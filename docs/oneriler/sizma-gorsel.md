# Sızma — yeni görseller (ChatGPT için tarifler)

Bu dosyadaki her blok ChatGPT'ye **olduğu gibi** kopyalanıp yapıştırılır. Her bloğun üstünde: hangi görsel, hangi
adla kaydedileceği, oranı ve şeffaflığı, referans olarak yüklenecek mevcut görsel yazar.

Görseller gelene kadar oyunda üçünün de SVG karşılığı çizilir; oyun görselsiz de eksiksiz çalışır. Bir görsel
`apps/client/public/assets/props/sizma/<ad>.webp` olarak eklenince bir sonraki derlemede kendiliğinden kullanılır
(kod değişmez; `vite.config.ts` derleme anında klasördeki dosyaları listeler, olmayan dosya istenmez). WebP, ≤ 60 KB.

Üç görsel aynı maskenin parçalarıdır: önce bütün maskeyi üret, onaylanınca **onu referans vererek** iki kırık parçayı
aynı sohbette üret (aynı renk, aynı çizgi kalınlığı, aynı açı). Parçalar üst üste konunca bütün maskeyi oluşturmalı.

Ortak kural: görselde yazı, harf, sayı yok; zemin şeffaf (araç desteklemiyorsa düz, gölgesiz **#00FF00** yeşil).

---

## 1. Sızma maskesi (bütün)

- Dosya adı: `maske.webp` (üretimde `sizma-maske.png`)
- Oran: yatay 3:2 (oyunda sonuç portresinin yüzünün üstünde, yaklaşık 90×60 px; TV'de 160×105 px); **şeffaf zemin**
- Kullanım: sonuç açılışında sızmanın portresinin yüzünü örten domino maske; yakalanınca sallanır ve kırılır,
  kurtulunca göz kırpar.
- Referans olarak yükle: `apps/client/public/assets/avatars/busts/p2-magenta-bust-v1.webp`

```
Same style as the attached reference. Stylized cel-shaded comic illustration, bold dark outlines, dark moody base colors with vivid neon accents (cyan #2EF2FF, magenta #FF2BD6, amber #FFC23B, lime #B6FF3B, violet #8B5CFF), soft neon glow, clean shapes, slightly playful party-game mood, high contrast, no text, no letters, no logos, no watermark.
A single carnival domino eye mask seen straight from the front, glossy neon magenta (#FF2BD6) with a darker magenta underside, two almond-shaped eye holes that are completely empty and transparent, a thin bright rim light along the top edge and a small sharp highlight on the left cheek. Symmetric, slightly mischievous shape with pointed outer corners, no strings, no ribbons, no face behind it. The mask fills about 90 percent of the width and is centered.
Avoid: text, letters, numbers, watermark, logo, signature, real brands, real people, photorealistic, gore, blood, blurry, low detail, cluttered composition, face, eyes inside the holes, strings, feathers, background scenery.
Transparent background (if not possible: flat solid #00FF00 green background with no shadow). Landscape 3:2 aspect ratio.
```

---

## 2. Kırık maske — sol parça

- Dosya adı: `maske-parca-sol.webp` (üretimde `sizma-maske-parca-sol.png`)
- Oran: yatay 3:2, **1. görselle aynı tuval boyutu ve aynı konum**; **şeffaf zemin**
- Kullanım: maske kırılınca sol yarısı aşağı-sola dönerek düşer. Parça, bütün maskenin tam olarak bulunduğu yerde
  durmalı (tuvalin sağ yarısı boş kalır), kırık kenarı ortadan yukarıdan aşağı zikzakla iner.
- Referans olarak yükle: 1. görsel (`maske.webp`, onaylanan hâli)

```
Same style as the attached reference. Stylized cel-shaded comic illustration, bold dark outlines, dark moody base colors with vivid neon accents (cyan #2EF2FF, magenta #FF2BD6, amber #FFC23B, lime #B6FF3B, violet #8B5CFF), soft neon glow, clean shapes, slightly playful party-game mood, high contrast, no text, no letters, no logos, no watermark.
Exactly the same magenta domino eye mask as the attached reference, same size, same position and same lighting on the same canvas, but cracked in two: show ONLY the left half. The break runs from the top center to the bottom center as a sharp jagged zigzag line, with a thin bright inner edge along the crack and two or three tiny shards just next to it. The left eye hole stays complete and transparent. Everything right of the crack is empty and transparent.
Avoid: text, letters, numbers, watermark, logo, signature, real brands, real people, photorealistic, gore, blood, blurry, low detail, cluttered composition, the right half of the mask, face, background scenery, moving the mask.
Transparent background (if not possible: flat solid #00FF00 green background with no shadow). Landscape 3:2 aspect ratio.
```

---

## 3. Kırık maske — sağ parça

- Dosya adı: `maske-parca-sag.webp` (üretimde `sizma-maske-parca-sag.png`)
- Oran: yatay 3:2, **1. görselle aynı tuval boyutu ve aynı konum**; **şeffaf zemin**
- Kullanım: maske kırılınca sağ yarısı aşağı-sağa dönerek düşer. Kırık kenarı 2. görselin kırık kenarıyla birebir
  örtüşmeli (iki parça yan yana konunca bütün maske oluşur).
- Referans olarak yükle: 1. görsel (`maske.webp`) ve 2. görsel (`maske-parca-sol.webp`), onaylanan hâlleri

```
Same style as the attached references. Stylized cel-shaded comic illustration, bold dark outlines, dark moody base colors with vivid neon accents (cyan #2EF2FF, magenta #FF2BD6, amber #FFC23B, lime #B6FF3B, violet #8B5CFF), soft neon glow, clean shapes, slightly playful party-game mood, high contrast, no text, no letters, no logos, no watermark.
Exactly the same magenta domino eye mask as the first attached reference, same size, same position and same lighting on the same canvas, cracked in two: show ONLY the right half, the piece that fits perfectly against the left half in the second attached reference. The jagged zigzag break edge must match the left piece exactly, with a thin bright inner edge along the crack and two or three tiny shards just next to it. The right eye hole stays complete and transparent. Everything left of the crack is empty and transparent.
Avoid: text, letters, numbers, watermark, logo, signature, real brands, real people, photorealistic, gore, blood, blurry, low detail, cluttered composition, the left half of the mask, face, background scenery, moving the mask.
Transparent background (if not possible: flat solid #00FF00 green background with no shadow). Landscape 3:2 aspect ratio.
```
