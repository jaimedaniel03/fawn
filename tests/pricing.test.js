import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bootstrap } from './helpers.js';

test('pickup is free, local shipping adds a flat $6', () => {
  const w = bootstrap();
  w.addToCart('t03'); // Washed rose henley, $28
  assert.equal(w.subtotal(), 28, 'subtotal reflects the single item');
  assert.equal(w.deliveryFee('pickup'), 0, 'pickup has no fee');
  assert.equal(w.deliveryFee('ship'), 6, 'shipping is a flat $6');
  assert.equal(w.total('pickup'), 28, 'pickup total = subtotal');
  assert.equal(w.total('ship'), 34, 'ship total = subtotal + 6');
});

test('subtotal sums multiple items', () => {
  const w = bootstrap();
  w.addToCart('t01'); // $24
  w.addToCart('t02'); // $19
  assert.equal(w.subtotal(), 43);
  assert.equal(w.total('ship'), 49);
});

test('sold items cannot be added to the cart', () => {
  const w = bootstrap();
  w.addToCart('t05'); // marked sold in PRODUCTS
  assert.equal(w.subtotal(), 0, 'sold item is rejected');
});
