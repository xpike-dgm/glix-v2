# Yazı Yaz — görsel tarifi (ChatGPT görev dosyasına girecek)

Onaylanan YY-U2 için dört görsel gerekir: ters rol kartının arka yüzü, iki ön yüz (YAZAN / MASUM) ve konu kartının
daktilo kâğıdı. Görseller gelene kadar oyun aynı yerlerde kendi CSS/SVG çizimini kullanır; dosya
`apps/client/public/assets/props/yazi-yaz/<ad>.webp` olarak konunca bir sonraki derlemede **kod değişmeden** onu
kullanır (`vite.config.ts` → `__YAZI_YAZ_PROPS__`; olmayan dosya istenmez, 404 yok).

Önemli kurallar:
- Görsellerde **yazı yok**: "YAZAN", "MASUM", "KONU", konu adı ve "Rolünü görmek için basılı tut" kodla üstüne yazılır.
- Kartın arka yüzü yazan ve masum için **aynıdır**: gizli bilgi taşımaz.
- Ön yüz görselleri kartın üst yarısına (genişliğin ~%82'si, yüksekliğin en çok %55'i) "contain" ile konur; altına
  kod büyük harfle rolü ve kısa satırı yazar. Nesne kadrajda ortalı, kenarlarda boşluk.
- Arka yüz kartı tam kaplar ("cover", 3:4); alt %25'e kod koyu bir şerit ve yazı koyar, o bölge sade kalmalı.

## Gereken görseller

| # | Görsel | Kaydedilecek dosya | Oran / zemin | Öncelik |
|---|---|---|---|---|
| 1 | Rol kartı arka yüzü | `apps/client/public/assets/props/yazi-yaz/kart-arka.webp` | dikey 3:4, dolu; WebP ≤ 80 KB (600×800) | 1 |
| 2 | YAZAN ön yüzü: daktilo ve kalem | `apps/client/public/assets/props/yazi-yaz/kart-yazan.webp` | kare 1:1, şeffaf; WebP ≤ 60 KB (512×512) | 2 |
| 3 | MASUM ön yüzü: boş kâğıt | `apps/client/public/assets/props/yazi-yaz/kart-masum.webp` | kare 1:1, şeffaf; WebP ≤ 60 KB (512×512) | 3 |
| 4 | Konu kartı: daktiloya takılı kâğıt | `apps/client/public/assets/props/yazi-yaz/konu-kagit.webp` | yatay 3:1, şeffaf; WebP ≤ 60 KB (960×320) | 4 (CSS çizimi yeterli; isteğe bağlı) |

Referans olarak yüklenecek mevcut görseller (hepsinde):
- `docs/wiki/ekran/yazi-write-card.webp` (bugünkü ekran ve CSS yer tutucuları: kompozisyon ve renk)
- `apps/client/public/assets/props/zehirli-kadeh/kadeh-magenta.webp` (nesne çizim stili, kontur kalınlığı, ışık)

## 1. Rol kartı arka yüzü — `kart-arka.png` → `kart-arka.webp` (dikey 3:4, dolu zemin)

Ek referans: `docs/wiki/ekran/yazi-write-card.webp` (ortadaki mor çizgili kart).

```
Same style as the attached reference images: the first is the current game screen (keep the same neon color mood; the card in the middle is the placeholder for this image), the second is an item from the same game (match its drawing style, outline thickness and lighting).

Stylized cel-shaded comic illustration, bold dark outlines, dark moody base colors with vivid neon accents (cyan #2EF2FF, magenta #FF2BD6, amber #FFC23B, lime #B6FF3B, violet #8B5CFF), soft neon glow, clean shapes, slightly playful party-game mood, high contrast, no text, no letters, no logos, no watermark.

The back side of a mysterious secret role playing card for a party game, seen straight on and filling the whole image edge to edge: a deep dark violet card face with a thin glowing violet border and rounded corners, a symmetric ornamental pattern of fine diagonal neon lines, in the upper middle a large round emblem with a stylized closed eye and a small typewriter key motif glowing cyan, subtle magenta sparkles. The lower quarter of the card stays calm, dark and simple because a text strip is placed there in the game. Perfectly symmetric, flat front view, no perspective, no hands.

Vertical 3:4 image, the card fills the entire image (no background around it).

Avoid: text, letters, numbers, question marks, watermark, logo, signature, real brands, real people, photorealistic, gore, blood, blurry, low detail, cluttered composition, any hint of a role (no pen, no paper), playing card suits.
```

## 2. YAZAN ön yüzü — `kart-yazan.png` → `kart-yazan.webp` (kare 1:1, şeffaf zemin)

```
Same style as the attached reference images: the first is the current game screen (keep the same neon color mood), the second is an item from the same game (match its drawing style, outline thickness and lighting).

Stylized cel-shaded comic illustration, bold dark outlines, dark moody base colors with vivid neon accents (cyan #2EF2FF, magenta #FF2BD6, amber #FFC23B, lime #B6FF3B, violet #8B5CFF), soft neon glow, clean shapes, slightly playful party-game mood, high contrast, no text, no letters, no logos, no watermark.

A chunky retro typewriter as a party game prop for the secret "writer" role: dark violet body with glowing magenta edges, round keys with cyan rims, a blank cream sheet of paper rolled in at the top, and a glowing amber fountain pen leaning diagonally against the right side of the typewriter. Seen from the front at a slight 3/4 angle from above, slightly playful and cartoonish, centered, filling about 80 percent of the frame. The paper is completely blank. Isolated on a transparent background.

Square 1:1 image, transparent background (if transparency is not available, use a flat solid #00FF00 green background with no shadows or gradients).

Avoid: text, letters, numbers, symbols on the keys, writing on the paper, watermark, logo, signature, real brands, real people, photorealistic, gore, blood, blurry, low detail, cluttered composition, desk, background scenery.
```

## 3. MASUM ön yüzü — `kart-masum.png` → `kart-masum.webp` (kare 1:1, şeffaf zemin)

Ek referans: üretilip onaylanan `kart-yazan` görseli (aynı ışık ve çizgi kalınlığı için).

```
Same style as the attached reference images: the first is the current game screen (keep the same neon color mood), the second is an item from the same game (match its drawing style, outline thickness and lighting), the third is the matching "writer" card art (same lighting, same outline thickness, same camera angle).

Stylized cel-shaded comic illustration, bold dark outlines, dark moody base colors with vivid neon accents (cyan #2EF2FF, magenta #FF2BD6, amber #FFC23B, lime #B6FF3B, violet #8B5CFF), soft neon glow, clean shapes, slightly playful party-game mood, high contrast, no text, no letters, no logos, no watermark.

A single blank sheet of cream paper for the "innocent" role of a party game: slightly tilted, one corner gently curled, faint ruled lines, a soft cyan glow around its edges, completely empty and clean, an innocent calm feel. Seen from the front at a slight angle, centered, filling about 70 percent of the frame. Isolated on a transparent background.

Square 1:1 image, transparent background (if transparency is not available, use a flat solid #00FF00 green background with no shadows or gradients).

Avoid: text, letters, numbers, any writing or drawing on the paper, pen, pencil, typewriter, watermark, logo, signature, real brands, real people, photorealistic, gore, blood, blurry, low detail, cluttered composition, background scenery.
```

## 4. Konu kartı kâğıdı — `konu-kagit.png` → `konu-kagit.webp` (yatay 3:1, şeffaf zemin; isteğe bağlı)

Kod bu görselin üstüne ortalayarak "KONU" ve konu adını (ör. MUTFAKTA BULUNUR) koyu harflerle yazar; kâğıdın orta
bölgesi düz ve açık renkli kalmalı. Görsel kutuya "fill" ile gerilir: kenarlarda boşluk bırakılmamalı.

```
Same style as the attached reference images: the first is the current game screen (the cream paper sheet under the dark roller at the top is the placeholder for this image), the second is an item from the same game (match its drawing style, outline thickness and lighting).

Stylized cel-shaded comic illustration, bold dark outlines, dark moody base colors with vivid neon accents (cyan #2EF2FF, magenta #FF2BD6, amber #FFC23B, lime #B6FF3B, violet #8B5CFF), soft neon glow, clean shapes, slightly playful party-game mood, high contrast, no text, no letters, no logos, no watermark.

A wide strip of cream typewriter paper coming out of the dark violet rubber roller of a typewriter, seen straight on: the roller runs across the full width at the very top with small glowing magenta knobs at both ends, the paper hangs below it and fills the rest of the image, with very faint ruled lines and a soft paper texture. The middle of the paper is plain, light and empty because large dark text is placed there in the game. Flat front view, no perspective.

Wide horizontal 3:1 image, transparent background outside the roller and paper (if transparency is not available, use a flat solid #00FF00 green background with no shadows or gradients).

Avoid: text, letters, numbers, any writing on the paper, watermark, logo, signature, real brands, real people, photorealistic, gore, blood, blurry, low detail, cluttered composition, keys, desk, background scenery.
```
