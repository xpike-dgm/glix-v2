# Kara Borsa — yeni görseller (ChatGPT için tarifler)

Bu dosyadaki her blok ChatGPT'ye **olduğu gibi** kopyalanıp yapıştırılır. Her bloğun üstünde: hangi görsel, hangi
adla kaydedileceği, oranı ve şeffaflığı, referans olarak yüklenecek mevcut görsel yazar.

Görseller gelene kadar oyunda hepsinin CSS/SVG karşılığı çizilir; oyun görselsiz de eksiksiz çalışır (açık kutu yokken
kapalı kutunun üst parçası kapak gibi kalkar ve içinden CSS ışığı çıkar; tokmak SVG'dir). Bir görsel
`apps/client/public/assets/props/kara-borsa/<ad>.webp` olarak eklenince **kod değişmeden** kullanılır: derleme o
klasördeki dosyaları listeler (`vite.config.ts`, `__KARA_BORSA_PROPS__`), olmayan dosya hiç istenmez (WebP, ≤ 60 KB,
1024×1024'ten 384×384'e küçültülür).

Ortak kural: görselde yazı, harf, sayı yok; zemin şeffaf (araç desteklemiyorsa düz, gölgesiz **#00FF00** yeşil).
Açık kutuların her biri kapalı hâliyle **aynı açı, aynı boy, aynı konumda** olmalı (kapalı ile açık yer değiştirir).
Öncelik sırası: 1–5 (açık kutular), 6 (tokmak), 7–8 (isteğe bağlı büyük sandık).

---

## 1. Ahşap kutu — açık hâli

- Dosya adı: `kutu-ahsap-acik.webp` (üretimde `kara-borsa-kutu-ahsap-acik.png`)
- Oran: kare 1:1 (1024×1024); **şeffaf zemin**
- Kullanım: Açılışta kapak kalkınca kapalı ahşap kutunun yerine geçer (1. ve 5. tur dışı).
- Referans olarak yükle: `apps/client/public/assets/props/kara-borsa/kutu-ahsap.webp`

```
Same style as the attached reference. Stylized cel-shaded comic illustration, bold dark outlines, dark moody base colors with vivid neon accents (cyan #2EF2FF, magenta #FF2BD6, amber #FFC23B, lime #B6FF3B, violet #8B5CFF), soft neon glow, clean shapes, slightly playful party-game mood, high contrast, no text, no letters, no logos, no watermark.
The attached wooden crate, now OPEN: its lid is flipped up and tilted back on one hinge, and a warm golden light (amber #FFC23B with a white-hot center) pours upward out of the box in soft rays, with a few floating sparkles. Nothing else is inside except the light. Keep exactly the same camera angle, scale, position, lighting and outline thickness as the attached closed box so the two images can be swapped in place: the box body stays where it is, only the lid is open.
Avoid: text, letters, numbers, watermark, logo, signature, real brands, real people, photorealistic, gore, blood, blurry, low detail, cluttered composition, lid missing, lid on the floor, objects or coins inside the box, background scenery.
Transparent background (if not possible: flat solid #00FF00 green background with no shadow). Square 1:1 aspect ratio.
```

## 2. Çelik kasa — açık hâli

- Dosya adı: `kutu-celik-acik.webp` (üretimde `kara-borsa-kutu-celik-acik.png`)
- Oran: kare 1:1 (1024×1024); **şeffaf zemin**
- Kullanım: Açılışta kapalı çelik kasanın yerine geçer.
- Referans olarak yükle: `apps/client/public/assets/props/kara-borsa/kutu-celik.webp`

```
Same style as the attached reference. Stylized cel-shaded comic illustration, bold dark outlines, dark moody base colors with vivid neon accents (cyan #2EF2FF, magenta #FF2BD6, amber #FFC23B, lime #B6FF3B, violet #8B5CFF), soft neon glow, clean shapes, slightly playful party-game mood, high contrast, no text, no letters, no logos, no watermark.
The attached steel strongbox, now OPEN: its heavy lid is swung up and back on its hinges, and a cool bright light (cyan #2EF2FF mixed with warm amber) shines upward out of it in soft rays, with a few floating sparkles. Nothing else is inside except the light. Keep exactly the same camera angle, scale, position, lighting and outline thickness as the attached closed box so the two images can be swapped in place: the box body stays where it is, only the lid is open.
Avoid: text, letters, numbers, watermark, logo, signature, real brands, real people, photorealistic, gore, blood, blurry, low detail, cluttered composition, lid missing, lid on the floor, objects or coins inside the box, background scenery.
Transparent background (if not possible: flat solid #00FF00 green background with no shadow). Square 1:1 aspect ratio.
```

## 3. Hediye kutusu — açık hâli

- Dosya adı: `kutu-hediye-acik.webp` (üretimde `kara-borsa-kutu-hediye-acik.png`)
- Oran: kare 1:1 (1024×1024); **şeffaf zemin**
- Kullanım: Açılışta kapalı hediye kutusunun yerine geçer.
- Referans olarak yükle: `apps/client/public/assets/props/kara-borsa/kutu-hediye.webp`

```
Same style as the attached reference. Stylized cel-shaded comic illustration, bold dark outlines, dark moody base colors with vivid neon accents (cyan #2EF2FF, magenta #FF2BD6, amber #FFC23B, lime #B6FF3B, violet #8B5CFF), soft neon glow, clean shapes, slightly playful party-game mood, high contrast, no text, no letters, no logos, no watermark.
The attached gift box, now OPEN: the ribbon is untied and loose, the lid with its bow is lifted up and tilted to one side above the box, and a bright golden light pours upward out of the box in soft rays, with confetti-like sparkles. Nothing else is inside except the light. Keep exactly the same camera angle, scale, position, lighting and outline thickness as the attached closed box so the two images can be swapped in place: the box body stays where it is, only the lid is open.
Avoid: text, letters, numbers, watermark, logo, signature, real brands, real people, photorealistic, gore, blood, blurry, low detail, cluttered composition, lid missing, objects or coins inside the box, background scenery.
Transparent background (if not possible: flat solid #00FF00 green background with no shadow). Square 1:1 aspect ratio.
```

## 4. Antika kutu — açık hâli

- Dosya adı: `kutu-antika-acik.webp` (üretimde `kara-borsa-kutu-antika-acik.png`)
- Oran: kare 1:1 (1024×1024); **şeffaf zemin**
- Kullanım: Açılışta kapalı antika kutunun yerine geçer (Büyük Kutu görseli yoksa 5. turda da).
- Referans olarak yükle: `apps/client/public/assets/props/kara-borsa/kutu-antika.webp`

```
Same style as the attached reference. Stylized cel-shaded comic illustration, bold dark outlines, dark moody base colors with vivid neon accents (cyan #2EF2FF, magenta #FF2BD6, amber #FFC23B, lime #B6FF3B, violet #8B5CFF), soft neon glow, clean shapes, slightly playful party-game mood, high contrast, no text, no letters, no logos, no watermark.
The attached antique ornate chest, now OPEN: its curved lid is raised and tilted back on its hinges, and a rich golden light pours upward out of it in soft rays, with a few floating sparkles and a faint magenta (#FF2BD6) rim glow. Nothing else is inside except the light. Keep exactly the same camera angle, scale, position, lighting and outline thickness as the attached closed box so the two images can be swapped in place: the box body stays where it is, only the lid is open.
Avoid: text, letters, numbers, watermark, logo, signature, real brands, real people, photorealistic, gore, blood, blurry, low detail, cluttered composition, lid missing, lid on the floor, objects or coins inside the box, background scenery.
Transparent background (if not possible: flat solid #00FF00 green background with no shadow). Square 1:1 aspect ratio.
```

## 5. Lanetli kutu — açık hâli

- Dosya adı: `kutu-lanet-acik.webp` (üretimde `kara-borsa-kutu-lanet-acik.png`)
- Oran: kare 1:1 (1024×1024); **şeffaf zemin**
- Kullanım: Lanetli kutu açılınca kullanılır; ekrandaki mor duman efekti üstüne CSS ile eklenir.
- Referans olarak yükle: `apps/client/public/assets/props/kara-borsa/kutu-lanet.webp`

```
Same style as the attached reference. Stylized cel-shaded comic illustration, bold dark outlines, dark moody base colors with vivid neon accents (cyan #2EF2FF, magenta #FF2BD6, amber #FFC23B, lime #B6FF3B, violet #8B5CFF), soft neon glow, clean shapes, slightly playful party-game mood, high contrast, no text, no letters, no logos, no watermark.
The attached cursed box, now OPEN: its lid is thrown up and back, and thick swirling purple-violet smoke (violet #8B5CFF and deep purple) bursts upward out of the box with a few small sickly green sparks; the smoke curls upward but stays compact around the top of the box. Ominous but cartoonish and party-friendly, not scary. Keep exactly the same camera angle, scale, position, lighting and outline thickness as the attached closed box so the two images can be swapped in place: the box body stays where it is, only the lid is open.
Avoid: text, letters, numbers, watermark, logo, signature, real brands, real people, photorealistic, gore, blood, blurry, low detail, cluttered composition, skulls, demons, faces in the smoke, horror, lid missing, background scenery.
Transparent background (if not possible: flat solid #00FF00 green background with no shadow). Square 1:1 aspect ratio.
```

## 6. Tokmak (mezat tokmağı)

- Dosya adı: `tokmak.webp` (üretimde `kara-borsa-tokmak.png`)
- Oran: kare 1:1 (1024×1024); **şeffaf zemin**
- Kullanım: Açılışın ilk saniyesinde ekranın ortasında iner ("SATILDI!" damgası CSS); yoksa SVG tokmak çizilir.
- Referans olarak yükle: `apps/client/public/assets/props/kara-borsa/kutu-antika.webp`

```
Same style as the attached reference. Stylized cel-shaded comic illustration, bold dark outlines, dark moody base colors with vivid neon accents (cyan #2EF2FF, magenta #FF2BD6, amber #FFC23B, lime #B6FF3B, violet #8B5CFF), soft neon glow, clean shapes, slightly playful party-game mood, high contrast, no text, no letters, no logos, no watermark.
A single wooden auctioneer's gavel shown from the side, mid-strike, resting on a small round wooden sound block: dark polished wood with a thin amber (#FFC23B) brass band around each end of the hammer head, the long handle rising diagonally up to the upper right. A few short white impact lines around the point where the head meets the block. Centered, the whole gavel and block fit in the frame with a small margin.
Avoid: text, letters, numbers, watermark, logo, signature, real brands, real people, photorealistic, gore, blood, blurry, low detail, cluttered composition, hand, arm, judge, courtroom, background scenery.
Transparent background (if not possible: flat solid #00FF00 green background with no shadow). Square 1:1 aspect ratio.
```

## 7. Büyük altın sandık (isteğe bağlı)

- Dosya adı: `buyuk-sandik.webp` (üretimde `kara-borsa-buyuk-sandik.png`)
- Oran: kare 1:1 (1024×1024); **şeffaf zemin**
- Kullanım: 5. tur (Büyük Kutu) teklif ekranında ve açılışta; yoksa antika kutu altın parıltıyla kullanılır.
- Referans olarak yükle: `apps/client/public/assets/props/kara-borsa/kutu-antika.webp`

```
Same style as the attached reference. Stylized cel-shaded comic illustration, bold dark outlines, dark moody base colors with vivid neon accents (cyan #2EF2FF, magenta #FF2BD6, amber #FFC23B, lime #B6FF3B, violet #8B5CFF), soft neon glow, clean shapes, slightly playful party-game mood, high contrast, no text, no letters, no logos, no watermark.
A big closed treasure chest, larger and grander than the attached antique box but in the same family: gold-plated with ornate amber (#FFC23B) and white-gold trim, a glowing magenta (#FF2BD6) gem lock on the front, a strong warm golden glow around its edges and a few sparkles. It must look precious and twice as valuable. Same camera angle, lighting and outline thickness as the attached reference, centered, filling about 85 percent of the frame.
Avoid: text, letters, numbers, watermark, logo, signature, real brands, real people, photorealistic, gore, blood, blurry, low detail, cluttered composition, open lid, coins spilling out, background scenery.
Transparent background (if not possible: flat solid #00FF00 green background with no shadow). Square 1:1 aspect ratio.
```

## 8. Büyük altın sandık — açık hâli (isteğe bağlı)

- Dosya adı: `buyuk-sandik-acik.webp` (üretimde `kara-borsa-buyuk-sandik-acik.png`)
- Oran: kare 1:1 (1024×1024); **şeffaf zemin**
- Kullanım: Büyük Kutu açılınca. Yalnız 7. görsel de üretildiyse anlamlıdır.
- Referans olarak yükle: `apps/client/public/assets/props/kara-borsa/buyuk-sandik.webp` (7. görsel eklendikten sonra; o yokken bu görseli üretme)

```
Same style as the attached reference. Stylized cel-shaded comic illustration, bold dark outlines, dark moody base colors with vivid neon accents (cyan #2EF2FF, magenta #FF2BD6, amber #FFC23B, lime #B6FF3B, violet #8B5CFF), soft neon glow, clean shapes, slightly playful party-game mood, high contrast, no text, no letters, no logos, no watermark.
The attached big golden treasure chest, now OPEN: its lid is raised and tilted back on its hinges, and an intense golden light pours upward out of it in broad soft rays with many floating sparkles. Nothing else is inside except the light. Keep exactly the same camera angle, scale, position, lighting and outline thickness as the attached closed box so the two images can be swapped in place: the box body stays where it is, only the lid is open.
Avoid: text, letters, numbers, watermark, logo, signature, real brands, real people, photorealistic, gore, blood, blurry, low detail, cluttered composition, lid missing, coins or objects inside, background scenery.
Transparent background (if not possible: flat solid #00FF00 green background with no shadow). Square 1:1 aspect ratio.
```
