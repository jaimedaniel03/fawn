// stripe-webhook — DISABLED-SAFE. Returns {configured:false} until STRIPE_WEBHOOK_SECRET
// is set. When set, it verifies the Stripe signature, then on checkout.session.completed
// marks the matching pending order paid and the product sold (and emails if Resend is on).
import { createClient } from "npm:@supabase/supabase-js@2";

async function verifyStripeSig(payload: string, header: string, secret: string) {
  const parts: Record<string, string> = {};
  header.split(",").forEach((kv) => { const [k, v] = kv.split("="); parts[k] = v; });
  if (!parts.t || !parts.v1) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${parts.t}.${payload}`));
  const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (expected.length !== parts.v1.length) return false;
  let r = 0; for (let i = 0; i < expected.length; i++) r |= expected.charCodeAt(i) ^ parts.v1.charCodeAt(i);
  return r === 0;
}

Deno.serve(async (req) => {
  const SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!SECRET) return new Response(JSON.stringify({ configured: false }), { status: 200, headers: { "Content-Type": "application/json" } });

  const sig = req.headers.get("stripe-signature") || "";
  const raw = await req.text();
  if (!(await verifyStripeSig(raw, sig, SECRET))) return new Response("bad signature", { status: 400 });

  const event = JSON.parse(raw);
  if (event.type === "checkout.session.completed") {
    const s = event.data.object;
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const productId = s.metadata?.product_id;
    if (productId) await db.from("products").update({ sold: true }).eq("id", productId);
    await db.from("orders").update({ status: "paid" }).eq("code", `STRIPE-${String(s.id).slice(-6)}`);
  }
  return new Response(JSON.stringify({ received: true }), { status: 200, headers: { "Content-Type": "application/json" } });
});
