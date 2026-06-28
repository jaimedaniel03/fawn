// create-checkout-session — DISABLED-SAFE Stripe Checkout. If STRIPE_SECRET_KEY is
// not set it returns {configured:false} and the storefront keeps using per-item
// Payment Links. When set: price/availability are validated SERVER-SIDE (never trust
// the browser), a pending order is created, and a Stripe Checkout Session is returned.
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const STRIPE = Deno.env.get("STRIPE_SECRET_KEY");
  const SITE = Deno.env.get("SITE_URL") || "https://jaimedaniel03.github.io/fawn";
  if (!STRIPE) return json({ configured: false, message: "Full Stripe Checkout not connected yet." });

  let productId = "";
  try { productId = String((await req.json())?.product_id ?? ""); } catch { /* ignore */ }
  if (!productId) return json({ error: "missing product_id" }, 400);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: p } = await db.from("products").select("*").eq("id", productId).maybeSingle();
  if (!p) return json({ error: "not found" }, 404);
  if (p.hidden || p.sold) return json({ error: "This item isn't available." }, 409);

  const amount = Math.round(Number(p.price) * 100); // server-side price; browser value ignored
  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("success_url", `${SITE}/?paid=1`);
  params.set("cancel_url", `${SITE}/`);
  params.set("line_items[0][quantity]", "1");
  params.set("line_items[0][price_data][currency]", "usd");
  params.set("line_items[0][price_data][unit_amount]", String(amount));
  params.set("line_items[0][price_data][product_data][name]", String(p.title || "FAWN item"));
  params.set("metadata[product_id]", String(p.id));

  const sres = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${STRIPE}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  const session = await sres.json();
  if (!sres.ok) return json({ error: session?.error?.message || "stripe error" }, 502);

  await db.from("orders").insert({
    code: `STRIPE-${String(session.id).slice(-6)}`,
    items: [{ id: p.id, title: p.title, price: Number(p.price) }],
    total: Number(p.price), payment: "stripe", delivery: "ship", status: "pending_payment",
  });

  return json({ url: session.url });
});
