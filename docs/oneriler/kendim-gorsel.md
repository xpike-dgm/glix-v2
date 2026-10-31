# Kendim — yeni görseller (ChatGPT için tarifler)

Bu dosyadaki her blok ChatGPT'ye **olduğu gibi** kopyalanıp yapıştırılır. Her bloğun üstünde: hangi görsel, hangi
adla kaydedileceği, oranı ve şeffaflığı, referans olarak yüklenecek mevcut görsel yazar.

Görseller gelene kadar oyunda ikisinin de CSS karşılığı çizilir; oyun görselsiz de eksiksiz çalışır. Bir görsel
`apps/client/public/assets/props/kendim/<ad>.webp` olarak eklenince bir sonraki derlemede **kod değişmeden**
kullanılır (`vite.config.ts` `__KENDIM_PROPS__` derlemede var olan dosyaları listeler; `apps/client/src/games/kendim/art.ts`).
Dosya yokken istenmez (404 yok). WebP; ayna ≤ 120 KB, kart arka yüzü ≤ 60 KB.

Ortak kural: görselde yazı, harf, sayı yok.

---

## 1. Ayna çerçevesi (KN-U1)

- Dosya adı: `ayna-cercevesi.webp` (üretimde `kendim-ayna-cercevesi.png`)
- Oran: dikey **3:4**; **şeffaf zemin** ve **şeffaf orta** (çerçevenin içi tamamen boş/şeffaf olmalı; camı ve buğuyu
  oyun CSS ile çizer, yazı panosu camın ortasında durur)
- Kullanım: yazma ekranının ortasını kaplayan büyük ayna; telefonda yaklaşık 350×470 px, TV'de ~330×440 px. Oyun
  görseli kutuya **esneterek** oturtur, camı şu boşluğa çizer: soldan ve sağdan %11, üstten %9, alttan %8 içeride;
  camın üst kenarı **sivri değil yuvarlak gotik kemer** (yarım daireye yakın), alt köşeler hafif yuvarlak. Çerçevenin iç
  kenarı bu boşluğa denk gelmeli; çerçeve kalınlığı her yanda kabaca eşit (üstte kemerin tepesinde küçük bir süs olabilir).
- Referans olarak yükle: `apps/client/public/assets/worlds/kendim-portrait.webp` (arka plandaki aynalı salonla aynı
  aile görünmeli)

```
Same style as the attached reference. Stylized cel-shaded comic illustration, bold dark outlines, dark moody base colors with vivid neon accents (cyan #2EF2FF, magenta #FF2BD6, amber #FFC23B, lime #B6FF3B, violet #8B5CFF), soft neon glow, clean shapes, slightly playful party-game mood, high contrast, no text, no letters, no logos, no watermark.
An ornate gothic standing-mirror frame seen perfectly straight from the front, matching the mirrors in the attached hall: polished antique gold frame with deep violet (#8B5CFF) enamel inlays and dark plum shadows, a rounded gothic arch at the top crowned by a small violet gemstone finial, slim carved pillars on the left and right sides, a slightly heavier carved base at the bottom. The frame is a thin, even border of roughly the same thickness on every side; the opening inside the frame is completely empty and fully transparent (no glass, no reflection, no fog, nothing inside). Subtle violet rim glow on the outer edge of the gold. Perfectly centered and symmetric, the frame touches all four edges of the image.
Avoid: text, letters, numbers, watermark, logo, signature, real brands, real people, photorealistic, gore, blood, blurry, low detail, cluttered composition, glass, mirror reflection, fog, person, face, candles, background scenery, perspective tilt, cracks.
Transparent background and transparent inner opening (if not possible: flat solid #00FF00 green background and green inner opening with no shadow). Portrait 3:4 aspect ratio.
```

---

## 2. Kart arka yüzü (KN-U4)

- Dosya adı: `kart-arka.webp` (üretimde `kendim-kart-arka.png`)
- Oran: yatay **5:3**; **opak** (şeffaflık yok)
- Kullanım: kart kart açılışta kart döndüğünde görünen yüz. Bu yüzün ortasına oyun kart sahibinin **yuvarlak avatarını**
  (kartın yüksekliğinin ~%35'i), üstüne küçük kelimeyi, altına sahibin adını yazar. Bu yüzden **merkez sade ve koyu**
  kalmalı (boş yuvarlak madalyon yuvası); süsler kenarlarda ve köşelerde olmalı. Telefonda ~320×192 px, TV'de ~380×228 px;
  oyun köşeleri 18 px yuvarlatır, kenarlara yakın 4 px'lik bir bölge kırpılabilir.
- Referans olarak yükle: `apps/client/public/assets/briefing/kendim-2.webp` (havada uçan mor-altın kart sırtları; aynı
  tasarımın yatay hâli olmalı)

```
Same style as the attached reference. Stylized cel-shaded comic illustration, bold dark outlines, dark moody base colors with vivid neon accents (cyan #2EF2FF, magenta #FF2BD6, amber #FFC23B, lime #B6FF3B, violet #8B5CFF), soft neon glow, clean shapes, slightly playful party-game mood, high contrast, no text, no letters, no logos, no watermark.
The back of a playing card exactly like the purple-and-gold card backs flying in the attached reference, shown flat and straight from the front, filling the whole image edge to edge, in landscape orientation: deep plum-to-violet background with a fine diamond lattice pattern, a thin antique gold double border inset from the edges, small gold filigree ornaments in the four corners, and soft violet glow. The center holds an empty round gold-rimmed medallion (about one third of the card height) with a plain dark violet interior and nothing inside it; keep the area around the medallion calm and dark so a portrait can be placed on top later.
Avoid: text, letters, numbers, watermark, logo, signature, real brands, real people, photorealistic, gore, blood, blurry, low detail, cluttered composition, perspective, tilt, hands, table, other cards, symbols or icons inside the medallion, background scenery.
Opaque image, no transparency. Landscape 5:3 aspect ratio.
```

---

Buğu, cam parlaması, Tamam'daki ışık çakması, kazınmış kelime, neon ip, kilit, "TEK BULAN" şeridi ve "İkiz kelime!"
etiketi CSS ile çizilir; görsel gerekmez.
