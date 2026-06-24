import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bootstrap } from './helpers.js';

// The core integrity rule: a mailed order can't be paid with an unprotected
// Apple Cash transfer. Selecting shipping must disable Apple Cash, force PayPal,
// reveal the address field, and add $6 to the displayed total.
function openCheckout(w, productId) {
  w.addToCart(productId);
  w.document.querySelector('#checkoutBtn')
    .dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  return w.document.querySelector('#checkoutForm');
}

function selectDelivery(w, form, value) {
  const r = form.querySelector(`input[name="delivery"][value="${value}"]`);
  r.checked = true;
  r.dispatchEvent(new w.Event('change', { bubbles: true }));
}

test('pickup allows Apple Cash and hides the address field', () => {
  const w = bootstrap();
  const form = openCheckout(w, 't03');
  selectDelivery(w, form, 'pickup');
  assert.equal(form.querySelector('input[value="applecash"]').disabled, false);
  assert.equal(w.document.querySelector('#addressField').hidden, true);
  assert.equal(w.document.querySelector('#coTotal').textContent, '$28');
});

test('shipping disables Apple Cash, forces PayPal, shows + requires address, adds $6', () => {
  const w = bootstrap();
  const form = openCheckout(w, 't03'); // $28
  // pre-select Apple Cash, then switch to shipping
  form.querySelector('input[value="applecash"]').checked = true;
  selectDelivery(w, form, 'ship');

  assert.equal(form.querySelector('input[value="applecash"]').disabled, true, 'Apple Cash disabled');
  assert.equal(form.querySelector('input[value="paypal"]').checked, true, 'forced to PayPal');
  const addr = w.document.querySelector('#addressField');
  assert.equal(addr.hidden, false, 'address field shown');
  assert.equal(addr.querySelector('textarea').required, true, 'address required');
  assert.equal(w.document.querySelector('#coTotal').textContent, '$34', 'total includes $6');
});
