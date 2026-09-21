# carcineapp.com

Carcine'in tanıtım sitesi — tek sayfa, bağımlılıksız (vanilla JS modülleri + GSAP/Lenis CDN),
GitHub Pages'ten yayınlanır. Hukuki sayfalar (`privacy*.html`, `terms*.html`) ayrı ve dokunulmaz:
mağaza kayıtları bu adreslere bakar.

## Çalıştırma

```sh
npm test                      # saf yardımcıların node --test testleri
python3 -m http.server 8787   # http://localhost:8787
```

Claude Code içinde: `.claude/launch.json` → `site` yapılandırması aynı sunucuyu açar.
Python sunucusu dosyaları tarayıcı önbelleğinde bayat bırakabiliyor; bir değişiklik görünmüyorsa
`touch assets/*` ve sert yenileme.

## URL kancaları

- `?lang=tr` / `?lang=en` — dili zorlar (yoksa `localStorage` > `navigator.language` > en).
- `?nomotion` — GSAP/Lenis hiç kurulmaz. `prefers-reduced-motion: reduce` ile aynı yüzeyi verir:
  hero videosu durur (yalnız poster), showreel pin yerine yatay kart dizisi, grain durur, imleç yok.
  Hareketsiz durumu denemek için bunu kullan.

## Veri ve varlıklar

**`assets/templates.json`** — şablon kataloğu (ad/süre/kategori/poster/render URL'leri).
carcine deposundan üretilir:

```sh
npx -y tsx scripts/build-templates-json.ts --out ~/carcine-site/assets/templates.json
```

**`site/v1/` varlıkları** — `templates` public bucket'ında, damgalı (önbellek kırıcı).
Damga `assets/core.js` içindeki `SITE_STAMP`; yeni yükleme yapınca orayı da güncelle.

| Ne | Nereden | Komut |
|---|---|---|
| `<slug>.<damga>.mp4` (36 adet, web boyutu) | `docs/h3-kanit/previews-v2/<slug>.mp4` | `ffmpeg -i in.mp4 -an -vf scale=-2:960 -c:v libx264 -preset slow -crf 27 -movflags +faststart -pix_fmt yuv420p out.mp4` |
| `thumb/<slug>.<damga>.jpg` (kart küçük resmi) | aynı önizleme karesi | `ffmpeg -i in.jpg -vf scale=360:-2 -q:v 5 out.jpg` |
| `jag/angle-<0-7>.<damga>.jpg` | `car-photos` bucket (sahibin Jaguar'ı), 1280 yükseklik | — |

Hero posteri LCP adayı olduğu için `index.html` içinde **iki yerde** elle yazılı
(`<link rel="preload" as="image">` ve `<video poster>`) — `templates.json` yenilenip neon-cruise
poster damgası değişirse ikisini de güncelle, yoksa poster 404 döner.
