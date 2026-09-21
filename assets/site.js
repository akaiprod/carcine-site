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

  const img = document.createElement('img');
  img.src = tpl.poster;
  img.alt = '';
  img.setAttribute('width', '768');
  img.setAttribute('height', '1365');
  img.setAttribute('loading', eager ? 'eager' : 'lazy');
  if (eager) img.setAttribute('fetchpriority', 'high');
  img.setAttribute('decoding', 'async');

  const dur = document.createElement('span');
  dur.className = 'dur';
  dur.dataset.sec = tpl.duration_sec;

  // Metinleri applyI18n yazar (dil değişiminde tek yerden).
  const name = document.createElement('span');
  name.className = 'name';
  name.dataset.nameEn = tpl.name.en;
  name.dataset.nameTr = tpl.name.tr;

  el.append(img, dur, name);
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
  return picks;
}

/** GSAP'siz sayfada da dolu görünsün: sonuç karesi, selfie fonu, ilk adım görseli. */
function seedStills(first) {
  const shot = document.getElementById('shot-result');
  if (shot) shot.src = first.poster;
  const bg = document.getElementById('selfie-bg');
  if (bg) bg.style.backgroundImage = `url("${first.poster}")`;
  const step1 = document.querySelector('.shot[data-step="1"]');
  if (step1) step1.classList.add('is-on');
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
function closeLightbox() { lb.close(); }
document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
lb.addEventListener('click', (e) => { if (e.target === lb) closeLightbox(); });
// Tek teardown: Escape de düğme de 'close' olayından geçer.
lb.addEventListener('close', () => { lbVideo.pause(); lbVideo.removeAttribute('src'); lbVideo.load(); });

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
  const picks = buildStrip();
  if (picks[0]) seedStills(picks[0]);
  buildRails();
  applyI18n();
  initMotion();
}

/** GSAP kancası — Görev 5–7 doldurur. Reduced-motion ve <768 px: hiç animasyon. */
function initMotion() {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobile = matchMedia('(max-width: 767px)').matches;
  if (reduce || mobile || !window.gsap) return;
  gsap.registerPlugin(ScrollTrigger);
  motionStrip();
}

/** Sonsuz şerit: iki kopya, xPercent -50 döngü; scroll hızı timeScale'i büyütür, sonra 1'e döner. */
function motionStrip() {
  const track = document.getElementById('strip');
  const loop = gsap.to(track, { xPercent: -50, duration: 48, ease: 'none', repeat: -1 });
  let settle;
  ScrollTrigger.create({
    onUpdate: (self) => {
      const v = Math.min(Math.abs(self.getVelocity()) / 600, 5);
      loop.timeScale(1 + v);
      settle?.kill();
      settle = gsap.to(loop, { timeScale: 1, duration: 1.2, ease: 'power2.out' });
    },
  });
  // Sekme arka planda: döngü dursun (pil).
  document.addEventListener('visibilitychange', () => (document.hidden ? loop.pause() : loop.play()));
}

main().catch((e) => console.error('site init', e));
