import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bootstrap } from './helpers.js';

// The storefront maps Supabase product rows into card models. Hidden/draft rows are
// filtered out SERVER-SIDE (RLS hidden=false + the loadProducts query), so the client
// contract we lock here is the field mapping + that a buy-now link only shows when live.

test('rowToProduct maps cloud fields, incl. pay link and sold state', () => {
  const w = bootstrap();
  const p = w.rowToProduct({
    id: 'abc', title: 'Waffle henley', brand: 'vintage', size: 'M', condition: 'like new',
    price: '28', resale: '40', sold: false, flag: 'one of one',
    image_url: 'https://x/y.jpg', pay_link: 'https://buy.stripe.com/test',
  });
  assert.equal(p.id, 'abc');
  assert.equal(p.price, 28);
  assert.equal(p.resale, 40);
  assert.equal(p.sold, false);
  assert.equal(p.payLink, 'https://buy.stripe.com/test');
  assert.equal(p.img, 'https://x/y.jpg');
  assert.equal(p.meta, 'vintage · M · like new', 'meta built from brand/size/condition');
});

test('buy-now eligibility: only a live item with a pay link qualifies', () => {
  const w = bootstrap();
  // Mirrors the card template's `payLink && !sold` rule, so a sold piece can never
  // expose a working buy link even if a Payment Link is still attached.
  const eligible = (row) => { const p = w.rowToProduct(row); return !!(p.payLink && !p.sold); };
  assert.equal(eligible({ id: 'a', price: 20, sold: false, pay_link: 'https://buy.stripe.com/x' }), true);
  assert.equal(eligible({ id: 'b', price: 20, sold: true, pay_link: 'https://buy.stripe.com/x' }), false);
  assert.equal(eligible({ id: 'c', price: 20, sold: false, pay_link: '' }), false);
});
