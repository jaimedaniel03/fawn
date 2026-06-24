import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bootstrap } from './helpers.js';

function pressEscape(w) {
  w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
}

test('Escape closes the cart drawer', () => {
  const w = bootstrap();
  w.addToCart('t03'); // opens the drawer
  assert.ok(w.document.querySelector('#cartDrawer').classList.contains('open'), 'drawer open');
  pressEscape(w);
  assert.ok(!w.document.querySelector('#cartDrawer').classList.contains('open'), 'drawer closed by Escape');
});

test('Escape closes the checkout modal', () => {
  const w = bootstrap();
  w.addToCart('t03');
  w.document.querySelector('#checkoutBtn').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  assert.equal(w.document.querySelector('#checkoutModal').hidden, false, 'modal open');
  pressEscape(w);
  assert.equal(w.document.querySelector('#checkoutModal').hidden, true, 'modal closed by Escape');
});

test('Escape does nothing when no dialog is open', () => {
  const w = bootstrap();
  // should not throw
  pressEscape(w);
  assert.equal(w.document.querySelector('#cartDrawer').classList.contains('open'), false);
  assert.equal(w.document.querySelector('#checkoutModal').hidden, true);
});
