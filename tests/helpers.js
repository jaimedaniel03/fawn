// Test harness: load the REAL index.html + app.js into a JSDOM window and
// return it, fully initialized. No production code is modified or stubbed —
// these tests exercise the same code that ships.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { JSDOM } from 'jsdom';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export function bootstrap() {
  // Strip the external <script> so we control exactly when app.js runs.
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8')
    .replace('<script src="app.js"></script>', '');
  const appJs = readFileSync(join(ROOT, 'app.js'), 'utf8');

  const dom = new JSDOM(html, {
    url: 'https://fawn.test/',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
  });
  const { window } = dom;

  // JSDOM doesn't implement these; app.js may touch them indirectly.
  window.scrollTo = () => {};
  if (!window.Element.prototype.scrollIntoView) {
    window.Element.prototype.scrollIntoView = () => {};
  }
  try { window.localStorage.clear(); } catch { /* ignore */ }

  // Run app.js, then fire DOMContentLoaded so init() wires the page up.
  const script = window.document.createElement('script');
  script.textContent = appJs;
  window.document.body.appendChild(script);
  window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));

  return window;
}

// Fill + submit the checkout form through the real handlers, returning the
// generated order code. `opts`: { delivery: 'pickup'|'ship', pay: 'paypal'|'applecash' }
export function placeOrder(window, productId, opts = {}) {
  const { document } = window;
  window.addToCart(productId);
  document.querySelector('#checkoutBtn')
    .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

  const form = document.querySelector('#checkoutForm');
  const delivery = opts.delivery || 'pickup';
  const pay = opts.pay || 'paypal';

  const deliveryRadio = form.querySelector(`input[name="delivery"][value="${delivery}"]`);
  deliveryRadio.checked = true;
  deliveryRadio.dispatchEvent(new window.Event('change', { bubbles: true }));

  form.querySelector('input[name="name"]').value = 'Test Buyer';
  form.querySelector('input[name="email"]').value = 'buyer@example.com';
  if (delivery === 'ship') {
    form.querySelector('textarea[name="address"]').value = '1 Test St, Town, CA 90000';
  }
  const payRadio = form.querySelector(`input[name="pay"][value="${pay}"]`);
  if (!payRadio.disabled) payRadio.checked = true;

  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  return document.querySelector('.order-code')?.textContent?.trim();
}

export function readOrders(window) {
  try { return JSON.parse(window.localStorage.getItem('fawn_orders') || '{}'); }
  catch { return {}; }
}
