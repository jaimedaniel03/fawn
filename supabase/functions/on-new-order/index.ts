// on-new-order — emails Jessica about a new order. DISABLED-SAFE: if RESEND_API_KEY
// is not set it simply does nothing (orders still save; nothing fails). Idempotent
// via the orders.notified flag. Called fire-and-forget by the storefront with {code}.
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
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  let code = "";
  try { code = String((await req.json())?.code ?? ""); } catch { /* ignore */ }
  if (!code) return json({ ok: true, sent: false });

  const { data: o } = await db.from("orders").select("*").eq("code", code)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!o || o.notified) return json({ ok: true, sent: false });

  const RESEND = Deno.env.get("RESEND_API_KEY");
  const TO = Deno.env.get("ORDER_NOTIFY_TO") || "jessicapotterrr@gmail.com";
  const FROM = Deno.env.get("ORDER_NOTIFY_FROM") || "FAWN <onboarding@resend.dev>";
  if (!RESEND) return json({ ok: true, sent: false, configured: false }); // not connected yet

  // Atomically CLAIM this order before sending, so two concurrent calls (double-submit,
  // retry) can't both email. Only the call that actually flips notified=false→true sends.
  const claim = await db.from("orders").update({ notified: true }).eq("id", o.id).eq("notified", false).select("id");
  if (!claim.data || claim.data.length === 0) return json({ ok: true, sent: false }); // already claimed

  const items = Array.isArray(o.items) ? o.items.map((i: any) => i.title || i.t || "item").join(", ") : "";
  const ship = o.delivery === "ship" ? `Ship to: ${o.address || ""}` : "Local pickup";
  const html = `
    <h2>New FAWN order — ${o.code}</h2>
    <p><b>${o.name || ""}</b> · ${o.email || ""}</p>
    <p>${items}</p>
    <p>${ship}<br/>Total: <b>$${Math.round(o.total || 0)}</b> · pay via ${o.payment || "?"}</p>
    <p><a href="https://jaimedaniel03.github.io/fawn/admin.html">Open your dashboard →</a></p>`;

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [TO], subject: `New order ${o.code} · $${Math.round(o.total || 0)}`, html }),
  });
  if (r.ok) return json({ ok: true, sent: true });
  await db.from("orders").update({ notified: false }).eq("id", o.id); // release claim so a retry can re-send
  return json({ ok: true, sent: false, error: await r.text() });
});
