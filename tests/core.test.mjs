import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fmtDuration, pickLang, stripPicks, t } from '../assets/core.js';

test('pickLang: ?lang > localStorage > navigator > en', () => {
  assert.equal(pickLang({ query: '?lang=tr', stored: 'en', navigatorLang: 'en-US' }), 'tr');
  assert.equal(pickLang({ query: '?lang=xx', stored: 'tr', navigatorLang: 'en-US' }), 'tr');
  assert.equal(pickLang({ query: '', stored: null, navigatorLang: 'tr-TR' }), 'tr');
  assert.equal(pickLang({ query: '', stored: null, navigatorLang: 'de' }), 'en');
  assert.equal(pickLang({ query: '', stored: 'bozuk', navigatorLang: undefined }), 'en');
});

test('t: noktalı anahtar, eksikte anahtarın kendisi', () => {
  const d = { hero: { title: 'PUT YOUR BUILD' } };
  assert.equal(t(d, 'hero.title'), 'PUT YOUR BUILD');
  assert.equal(t(d, 'hero.yok'), 'hero.yok');
});

test('stripPicks: kategoriler arası sırayla, n tane', () => {
  const cat = {
    categories: [
      { slug: 'a', templates: [{ slug: 'a1' }, { slug: 'a2' }] },
      { slug: 'b', templates: [{ slug: 'b1' }] },
      { slug: 'c', templates: [{ slug: 'c1' }, { slug: 'c2' }, { slug: 'c3' }] },
    ],
  };
  assert.deepEqual(stripPicks(cat, 5).map((x) => x.slug), ['a1', 'b1', 'c1', 'a2', 'c2']);
  assert.equal(stripPicks(cat, 99).length, 6);
});

test('fmtDuration', () => {
  assert.equal(fmtDuration(10), '10 s');
  assert.equal(fmtDuration(15), '15 s');
});

test('i18n.json: en ve tr aynı anahtar kümesi, boş değer yok', () => {
  const d = JSON.parse(readFileSync(new URL('../assets/i18n.json', import.meta.url), 'utf8'));
  const keys = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' ? keys(v, `${p}${k}.`) : [`${p}${k}`]));
  const en = keys(d.en).sort();
  const tr = keys(d.tr).sort();
  assert.deepEqual(tr, en);
  for (const k of en) assert.notEqual(t(d.en, k), '', k);
  for (const k of tr) assert.notEqual(t(d.tr, k), '', k);
});
