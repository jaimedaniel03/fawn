// admin-api — all private admin reads/writes, gated by a valid PIN session token.
// verify_jwt=false because auth is the session token (checked below) + service role.
// The browser never gets the service role key or direct access to orders/signups.
import { createClient } from "npm:@supabase/supabase-js@2";

const BUCKET = "item-photos";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
const hexToBytes = (h: string) => new Uint8Array((h.match(/.{1,2}/g) ?? []).map((p) => parseInt(p, 16)));
async function sha256Hex(s: string) {
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))));
}
async function pbkdf2Hex(pin: string, saltHex: string, iter: number) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: hexToBytes(saltHex), iterations: iter, hash: "SHA-256" }, key, 256);
  return hex(new Uint8Array(bits));
}
function ctEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  let body: any = {};
  try { body = await req.json(); } catch { /* ignore */ }
  const { action, token } = body;

  // ----- session gate (every action) -----
  if (!token || typeof token !== "string") return json({ error: "Unauthorized" }, 401);
  const tokenHash = await sha256Hex(token);
  const { data: sess } = await db.from("admin_sessions")
    .select("id, expires_at").eq("token_hash", tokenHash).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (!sess) return json({ error: "Session expired" }, 401);

  try {
    switch (action) {
      case "session":
        return json({ valid: true, expires_at: sess.expires_at });

      case "logout":
        await db.from("admin_sessions").delete().eq("id", sess.id);
        return json({ ok: true });

      case "list_orders": {
        const { data, error } = await db.from("orders").select("*").order("created_at", { ascending: false });
        if (error) throw error;
        return json({ orders: data });
      }
      case "list_signups": {
        const { data, error } = await db.from("signups").select("*").order("created_at", { ascending: false });
        if (error) throw error;
        return json({ signups: data });
      }
      case "list_products": {
        const { data, error } = await db.from("products").select("*")
          .order("sold", { ascending: true }).order("sort", { ascending: true }).order("created_at", { ascending: false });
        if (error) throw error;
        return json({ products: data });
      }

      case "create_product":
      case "update_product": {
        const p = body.product ?? {};
        const row: Record<string, unknown> = {
          title: String(p.title ?? "").trim(),
          blurb: String(p.blurb ?? "").trim(),
          brand: String(p.brand ?? "").trim(),
          category: String(p.category ?? "").trim(),
          size: String(p.size ?? "").trim(),
          condition: String(p.condition ?? "").trim(),
          description: String(p.description ?? "").trim(),
          price: Number(p.price) || 0,
          resale: Number(p.resale) || 0,
          flag: String(p.flag ?? "").trim(),
          sold: Boolean(p.sold),
          hidden: Boolean(p.hidden),
          pay_link: String(p.pay_link ?? "").trim(),
        };
        if (body.image_b64) {
          const bytes = Uint8Array.from(atob(body.image_b64), (c) => c.charCodeAt(0));
          const path = `items/${crypto.randomUUID()}.jpg`;
          const up = await db.storage.from(BUCKET).upload(path, bytes, { contentType: body.image_type || "image/jpeg" });
          if (up.error) throw up.error;
          row.image_url = db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
        }
        if (action === "create_product") {
          const { data, error } = await db.from("products").insert(row).select("id").single();
          if (error) throw error;
          return json({ ok: true, id: data.id });
        } else {
          if (!body.id) return json({ error: "Missing id" }, 400);
          if (!body.image_b64) delete row.image_url; // keep existing photo if none uploaded
          const { error } = await db.from("products").update(row).eq("id", body.id);
          if (error) throw error;
          return json({ ok: true });
        }
      }

      case "delete_product": {
        if (!body.id) return json({ error: "Missing id" }, 400);
        const { data: prod } = await db.from("products").select("image_url").eq("id", body.id).maybeSingle();
        const imgUrl = prod?.image_url ?? "";
        const marker = `/${BUCKET}/`;
        const at = imgUrl.indexOf(marker);
        if (at !== -1) { try { await db.storage.from(BUCKET).remove([imgUrl.slice(at + marker.length)]); } catch { /* ignore */ } }
        const { error } = await db.from("products").delete().eq("id", body.id);
        if (error) throw error;
        return json({ ok: true });
      }

      case "mark_order": {
        if (!body.id) return json({ error: "Missing id" }, 400);
        const status = body.status === "done" ? "done" : "new";
        const { error } = await db.from("orders").update({ status }).eq("id", body.id);
        if (error) throw error;
        return json({ ok: true });
      }

      case "change_pin": {
        const newPin = String(body.new_pin ?? "");
        const curPin = String(body.current_pin ?? "");
        if (!/^\d{4}$/.test(newPin)) return json({ error: "New PIN must be 4 digits" }, 400);
        // Re-authenticate with the CURRENT pin (defense-in-depth: a leaked session
        // token alone cannot silently change the PIN and lock Jessica out).
        const { data: cfg } = await db.from("admin_config").select("pin_hash").eq("id", 1).single();
        const parts = (cfg?.pin_hash ?? "").split("$");
        let curOk = false;
        if (parts.length === 4 && parts[0] === "pbkdf2") {
          curOk = ctEqual(await pbkdf2Hex(curPin, parts[2], parseInt(parts[1], 10)), parts[3]);
        }
        if (!curOk) return json({ error: "Current PIN is incorrect" }, 401);
        const salt = new Uint8Array(16); crypto.getRandomValues(salt);
        const value = `pbkdf2$100000$${hex(salt)}$${await pbkdf2Hex(newPin, hex(salt), 100000)}`;
        const { error } = await db.from("admin_config").update({ pin_hash: value, updated_at: new Date().toISOString() }).eq("id", 1);
        if (error) throw error;
        await db.from("admin_sessions").delete().neq("id", sess.id); // sign out other devices
        return json({ ok: true });
      }

      default:
        return json({ error: "Unknown action" }, 400);
    }
  } catch (e) {
    return json({ error: (e as Error).message || "Server error" }, 500);
  }
});
