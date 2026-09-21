// Saf yardımcılar — DOM/GSAP yok, node --test ile test edilir. site.js tüketir.

/** Dil: ?lang=tr|en > localStorage > navigator (tr*) > en. */
export function pickLang({ query, stored, navigatorLang }) {
  const q = new URLSearchParams(query || '').get('lang');
  if (q === 'tr' || q === 'en') return q;
  if (stored === 'tr' || stored === 'en') return stored;
  return /^tr/i.test(navigatorLang || '') ? 'tr' : 'en';
}

/** Noktalı anahtar; eksikte anahtarın kendisi döner (sayfada görünür → fark edilir). */
export function t(dict, key) {
  const v = key.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), dict);
  return typeof v === 'string' ? v : key;
}

/** Hero film şeridi: kategoriler arasında sırayla (round-robin) en çok n şablon. */
export function stripPicks(catalog, n) {
  const out = [];
  const lists = catalog.categories.map((c) => c.templates);
  for (let i = 0; out.length < n; i++) {
    let any = false;
    for (const l of lists) {
      if (i < l.length) {
        any = true;
        out.push(l[i]);
        if (out.length === n) return out;
      }
    }
    if (!any) return out;
  }
  return out;
}

export function fmtDuration(sec) {
  return `${sec} s`;
}
