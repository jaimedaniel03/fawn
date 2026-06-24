import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bootstrap, placeOrder, readOrders } from './helpers.js';

test('pickup and shipping use different stage sets', () => {
  const w = bootstrap();
  // Array.from in the test realm avoids a cross-realm prototype mismatch
  // (the array returned by app.js lives in the JSDOM realm).
  const pickup = Array.from(w.stagesFor({ delivery: 'pickup' }), s => s.key);
  const ship = Array.from(w.stagesFor({ delivery: 'ship' }), s => s.key);
  assert.deepEqual(pickup, ['received', 'packed', 'ready', 'pickedup']);
  assert.deepEqual(ship, ['received', 'packed', 'shipped', 'out_for_delivery', 'delivered']);
});

test('advance() walks a pickup order to picked up', () => {
  const w = bootstrap();
  const code = placeOrder(w, 't03', { delivery: 'pickup' });
  w.fawnAdmin.advance(code); // packed
  w.fawnAdmin.advance(code); // ready
  w.fawnAdmin.advance(code); // pickedup
  assert.equal(readOrders(w)[code].status, 'pickedup');
});

test('ship() is refused on a pickup order, accepted on a shipping order', () => {
  const w = bootstrap();
  const pickup = placeOrder(w, 't03', { delivery: 'pickup' });
  w.fawnAdmin.ship(pickup, 'USPS', '123');
  assert.equal(readOrders(w)[pickup].status, 'received', 'pickup order unaffected by ship()');

  const ship = placeOrder(w, 't04', { delivery: 'ship', pay: 'paypal' });
  w.fawnAdmin.ship(ship, 'USPS', '9400111899', 'https://tools.usps.com/x');
  const o = readOrders(w)[ship];
  assert.equal(o.status, 'shipped');
  assert.equal(o.tracking.number, '9400111899');
});

test('renderTimeline marks the current stage and renders all stages', () => {
  const w = bootstrap();
  const code = placeOrder(w, 't04', { delivery: 'ship', pay: 'paypal' });
  const order = readOrders(w)[code];
  const html = w.renderTimeline(order);
  assert.match(html, /Order received/);
  assert.match(html, /class="current"/, 'the active stage is flagged current');
  assert.match(html, /Delivered/, 'all shipping stages are present');
});
