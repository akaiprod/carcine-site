import { FEATURED_SLUGS, REEL_SLUGS, STRIP_COUNT, fmtDuration, jagPhoto, pickLang, showcasePicks, siteThumb, siteVideo, stripPicks, t } from './core.js';

const LS = 'carcine.lang';
let lang = 'en';
let dict = {};
let catalog = { categories: [] };
let reelItems = [];
let reelIndex = 0;

function readStored() { try { return localStorage.getItem(LS); } catch { return null; } }
function writeStored(v) { try { localStorage.setItem(LS, v); } catch { /* özel pencere */ } }

/* --- Yardımcılar ------------------------------------------------------- */

/** Hareket kapalı mı: ?nomotion (elle deneme) ya da işletim sistemi tercihi. */
function motionOff() {
  return new URLSearchParams(location.search).has('nomotion')
    || matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Başlık harfleri: her karakter span, ama kelime kabuğu içinde — inline-block harfler arasında
 * satır sonu oluşabiliyordu ("PICK A SCE / NE."). Boşluklar gerçek metin düğümü: satır yalnız orada kırılır.
 * Metin aria-label'a taşınır, kabuk aria-hidden ile alt ağacı ekran okuyucudan gizler.
 */
function splitChars(el) {
  const text = el.textContent;
  el.setAttribute('aria-label', text);
  el.textContent = '';
  text.split(' ').forEach((word, w) => {
    if (w) el.appendChild(document.createTextNode(' '));
    const wrap = document.createElement('span');
    wrap.className = 'word';
    wrap.setAttribute('aria-hidden', 'true');
    for (const ch of word) {
      const sp = document.createElement('span');
      sp.className = 'ch';
      sp.textContent = ch;
      wrap.appendChild(sp);
    }
    el.appendChild(wrap);
  });
}

/** Bölüm bir ekran yaklaşınca bir kez: ağır varlıklar ancak o an iner. */
function loadOnApproach(trigger, fn) {
  ScrollTrigger.create({ trigger, start: 'top 150%', once: true, onEnter: fn });
}

function applyI18n() {
  const d = dict[lang];
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const txt = t(d, el.dataset.i18n);
    el.textContent = txt;
    // splitChars aria-label bıraktıysa dil değişiminde bayat kalmasın (data-i18n-aria/#lang sonra ezer).
    if (el.hasAttribute('aria-label')) el.setAttribute('aria-label', txt);
  });
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
  renderReelMeta();
}

/** Showreel sağ sütunu: sahne sayacı + kategori/süre çipleri — sahne değişiminde tek başına da çağrılır. */
function renderReelMeta() {
  const chips = document.getElementById('reel-chips');
  if (!chips || !reelItems.length) return;
  const tpl = reelItems[reelIndex];
  const cat = catalog.categories.find((c) => c.templates.includes(tpl));
  const pad = (n) => String(n).padStart(2, '0');
  const count = document.getElementById('reel-count');
  if (count) count.textContent = `${pad(reelIndex + 1)} / ${pad(reelItems.length)}`;
  chips.textContent = '';
  for (const txt of [cat ? cat.name[lang] : null, fmtDuration(tpl.duration_sec, lang)]) {
    if (!txt) continue;
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = txt;
    chips.appendChild(chip);
  }
}

function card(tpl, { eager = false, interactive = false } = {}) {
  const el = document.createElement(interactive ? 'button' : 'div');
  el.className = 'card';
  if (interactive) { el.type = 'button'; el.setAttribute('aria-label', tpl.name[lang]); }

  const img = document.createElement('img');
  // Kart ekranda en fazla ~220 px: 360×640 küçük resim (~25 KB), tam poster değil.
  img.src = siteThumb(tpl.slug);
  img.alt = '';
  img.setAttribute('width', '360');
  img.setAttribute('height', '640');
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

/** Hero videosu: tek autoplay (sahip onayı, mobil dâhil); hareket kapalıysa yalnız poster. */
function buildHero(posterUrl) {
  const v = document.getElementById('hero-video');
  if (!v) return;
  if (posterUrl) v.poster = posterUrl;
  if (motionOff()) return;
  v.src = siteVideo('neon-cruise');
  v.autoplay = true;
  v.play().catch(() => {});
  // Bağlam dışı: hero videosu masaüstü/mobil ayrımı olmadan çalışır, sekme gizlenince dursun (pil).
  document.addEventListener('visibilitychange', () => (document.hidden ? v.pause() : v.play().catch(() => {})));
}

function buildStrip() {
  const track = document.getElementById('strip');
  const picks = stripPicks(catalog, STRIP_COUNT);
  // İki kopya: sonsuz döngü için xPercent -50 (Görev 5).
  for (const pass of [0, 1]) picks.forEach((tpl, i) => track.appendChild(card(tpl, { eager: pass === 0 && i < 4 })));
  return picks;
}

/** Showreel: 5 featured sahne tek çerçevede (masaüstü pin) + mobil scroll-snap kartları. */
function buildReel() {
  const all = catalog.categories.flatMap((c) => c.templates);
  const items = REEL_SLUGS.map((slug) => all.find((tpl) => tpl.slug === slug)).filter(Boolean);
  const frame = document.getElementById('reel-frame');
  const titles = document.getElementById('reel-titles');
  const dots = document.getElementById('reel-dots');
  const mobile = document.getElementById('reel-mobile');
  if (!frame || !items.length) return items;
  items.forEach((tpl, i) => {
    const v = document.createElement('video');
    v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'none';
    v.setAttribute('aria-hidden', 'true');
    v.poster = tpl.poster; v.dataset.src = siteVideo(tpl.slug); v.dataset.i = String(i);
    frame.appendChild(v);
    const h = document.createElement('div');
    h.className = 'rt'; h.dataset.nameEn = tpl.name.en; h.dataset.nameTr = tpl.name.tr;
    titles.appendChild(h);
    const d = document.createElement('li');
    if (i === 0) d.classList.add('is-on');
    dots.appendChild(d);
    mobile.appendChild(card(tpl, { interactive: true }));
  });
  return items;
}

/** Marquee: kategori adları + "her hafta yeni sahne", iki kopya (xPercent -50 döngüsü). */
function buildMarquee() {
  const track = document.getElementById('marquee');
  if (!track) return;
  const words = catalog.categories.map((c) => ({ en: c.name.en, tr: c.name.tr }));
  for (const pass of [0, 1]) {
    words.forEach((w) => {
      const sp = document.createElement('span');
      sp.dataset.nameEn = w.en; sp.dataset.nameTr = w.tr;
      track.appendChild(sp);
    });
    const m = document.createElement('span');
    m.dataset.i18n = 'templates.more';
    track.appendChild(m);
  }
}

/** "8 fotoğraftan filme": 8 Jaguar açı fotoğrafı + merkezdeki race-day videosu (tıkla oynat). */
function buildProof() {
  const ring = document.getElementById('proof-ring');
  const box = document.getElementById('proof-video');
  if (!ring || !box) return;
  for (let i = 0; i < 8; i++) {
    const img = document.createElement('img');
    img.src = jagPhoto(i); img.alt = ''; img.loading = 'lazy'; img.decoding = 'async'; img.width = 720; img.height = 1280;
    ring.appendChild(img);
  }
  const all = catalog.categories.flatMap((c) => c.templates);
  const rd = all.find((tpl) => tpl.slug === 'race-day');
  const v = document.createElement('video');
  v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'none';
  v.setAttribute('aria-hidden', 'true');
  if (rd) v.poster = rd.poster;
  v.dataset.src = siteVideo('race-day');
  box.appendChild(v);
  // preload="none" olduğu için ilk tıkta indirmeyi de açmak gerekir; play() reddedilirse canplay'i bekle.
  const start = () => v.play().catch(() => {
    v.addEventListener('canplay', () => v.play().catch(() => {}), { once: true });
  });
  box.addEventListener('click', () => {
    if (!v.src) { v.src = v.dataset.src; v.preload = 'auto'; }
    if (v.paused) start(); else v.pause();
  });
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
  const groups = [4, 2, 3].slice(0, wide.length);
  if (wide.length < 3) console.warn('carcine: vitrin 3 geniş kart bekliyor, bulunan', wide.length);
  const order = [];
  let k = 0;
  wide.forEach((tpl, i) => {
    const take = groups[i] ?? 0;
    order.push({ tpl, isWide: true });
    rest.slice(k, k + take).forEach((r) => order.push({ tpl: r, isWide: false }));
    k += take;
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
  if (new URLSearchParams(location.search).has('nomotion')) document.documentElement.classList.add('nomotion');
  lang = pickLang({ query: location.search, stored: readStored(), navigatorLang: navigator.language });
  const picks = buildStrip();
  reelItems = buildReel();
  buildMarquee();
  buildProof();
  const featured = buildShowcase();
  const still = featured || picks[0];
  if (still) seedStills(still);
  applyI18n();
  const neon = catalog.categories.flatMap((c) => c.templates).find((tpl) => tpl.slug === 'neon-cruise');
  buildHero(neon ? neon.poster : '');
  initMotion();
}

/** GSAP kancası: masaüstü + hareket kısıtlaması yoksa; matchMedia sorgu dışına çıkınca her şeyi geri alır. */
function initMotion() {
  if (!window.gsap) return;
  if (motionOff()) return;
  gsap.registerPlugin(ScrollTrigger);
  gsap.matchMedia().add('(min-width: 768px) and (prefers-reduced-motion: no-preference)', () => {
    // Dinleyiciler de sorgu dışına çıkınca kalkar (tween'leri matchMedia kendi geri alır).
    const ctrl = new AbortController();
    initLenis(ctrl.signal);
    motionHeroTitle();
    initCursor(ctrl.signal);
    motionStrip(ctrl.signal);
    // Pin'ler belge sırasıyla kurulur: sonraki bölümün start'ı önceki pin-spacer'ı hesaba katsın.
    motionReel();
    motionHow();
    motionProof();
    motionHeadings();
    motionShowcase(ctrl.signal);
    motionSelfie();
    // Pin-spacer'lar eklendikten sonra tek toplu ölçüm.
    ScrollTrigger.refresh();
    // Sekme arka planda: bölüm videoları dursun, geri gelince yalnız duranlar devam etsin (pil).
    const pausedByTab = new Set();
    document.addEventListener('visibilitychange', () => {
      const vids = document.querySelectorAll('#reel-frame video, #proof-video video');
      if (document.hidden) {
        vids.forEach((v) => { if (!v.paused) { pausedByTab.add(v); v.pause(); } });
      } else {
        pausedByTab.forEach((v) => v.play().catch(() => {}));
        pausedByTab.clear();
      }
    }, { signal: ctrl.signal });
    return () => {
      ctrl.abort();
      document.querySelectorAll('#reel-frame video, #proof-video video').forEach((v) => v.pause());
    };
  });
}

/** Scroll'la sürülen katman kayması (parallax). */
function parallax(el, yPercent, trigger) {
  gsap.to(el, { yPercent, ease: 'none', scrollTrigger: { trigger, start: 'top bottom', end: 'bottom top', scrub: true } });
}

/** Lenis: GSAP ticker'a bağlı yumuşak scroll; sorgu dışına çıkınca ticker'dan da düşer. */
function initLenis(signal) {
  if (!window.Lenis) return;
  const lenis = new Lenis({ lerp: .09, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  const tick = (time) => lenis.raf(time * 1000);
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);
  signal?.addEventListener('abort', () => {
    gsap.ticker.remove(tick);
    gsap.ticker.lagSmoothing(500, 33); // GSAP varsayılanı
    lenis.destroy();
  });
}

/** Hero başlığı: harf harf yükselir (yükleme anı, bir kez). */
function motionHeroTitle() {
  document.querySelectorAll('.hero h1.big [data-i18n]').forEach(splitChars);
  gsap.from('.hero h1.big .ch', { yPercent: 110, opacity: 0, rotationX: -40, stagger: .025, duration: .9, ease: 'power4.out', delay: .1 });
  gsap.from('.hero .lab, .hero .hero-row, .hero .stores', { y: 20, opacity: 0, stagger: .12, duration: .8, ease: 'power3.out', delay: .5 });
}

/** Özel imleç: nokta fareyi izler, kart/videoda "▶" olur (yalnız pointer: fine). */
function initCursor(signal) {
  const c = document.getElementById('cursor');
  if (!c || !matchMedia('(pointer: fine)').matches) return;
  c.classList.add('is-live');
  gsap.set(c, { xPercent: -50, yPercent: -50 });
  // quickTo kanonik ad ister: 'x'/'y'.
  const x = gsap.quickTo(c, 'x', { duration: .18, ease: 'power3' });
  const y = gsap.quickTo(c, 'y', { duration: .18, ease: 'power3' });
  window.addEventListener('pointermove', (e) => { x(e.clientX); y(e.clientY); }, { passive: true, signal });
  document.addEventListener('pointerover', (e) => c.classList.toggle('is-play', !!e.target.closest('.card, .reel-frame, .proof-video')), { signal });
}

/** Sonsuz şerit: iki kopya, xPercent -50 döngü; scroll hızı timeScale'i büyütür, sonra 1'e döner. */
function motionStrip(signal) {
  const track = document.getElementById('strip');
  const loop = gsap.to(track, { xPercent: -50, duration: 48, ease: 'none', repeat: -1 });
  const toScale = gsap.quickTo(loop, 'timeScale', { duration: 1.2, ease: 'power2.out' });
  const settle = gsap.delayedCall(.2, () => toScale(1)).pause();
  ScrollTrigger.create({
    onUpdate: (self) => {
      toScale(1 + Math.min(Math.abs(self.getVelocity()) / 600, 5));
      settle.restart(true);
    },
  });
  // Sekme arka planda: döngü dursun (pil).
  document.addEventListener('visibilitychange', () => (document.hidden ? loop.pause() : loop.resume()), { signal });
}

/** Pin'li bölüm: scrub ile 3 adım sırayla belirir, telefon ekranı adım görselini değiştirir, telefon yavaş kayar. */
function motionHow() {
  const section = document.querySelector('.how');
  const steps = gsap.utils.toArray('.step');
  const shots = gsap.utils.toArray('.shot');
  gsap.set(steps, { opacity: .25, y: 24 });
  const tl = gsap.timeline({
    scrollTrigger: { trigger: section, start: 'top 72px', end: '+=180%', pin: true, scrub: .6 },
    // Adım görseli ilerlemeden türetilir: ileri/geri atlayınca da doğru kare açık kalır.
    onUpdate: () => {
      const i = Math.min(steps.length - 1, Math.floor(tl.progress() * steps.length));
      shots.forEach((img, j) => img.classList.toggle('is-on', j === i));
    },
  });
  steps.forEach((s, i) => {
    tl.to(s, { opacity: 1, y: 0, duration: 1 }, i);
    if (i < steps.length - 1) tl.to(s, { opacity: .35, duration: .6 }, i + 1);
  });
  tl.to('.phone', { yPercent: -8, ease: 'none', duration: steps.length }, 0);
}

/** Mozaik: kartlar scroll'la sırayla belirir (stagger, rotateY'den düzleşir); fare ile hafif 3D eğim. */
function motionShowcase(signal) {
  const cards = gsap.utils.toArray('.mosaic .card');
  // fromTo: bitiş değerleri açık yazılır — 'from' ScrollTrigger yenilenmesinde başlangıcı bitiş sanıp kartları y:40'ta bırakıyor.
  gsap.fromTo(cards, { opacity: 0, y: 40, rotationY: -18 }, {
    opacity: 1, y: 0, rotationY: 0, stagger: .06, duration: .8, ease: 'power3.out',
    scrollTrigger: { trigger: '.mosaic', start: 'top 80%', once: true },
  });
  cards.forEach((c) => {
    gsap.set(c, { transformPerspective: 700 });
    // quickTo: kart başına tek tween, her fare hareketinde yenisi yaratılmaz.
    // Özellik adları GSAP'nin kanonik adları olmalı — quickTo 'rotateY'/'scale' takma adlarını sessizce yutar.
    const toRotY = gsap.quickTo(c, 'rotationY', { duration: .3 });
    const toRotX = gsap.quickTo(c, 'rotationX', { duration: .3 });
    const toScaleX = gsap.quickTo(c, 'scaleX', { duration: .3 });
    const toScaleY = gsap.quickTo(c, 'scaleY', { duration: .3 });
    const scaleTo = (v) => { toScaleX(v); toScaleY(v); };
    c.addEventListener('mousemove', (e) => {
      const r = c.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - .5;
      const py = (e.clientY - r.top) / r.height - .5;
      toRotY(px * 14); toRotX(-py * 10); scaleTo(1.04);
    }, { signal });
    c.addEventListener('mouseleave', () => { toRotY(0); toRotX(0); scaleTo(1); }, { signal });
  });
}

/** İki katman: arka plan poster yavaş, metin normal. */
function motionSelfie() {
  parallax('#selfie-bg', 14, '.selfie');
}

/** Showreel pin: scrub ilerlemesi sahneyi seçer — crossfade, tipografi uçuşu, nokta, oynatma. */
function motionReel() {
  const frame = document.getElementById('reel-frame');
  if (!frame || !reelItems.length) return;
  const videos = gsap.utils.toArray('#reel-frame video');
  const titles = gsap.utils.toArray('#reel-titles .rt');
  const dots = gsap.utils.toArray('#reel-dots li');
  const n = videos.length;
  // Yalnız gereken sahne iner: yaklaşınca ilk sahne, sonrakiler sırası gelince (+1 önden).
  const srcFor = (i) => { const v = videos[i]; if (v && !v.src) v.src = v.dataset.src; };
  loadOnApproach('.reel', () => srcFor(0));
  gsap.set(videos[0], { opacity: 1 });
  gsap.set(titles[0], { opacity: 1 });
  let active = 0;
  const show = (i) => {
    if (i === active) return;
    gsap.to(videos[active], { opacity: 0, duration: .5 });
    gsap.to(videos[i], { opacity: 1, duration: .5 });
    gsap.fromTo(titles[i], { x: -40, opacity: 0 }, { x: 0, opacity: 1, duration: .5, ease: 'power3.out' });
    gsap.to(titles[active], { x: 30, opacity: 0, duration: .35 });
    dots[active].classList.remove('is-on');
    dots[i].classList.add('is-on');
    videos[active].pause();
    srcFor(i);
    videos[i].play().catch(() => {});
    srcFor(i + 1);
    active = i;
    reelIndex = i;
    // Yalnız etiketler: applyI18n bütün [data-i18n] metnini yeniden yazar, başlık harflerini siler.
    renderReelMeta();
  };
  ScrollTrigger.create({
    trigger: '.reel', start: 'top top', end: `+=${n * 100}%`, pin: '.reel-stage', scrub: true,
    onUpdate: (self) => show(Math.min(n - 1, Math.floor(self.progress * n))),
    onEnter: () => videos[active].play().catch(() => {}),
    onLeave: () => videos[active].pause(),
    onEnterBack: () => videos[active].play().catch(() => {}),
    onLeaveBack: () => videos[active].pause(),
  });
}

/** 8 fotoğraf → film: fotoğraflar kenarlardan elips dizilime uçar, sonra merkeze çöker; video büyüyüp oynar. */
function motionProof() {
  const imgs = gsap.utils.toArray('#proof-ring img');
  const v = document.querySelector('#proof-video video');
  if (!imgs.length || !v) return;
  loadOnApproach('.proof', () => { if (!v.src) v.src = v.dataset.src; });
  const rx = () => Math.min(innerWidth * .38, 520);
  const ry = () => Math.min(innerHeight * .34, 300);
  gsap.set(imgs, { xPercent: -50, yPercent: -50 });
  gsap.set(v.parentElement, { scale: 0, opacity: 0 });
  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: '.proof', start: 'top top', end: '+=250%', pin: '.proof-stage', scrub: .5, invalidateOnRefresh: true,
      onUpdate: (self) => {
        if (self.progress > .6) { if (v.paused) v.play().catch(() => {}); }
        else if (!v.paused) v.pause();
      },
    },
  });
  imgs.forEach((img, i) => {
    const a = (i / imgs.length) * Math.PI * 2 - Math.PI / 2;
    tl.fromTo(img, { x: () => Math.cos(a) * innerWidth, y: () => Math.sin(a) * innerHeight, rotation: (i % 2 ? 1 : -1) * 18, opacity: 0 },
      { x: () => Math.cos(a) * rx(), y: () => Math.sin(a) * ry(), rotation: (i % 2 ? 1 : -1) * 6, opacity: 1, duration: 1, ease: 'power3.out' }, i * .08);
  });
  tl.to(imgs, { x: 0, y: 0, scale: .2, opacity: 0, duration: .8, ease: 'power3.in', stagger: .03 }, 1.6)
    .to(v.parentElement, { scale: 1, opacity: 1, duration: .8, ease: 'power3.out' }, 1.9);
}

/** Bölüm başlıkları: scroll'la harf harf yükselir (bir kez). */
function motionHeadings() {
  document.querySelectorAll('section:not(.hero) h2.big').forEach((h) => {
    splitChars(h);
    gsap.from(h.querySelectorAll('.ch'), {
      yPercent: 100, opacity: 0, stagger: .015, duration: .7, ease: 'power3.out',
      scrollTrigger: { trigger: h, start: 'top 85%', once: true },
    });
  });
}

main().catch((e) => console.error('site init', e));
