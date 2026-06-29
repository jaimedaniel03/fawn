# FAWN — Launch Checklist & Operator Guide

Everything Jessica (and the developer) needs to run the shop. Live shop:
`https://jaimedaniel03.github.io/fawn/` · Dashboard: `https://jaimedaniel03.github.io/fawn/admin.html`

---

## 1. How Jessica logs in (PIN)

1. Open **`/admin.html`**.
2. Enter the **4-digit PIN** (shared with you privately — it is *not* written anywhere in the code).
3. Tap **Unlock Dashboard**.

- The PIN is checked **on the server** (Supabase Edge Function `verify-admin-pin`). It is never stored in the page.
- A successful unlock starts a **session that lasts ~10 hours**, kept in `sessionStorage` (it clears when you close the tab).
- Tap **lock 🔒** any time to sign out. The dashboard auto-locks when the session expires.
- Too many wrong tries are blocked: **5 / 15 min** and **20 / day** → "Too many attempts. Try again later."

## 2. How to change the PIN

**Easiest — from the dashboard:** unlock, scroll to **Settings → "change your PIN"**, enter your **current** PIN and the **new** 4 digits, **update PIN**. (Requiring the current PIN means a stolen session can't silently change it.) All other devices are signed out immediately.

**Or from a terminal (developer):**
```bash
node scripts/hash-admin-pin.mjs 1234     # your 4 digits
```
It prints a salted hash + the one line of SQL to run in **Supabase → SQL Editor**. The PIN and hash are **never committed** — only the hash lives in the private `admin_config` table.

## 3. How to add / edit products

In the dashboard **"add an item"** panel:
- Title, size, condition, **brand**, **category**, price, usual resale, tag, **photo**, note.
- **buy-now link** — paste a Stripe **Payment Link** to show a "buy now ↗" button on that card.
- **mark as sold** — greys it out (stays visible as social proof; no buy button).
- **hide (draft)** — keeps it **out of the public shop** until you're ready.
- Each item row has **edit / mark sold / delete**. Delete also removes the stored photo.

Photos upload through the server (service role) and items go live instantly.

## 4. How to add Stripe Payment Links (works today, no setup)

1. In Stripe → **Payment Links**, create a link for the item's price.
2. Paste it into the item's **buy-now link** field.
3. The card shows **buy now ↗**. This is the live payment path right now.

## 5. Connect full Stripe Checkout later (optional upgrade)

Code is already deployed and **safely disabled** until keys exist (`create-checkout-session` + `stripe-webhook`). To turn on:

1. Set Edge Function secrets (Supabase → Project → Edge Functions → Secrets):
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `SITE_URL=https://jaimedaniel03.github.io/fawn`
2. In Stripe → Webhooks, add endpoint
   `https://zutihcvdczoumrydrdmw.supabase.co/functions/v1/stripe-webhook`, event `checkout.session.completed`.

Prices/availability are validated **server-side** (the browser price is ignored); hidden/draft/sold items can't be bought. Until keys are added, the dashboard shows *"Full Stripe Checkout not connected yet."* and Payment Links keep working.

## 6. Connect order emails later (Resend)

Code is deployed and **safely disabled** (`on-new-order`). Orders **always save** even with no email key. To turn on:

1. Get a [Resend](https://resend.com) API key (verify a sending domain).
2. Set Edge Function secrets:
   - `RESEND_API_KEY`
   - `ORDER_NOTIFY_TO=jessicapotterrr@gmail.com`
   - `ORDER_NOTIFY_FROM="FAWN <orders@yourdomain.com>"`

Each new order then emails Jessica (buyer, items, total, dashboard link), once per order.

## 7. How backups work

- **Keep-alive:** GitHub Action pings the DB every 3 days so the free Supabase project never pauses.
- **Weekly catalog backup:** GitHub Action exports the product catalog as a JSON artifact (90-day retention).
- **Full DB dump (optional):** add the `SUPABASE_DB_URL` GitHub secret to also store a `pg_dump` of the `public` schema.

## 8. Secrets required (where they live)

**Nothing sensitive is ever committed to GitHub.**

| Secret | Where | Needed for |
|---|---|---|
| Admin PIN hash | `admin_config` table (private, service-role only) | PIN login (already set) |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-injected into Edge Functions by Supabase | Server-side admin reads/writes |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SITE_URL` | Edge Function secrets | Full Stripe Checkout (optional) |
| `RESEND_API_KEY`, `ORDER_NOTIFY_TO/FROM` | Edge Function secrets | Order emails (optional) |
| `SUPABASE_URL`, `SUPABASE_ANON` | GitHub Actions secrets | Keep-alive / backup jobs |
| `SUPABASE_DB_URL` | GitHub Actions secret | Full DB dump (optional) |

The browser only ever holds the **public** Supabase publishable key and a short-lived **session token** — never the service role key, never the PIN, never the hash.

---

## Security model (how the PIN stays safe on a static site)

GitHub Pages can't keep a secret, so **all real protection lives in Supabase Edge Functions + RLS**:

- **PIN** → verified by `verify-admin-pin` against a salted **PBKDF2** hash in a service-role-only table; the function returns only a random **session token** (its SHA-256 hash is what's stored). Rate-limited + audit-logged in `admin_login_attempts`.
- **All private data** (orders, signups, every product incl. drafts) is read/written **only** through `admin-api`, which requires a valid, unexpired session token and uses the service role **server-side**.
- **RLS** keeps the public anon key from reading orders/signups at all, and from seeing **hidden/draft** products (`hidden = false` only). Buyers can submit orders and signups but can't read anyone else's.

**Edge Functions:** `verify-admin-pin`, `admin-api`, `create-checkout-session`, `stripe-webhook`, `on-new-order`.

## Tests

`npm test` → all green. Covers pricing/order/timeline/security/payment-rules/dialog/nav + product-visibility mapping and buy-now eligibility. Server-only paths (PIN verify, rate limit, session gate, hidden-from-public) are verified directly against the deployed functions (see the project notes).
