# Zaman Bombası Hafızası — görsel tarifi (ZB-U1)

Oyun bugün fitilli bombayı kodla (SVG) çiziyor; aşağıdaki görsel eklenince gövde olarak otomatik onu kullanır.
Fitil ve kıvılcım kodda kalır (giriş süresine göre yanması gerektiği için), görselde **fitil olmamalı**.

Görsel hazır olunca dosyayı şuraya koy (WebP'ye çevrilmiş, ≤ 60 KB):
`apps/client/public/assets/props/zaman-bombasi-hafizasi/bomba.webp`
Yapı (ve geliştirme sunucusu) yeniden başlatılınca oyun bu dosyayı kullanır; dosya yoksa SVG çizim sürer.

---

## Görsel: Fitilsiz bomba gövdesi

- **Kaydedilecek dosya adı:** `zb-bomba-govde.png` (yerleştirilecek yer: `apps/client/public/assets/props/zaman-bombasi-hafizasi/bomba.webp`)
- **Oran / şeffaflık:** kare 1:1 (1024×1024), **şeffaf arka plan** (desteklenmiyorsa düz, gölgesiz #00FF00 yeşil zemin)
- **Referans olarak yükle:** `apps/client/public/assets/props/bomba/govde.webp` (mevcut bomba gövdesi, stil ve çizgi kalınlığı) ve
  `apps/client/public/assets/avatars/busts/p1-cyan-bust-v1.webp` (genel çizim stili)

```
Same style as the attached reference. Stylized cel-shaded comic illustration, bold dark outlines, dark moody base colors with vivid neon accents (cyan #2EF2FF, magenta #FF2BD6, amber #FFC23B, lime #B6FF3B, violet #8B5CFF), soft neon glow, clean shapes, slightly playful party-game mood, high contrast, no text, no letters, no logos, no watermark.

A single classic round cartoon bomb body WITHOUT any fuse rope: a glossy dark navy-black iron sphere with a strong soft highlight on the upper left, a thin cyan rim light on the right edge and subtle riveted metal band details. On the upper right of the sphere, at the one o'clock position, there is a short cylindrical metal fuse socket (a small dark steel cap with a thin glowing cyan ring), tilted outward at about 40 degrees; the socket is open and EMPTY, nothing comes out of it. Composition is fixed and important: the sphere's center is slightly left of and below the image center (about 45% from the left, 58% from the top), the sphere's diameter is about two thirds of the image width, and the open end of the socket ends at about 70% from the left and 26% from the top. Keep the right upper corner of the image empty (a fuse will be drawn there in code). Front view, centered object, isolated on transparent background, square 1:1.

Avoid: text, letters, numbers, watermark, logo, signature, real brands, real people, photorealistic, gore, blood, blurry, low detail, cluttered composition, fuse, rope, string, wick, spark, flame, fire, explosion, smoke, cast shadow on the ground, background scenery.

Background: transparent (if transparency is not supported: flat solid #00FF00 green with no shadow and no gradient).
Aspect ratio: square 1:1, 1024x1024.
```

Gereken görseller (bu oyun için): yalnız bu bir dosya. Uçan bomba, şeritteki küçük bomba ve TV kartındaki bomba
aynı gövdeyi ya da CSS/SVG çizimi kullanır; ayrıca görsel gerekmez.
