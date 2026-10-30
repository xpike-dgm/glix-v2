# Kontrol Paneli Kaosu — üretilecek görseller

Onaylanan maddeler (KP-U1 bomba, KP-U3 kâğıt not, KP-M1 mor kablo) için üç görsel gerekir. Oyun bugün bunların
yerine CSS çizimi kullanır; dosya aşağıdaki yola konunca kod değişmeden görsel kullanılır (dosya yoksa CSS kalır).

Her blok tek başına yeterlidir: kod bloğunun tamamını ChatGPT'ye kopyalayıp yapıştır ve belirtilen referans
görseli de ekle. Görsel gelince yönetici WebP'ye çevirip (nesne: ≤ 60 KB) yola koyar ve
`apps/client/src/ui/props.ts` içindeki `GAME_PROPS["kontrol-paneli-kaosu"]` listesine ekler (önden indirme için).

---

## 1. Bomba gövdesi (KP-U1)

- **Dosya:** `apps/client/public/assets/props/kontrol-paneli-kaosu/bomba-govde.webp`
- **Oran / zemin:** yatay 3:2 (ör. 1536×1024), **şeffaf** zemin (desteklenmiyorsa düz #00FF00 yeşil). Ekranda
  yaklaşık 300×110 px alanda, ortalanarak ("contain") gösterilir.
- **Önemli:** ortadaki dijital saat ekranı **boş ve koyu** olmalı; saat rakamları, dalga yazısı ve LED kodla üstüne
  çizilir.
- **Referans (yükle):** `apps/client/public/assets/props/bomba/govde.webp` (mevcut bomba stili) ve
  `apps/client/public/assets/props/kontrol-paneli-kaosu/kablo-mavi.webp` (kablo stili).

```
Same style as the attached reference images. Stylized cel-shaded comic illustration, bold dark outlines, dark moody base colors with vivid neon accents (cyan #2EF2FF, magenta #FF2BD6, amber #FFC23B, lime #B6FF3B, violet #8B5CFF), soft neon glow, clean shapes, slightly playful party-game mood, high contrast, no text, no letters, no logos, no watermark. A wide, flat time-bomb casing seen straight from the front: a dark gunmetal rectangular box with rounded corners, four small screws in the corners, a few short colored wires (blue, green, red, yellow) looping out of both sides and back in, small rivets and panel seams. In the exact center there is a wide, empty, very dark recessed display window with a thin red-glowing bezel; the window is completely blank (no digits, no symbols) because numbers will be added later. A small empty round socket at the top-right corner of the casing for an indicator light. Symmetric composition, the casing fills the frame horizontally with a little margin, centered, isolated on a transparent background (if transparency is not possible, use a perfectly flat pure #00FF00 green background with no shadow). Landscape 3:2 aspect ratio. Avoid: text, letters, numbers, digits on the display, watermark, logo, signature, real brands, real people, photorealistic, gore, blood, blurry, low detail, cluttered composition, explosion, fire.
```

---

## 2. İpucu notu kâğıdı ve bant (KP-U3)

- **Dosya:** `apps/client/public/assets/props/kontrol-paneli-kaosu/not-kagidi.webp`
- **Oran / zemin:** yatay 3:2 (ör. 1536×1024), **şeffaf** zemin (desteklenmiyorsa düz #00FF00 yeşil). Not alanının
  tamamına gerilerek yerleşir; üstüne koyu mürekkeple ipucu cümlesi ve küçük bir şema yazılır, bu yüzden kâğıdın
  ortası **açık renkli ve sade** olmalı.
- **Referans (yükle):** mevcut oyun ekranı görüntüsü `docs/wiki/ekran/kontrol-play-n-4.webp` (notun yeri ve
  boyutu) ve `apps/client/public/assets/props/kontrol-paneli-kaosu/kivilcim.webp` (stil).

```
Same style as the attached reference images. Stylized cel-shaded comic illustration, bold dark outlines, dark moody base colors with vivid neon accents (cyan #2EF2FF, magenta #FF2BD6, amber #FFC23B, lime #B6FF3B, violet #8B5CFF), soft neon glow, clean shapes, slightly playful party-game mood, high contrast, no text, no letters, no logos, no watermark. A single torn-out notebook page, slightly crumpled and then flattened, seen straight from above: warm cream paper with faint pale-blue ruled lines, soft creases and a few gentle wrinkles near the edges, slightly irregular torn edges, one small coffee-ring stain in a corner. A strip of semi-transparent beige masking tape holds the page at the top center, slightly tilted. The center of the page is clean, light and evenly lit so that dark handwriting can be placed on it later; the page itself is completely blank. The page fills the frame with a small margin, centered, isolated on a transparent background (if transparency is not possible, use a perfectly flat pure #00FF00 green background with no shadow). Landscape 3:2 aspect ratio. Avoid: text, letters, numbers, handwriting, drawings on the page, watermark, logo, signature, real brands, real people, photorealistic, gore, blood, blurry, low detail, cluttered composition.
```

---

## 3. Mor kablo (KP-M1, dalga 3)

- **Dosya:** `apps/client/public/assets/props/kontrol-paneli-kaosu/kablo-mor.webp`
- **Oran / zemin:** kare 1:1 (1024×1024), **şeffaf** zemin (desteklenmiyorsa düz #00FF00 yeşil). Mevcut dört kablo
  görseliyle aynı kadraj, aynı kalınlık ve aynı açı; yalnız renk mor (#B25CFF).
- **Referans (yükle):** `apps/client/public/assets/props/kontrol-paneli-kaosu/kablo-mavi.webp` (birebir aynı
  kompozisyon, renk varyantı).

```
Same style as the attached reference image: create an exact color variant of it. Stylized cel-shaded comic illustration, bold dark outlines, dark moody base colors with vivid neon accents (cyan #2EF2FF, magenta #FF2BD6, amber #FFC23B, lime #B6FF3B, violet #8B5CFF), soft neon glow, clean shapes, slightly playful party-game mood, high contrast, no text, no letters, no logos, no watermark. The same single electric wire in the same metal channel, same framing, same camera angle, same thickness, same outline weight and same lighting as the reference, but the wire's insulation and its neon glow are vivid purple (#B25CFF) instead of blue. Nothing else changes. Centered, isolated on a transparent background (if transparency is not possible, use a perfectly flat pure #00FF00 green background with no shadow). Square 1:1 aspect ratio, 1024x1024. Avoid: text, letters, numbers, watermark, logo, signature, real brands, real people, photorealistic, gore, blood, blurry, low detail, cluttered composition, any other wire colors.
```
