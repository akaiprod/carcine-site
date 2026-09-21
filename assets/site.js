import { fmtDuration, pickLang, stripPicks, t } from './core.js';

const LS = 'carcine.lang';
let lang = 'en';
let dict = {};
let catalog = { categories: [] };

function readStored() { try { return localStorage.getItem(LS); } catch { return null; } }
function writeStored(v) { try { localStorage.setItem(LS, v); } catch { /* özel pencere */ } }

function applyI18n() {
  const d = dict[lang];
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(d, el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-content]').forEach((el) => { el.setAttribute('content', t(d, el.dataset.i18nContent)); });
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(d, el.dataset.i18nAria)); });
  document.getElementById('lang').setAttribute('aria-label', lang === 'en' ? 'Türkçe' : 'English');
  const tr = lang === 'tr' ? '-tr' : '';
  document.getElementById('link-privacy').href = `privacy${tr}.html`;
  document.getElementById('link-terms').href = `terms${tr}.html`;
  document.querySelectorAll('[data-name-en]').forEach((el) => {
    const name = el.dataset[lang === 'tr' ? 'nameTr' : 'nameEn'];
    el.textContent = name;
    el.closest('button.card')?.setAttribute('aria-label', name);
  });
  document.querySelectorAll('[data-cat-en]').forEach((el) => { el.textContent = el.dataset[lang === 'tr' ? 'catTr' : 'catEn']; });
  document.querySelectorAll('[data-sec]').forEach((el) => { el.textContent = fmtDuration(Number(el.dataset.sec), lang); });
}

function card(tpl, { eager = false, interactive = false } = {}) {
  const el = document.createElement(interactive ? 'button' : 'div');
  el.className = 'card';
  if (interactive) { el.type = 'button'; el.setAttribute('aria-label', tpl.name[lang]); }
  el.dataset.video = tpl.video;
  el.dataset.slug = tpl.slug;
  el.innerHTML = `<img src="${tpl.poster}" alt="" width="768" height="1365" ${eager ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"'} decoding="async"><span class="dur" data-sec="${tpl.duration_sec}"></span><span class="name" data-name-en="${tpl.name.en}" data-name-tr="${tpl.name.tr}"></span>`;
  // Hover'da oynat: mp4 ancak o an indirilir (spec §4).
  el.addEventListener('mouseenter', () => {
    let v = el.querySelector('video');
    if (!v) {
      v = document.createElement('video');
      v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'none';
      v.src = tpl.video;
      el.appendChild(v);
    }
    v.play().then(() => el.classList.add('is-playing')).catch(() => {});
  });
  el.addEventListener('mouseleave', () => {
    const v = el.querySelector('video');
    if (v) { v.pause(); el.classList.remove('is-playing'); }
  });
  if (interactive) el.addEventListener('click', () => openLightbox(tpl));
  return el;
}

function buildStrip() {
  const track = document.getElementById('strip');
  const picks = stripPicks(catalog, 12);
  // İki kopya: sonsuz döngü için xPercent -50 (Görev 5).
  for (const pass of [0, 1]) picks.forEach((tpl, i) => track.appendChild(card(tpl, { eager: pass === 0 && i < 4 })));
  const first = picks[0];
  if (first) {
    document.getElementById('shot-result').src = first.poster;
    document.getElementById('selfie-bg').style.backgroundImage = `url("${first.poster}")`;
  }
  document.querySelector('.shot[data-step="1"]').classList.add('is-on');
}

function buildRails() {
  const root = document.getElementById('rails');
  catalog.categories.forEach((cat, i) => {
    const title = document.createElement('h3');
    title.className = 'rail-title';
    title.dataset.catEn = cat.name.en; title.dataset.catTr = cat.name.tr;
    const wrap = document.createElement('div');
    wrap.className = 'rail-wrap';
    const rail = document.createElement('div');
    rail.className = 'rail';
    rail.dataset.dir = i % 2 ? '1' : '-1';
    cat.templates.forEach((tpl) => rail.appendChild(card(tpl, { interactive: true })));
    wrap.appendChild(rail);
    root.append(title, wrap);
  });
}

const lb = document.getElementById('lightbox');
const lbVideo = document.getElementById('lightbox-video');
function openLightbox(tpl) {
  lbVideo.src = tpl.video;
  document.getElementById('lightbox-name').textContent = tpl.name[lang];
  lb.showModal();
  lbVideo.play().catch(() => {});
}
function closeLightbox() { lbVideo.pause(); lbVideo.removeAttribute('src'); lbVideo.load(); lb.close(); }
document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
lb.addEventListener('click', (e) => { if (e.target === lb) closeLightbox(); });
lb.addEventListener('close', () => { lbVideo.pause(); });

document.getElementById('lang').addEventListener('click', () => {
  lang = lang === 'en' ? 'tr' : 'en';
  writeStored(lang);
  applyI18n();
});

async function main() {
  const [i18n, cat] = await Promise.all([
    fetch('assets/i18n.json').then((r) => r.json()),
    fetch('assets/templates.json').then((r) => r.json()),
  ]);
  dict = i18n; catalog = cat;
  lang = pickLang({ query: location.search, stored: readStored(), navigatorLang: navigator.language });
  buildStrip();
  buildRails();
  applyI18n();
  initMotion();
}

/** GSAP kancası — Görev 5–7 doldurur. Reduced-motion ve <768 px: hiç animasyon. */
function initMotion() {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobile = matchMedia('(max-width: 767px)').matches;
  if (reduce || mobile || !window.gsap) return;
}

main();
