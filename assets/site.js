import { FEATURED_SLUGS, fmtDuration, pickLang, showcasePicks, stripPicks, t } from './core.js';

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

/** Vitrin: 12 kartlık seçki, geniş kartlar sahibin Jaguar render'ları; kategori adları çip. */
function buildShowcase() {
  const { wide, rest } = showcasePicks(catalog, FEATURED_SLUGS, 12);
  // Her öbek geniş kartla başlar; öbek boyları 6 sütunluk ızgarayı deliksiz doldurur (boşluk son satırın sağında).
  const groups = [4, 2, 3];
  const order = [];
  let k = 0;
  wide.forEach((tpl, i) => {
    order.push({ tpl, isWide: true });
    rest.slice(k, k + groups[i]).forEach((r) => order.push({ tpl: r, isWide: false }));
    k += groups[i];
  });
  rest.slice(k).forEach((r) => order.push({ tpl: r, isWide: false }));

  const grid = document.getElementById('mosaic');
  order.forEach(({ tpl, isWide }) => {
    const c = card(tpl, { interactive: true });
    if (isWide) c.classList.add('is-wide');
    grid.appendChild(c);
  });

  const chips = document.getElementById('chips');
  catalog.categories.forEach((cat) => {
    const li = document.createElement('li');
    li.dataset.catEn = cat.name.en; li.dataset.catTr = cat.name.tr;
    chips.appendChild(li);
  });
  return wide[0];
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
  const featured = buildShowcase();
  const still = featured || picks[0];
  if (still) seedStills(still);
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
  motionHow();
  motionShowcase();
  motionSelfie();
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

/** Pin'li bölüm: scrub ile 3 adım sırayla belirir, telefon ekranı adım görselini değiştirir, telefon yavaş kayar. */
function motionHow() {
  const section = document.querySelector('.how');
  const steps = gsap.utils.toArray('.step');
  const shots = gsap.utils.toArray('.shot');
  gsap.set(steps, { opacity: .25, y: 24 });
  const tl = gsap.timeline({
    scrollTrigger: { trigger: section, start: 'top top', end: '+=180%', pin: true, scrub: .6 },
  });
  steps.forEach((s, i) => {
    tl.to(s, { opacity: 1, y: 0, duration: 1 }, i)
      .call(() => shots.forEach((img, j) => img.classList.toggle('is-on', j === i)), null, i + .2);
    if (i < steps.length - 1) tl.to(s, { opacity: .35, duration: .6 }, i + 1);
  });
  gsap.to('.phone', { yPercent: -8, ease: 'none', scrollTrigger: { trigger: section, start: 'top bottom', end: 'bottom top', scrub: true } });
}

/** Mozaik: kartlar scroll'la sırayla belirir (stagger, rotateY'den düzleşir); fare ile hafif 3D eğim. */
function motionShowcase() {
  const cards = gsap.utils.toArray('.mosaic .card');
  // fromTo: bitiş değerleri açık yazılır — 'from' ScrollTrigger yenilenmesinde başlangıcı bitiş sanıp kartları y:40'ta bırakıyor.
  gsap.fromTo(cards, { opacity: 0, y: 40, rotateY: -18 }, {
    opacity: 1, y: 0, rotateY: 0, stagger: .06, duration: .8, ease: 'power3.out',
    scrollTrigger: { trigger: '.mosaic', start: 'top 80%', once: true },
  });
  cards.forEach((c) => {
    c.addEventListener('mousemove', (e) => {
      const r = c.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - .5;
      const py = (e.clientY - r.top) / r.height - .5;
      gsap.to(c, { rotateY: px * 14, rotateX: -py * 10, scale: 1.04, duration: .3, transformPerspective: 700 });
    });
    c.addEventListener('mouseleave', () => gsap.to(c, { rotateY: 0, rotateX: 0, scale: 1, duration: .4 }));
  });
}

/** İki katman: arka plan poster yavaş, metin normal. */
function motionSelfie() {
  gsap.to('#selfie-bg', { yPercent: 14, ease: 'none', scrollTrigger: { trigger: '.selfie', start: 'top bottom', end: 'bottom top', scrub: true } });
}
