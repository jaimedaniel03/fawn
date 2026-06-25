import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bootstrap } from './helpers.js';

test('the mobile nav toggle opens and closes the menu', () => {
  const w = bootstrap();
  const toggle = w.document.querySelector('#navToggle');
  const nav = w.document.querySelector('#primaryNav');

  assert.equal(nav.classList.contains('open'), false, 'starts closed');
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');

  toggle.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  assert.equal(nav.classList.contains('open'), true, 'opens on click');
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');

  toggle.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  assert.equal(nav.classList.contains('open'), false, 'closes on second click');
});

test('selecting a nav link closes the menu', () => {
  const w = bootstrap();
  const toggle = w.document.querySelector('#navToggle');
  const nav = w.document.querySelector('#primaryNav');
  toggle.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  nav.querySelector('a').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  assert.equal(nav.classList.contains('open'), false, 'link click closes the menu');
});

test('Escape closes the mobile nav', () => {
  const w = bootstrap();
  const toggle = w.document.querySelector('#navToggle');
  const nav = w.document.querySelector('#primaryNav');
  toggle.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(nav.classList.contains('open'), false);
});
