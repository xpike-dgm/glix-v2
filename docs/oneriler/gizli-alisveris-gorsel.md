# Gizli Alışveriş — görsel tarifleri (ChatGPT'ye kopyala-yapıştır)

Onaylanan geliştirmeler (GA-M1, GA-M2, GA-U1, GA-U4, GA-U5) için gereken görseller. Her bölümdeki kod bloğunun
**tamamını** ChatGPT'ye yapıştır; bloğun içinde stil öneki, tarif, yasaklar, arka plan ve oran isteği hazırdır.
Her bölümün başında ChatGPT'ye **ek olarak yüklenecek referans görsel** yazıyor (repo içindeki yol).

Teslim: üretilen PNG'yi tablodaki dosya adıyla ver; yönetici kırpar, 256×256 WebP'ye (≤ 60 KB, şeffaf) çevirip
belirtilen yola koyar. Ürün görselleri için **kod değişikliği gerekmez**: dosya yerine konunca oyun onu kendiliğinden
kullanır (o zamana kadar ürün adının baş harflerini taşıyan neon kutu yer tutucusu görünür).

## Gereken görseller (özet)

| # | Görsel | Kaydedilecek dosya | Oran / zemin | Durum |
|---|---|---|---|---|
| 1 | Lazer Kalem | `apps/client/public/assets/props/gizli-alisveris/lazer-kalem.webp` | kare, şeffaf | gerekli |
| 2 | Ses Kartı | `apps/client/public/assets/props/gizli-alisveris/ses-karti.webp` | kare, şeffaf | gerekli |
| 3 | Retro Joystick | `apps/client/public/assets/props/gizli-alisveris/retro-joystick.webp` | kare, şeffaf | gerekli |
| 4 | Plazma Lamba | `apps/client/public/assets/props/gizli-alisveris/plazma-lamba.webp` | kare, şeffaf | gerekli |
| 5 | Mini Robot | `apps/client/public/assets/props/gizli-alisveris/mini-robot.webp` | kare, şeffaf | gerekli |
| 6 | Hologram Saat | `apps/client/public/assets/props/gizli-alisveris/hologram-saat.webp` | kare, şeffaf | gerekli |
| 7 | Neon Kaykay | `apps/client/public/assets/props/gizli-alisveris/neon-kaykay.webp` | kare, şeffaf | gerekli |
| 8 | VR Gözlük | `apps/client/public/assets/props/gizli-alisveris/vr-gozluk.webp` | kare, şeffaf | gerekli |
| 9 | Kupon etiketi | `apps/client/public/assets/props/gizli-alisveris/kupon.webp` | yatay 3:2, şeffaf | isteğe bağlı |
| 10 | Alışveriş poşeti | `apps/client/public/assets/props/gizli-alisveris/poset.webp` | kare, şeffaf | isteğe bağlı |
| 11 | Metal kepenk | `apps/client/public/assets/props/gizli-alisveris/kepenk.webp` | yatay 3:2, dolu | isteğe bağlı |
| 12 | Raf tahtası + fiyat etiketi | `apps/client/public/assets/props/gizli-alisveris/raf-tahtasi.webp`, `fiyat-etiketi.webp` | yatay / kare, şeffaf | isteğe bağlı |

"İsteğe bağlı" olanlar bugün oyunda CSS/SVG ile çiziliyor (kupon etiketi, poşet, kepenk, raf tahtası ve iple asılı
fiyat etiketi). Görsel üretilirse yerleştirmek için küçük bir kod değişikliği gerekir; üretmesen de oyun eksiksizdir.

---

## 1. Lazer Kalem — `lazer-kalem.png` → `lazer-kalem.webp` (kare 1:1, şeffaf zemin)

**Seriyi başlatan blok.** 8 ürünü **aynı sohbette sırayla** üret; bu ilk bloktur.
Referans olarak ChatGPT'ye yükle: `apps/client/public/assets/props/gizli-alisveris/mini-drone.webp` ve
`apps/client/public/assets/props/gizli-alisveris/retro-kartus.webp` (mevcut ürünlerin tarzı).

```
Same style as the attached reference images: they are item icons from the same game shop, and every new item must match them exactly in drawing style, outline thickness, lighting and camera angle. I will ask for 8 items one after another in this chat; keep the series consistent.

Stylized cel-shaded comic illustration, bold dark outlines, dark moody base colors with vivid neon accents (cyan #2EF2FF, magenta #FF2BD6, amber #FFC23B, lime #B6FF3B, violet #8B5CFF), soft neon glow, clean shapes, slightly playful party-game mood, high contrast, no text, no letters, no logos, no watermark.

A single futuristic laser pointer pen as a game shop item icon: a sleek dark metal pen body with a glowing cyan tip and a short bright laser beam with a small sparkle, magenta grip ring, isometric 3/4 view, centered, filling about 80 percent of the frame, isolated on a transparent background.

Square 1:1 image, transparent background (if transparency is not available, use a flat solid #00FF00 green background with no shadows or gradients).

Avoid: text, letters, numbers, watermark, logo, signature, real brands, real people, photorealistic, gore, blood, blurry, low detail, cluttered composition.
```

## 2. Ses Kartı — `ses-karti.png` → `ses-karti.webp` (kare 1:1, şeffaf zemin)

Referans: aynı sohbet (önceki görsel) + `apps/client/public/assets/props/gizli-alisveris/mini-hoparlor.webp`.

```
Same style, same lighting, same outline thickness and same camera angle as the previous image in this chat.

A single retro-futuristic sound card as a game shop item icon: a dark circuit board with glowing magenta and cyan traces, two small audio jacks and a tiny equalizer of neon lime bars rising from it, isometric 3/4 view, centered, filling about 80 percent of the frame, isolated on a transparent background.

Square 1:1 image, transparent background (if transparency is not available, use a flat solid #00FF00 green background with no shadows or gradients). No text, no letters, no numbers, no logos, no real brands, no watermark, not photorealistic.
```

## 3. Retro Joystick — `retro-joystick.png` → `retro-joystick.webp` (kare 1:1, şeffaf zemin)

Referans: aynı sohbet (önceki görsel) + `apps/client/public/assets/props/gizli-alisveris/arcade-eldiveni.webp`.

```
Same style, same lighting, same outline thickness and same camera angle as the previous image in this chat.

A single retro arcade joystick as a game shop item icon: a chunky dark base with a glossy magenta ball-top stick and two round amber buttons, cyan neon rim light along the edges, isometric 3/4 view, centered, filling about 80 percent of the frame, isolated on a transparent background.

Square 1:1 image, transparent background (if transparency is not available, use a flat solid #00FF00 green background with no shadows or gradients). No text, no letters, no numbers, no logos, no real brands, no watermark, not photorealistic.
```

## 4. Plazma Lamba — `plazma-lamba.png` → `plazma-lamba.webp` (kare 1:1, şeffaf zemin)

Referans: aynı sohbet (önceki görsel) + `apps/client/public/assets/props/gizli-alisveris/kristal-kulaklik.webp`.

```
Same style, same lighting, same outline thickness and same camera angle as the previous image in this chat.

A single plasma lamp as a game shop item icon: a glass sphere on a dark metal base, with glowing violet and magenta electric filaments reaching from a bright center to the glass, soft cyan glow around it, isometric 3/4 view, centered, filling about 80 percent of the frame, isolated on a transparent background.

Square 1:1 image, transparent background (if transparency is not available, use a flat solid #00FF00 green background with no shadows or gradients). No text, no letters, no numbers, no logos, no real brands, no watermark, not photorealistic.
```

## 5. Mini Robot — `mini-robot.png` → `mini-robot.webp` (kare 1:1, şeffaf zemin)

Referans: aynı sohbet (önceki görsel) + `apps/client/public/assets/props/gizli-alisveris/holo-kask.webp`.

```
Same style, same lighting, same outline thickness and same camera angle as the previous image in this chat.

A single small toy robot as a game shop item icon: a cute boxy robot with a dark glossy body, a glowing cyan visor face without a mouth, a tiny antenna with an amber light and lime accents on the joints, standing, isometric 3/4 view, centered, filling about 80 percent of the frame, isolated on a transparent background.

Square 1:1 image, transparent background (if transparency is not available, use a flat solid #00FF00 green background with no shadows or gradients). No text, no letters, no numbers, no logos, no real brands, no watermark, not photorealistic.
```

## 6. Hologram Saat — `hologram-saat.png` → `hologram-saat.webp` (kare 1:1, şeffaf zemin)

Referans: aynı sohbet (önceki görsel) + `apps/client/public/assets/props/gizli-alisveris/hologram-sticker.webp`.

```
Same style, same lighting, same outline thickness and same camera angle as the previous image in this chat.

A single futuristic wristwatch as a game shop item icon: a dark strap and round metal case, with a small glowing cyan holographic dial projected above the face showing abstract rings and dots (no digits), magenta accent ring, isometric 3/4 view, centered, filling about 80 percent of the frame, isolated on a transparent background.

Square 1:1 image, transparent background (if transparency is not available, use a flat solid #00FF00 green background with no shadows or gradients). No text, no letters, no numbers, no digits, no logos, no real brands, no watermark, not photorealistic.
```

## 7. Neon Kaykay — `neon-kaykay.png` → `neon-kaykay.webp` (kare 1:1, şeffaf zemin)

Referans: aynı sohbet (önceki görsel) + `apps/client/public/assets/props/gizli-alisveris/jet-canta.webp`.

```
Same style, same lighting, same outline thickness and same camera angle as the previous image in this chat.

A single skateboard as a game shop item icon: a dark deck with glowing magenta and cyan neon stripes along the edges and lime glowing wheels, slightly tilted, isometric 3/4 view, centered, filling about 80 percent of the frame, isolated on a transparent background. Abstract geometric pattern only on the deck, no graphics with words.

Square 1:1 image, transparent background (if transparency is not available, use a flat solid #00FF00 green background with no shadows or gradients). No text, no letters, no numbers, no logos, no real brands, no watermark, not photorealistic.
```

## 8. VR Gözlük — `vr-gozluk.png` → `vr-gozluk.webp` (kare 1:1, şeffaf zemin)

Referans: aynı sohbet (önceki görsel) + `apps/client/public/assets/props/gizli-alisveris/piksel-kamera.webp`.

```
Same style, same lighting, same outline thickness and same camera angle as the previous image in this chat.

A single virtual reality headset as a game shop item icon: a sleek dark visor with a glowing violet and cyan front panel, a soft padded strap, small amber status light, isometric 3/4 view, centered, filling about 80 percent of the frame, isolated on a transparent background.

Square 1:1 image, transparent background (if transparency is not available, use a flat solid #00FF00 green background with no shadows or gradients). No text, no letters, no numbers, no logos, no real brands, no watermark, not photorealistic.
```

---

## 9. Kupon etiketi (isteğe bağlı) — `kupon.png` → `kupon.webp` (yatay 3:2, şeffaf zemin)

Referans: `apps/client/public/assets/props/gizli-alisveris/hologram-sticker.webp`. Yeni bir sohbette üretilebilir.
Yüzde yazısı oyunda kodla eklenir; görselde yazı olmamalı.

```
Same style as the attached reference image (an item icon from the same game).

Stylized cel-shaded comic illustration, bold dark outlines, dark moody base colors with vivid neon accents (cyan #2EF2FF, magenta #FF2BD6, amber #FFC23B, lime #B6FF3B, violet #8B5CFF), soft neon glow, clean shapes, slightly playful party-game mood, high contrast, no text, no letters, no logos, no watermark.

A single discount coupon ticket: a glossy magenta paper ticket with notched semicircle cutouts on both short sides, a dashed perforation line near the left end, a small punched hole, a blank empty area in the middle for a label added later, slightly tilted, soft neon glow, centered, isolated on a transparent background.

Wide 3:2 image, transparent background (if transparency is not available, use a flat solid #00FF00 green background with no shadows or gradients).

Avoid: text, letters, numbers, percent signs, watermark, logo, signature, real brands, photorealistic, blurry, cluttered composition.
```

## 10. Alışveriş poşeti (isteğe bağlı) — `poset.png` → `poset.webp` (kare 1:1, şeffaf zemin)

Referans: `apps/client/public/assets/props/gizli-alisveris/jet-canta.webp`. Tamam sonrası "paketlenmiş sepet" ekranında
ürünler poşetin ağzından taşar; bu yüzden ağzı açık ve **içi boş** olmalı.

```
Same style as the attached reference image (an item icon from the same game).

Stylized cel-shaded comic illustration, bold dark outlines, dark moody base colors with vivid neon accents (cyan #2EF2FF, magenta #FF2BD6, amber #FFC23B, lime #B6FF3B, violet #8B5CFF), soft neon glow, clean shapes, slightly playful party-game mood, high contrast, no text, no letters, no logos, no watermark.

A single empty paper shopping bag seen from the front with the top open, dark violet paper with glowing magenta edges and two amber rope handles standing up, a folded rim at the top, nothing inside the bag, centered, filling about 80 percent of the frame, isolated on a transparent background.

Square 1:1 image, transparent background (if transparency is not available, use a flat solid #00FF00 green background with no shadows or gradients).

Avoid: text, letters, numbers, watermark, logo, signature, real brands, store names, photorealistic, blurry, cluttered composition.
```

## 11. Metal kepenk (isteğe bağlı) — `kepenk.png` → `kepenk.webp` (yatay 3:2, dolu zemin)

Referans: `apps/client/public/assets/props/gizli-alisveris/gizli-sandik.webp`. Sonuçta raf üstünde yukarı kalkan ve
son 3 saniyede biraz inen kepenk; yatayda kesintisiz tekrar edebilmeli.

```
Same style as the attached reference image (an item from the same game).

Stylized cel-shaded comic illustration, bold dark outlines, dark moody base colors with vivid neon accents (cyan #2EF2FF, magenta #FF2BD6, amber #FFC23B, lime #B6FF3B, violet #8B5CFF), soft neon glow, clean shapes, slightly playful party-game mood, high contrast, no text, no letters, no logos, no watermark.

A flat front view of a closed metal roller shutter of a small night shop: horizontal dark steel slats filling the whole image edge to edge, subtle scratches, a bottom bar with a glowing cyan neon strip, faint magenta reflections, the pattern should tile seamlessly from left to right, no frame, no wall around it.

Wide 3:2 image, filled background (no transparency needed).

Avoid: text, letters, numbers, graffiti, watermark, logo, signature, real brands, store names, photorealistic, blurry, cluttered composition.
```

## 12. Raf tahtası ve fiyat etiketi (isteğe bağlı)

Referans: `apps/client/public/assets/props/gizli-alisveris/retro-kartus.webp`. İki ayrı görsel; ikisi de aynı sohbette.

### 12a. Raf tahtası — `raf-tahtasi.png` → `raf-tahtasi.webp` (çok yatay, şeffaf zemin)

```
Same style as the attached reference image (an item from the same game).

Stylized cel-shaded comic illustration, bold dark outlines, dark moody base colors with vivid neon accents (cyan #2EF2FF, magenta #FF2BD6, amber #FFC23B, lime #B6FF3B, violet #8B5CFF), soft neon glow, clean shapes, slightly playful party-game mood, high contrast, no text, no letters, no logos, no watermark.

A single long thin shop shelf plank seen from the front, dark metal with a glowing cyan neon light strip along its front edge, two small brackets at the ends, the plank spans the full width of the image, centered vertically, isolated on a transparent background.

The widest horizontal format available (3:2 or wider), transparent background (if transparency is not available, use a flat solid #00FF00 green background with no shadows or gradients).

Avoid: text, letters, numbers, watermark, logo, signature, real brands, photorealistic, blurry, cluttered composition.
```

### 12b. Fiyat etiketi — `fiyat-etiketi.png` → `fiyat-etiketi.webp` (kare 1:1, şeffaf zemin)

Fiyat rakamı oyunda kodla yazılır; etiketin ortası boş kalmalı.

```
Same style, same lighting and same outline thickness as the previous image in this chat.

A single blank price tag hanging from a short thin string: an amber paper tag with a rounded right end, a small punched hole with a metal ring on the left end, slightly tilted, the center of the tag left completely empty for a number added later, centered, isolated on a transparent background.

Square 1:1 image, transparent background (if transparency is not available, use a flat solid #00FF00 green background with no shadows or gradients). No text, no letters, no numbers, no currency signs, no logos, no watermark, not photorealistic.
```
