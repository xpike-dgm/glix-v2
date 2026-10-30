# Zehirli Kadeh — gereken yeni görseller (ChatGPT için)

Bu dosyadaki her blok ChatGPT'ye **doğrudan kopyala-yapıştır** yapılmak içindir: önce başlıktaki referans görseli
yükle, sonra kod bloğunun içindekinin tamamını yapıştır. Görseller gelene kadar oyun aynı şeyleri CSS ile çizer;
dosya belirtilen yola konunca kod onu kendiliğinden kullanır (başka değişiklik gerekmez).

Kontrol anındaki "kapak kalkar / sıvı görünür" efekti CSS ile yapıldı; onun için görsel gerekmiyor. Kadehler
mevcut görsellerle (`apps/client/public/assets/props/zehirli-kadeh/kadeh-*.webp`) kalıyor.

---

## 1. Ziyafet masası (yukarıdan bakış)

- **Kaydedilecek dosya:** `apps/client/public/assets/props/zehirli-kadeh/masa.webp`
- **Oran:** dikey 2:3 (modelin en büyük dikey oranı); oyunda yaklaşık 1:2'lik dikey bir alana "cover" ile
  oturur, kenarlar kırpılabilir. **Şeffaflık yok:** zemin dolu, masa bütün kareyi kaplar.
- **Hedef ağırlık:** WebP ≤ 200 KB.
- **Referans olarak yükle:** `apps/client/public/assets/worlds/zehirli-kadeh-portrait.webp` (ortam ve renk) ve
  `apps/client/public/assets/props/zehirli-kadeh/kadeh-cyan.webp` (çizgi ve parlaklık stili).

```
Same style as the attached references. Stylized cel-shaded comic illustration, bold dark outlines, dark moody base colors with vivid neon accents (cyan #2EF2FF, magenta #FF2BD6, amber #FFC23B, lime #B6FF3B, violet #8B5CFF), soft neon glow, clean shapes, slightly playful party-game mood, high contrast, no text, no letters, no logos, no watermark.

A long royal banquet table seen exactly from above (straight top-down view), running vertically from the top edge to the bottom edge of the image and filling the whole frame edge to edge. Dark polished wood with visible plank lines running lengthwise, an ornate thin gold trim along both long edges. A narrow violet-and-magenta velvet table runner runs down the exact vertical center, with three small unlit-looking candle holders spaced evenly along the runner giving a faint warm amber glow. The left third and the right third of the table surface (where goblets will be placed later by the game) must stay EMPTY and calm: plain dark wood only, no plates, no cutlery, no food, no goblets, no objects. Subtle vignette toward the corners. Everything symmetric left-to-right. The table must give no hint about which seat is poisoned: all places look identical.

Avoid: text, letters, numbers, watermark, logo, signature, real brands, real people, photorealistic, gore, blood, blurry, low detail, cluttered composition, perspective or angled view, chairs, people, hands, goblets, cups, plates, food, skulls, poison bottles.

Background: the table fills the entire image, no empty background visible. Aspect ratio: portrait 2:3.
```

---

## 2. Mum (süre mumu gövdesi)

- **Kaydedilecek dosya:** `apps/client/public/assets/props/zehirli-kadeh/mum.webp`
- **Oran:** dikey, mümkün olan en dar dikey oran (2:3 gelirse mum ortada ve boydan boya olmalı; yönetici dar
  bir şerit hâlinde kırpar). **Şeffaf arka plan** (desteklenmiyorsa düz, gölgesiz #00FF00 yeşil zemin).
- **Not:** Yalnız mumun **gövdesi**. Alev, fitil ve tabak oyunda ayrıca çizilir; görselde OLMAMALI. Oyun gövdeyi
  kalan süreye göre yukarıdan aşağı kırparak "eritir", bu yüzden gövde boydan boya aynı kalınlıkta olmalı.
- **Hedef ağırlık:** WebP ≤ 40 KB.
- **Referans olarak yükle:** `apps/client/public/assets/props/zehirli-kadeh/kadeh-amber.webp` (stil).

```
Same style as the attached reference. Stylized cel-shaded comic illustration, bold dark outlines, dark moody base colors with vivid neon accents (cyan #2EF2FF, magenta #FF2BD6, amber #FFC23B, lime #B6FF3B, violet #8B5CFF), soft neon glow, clean shapes, slightly playful party-game mood, high contrast, no text, no letters, no logos, no watermark.

A single tall straight pillar candle body, front view, perfectly vertical and centered, filling the full height of the image from the very top edge to the very bottom edge. Warm ivory wax with soft cel-shaded highlights on the left and a warm amber rim light on the right, a few wax drips running down the sides, the same width from top to bottom. The top of the candle is cut flat. NO flame, NO wick, NO candle holder, NO plate, NO base, NO smoke.

Avoid: text, letters, numbers, watermark, logo, signature, real brands, real people, photorealistic, gore, blood, blurry, low detail, cluttered composition, flame, fire, wick, candle holder, plate, multiple candles, tilted candle.

Background: transparent background (if transparency is not supported: flat solid #00FF00 green, no shadow, no gradient). Aspect ratio: the narrowest available portrait ratio (2:3 is acceptable, candle centered and narrow).
```
