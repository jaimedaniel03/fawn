#!/usr/bin/env node
/* Hash an admin PIN for FAWN. The PIN is NEVER stored or committed — only this
 * salted PBKDF2 hash, which lives in the service-role-only `admin_config` table.
 *
 *   node scripts/hash-admin-pin.mjs 1234     # use your own 4 digits, not this example
 *
 * It prints the hash and the exact SQL to set it. Run that SQL in the Supabase
 * SQL editor (or use the dashboard's "Change PIN" once logged in). Do NOT commit
 * the printed value or the PIN. These PBKDF2 params MUST match verify-admin-pin.
 */
import { pbkdf2Sync, randomBytes } from "node:crypto";

const ITER = 100000;
const KEYLEN = 32;
const DIGEST = "sha256";

const pin = process.argv[2];
if (!/^\d{4}$/.test(pin || "")) {
  console.error("Usage: node scripts/hash-admin-pin.mjs <4-digit-pin>");
  process.exit(1);
}

const salt = randomBytes(16);
const hash = pbkdf2Sync(pin, salt, ITER, KEYLEN, DIGEST);
const value = `pbkdf2$${ITER}$${salt.toString("hex")}$${hash.toString("hex")}`;

console.log("\nPIN hash (store server-side only — do NOT commit, do NOT share):\n");
console.log("  " + value + "\n");
console.log("Set it by running this in Supabase → SQL Editor:\n");
console.log(`  update public.admin_config set pin_hash = '${value}', updated_at = now() where id = 1;\n`);
