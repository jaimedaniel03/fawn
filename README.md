# FAWN — vintage & thrifted tops storefront

A self-contained, no-build storefront. Open `index.html` in a browser and it works.
Light-pink "fawn" aesthetic, product grid, cart, checkout with honest payment
instructions, a real **order-tracking timeline**, and full **Terms / Shipping /
Returns / Privacy** pages.

## Files
- `index.html` — the shop (hero, products, fair-price pledge, how-it-works, tracking, email capture)
- `styles.css` — all styling (light-pink palette)
- `app.js` — products, cart, checkout, order codes, tracking timeline, seller tools
- `terms.html` — Terms of Service, payment & buyer protection, shipping, returns, delivery promise, privacy
- `README.md` — this file

## Fulfillment model: meet up or $6 local shipping
At checkout the buyer picks **how they want it**:
- **Meet up — local pickup (free):** you message them to set a time and a *safe public place*. They can pay in person (Apple Cash or PayPal) or pay ahead by PayPal G&S. Timeline: received → packed → ready for pickup → picked up.
- **Local shipping (flat $6):** packed & shipped within 2 business days with tracking. **Must** be paid by PayPal Goods & Services (Apple Cash is disabled for shipped orders — see security note). Timeline: received → packed → shipped → out for delivery → delivered.

The checkout enforces this: choosing shipping shows the address field, recalculates the total to +$6, and locks out Apple Cash so a mailed order can't be paid with an unprotected transfer.

## Security — what's real, and what "firewall" can't do here
Straight talk, because this matters: **a firewall is the wrong tool for a static site, and nothing is "unhackable."** A firewall/WAF guards a *server you run*. This site has no server holding customer data — so there's no database to breach. That's the strongest protection of all: the data mostly isn't anywhere to steal. Here's what actually protects your buyers' info, all implemented:

- **No central customer database.** Orders live in the buyer's *own* browser (localStorage) and, if you enable it, go *only* to your order endpoint (Formspree) over HTTPS. You never run a server that pools everyone's names/addresses for an attacker to take.
- **PayPal/Apple handle all payment data.** Card and bank details never touch this site — so they can't leak from it.
- **XSS-safe rendering.** Every piece of user-typed text is HTML-escaped before it's shown (`esc()` in app.js). A buyer can't inject a script through the order-tracking box or any field.
- **Content-Security-Policy** (in each page's `<head>` + the header files): scripts may load only from this site (`script-src 'self'`), which blocks injected/third-party scripts — the main XSS vector.
- **Security headers** in `_headers` (Netlify/Cloudflare Pages) and `vercel.json` (Vercel): `X-Frame-Options: DENY` + `frame-ancestors 'none'` (no clickjacking), `Strict-Transport-Security` (force HTTPS), `X-Content-Type-Options: nosniff`, a locked-down `Permissions-Policy`, and `Referrer-Policy`.
- **HTTPS everywhere** — automatic on Netlify/Vercel/Cloudflare Pages. Always use the https:// URL.

**When a firewall/WAF *does* matter:** the day you add a real backend (a server + database to store orders across devices), that server needs auth, input validation, rate limiting, and yes — a WAF in front. Until then, the safest design is the one you have: don't collect what you don't need, and don't run a honeypot of customer data. If you enable Formspree, your buyers' info is then stored by Formspree under their security/privacy terms.

> Want to verify the production headers? After deploying, run the URL through [securityheaders.com](https://securityheaders.com) and [Mozilla Observatory](https://observatory.mozilla.org).

## Two things that were corrected from the original brief (and why it matters)

1. **Apple Cash can't be a website checkout.** Apple Cash only works person-to-person
   inside Messages/Wallet — there is no web checkout API, and it offers **no buyer
   protection**. So in the site it's offered **only for local, in-person pickup**, with
   a clear warning. Don't use it for mailed orders.
2. **"Make sure the buyer gets their product" = protected payment, not magic.** A page
   can't force delivery. What actually guarantees it is **PayPal Goods & Services**: if
   you never ship, the buyer opens a PayPal dispute and gets refunded. That's why the
   site pushes PayPal G&S as the recommended, default method — it's the real safety net
   for both of you. Paying PayPal *Friends & Family* removes that protection, so the
   site tells buyers explicitly to choose Goods & Services.

## How to edit your products
Open `app.js` and edit the `PRODUCTS` array. For each piece:
- `img` — paste a real photo URL (leave blank to show a colored placeholder). **Good photos are the single biggest driver of sales.**
- `price` / `resale` — your price and the honest typical-resale price (the fair-price pledge shows both)
- `sold` — set `true` to mark sold
- `depop` — optional: your Depop listing URL adds a "View on Depop" link

## How orders & fulfillment work
1. Buyer checks out → picks meet-up or $6 shipping → gets an order code like `FAWN-7K3Q` and clear payment instructions.
2. Buyer pays. For shipping, that's **PayPal Goods & Services** to `jessicapotterrr@gmail.com` (order code in the note). For meet-up, Apple Cash to `669-264-4830` in person, or PayPal.
3. You update the order so the buyer's tracking timeline moves. From your browser console on the site:
   ```js
   fawnAdmin.list()                              // see all orders (and their delivery type)

   // shipping orders:
   fawnAdmin.ship('FAWN-7K3Q','USPS','9400111899...','https://tools.usps.com/go/TrackConfirmAction?tLabels=9400111899...')
   fawnAdmin.advance('FAWN-7K3Q')                // → out for delivery → delivered

   // meet-up orders (ship() is refused — use advance):
   fawnAdmin.advance('FAWN-7K3Q')                // received → packed → ready for pickup → picked up

   fawnAdmin.set('FAWN-7K3Q','delivered')        // jump straight to any stage valid for that order
   ```
   The buyer sees the right timeline for their order — shipping (received → packed → shipped → out for delivery → delivered) or pickup (received → packed → ready for pickup → picked up).

### Get every order emailed to you (recommended)
Orders are saved in the browser by default. To also receive each one by email:
1. Make a free form at [formspree.io](https://formspree.io) (or similar) → get a URL like `https://formspree.io/f/abcmyform`.
2. In `app.js`, set `const ORDER_ENDPOINT = 'https://formspree.io/f/abcmyform';`
3. Now every checkout emails you the buyer's name, address, items, and order code.

> Note: localStorage tracking is per-browser — fine for launching and for buyers who
> track from the same device. For a shared, always-accurate order database across
> devices, move orders to a tiny backend (Formspree + a sheet, Airtable, Supabase, or
> Shopify). The front end is already structured so this is a drop-in upgrade.

## Email drop-list capture
In `index.html`, set the email form's `action="YOUR_EMAIL_ENDPOINT"` to a
Formspree/Klaviyo/Beehiiv endpoint to collect signups. Until then it just shows a
thank-you message.

## Optional: Meta Pixel (for ads)
In `index.html` `<head>` there's a commented Meta Pixel block. Add your Pixel ID and
uncomment it to track `PageView`, `AddToCart`, `Purchase`, and `Lead` for ad
optimization.

## Deploying
It's static — drag the folder onto **Netlify Drop**, **Vercel**, or **Cloudflare Pages**.
No server required, and all of them give you free HTTPS.

Prefer **Netlify / Cloudflare Pages** (they read `_headers`) or **Vercel** (reads
`vercel.json`) so the full set of security headers is applied automatically.
GitHub Pages also works but ignores those files, so you'd only get the in-page
`<meta>` CSP, not the HTTP-only headers (HSTS, X-Frame-Options).

## Swapping the brand / colors
- Brand name: search `fawn` / `FAWN` in `index.html`, `terms.html`, `app.js`.
- Colors: edit the CSS variables at the top of `styles.css` (the `--pink-*`, `--rose`, `--fawn` values).
