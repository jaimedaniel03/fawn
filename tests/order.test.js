import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bootstrap, placeOrder, readOrders } from './helpers.js';

const CODE_RE = /^FAWN-[A-HJ-NP-Z2-9]{4}$/;

test('a pickup order is created, persisted, and clears the cart', () => {
  const w = bootstrap();
  const code = placeOrder(w, 't03', { delivery: 'pickup', pay: 'applecash' });
  assert.match(code, CODE_RE, 'order code has the FAWN-XXXX format');

  const o = readOrders(w)[code];
  assert.ok(o, 'order is saved to storage');
  assert.equal(o.delivery, 'pickup');
  assert.equal(o.shipping, 0);
  assert.equal(o.total, 28);
  assert.equal(o.payment, 'applecash');
  assert.equal(o.address, '', 'no address captured for pickup');
  assert.equal(o.status, 'received');

  // cart emptied after checkout
  assert.equal(w.subtotal(), 0);
});

test('a shipping order captures address and adds $6', () => {
  const w = bootstrap();
  const code = placeOrder(w, 't04', { delivery: 'ship', pay: 'paypal' }); // $32
  const o = readOrders(w)[code];
  assert.equal(o.delivery, 'ship');
  assert.equal(o.shipping, 6);
  assert.equal(o.total, 38);
  assert.equal(o.payment, 'paypal');
  assert.ok(o.address.length > 0, 'shipping address is captured');
});

test('order codes are unique across orders', () => {
  const w = bootstrap();
  const codes = new Set();
  for (const id of ['t01', 't02', 't03', 't06', 't07']) {
    codes.add(placeOrder(w, id, { delivery: 'pickup' }));
  }
  assert.equal(codes.size, 5, 'five orders produced five distinct codes');
});

test('a purchased item is marked sold and cannot be re-bought', () => {
  const w = bootstrap();
  placeOrder(w, 't07', { delivery: 'pickup' });
  w.addToCart('t07'); // should be a no-op now
  assert.equal(w.subtotal(), 0, 'sold-out item is not re-added');
});
