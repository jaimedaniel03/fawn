import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bootstrap } from './helpers.js';

test('esc() escapes every HTML-significant character', () => {
  const w = bootstrap();
  assert.equal(w.esc('<img src=x>'), '&lt;img src=x&gt;');
  assert.equal(w.esc(`a & b "c" 'd'`), 'a &amp; b &quot;c&quot; &#39;d&#39;');
  assert.equal(w.esc(null), '', 'null becomes empty string, not "null"');
});

test('a malicious order code in the tracker is rendered inert, not executed', () => {
  const w = bootstrap();
  w.__xss = false;
  const payload = '<img src=x onerror="window.__xss=true">';
  w.document.querySelector('#trackInput').value = payload;
  w.document.querySelector('#trackForm')
    .dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));

  const box = w.document.querySelector('#trackResult');
  assert.equal(box.querySelectorAll('img').length, 0, 'no real <img> element is created');
  assert.equal(w.__xss, false, 'the onerror handler never runs');
  assert.match(box.innerHTML, /&lt;IMG/i, 'payload is HTML-escaped in output');
});

test('unknown order codes show a not-found message', () => {
  const w = bootstrap();
  w.document.querySelector('#trackInput').value = 'FAWN-ZZZZ';
  w.document.querySelector('#trackForm')
    .dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  assert.match(w.document.querySelector('#trackResult').textContent, /No order found/);
});
