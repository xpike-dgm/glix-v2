# Kule Ustası — yeni görseller (ChatGPT için tarifler)

Bu dosyadaki her blok ChatGPT'ye **olduğu gibi** kopyalanıp yapıştırılır. Her bloğun üstünde: hangi görsel, hangi
adla kaydedileceği, oranı ve şeffaflığı, referans olarak yüklenecek mevcut görsel yazar.

Görseller gelene kadar oyunda ikisinin de CSS/SVG karşılığı çizilir; oyun görselsiz de eksiksiz çalışır. Bir görsel
`apps/client/public/assets/props/kule-ustasi/<ad>.webp` olarak eklenince bir sonraki derlemede **kod değişmeden**
kullanılır (`vite.config.ts` `__KULE_PROPS__` derlemede var olan dosyaları listeler; `art.ts`). WebP, ≤ 60 KB.

Ortak kural: görselde yazı, harf, sayı yok; zemin şeffaf (araç desteklemiyorsa düz, gölgesiz **#00FF00** yeşil).

---

## 1. Vinç kancası (KU-U1)

- Dosya adı: `kanca.webp` (üretimde `kule-kanca.png`)
- Oran: dikey 5:6 (oyunda küçük, telefonda yaklaşık 26×31 px, TV'de ~60×70 px); **şeffaf zemin**
- Kullanım: kayan bloğun hemen üstünde, bloğu tutan vinç kancası. Görselin **üst kenarının ortası** halatın bağlandığı
  yerdir (halat CSS ile çizilir ve yukarı doğru devam eder: gri-mavi, ince); **alt kenarın ortası** bloğa değer.
  Kanca ucu tek parçadır; bırakışta ayrıca açılma görseli yoktur (oyun kancayı yukarı çeker).
- Referans olarak yükle: `apps/client/public/assets/worlds/kule-ustasi-portrait.webp` (arka plandaki vinçlerle uyum)

```
Same style as the attached reference. Stylized cel-shaded comic illustration, bold dark outlines, dark moody base colors with vivid neon accents (cyan #2EF2FF, magenta #FF2BD6, amber #FFC23B, lime #B6FF3B, violet #8B5CFF), soft neon glow, clean shapes, slightly playful party-game mood, high contrast, no text, no letters, no logos, no watermark.
A single construction crane hook seen straight from the front, matching the cranes in the reference: a compact amber (#FFC23B) pulley block with a dark steel frame at the top, and below it a thick steel claw hook made of two symmetric curved prongs that open downward like a grabber, holding nothing. A short stub of steel cable rises from the exact top center of the image. Clean silhouette readable at very small size, slight cyan rim light, perfectly centered and symmetric, the hook bottom touches the bottom edge of the image at its center.
Avoid: text, letters, numbers, watermark, logo, signature, real brands, real people, photorealistic, gore, blood, blurry, low detail, cluttered composition, crane arm, load or block attached, background scenery, long cable.
Transparent background (if not possible: flat solid #00FF00 green background with no shadow). Portrait 5:6 aspect ratio.
```

---

## 2. Kristal blok dokusu (KU-U1)

- Dosya adı: `blok-doku.webp` (üretimde `kule-blok-doku.png`)
- Oran: yatay 2:1 (oyunda yüksekliğe sığdırılıp yatay **tekrarlanır**; bir kat telefonda ~20–30 px yükseklikte);
  **opak**, şeffaflık yok
- Kullanım: kuledeki her katın ve kayan bloğun yüzeyi. Oyun dokuyu her katın kendi rengiyle **boyar**
  (`background-blend-mode: overlay`), yani doku **renksiz (nötr gri tonlu)** olmalı: açık gri parıltılar, koyu gri
  kenarlar. Sol ve sağ kenarlar kesintisiz birleşmeli (yatay döşenebilir).
- Referans olarak yükle: `apps/client/public/assets/briefing/kule-ustasi-1.webp` (anlatım görselindeki parlak bloklar)

```
Same style as the attached reference. Stylized cel-shaded comic illustration, bold dark outlines, dark moody base colors with vivid neon accents (cyan #2EF2FF, magenta #FF2BD6, amber #FFC23B, lime #B6FF3B, violet #8B5CFF), soft neon glow, clean shapes, slightly playful party-game mood, high contrast, no text, no letters, no logos, no watermark.
A seamless horizontally tileable texture of a glossy crystal glass slab surface seen from the front, fully desaturated neutral grayscale only (no color at all) so it can be tinted later: a mid-gray glass body with a few sharp diagonal white highlight facets, subtle inner refraction lines, a thin bright top edge highlight and a slightly darker bottom edge. The left and right edges must match perfectly so the texture repeats without a visible seam. Fills the whole frame edge to edge, flat front view, no perspective.
Avoid: text, letters, numbers, watermark, logo, signature, real brands, real people, photorealistic, gore, blood, blurry, low detail, cluttered composition, colors, hue, objects, frame or border, vignette, background scenery.
Opaque image, no transparency. Landscape 2:1 aspect ratio.
```

---

Toz bulutu, kesilen parça, altın şimşek dalgası, "KUSURSUZ!" damgası ve sıra halkası CSS ile çizilir; görsel gerekmez.
