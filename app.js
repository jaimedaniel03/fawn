/* ============================================================
   FAWN store logic — no framework, no build step.
   Works by opening index.html. Orders + tracking persist in
   the browser via localStorage. See README for going live.
   ============================================================ */

/* ----- 1. PRODUCTS -------------------------------------------------
   Edit this array. For each piece add real photo URLs (img) and, if
   you also list on Depop, drop the listing URL in `depop` to add a
   "View on Depop" link. `resale` is the honest typical-resale number
   shown next to your price (the fair-price pledge).
------------------------------------------------------------------- */
const PRODUCTS = [
  { id:'t01', title:'Broken-in baby tee', meta:'cropped · S · buttery cotton', price:24, resale:34, sold:false, flag:'one of one', img:'', tone:['#f3bcc7','#e89fae'], depop:'' },
  { id:'t02', title:'Ribbed coquette tank', meta:'fitted · M · second-skin rib', price:19, resale:28, sold:false, flag:'just in', img:'', tone:['#f6e3d6','#d8c3ad'], depop:'' },
  { id:'t03', title:'Washed waffle henley', meta:'relaxed · L · waffle knit', price:28, resale:42, sold:false, flag:'one of one', img:'', tone:['#e89fae','#d27e90'], depop:'' },
  { id:'t04', title:'Lace-trim slip cami', meta:'true vintage · S · lace trim', price:32, resale:55, sold:false, flag:'rare', img:'', tone:['#fde2e8','#f3bcc7'], depop:'' },
  { id:'t05', title:'Slouchy blush cardi', meta:'oversized · M/L · merino blend', price:38, resale:60, sold:true, flag:'one of one', img:'', tone:['#f9d9df','#e89fae'], depop:'' },
  { id:'t06', title:'Sun-faded band tee', meta:'boxy · M · 100% cotton', price:26, resale:40, sold:false, flag:'one of one', img:'', tone:['#d8c3ad','#b89a7c'], depop:'' },
  { id:'t07', title:'Pointelle baby top', meta:'fitted · S · stretch pointelle', price:22, resale:33, sold:false, flag:'just in', img:'', tone:['#fdeef0','#f3bcc7'], depop:'' },
  { id:'t08', title:'Silky shell cami', meta:'sleeveless · M · slip-silky', price:21, resale:30, sold:false, flag:'one of one', img:'', tone:['#f3bcc7','#d27e90'], depop:'' },
];

/* ----- 2. SELLER / PAYMENT DETAILS -------------------------------- */
const SELLER = {
  brand: 'FAWN',
  paypalEmail: 'jessicapotterrr@gmail.com',
  appleCashPhone: '669-264-4830',
  contactEmail: 'jessicapotterrr@gmail.com',
  localShip: 6,        // flat local shipping; in-person pickup is free
};

/* ----- 3. STATE --------------------------------------------------- */
const LS_CART = 'fawn_cart';
const LS_ORDERS = 'fawn_orders';
let cart = loadJSON(LS_CART, []);

const $ = sel => document.querySelector(sel);
const fmt = n => '$' + Number(n).toFixed(Number.isInteger(n) ? 0 : 2);

/* Escape any user-supplied text before it touches innerHTML. This is the
   real defense against XSS — never inject raw user input into the page. */
function esc(str){
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

function loadJSON(key, fallback){ try{ return JSON.parse(localStorage.getItem(key)) ?? fallback; }catch(e){ return fallback; } }
function saveJSON(key, val){ localStorage.setItem(key, JSON.stringify(val)); }

/* ----- 4. RENDER PRODUCTS ----------------------------------------- */
function placeholder(p){
  return `<div class="card-ph" style="background:linear-gradient(150deg,${p.tone[0]},${p.tone[1]})">${SELLER.brand}</div>`;
}
function productMedia(p){
  return p.img ? `<img src="${p.img}" alt="${p.title}" loading="lazy" />` : placeholder(p);
}
function renderProducts(){
  $('#productGrid').innerHTML = PRODUCTS.map(p => {
    const inCart = cart.includes(p.id);
    const save = p.resale - p.price;
    return `
    <article class="card">
      <div class="card-img">
        ${productMedia(p)}
        ${p.flag && !p.sold ? `<span class="card-flag">${p.flag}</span>` : ''}
        ${p.sold ? `<div class="card-sold">sold</div>` : ''}
      </div>
      <div class="card-body">
        <span class="card-title">${p.title}</span>
        <span class="card-meta">${p.meta}</span>
        <div class="card-price">
          <b>${fmt(p.price)}</b>
          <s>${fmt(p.resale)}</s>
          ${save>0?`<span class="save">save ${fmt(save)}</span>`:''}
        </div>
        ${p.sold
          ? `<button class="btn btn-ghost" disabled>Sold — one of one</button>`
          : inCart
            ? `<button class="btn btn-ghost" data-remove="${p.id}">In bag ✓ — remove</button>`
            : `<button class="btn btn-primary" data-add="${p.id}">Add to bag</button>`}
        ${p.payLink && !p.sold ? `<a class="btn btn-ghost card-buy" href="${esc(p.payLink)}" target="_blank" rel="noopener">buy now ↗</a>` : ''}
        ${p.depop && !p.sold ? `<a class="card-meta" href="${p.depop}" target="_blank" rel="noopener" data-depop style="text-align:center;text-decoration:underline;color:var(--rose-deep)">View on Depop ↗</a>` : ''}
      </div>
    </article>`;
  }).join('');
}

/* ----- 5. CART ---------------------------------------------------- */
function cartProducts(){ return cart.map(id => PRODUCTS.find(p => p.id === id)).filter(Boolean); }
function subtotal(){ return cartProducts().reduce((s,p)=>s+p.price,0); }
// fulfillment: 'pickup' (meet in person, free) or 'ship' ($6 local shipping)
function deliveryFee(method){ return method === 'ship' ? SELLER.localShip : 0; }
function total(method){ return subtotal() + deliveryFee(method); }

function addToCart(id){
  const p = PRODUCTS.find(x=>x.id===id);
  if(!p || p.sold || cart.includes(id)) return;
  cart.push(id); persistCart(); openCart();
  if(window.fbq) fbq('track','AddToCart',{content_ids:[id],value:p.price,currency:'USD'});
}
function removeFromCart(id){ cart = cart.filter(x=>x!==id); persistCart(); }
function persistCart(){ saveJSON(LS_CART, cart); renderProducts(); renderCart(); }

function renderCart(){
  const items = cartProducts();
  $('#cartCount').textContent = items.length;
  $('#cartCount').style.display = items.length ? 'grid' : 'none';
  $('#cartTotal').textContent = fmt(subtotal());
  $('#checkoutBtn').disabled = items.length === 0;
  $('#cartItems').innerHTML = items.length === 0
    ? `<p class="drawer-empty">Your bag is empty.<br/>Every piece is one of one — grab it before it's gone.</p>`
    : items.map(p=>`
      <div class="line-item">
        <div class="line-thumb">${productMedia(p)}</div>
        <div class="line-info">
          <h4>${p.title}</h4>
          <span class="card-meta">${p.meta}</span>
          <div class="line-price">${fmt(p.price)}</div>
          <button class="line-remove" data-remove="${p.id}">Remove</button>
        </div>
      </div>`).join('');
}

/* Dialog accessibility: trap Tab within an open dialog, close on Escape,
   and restore focus to the trigger when it closes. */
let lastFocused = null;
const FOCUSABLE_SEL = 'a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';
function dialogFocusables(container){ return [...container.querySelectorAll(FOCUSABLE_SEL)].filter(el => el.offsetParent !== null); }
function openDialog(container, firstFocus){ lastFocused = document.activeElement; (firstFocus || container).focus(); }
function restoreDialogFocus(){
  const target = (lastFocused && lastFocused.offsetParent !== null) ? lastFocused : $('#cartBtn');
  if(target) target.focus();
  lastFocused = null;
}
function activeDialog(){
  if(!$('#checkoutModal').hidden) return $('#checkoutModal');
  if($('#cartDrawer').classList.contains('open')) return $('#cartDrawer');
  return null;
}
function onDialogKeydown(e){
  const dlg = activeDialog();
  if(!dlg) return;
  if(e.key === 'Escape'){
    e.preventDefault();
    if(dlg.id === 'checkoutModal') closeCheckout(); else closeCart();
    return;
  }
  if(e.key === 'Tab'){
    const items = dialogFocusables(dlg);
    if(!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
    else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
  }
}

function openCart(){
  $('#cartDrawer').classList.add('open');
  $('#cartDrawer').setAttribute('aria-hidden','false');
  $('#overlay').hidden=false;
  openDialog($('#cartDrawer'), $('#closeCart'));
}
function closeCart(){
  $('#cartDrawer').classList.remove('open');
  $('#cartDrawer').setAttribute('aria-hidden','true');
  $('#overlay').hidden=true;
  restoreDialogFocus();
}

/* ----- 6. ORDER CODES & TIMELINE ---------------------------------- */
const SHIP_STAGES = [
  { key:'received',        title:'Order received',     desc:'We got your order and are confirming payment.' },
  { key:'packed',          title:'Packed with care',   desc:'Your piece is cleaned, folded, and boxed.' },
  { key:'shipped',         title:'Shipped',            desc:'Handed to the carrier with a tracking number.' },
  { key:'out_for_delivery',title:'Out for delivery',   desc:'On the truck and headed your way today.' },
  { key:'delivered',       title:'Delivered',          desc:'Enjoy it — tag @fawn so we can see the fit!' },
];
const PICKUP_STAGES = [
  { key:'received',        title:'Order received',     desc:'We got your order and are confirming payment.' },
  { key:'packed',          title:'Packed with care',   desc:'Your piece is cleaned, folded, and ready.' },
  { key:'ready',           title:'Ready for pickup',   desc:'We’ll message you to set a time and place to meet up.' },
  { key:'pickedup',        title:'Picked up',          desc:'Met up and handed off — enjoy it! Tag @fawn so we can see the fit.' },
];
// the stage set depends on how the buyer chose to receive the item
function stagesFor(order){ return order && order.delivery === 'pickup' ? PICKUP_STAGES : SHIP_STAGES; }
const stageIndex = (order, key) => stagesFor(order).findIndex(s => s.key === key);

function makeOrderCode(){
  // Crockford-style alphabet (no easily-confused chars like 0/O, 1/I).
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const orders = loadJSON(LS_ORDERS, {});
  const rnd = () => chars[Math.floor(Math.random() * chars.length)];
  let code;
  do { code = 'FAWN-' + rnd() + rnd() + rnd() + rnd(); }
  while (orders[code]);   // ~1M combinations — regenerate on the rare collision
  return code;
}

function createOrder(form){
  const items = cartProducts();
  const now = new Date();
  const code = makeOrderCode();
  const delivery = form.elements.delivery.value;   // 'pickup' | 'ship'
  const order = {
    code,
    createdAt: now.toISOString(),
    name: form.elements.name.value.trim(),
    email: form.elements.email.value.trim(),
    address: delivery === 'ship' ? form.elements.address.value.trim() : '',
    delivery,                            // 'pickup' | 'ship'
    payment: form.elements.pay.value,    // 'paypal' | 'applecash'
    items: items.map(p=>({id:p.id,title:p.title,price:p.price})),
    subtotal: subtotal(),
    shipping: deliveryFee(delivery),
    total: total(delivery),
    status: 'received',
    history: { received: now.toISOString() },
    tracking: { carrier:'', number:'', url:'' },
  };
  const orders = loadJSON(LS_ORDERS, {});
  orders[code] = order;
  saveJSON(LS_ORDERS, orders);

  // mark the purchased pieces sold so the one-of-one promise holds
  order.items.forEach(it=>{ const p = PRODUCTS.find(x=>x.id===it.id); if(p) p.sold = true; });

  // empty the cart
  cart = []; persistCart();

  if(window.fbq) fbq('track','Purchase',{value:order.total,currency:'USD',content_ids:order.items.map(i=>i.id)});
  return order;
}

/* Estimated date for a future stage, based on order creation. */
function estimateDate(order, key){
  const base = new Date(order.createdAt);
  const offsets = {
    received:0, packed:1,
    // shipping flow
    shipped:2, out_for_delivery:5, delivered:6,
    // pickup flow
    ready:1, pickedup:3,
  };
  const d = new Date(base);
  d.setDate(d.getDate() + (offsets[key] ?? 0));
  return d;
}
const niceDate = d => d.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'});
const niceDateTime = iso => new Date(iso).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});

function renderTimeline(order){
  const stages = stagesFor(order);
  const curIdx = stageIndex(order, order.status);
  const rows = stages.map((s,i)=>{
    let cls = 'pending', when = `Est. ${niceDate(estimateDate(order,s.key))}`;
    if(i < curIdx){ cls = 'done'; if(order.history[s.key]) when = niceDateTime(order.history[s.key]); }
    else if(i === curIdx){ cls = 'current'; when = order.history[s.key] ? niceDateTime(order.history[s.key]) : 'In progress'; }
    const trackLink = (s.key==='shipped' && order.tracking.number)
      ? `<div class="tl-track-no">Tracking: <a href="${esc(order.tracking.url||'#')}" target="_blank" rel="noopener">${esc(order.tracking.carrier)} ${esc(order.tracking.number)}</a></div>` : '';
    return `<li class="${cls}">
      <span class="tl-dot"></span>
      <div class="tl-title">${s.title}</div>
      <div class="tl-when">${when}</div>
      <div class="card-meta">${s.desc}</div>
      ${trackLink}
    </li>`;
  }).join('');

  const itemList = order.items.map(i=>`${esc(i.title)} — ${fmt(i.price)}`).join('<br/>');
  const payLabel = order.payment === 'paypal' ? 'PayPal (Goods & Services)' : 'Apple Cash';
  const deliveryLabel = order.delivery === 'pickup' ? 'Local pickup' : '$6 local shipping';
  return `
    <div class="tl-head">
      <strong>${esc(order.code)}</strong>
      <span>Placed ${niceDateTime(order.createdAt)} · ${order.items.length} item(s) · ${fmt(order.total)} · ${deliveryLabel} · ${payLabel}</span>
      <span style="margin-top:.4rem">${itemList}</span>
    </div>
    <ul class="timeline">${rows}</ul>`;
}

function lookupOrder(code){
  const orders = loadJSON(LS_ORDERS, {});
  return orders[(code||'').trim().toUpperCase()] || null;
}

/* ----- 7. CHECKOUT FLOW ------------------------------------------- */
function openCheckout(){
  closeCart();
  $('#checkoutModal').hidden = false;
  $('#checkoutStep').innerHTML = checkoutFormHTML();
  bindCheckoutForm();
  openDialog($('#checkoutModal'), $('#closeCheckout'));
}
function closeCheckout(){
  $('#checkoutModal').hidden = true;
  restoreDialogFocus();
}

function checkoutFormHTML(){
  // Re-render fresh form (so it resets each open)
  return `
    <h3>Checkout</h3>
    <form id="checkoutForm" class="checkout-form">
      <div class="field"><label>Full name</label><input name="name" required /></div>
      <div class="field"><label>Email</label><input name="email" type="email" required /></div>

      <fieldset class="pay-choice">
        <legend>How do you want it?</legend>
        <label class="pay-opt">
          <input type="radio" name="delivery" value="pickup" checked />
          <span class="pay-main">Meet up — local pickup</span>
          <span class="pay-badge good">Free</span>
          <span class="pay-desc">We message you to arrange a time and safe public place to meet in person.</span>
        </label>
        <label class="pay-opt">
          <input type="radio" name="delivery" value="ship" />
          <span class="pay-main">Local shipping</span>
          <span class="pay-badge">+$6</span>
          <span class="pay-desc">We pack and ship it to you with tracking. Pay online first.</span>
        </label>
      </fieldset>

      <div class="field" id="addressField" hidden>
        <label>Shipping address</label>
        <textarea name="address" rows="3" placeholder="Street, city, state, ZIP"></textarea>
      </div>

      <fieldset class="pay-choice">
        <legend>How would you like to pay?</legend>
        <label class="pay-opt">
          <input type="radio" name="pay" value="paypal" checked />
          <span class="pay-main">PayPal <em>(Goods &amp; Services)</em></span>
          <span class="pay-badge good">Buyer protected ✓</span>
          <span class="pay-desc">Recommended. Covered by PayPal purchase protection if anything goes wrong.</span>
        </label>
        <label class="pay-opt" id="appleCashOpt">
          <input type="radio" name="pay" value="applecash" />
          <span class="pay-main">Apple Cash <em>(pickup only)</em></span>
          <span class="pay-badge warn">No buyer protection</span>
          <span class="pay-desc" id="appleCashDesc">Pay in person when we meet up. Person-to-person transfer with no refund protection, so it's only available with local pickup.</span>
        </label>
      </fieldset>

      <button class="btn btn-primary btn-block" type="submit">Reserve &amp; get details · <span id="coTotal">${fmt(total('pickup'))}</span></button>
      <p class="checkout-fine">By ordering you agree to our <a href="terms.html" target="_blank">Terms &amp; refund policy</a>. Each item is reserved for 30 minutes to complete payment.</p>
    </form>`;
}

function bindCheckoutForm(){
  const form = $('#checkoutForm');
  const addressField = $('#addressField');
  const addressInput = addressField.querySelector('textarea');
  const coTotal = $('#coTotal');
  const appleCashOpt = $('#appleCashOpt');
  const appleCashRadio = appleCashOpt.querySelector('input');
  const appleCashDesc = $('#appleCashDesc');
  const paypalRadio = form.querySelector('input[value="paypal"]');

  function syncDelivery(){
    const method = form.elements.delivery.value;
    const isShip = method === 'ship';
    // total
    coTotal.textContent = fmt(total(method));
    // address only for shipping
    addressField.hidden = !isShip;
    addressInput.required = isShip;
    // Apple Cash is pickup-only — disable it (and switch to PayPal) when shipping
    appleCashRadio.disabled = isShip;
    appleCashOpt.style.opacity = isShip ? '.5' : '1';
    appleCashOpt.style.pointerEvents = isShip ? 'none' : 'auto';
    appleCashDesc.textContent = isShip
      ? 'Unavailable for shipped orders — there’s no buyer protection on Apple Cash, so it’s only offered for in-person pickup.'
      : 'Pay in person when we meet up. Person-to-person transfer with no refund protection, so it’s only available with local pickup.';
    if(isShip && appleCashRadio.checked){ paypalRadio.checked = true; }
  }

  form.querySelectorAll('input[name="delivery"]').forEach(r => r.addEventListener('change', syncDelivery));
  syncDelivery();

  form.addEventListener('submit', e=>{
    e.preventDefault();
    const order = createOrder(form);
    sendOrderNotification(order); // best-effort email to seller (see config)
    saveOrderToCloud(order);      // record it in Jessica's dashboard (Supabase)
    $('#checkoutStep').innerHTML = confirmationHTML(order);
  });
}

/* Record the order in Supabase so it shows up in Jessica's dashboard.
   Guarded + fire-and-forget so it never blocks checkout (and is skipped in tests). */
function saveOrderToCloud(order){
  if(!window.fawnClient) return;
  window.fawnClient.from('orders').insert({
    code: order.code, name: order.name, email: order.email, address: order.address,
    delivery: order.delivery, payment: order.payment, items: order.items,
    subtotal: order.subtotal, shipping: order.shipping, total: order.total,
  }).then(() => notifyOrder(order.code), (e) => console.warn('order cloud-save failed:', e?.message));
}

// Fire-and-forget email ping. No-ops on the server until Resend is connected, so this
// never blocks or fails the customer's checkout.
function notifyOrder(code){
  const cfg = window.FAWN_SUPABASE;
  if(!cfg || !code) return;
  fetch(`${cfg.url}/functions/v1/on-new-order`, {
    method: 'POST', headers: { apikey: cfg.key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  }).then(() => {}, () => {});
}

function confirmationHTML(order){
  const isPaypal = order.payment === 'paypal';
  const payBlock = isPaypal ? `
    <div class="pay-instructions">
      <h4>Pay with PayPal — you're protected</h4>
      <ol>
        <li>Open PayPal and choose <strong>Send</strong> → <strong>Goods &amp; Services</strong> (important — this is what makes you covered).</li>
        <li>Send <strong>${fmt(order.total)}</strong> to <span class="pay-target">${SELLER.paypalEmail}</span></li>
        <li>Put your order code <strong>${order.code}</strong> in the note.</li>
      </ol>
      <a class="btn btn-primary btn-block" style="margin-top:.8rem" target="_blank" rel="noopener"
         href="https://www.paypal.com/myaccount/transfer/homepage/pay">Open PayPal</a>
      <div class="pay-protect-note">Always choose <strong>Goods &amp; Services</strong>, not Friends &amp; Family — only Goods &amp; Services gives you a refund if your item never arrives or isn't as described.</div>
    </div>` : `
    <div class="pay-instructions">
      <h4>Pay with Apple Cash — local pickup</h4>
      <ol>
        <li>Open Messages and send <strong>${fmt(order.total)}</strong> via Apple Cash to <span class="pay-target">${SELLER.appleCashPhone}</span></li>
        <li>Include your order code <strong>${order.code}</strong>.</li>
        <li>We'll reply to arrange your local pickup time and place.</li>
      </ol>
      <div class="pay-protect-note">Heads up: Apple Cash is a person-to-person transfer with <strong>no refund protection</strong>. We offer it only for in-person handoffs. For mailed orders, please use PayPal Goods &amp; Services so you're covered.</div>
    </div>`;

  const nextStep = order.delivery === 'pickup'
    ? `Once payment is arranged we pack within <strong>2 business days</strong> and message you to set a time and a safe public place to meet up.`
    : `Once payment lands we pack within <strong>2 business days</strong> and email you a tracking number for your $6 local shipping.`;

  return `
    <div class="confirm">
      <div class="confirm-badge">🌸</div>
      <h3>Reserved! Just send payment.</h3>
      <p class="card-meta">A confirmation went to <strong>${esc(order.email)}</strong></p>
      <div class="order-code">${esc(order.code)}</div>
      ${payBlock}
      <p class="confirm-fine">${nextStep}
      Watch every step on the <a href="#track" id="goTrack">Track order</a> page using <strong>${esc(order.code)}</strong>.</p>
      <button class="btn btn-ghost btn-block" id="confirmDone" style="margin-top:1rem">Done</button>
    </div>`;
}

/* Best-effort: email the order to the seller. Set ORDER_ENDPOINT to a
   Formspree (or similar) URL to receive every order by email. Until you
   do, orders are still saved locally and shown on the confirmation. */
const ORDER_ENDPOINT = ''; // e.g. 'https://formspree.io/f/yourid'
function sendOrderNotification(order){
  if(!ORDER_ENDPOINT) return;
  fetch(ORDER_ENDPOINT, {
    method:'POST',
    headers:{'Content-Type':'application/json','Accept':'application/json'},
    body: JSON.stringify({
      _subject:`New FAWN order ${order.code}`,
      order_code:order.code, name:order.name, email:order.email,
      address:order.address, payment:order.payment, total:order.total,
      items:order.items.map(i=>i.title).join(', '),
    }),
  }).catch(()=>{ /* non-fatal: order is saved locally regardless */ });
}

/* ----- 8. TRACK PAGE ---------------------------------------------- */
function handleTrack(e){
  e.preventDefault();
  const code = $('#trackInput').value;
  const order = lookupOrder(code);
  const box = $('#trackResult');
  box.hidden = false;
  box.innerHTML = order
    ? renderTimeline(order)
    : `<p class="drawer-empty">No order found for <strong>${esc((code||'').toUpperCase())}</strong>.<br/>Check the code in your confirmation email, or <a href="mailto:${esc(SELLER.contactEmail)}" style="color:var(--rose-deep);text-decoration:underline">email us</a>.</p>`;
}

/* ----- 9. SELLER TOOLS (you, the shop owner) ---------------------- *
   Update an order's status from your browser console:
     fawnAdmin.advance('FAWN-7K3Q')                       // move to next stage
     fawnAdmin.ship('FAWN-7K3Q','USPS','9400...','https://tools.usps.com/...')
     fawnAdmin.set('FAWN-7K3Q','delivered')
     fawnAdmin.list()                                     // see all orders
   Each change stamps the time and updates the buyer's tracking page.
------------------------------------------------------------------- */
window.fawnAdmin = {
  list(){ return loadJSON(LS_ORDERS, {}); },
  get(code){ return lookupOrder(code); },
  set(code, status){
    const orders = loadJSON(LS_ORDERS, {});
    const o = orders[(code||'').toUpperCase()];
    if(!o) return console.warn('No such order', code);
    if(stageIndex(o, status) < 0) return console.warn('Unknown status for this order. Use:', stagesFor(o).map(s=>s.key).join(', '));
    o.status = status; o.history[status] = new Date().toISOString();
    saveJSON(LS_ORDERS, orders);
    console.log(`✓ ${code} → ${status}`); refreshTrackIfShowing(code); return o;
  },
  advance(code){
    const o = lookupOrder(code); if(!o) return console.warn('No such order', code);
    const stages = stagesFor(o);
    const next = Math.min(stageIndex(o, o.status)+1, stages.length-1);
    return this.set(code, stages[next].key);
  },
  ship(code, carrier, number, url){
    const orders = loadJSON(LS_ORDERS, {});
    const o = orders[(code||'').toUpperCase()];
    if(!o) return console.warn('No such order', code);
    if(o.delivery !== 'ship') return console.warn(`${code} is a local-pickup order — use advance('${code}') to move it to "ready"/"picked up".`);
    o.tracking = { carrier:carrier||'', number:number||'', url:url||'' };
    saveJSON(LS_ORDERS, orders);
    return this.set(code, 'shipped');
  },
};
function refreshTrackIfShowing(code){
  const box = $('#trackResult');
  if(box && !box.hidden && $('#trackInput').value.trim().toUpperCase() === code.toUpperCase()){
    box.innerHTML = renderTimeline(lookupOrder(code));
  }
}

/* ----- 9b. LIVE PRODUCTS (Supabase) ------------------------------- *
   If a Supabase client is configured (browser only — not in tests), replace
   the demo PRODUCTS with Jessica's real, uploaded inventory. Falls back to the
   built-in demo items if Supabase isn't configured or the fetch fails. */
function rowToProduct(r){
  const meta = r.blurb || [r.brand, r.size, r.condition].filter(Boolean).join(' · ');
  return {
    id: r.id, title: r.title, meta,
    price: Number(r.price) || 0, resale: Number(r.resale) || 0,
    sold: !!r.sold, flag: r.flag || '', img: r.image_url || '',
    depop: r.depop || '', payLink: r.pay_link || '', tone: ['#f3bcc7', '#e89fae'],
  };
}
async function loadProducts(){
  const c = window.fawnClient;
  if(!c) return; // tests / unconfigured → keep demo PRODUCTS
  const grid = $('#productGrid');
  if(grid) grid.innerHTML = '<p class="grid-empty">loading the closet…</p>';
  try{
    const { data, error } = await c
      .from('products').select('*')
      .eq('hidden', false)
      .order('sold', { ascending: true })
      .order('sort', { ascending: true })
      .order('created_at', { ascending: false });
    if(error) throw error;
    PRODUCTS.length = 0;
    (data || []).forEach(r => PRODUCTS.push(rowToProduct(r)));
    if(PRODUCTS.length === 0){
      if(grid) grid.innerHTML = '<p class="grid-empty">new little finds coming soon 🌿</p>';
      renderCart();
      return;
    }
    renderProducts();
    renderCart();
  }catch(e){
    console.warn('Live products unavailable, showing demo:', e.message);
    renderProducts(); // restore demo render
  }
}

/* ----- 10. WIRE UP ------------------------------------------------- */
function init(){
  renderProducts();
  renderCart();
  loadProducts();
  $('#year').textContent = '2026';

  // delegated clicks for add/remove + depop tracking
  document.body.addEventListener('click', e=>{
    const add = e.target.closest('[data-add]');
    const rem = e.target.closest('[data-remove]');
    const dep = e.target.closest('[data-depop]');
    if(add) addToCart(add.dataset.add);
    if(rem) removeFromCart(rem.dataset.remove);
    if(dep && window.fbq) fbq('track','ViewContent');
    if(e.target.id==='confirmDone') closeCheckout();
    if(e.target.id==='goTrack'){ closeCheckout(); }
  });

  $('#cartBtn').addEventListener('click', openCart);
  $('#closeCart').addEventListener('click', closeCart);
  $('#overlay').addEventListener('click', closeCart);
  $('#checkoutBtn').addEventListener('click', openCheckout);
  $('#closeCheckout').addEventListener('click', closeCheckout);
  $('#checkoutModal').addEventListener('click', e=>{ if(e.target.id==='checkoutModal') closeCheckout(); });
  $('#trackForm').addEventListener('submit', handleTrack);
  document.addEventListener('keydown', onDialogKeydown);

  // mobile nav toggle
  const navToggle = $('#navToggle');
  const primaryNav = $('#primaryNav');
  function setNav(open){
    primaryNav.classList.toggle('open', open);
    navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }
  navToggle.addEventListener('click', () => setNav(!primaryNav.classList.contains('open')));
  primaryNav.addEventListener('click', e => { if(e.target.tagName === 'A') setNav(false); });
  document.addEventListener('keydown', e => { if(e.key === 'Escape' && primaryNav.classList.contains('open')) setNav(false); });
  document.addEventListener('click', e => {
    if(primaryNav.classList.contains('open') && !e.target.closest('#primaryNav') && !e.target.closest('#navToggle')) setNav(false);
  });

  // email capture
  $('#emailForm').addEventListener('submit', e=>{
    const action = e.target.getAttribute('action');
    if(!action || action==='YOUR_EMAIL_ENDPOINT'){
      e.preventDefault();
      const email = $('#emailInput').value.trim();
      if(email && window.fawnClient){
        window.fawnClient.from('signups').insert({ email }).then(()=>{}, ()=>{});
      }
      $('#emailNote').hidden = false;
      $('#emailInput').value = '';
      if(window.fbq) fbq('track','Lead');
    }
    // if a real endpoint is set, let the form submit normally
  });

  setupReveal();

  // deep link: #track?CODE  or visiting with a stored last code
  if(location.hash.startsWith('#track')){ /* user can type code */ }
}

/* Gentle scroll-reveal. Guarded by IntersectionObserver so it no-ops in
   non-browser test environments — and the `.reveal-ready` flag means content
   stays visible if JS/IO is unavailable. */
function setupReveal(){
  if(!('IntersectionObserver' in window)) return;
  document.documentElement.classList.add('reveal-ready');
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));
}

document.addEventListener('DOMContentLoaded', init);
