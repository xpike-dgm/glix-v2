# Bozuk Telefon — görsel tarifi (ChatGPT görev dosyasına girecek)

Onaylanan BT-U4 (ilk cümle ekranı) için tek görsel gerekir. Görsel gelene kadar oyun aynı yerde kendi SVG çizimini
(neon çevirmeli telefon + kıvrık kablo) kullanır; dosya yerine konunca bir sonraki derlemede **kod değişikliği
olmadan** onu kullanır (`vite.config.ts` → `__BOZUK_PHONE_ART__`). Kablo ve kablodan giden "not" animasyonu kodda
çizilir; görselde kablo **olmamalı** (ya da kısa bir kablo ucu sağ alttan çıkabilir).

## Gereken görsel

| # | Görsel | Kaydedilecek dosya | Oran / zemin | Durum |
|---|---|---|---|---|
| 1 | Eski çevirmeli telefon (neon) | `apps/client/public/assets/props/bozuk-telefon/telefon.webp` | kare 1:1, şeffaf; WebP ≤ 60 KB (512×512) | gerekli |

Yerleşim: görsel ekranda 140×130 birimlik bir kutuya (oran ≈ 1:1) ortalanarak konur; kutunun sağ alt köşesinden
(telefon gövdesinin sağ alt kenarı) kodla çizilen kablo çıkar. Telefon kadrajın ~%85'ini doldurmalı, gövdenin sağ alt
kenarı görselin sağ alt çeyreğinde olmalı.

## 1. Eski telefon — `telefon.png` → `telefon.webp` (kare 1:1, şeffaf zemin)

Referans görsel olarak ekle: `docs/wiki/ekran/bozuk-write.webp` (bugünkü ekran ve SVG yer tutucusu: kompozisyon ve
renk), `apps/client/public/assets/props/zehirli-kadeh/kadeh-magenta.webp` (nesne çizim stili).

```
Same style as the attached reference images: the first is the current game screen (keep the same neon color mood and the same composition as the placeholder phone drawn there), the second is an item from the same game (match its drawing style, outline thickness and lighting).

Stylized cel-shaded comic illustration, bold dark outlines, dark moody base colors with vivid neon accents (cyan #2EF2FF, magenta #FF2BD6, amber #FFC23B, lime #B6FF3B, violet #8B5CFF), soft neon glow, clean shapes, slightly playful party-game mood, high contrast, no text, no letters, no logos, no watermark.

A single big old-fashioned rotary desk telephone as a party game prop: a chunky dark violet body with glowing magenta edges, a round cyan glowing rotary dial with ten finger holes and a small bright center, the curved handset resting on top in its cradle, a tiny amber light on the front, seen from the front at a slight 3/4 angle from above, slightly playful and cartoonish, centered, filling about 85 percent of the frame. No cable, or only a very short coiled cable stub leaving the lower right side of the body. The lower right part of the body should be clearly visible because an animated cable is drawn from there in the game. Isolated on a transparent background.

Square 1:1 image, transparent background (if transparency is not available, use a flat solid #00FF00 green background with no shadows or gradients).

Avoid: text, letters, numbers, digits on the dial, watermark, logo, signature, real brands, real people, photorealistic, gore, blood, blurry, low detail, cluttered composition, phone booth walls, background scenery.
```

Not: Öneri dosyasında "eski telefon / telefon kulübesi" denmişti. Ekranda kablonun sıradakine akması için ayrık bir
masa telefonu daha iyi okunur; kulübe istenirse aynı dosya adıyla kulübe üretilebilir (kod değişmez), ama kulübenin
sağ alt kenarından kablo çıkacağı göz önünde tutulmalı.
