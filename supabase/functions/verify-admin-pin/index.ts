// verify-admin-pin — server-side PIN login for the FAWN admin.
// Deployed with verify_jwt=false: it does its OWN auth (PIN + rate limit) and
// must be publicly reachable as the login endpoint. The PIN hash lives only in
// the service-role-only admin_config table; it is never returned.
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

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

const SESSION_HOURS = 10;
// Per-IP limits are best-effort: the IP comes from x-forwarded-for, which a caller
// can spoof. The GLOBAL ceiling below is the real guarantee — it counts every failed
// attempt regardless of source, so rotating the header cannot reset it. This bounds an
// online brute force of the 4-digit keyspace to ~GLOBAL_DAY guesses/day.
const PERIP_15MIN = 5;
const PERIP_DAY = 20;
const GLOBAL_15MIN = 20;
const GLOBAL_DAY = 100;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(url, svc, { auth: { persistSession: false } });

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const ua = req.headers.get("user-agent") ?? "";
  const ipHash = await sha256Hex("ip:" + ip + ":fawn-admin");
  const uaHash = await sha256Hex("ua:" + ua + ":fawn-admin");

  // ----- rate limit: per-IP (best-effort) + an unbypassable global ceiling -----
  const now = Date.now();
  const since15 = new Date(now - 15 * 60_000).toISOString();
  const since24 = new Date(now - 24 * 3600_000).toISOString();
  const fails = () => db.from("admin_login_attempts").select("*", { count: "exact", head: true }).eq("success", false);
  const [ip15, ipDay, all15, allDay] = await Promise.all([
    fails().eq("ip_hash", ipHash).gte("created_at", since15),
    fails().eq("ip_hash", ipHash).gte("created_at", since24),
    fails().gte("created_at", since15),
    fails().gte("created_at", since24),
  ]);
  const limited =
    (ip15.count ?? 0) >= PERIP_15MIN || (ipDay.count ?? 0) >= PERIP_DAY ||
    (all15.count ?? 0) >= GLOBAL_15MIN || (allDay.count ?? 0) >= GLOBAL_DAY;
  if (limited) return json({ error: "Too many attempts. Try again later." }, 429);

  // ----- input -----
  let pin = "";
  try { pin = String((await req.json())?.pin ?? ""); } catch { /* ignore */ }
  const logFail = () => db.from("admin_login_attempts").insert({ ip_hash: ipHash, ua_hash: uaHash, success: false });

  if (!/^\d{4}$/.test(pin)) { await logFail(); return json({ error: "Invalid PIN" }, 401); }

  // ----- compare against stored PBKDF2 hash -----
  const { data: cfg } = await db.from("admin_config").select("pin_hash").eq("id", 1).single();
  const stored = cfg?.pin_hash ?? "";
  const parts = stored.split("$"); // pbkdf2$iter$salt$hash
  let ok = false;
  if (parts.length === 4 && parts[0] === "pbkdf2") {
    const calc = await pbkdf2Hex(pin, parts[2], parseInt(parts[1], 10));
    ok = ctEqual(calc, parts[3]);
  }
  if (!ok) { await logFail(); return json({ error: "Invalid PIN" }, 401); }

  // ----- success: mint session -----
  const tokenBytes = new Uint8Array(32); crypto.getRandomValues(tokenBytes);
  const token = hex(tokenBytes);
  const tokenHash = await sha256Hex(token);
  const expiresAt = new Date(now + SESSION_HOURS * 3600_000).toISOString();
  await db.from("admin_sessions").insert({ token_hash: tokenHash, expires_at: expiresAt, ip_hash: ipHash, ua_hash: uaHash });
  await db.from("admin_login_attempts").insert({ ip_hash: ipHash, ua_hash: uaHash, success: true });
  // opportunistic cleanup of expired sessions
  db.from("admin_sessions").delete().lt("expires_at", new Date(now).toISOString()).then(() => {}, () => {});

  return json({ token, expires_at: expiresAt });
});
