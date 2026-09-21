import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { FEATURED_SLUGS, STRIP_COUNT, fmtDuration, pickLang, showcasePicks, stripPicks, t } from '../assets/core.js';

test('pickLang: ?lang > localStorage > navigator > en', () => {
  assert.equal(pickLang({ query: '?lang=tr', stored: 'en', navigatorLang: 'en-US' }), 'tr');
  assert.equal(pickLang({ query: '?lang=xx', stored: 'tr', navigatorLang: 'en-US' }), 'tr');
  assert.equal(pickLang({ query: '', stored: null, navigatorLang: 'tr-TR' }), 'tr');
  assert.equal(pickLang({ query: '', stored: null, navigatorLang: 'de' }), 'en');
  assert.equal(pickLang({ query: '?lang=TR', stored: 'en', navigatorLang: 'en-US' }), 'tr');
  assert.equal(pickLang({ query: '', stored: 'bozuk', navigatorLang: undefined }), 'en');
});

test('t: noktalı anahtar, eksikte anahtarın kendisi', () => {
  const d = { hero: { title: 'PUT YOUR BUILD' } };
  assert.equal(t(d, 'hero.title'), 'PUT YOUR BUILD');
  assert.equal(t(d, 'hero.yok'), 'hero.yok');
  assert.equal(t({}, 'constructor.name'), 'constructor.name');
  assert.equal(t(Object.create({ miras: 'devralinan' }), 'miras'), 'miras');
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
  assert.equal(fmtDuration(10, 'en'), '10 s');
  assert.equal(fmtDuration(15, 'tr'), '15 sn');
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

test('showcasePicks: geniş kartlar featured sırasında, geri kalan round-robin ve çakışmasız', () => {
  const cat = {
    categories: [
      { slug: 'a', templates: [{ slug: 'a1' }, { slug: 'a2' }, { slug: 'a3' }] },
      { slug: 'b', templates: [{ slug: 'b1' }, { slug: 'b2' }] },
      { slug: 'c', templates: [{ slug: 'c1' }, { slug: 'c2' }, { slug: 'c3' }] },
    ],
  };
  const featured = ['c2', 'yok', 'a3', 'b1', 'c1'];
  const { wide, rest } = showcasePicks(cat, featured, 6, []);
  assert.deepEqual(wide.map((x) => x.slug), ['c2', 'a3', 'b1']);
  assert.equal(rest.length, 3);
  assert.deepEqual(rest.map((x) => x.slug), ['a1', 'c1', 'a2']);
  assert.equal(new Set([...wide, ...rest].map((x) => x.slug)).size, 6);
});

test('showcasePicks: gerçek katalogda 3 Jaguar geniş + 9 diğer, tekrarsız', () => {
  const cat = JSON.parse(readFileSync(new URL('../assets/templates.json', import.meta.url), 'utf8'));
  const { wide, rest } = showcasePicks(cat, FEATURED_SLUGS, 12);
  assert.equal(wide.length, 3);
  assert.equal(rest.length, 9);
  assert.deepEqual(wide.map((x) => x.slug), FEATURED_SLUGS.slice(0, 3));
  assert.equal(new Set([...wide, ...rest].map((x) => x.slug)).size, 12);
});

test('showcasePicks: seçki hero şeridindeki kartlardan farklı (geniş kartlar hariç)', () => {
  const cat = JSON.parse(readFileSync(new URL('../assets/templates.json', import.meta.url), 'utf8'));
  const strip = new Set(stripPicks(cat, STRIP_COUNT).map((x) => x.slug));
  const { wide, rest } = showcasePicks(cat, FEATURED_SLUGS, 12);
  assert.equal(rest.length, 9);
  for (const tpl of rest) assert.equal(strip.has(tpl.slug), false, tpl.slug);
  assert.equal(new Set([...wide, ...rest].map((x) => x.slug)).size, 12);
});
