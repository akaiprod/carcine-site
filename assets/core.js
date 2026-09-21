// Saf yardımcılar — DOM/GSAP yok, node --test ile test edilir. site.js tüketir.

/** Dil: ?lang=tr|en > localStorage > navigator (tr*) > en. */
export function pickLang({ query, stored, navigatorLang }) {
  const q = (new URLSearchParams(query || '').get('lang') || '').toLowerCase();
  if (q === 'tr' || q === 'en') return q;
  if (stored === 'tr' || stored === 'en') return stored;
  return /^tr/i.test(navigatorLang || '') ? 'tr' : 'en';
}

/** Noktalı anahtar; eksikte anahtarın kendisi döner (sayfada görünür → fark edilir). */
export function t(dict, key) {
  const v = key.split('.').reduce((o, k) => (o && typeof o === 'object' && Object.hasOwn(o, k) ? o[k] : undefined), dict);
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

export function fmtDuration(sec, lang) {
  return `${sec} ${lang === 'tr' ? 'sn' : 's'}`;
}

/** Vitrinde geniş kartlar sahibin Jaguar render'ları olmalı (sıra = öncelik). */
export const FEATURED_SLUGS = ['neon-cruise', 'race-day', 'tunnel-pass', 'commercial', 'midnight-run', 'circuit-attack', 'dune-rush', 'mountain-pass', 'desert-drift'];

/**
 * Vitrin seçkisi: 3 geniş kart featured sırasında, kalan n-3 kart round-robin.
 * Kalanlar hem geniş kartlardan hem de hero şeridindeki 12 karttan farklı (varsayılan exclude);
 * geniş kartlar şeritle çakışabilir (sahibin Jaguar render'ları hep geniş).
 */
export function showcasePicks(catalog, featured, n, exclude = stripPicks(catalog, 12).map((t2) => t2.slug)) {
  const all = stripPicks(catalog, catalog.categories.reduce((s, c) => s + c.templates.length, 0));
  const wide = featured.map((slug) => all.find((t2) => t2.slug === slug)).filter(Boolean).slice(0, 3);
  const wideSlugs = new Set(wide.map((t2) => t2.slug));
  const skip = new Set(exclude);
  const rest = all.filter((t2) => !wideSlugs.has(t2.slug) && !skip.has(t2.slug)).slice(0, n - wide.length);
  return { wide, rest };
}
