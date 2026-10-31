# Çapraz Ateş — yeni görseller (ChatGPT için tarifler)

Bu dosyadaki her blok ChatGPT'ye **olduğu gibi** kopyalanıp yapıştırılır. Her bloğun üstünde: hangi görsel, hangi
adla kaydedileceği, oranı ve şeffaflığı, referans olarak yüklenecek mevcut görsel yazar.

Görseller gelene kadar oyunda hepsinin CSS/SVG karşılığı çizilir; oyun görselsiz de eksiksiz çalışır. Bir görsel
`apps/client/public/assets/props/capraz-ates/<ad>.webp` olarak eklenince `apps/client/src/games/capraz-ates/art.ts`
dosyasındaki ilgili satır `true` yapılır ve görsel CSS karşılığının yerine geçer (WebP, ≤ 60 KB).

Ortak kural: görselde yazı, harf, sayı yok; zemin şeffaf (araç desteklemiyorsa düz, gölgesiz **#00FF00** yeşil).

---

## 1. Namlu ateşi

- Dosya adı: `namlu-atesi.webp` (üretimde `capraz-namlu-atesi.png`)
- Oran: yatay 3:2 (oyunda küçük, yaklaşık 50×40 px görünür); **şeffaf zemin**
- Kullanım: final açılışında her atanın önünde, hedefe dönük kısa alev (sol kenar namlu ağzı, alev sağa doğru açılır).
- Referans olarak yükle: `apps/client/public/assets/props/kontrol-paneli-kaosu/kivilcim.webp`

```
Same style as the attached reference. Stylized cel-shaded comic illustration, bold dark outlines, dark moody base colors with vivid neon accents (cyan #2EF2FF, magenta #FF2BD6, amber #FFC23B, lime #B6FF3B, violet #8B5CFF), soft neon glow, clean shapes, slightly playful party-game mood, high contrast, no text, no letters, no logos, no watermark.
A single cartoon muzzle flash seen from the side: a bright white-hot core on the far left edge that bursts into a short star-shaped flame pointing to the right, layered amber and orange petals with a thin white rim light and a few tiny sparks flying forward. Compact and readable at very small size, no gun, no hand, nothing else in the frame. The flame starts exactly at the left edge, vertically centered, and fills about 80 percent of the width.
Avoid: text, letters, numbers, watermark, logo, signature, real brands, real people, photorealistic, gore, blood, blurry, low detail, cluttered composition, smoke clouds, background scenery.
Transparent background (if not possible: flat solid #00FF00 green background with no shadow). Landscape 3:2 aspect ratio.
```

---

## 2. Mermi parıltısı

- Dosya adı: `mermi-parilti.webp` (üretimde `capraz-mermi-parilti.png`)
- Oran: yatay 4:3 (oyunda yaklaşık 30×22 px); **şeffaf zemin**
- Kullanım: ağır çekimde hedefe uçan merminin parlak başı ve kısa kuyruğu (baş sağda, kuyruk sola uzanır; oyun
  döndürür). Görsel herkes için aynıdır; bu yüzden oyuncu rengine değil nötr beyaz-amber tona boyanmalı (oyuncunun
  rengi iz çizgisinde kalır).
- Referans olarak yükle: `apps/client/public/assets/props/genel/nisangah.webp`

```
Same style as the attached reference. Stylized cel-shaded comic illustration, bold dark outlines, dark moody base colors with vivid neon accents (cyan #2EF2FF, magenta #FF2BD6, amber #FFC23B, lime #B6FF3B, violet #8B5CFF), soft neon glow, clean shapes, slightly playful party-game mood, high contrast, no text, no letters, no logos, no watermark.
A single glowing bullet streak flying to the right: a small bright white-gold bullet head on the right side with a soft amber glow, followed by a tapered light trail that fades out toward the left edge, a few tiny motion sparks. Pure light shape, readable at very small size, perfectly horizontal, centered vertically.
Avoid: text, letters, numbers, watermark, logo, signature, real brands, real people, photorealistic, gore, blood, blurry, low detail, cluttered composition, gun, hand, background scenery.
Transparent background (if not possible: flat solid #00FF00 green background with no shadow). Landscape 4:3 aspect ratio.
```

---

## 3. Kalkan

- Dosya adı: `kalkan.webp` (üretimde `capraz-kalkan.png`)
- Oran: kare 1:1 (1024×1024); **şeffaf zemin, ortası tamamen saydam**
- Kullanım: siperdeki oyuncunun avatarının çevresinde enerji kalkanı halkası (avatar ortadaki boşlukta görünür; halka
  yüzü örtmemeli). Seçim ekranında siper alınca ekranın altını örten kubbe CSS ile çizilir, bu görseli kullanmaz.
- Referans olarak yükle: `apps/client/public/assets/avatars/busts/p1-cyan-bust-v1.webp`

```
Same style as the attached reference. Stylized cel-shaded comic illustration, bold dark outlines, dark moody base colors with vivid neon accents (cyan #2EF2FF, magenta #FF2BD6, amber #FFC23B, lime #B6FF3B, violet #8B5CFF), soft neon glow, clean shapes, slightly playful party-game mood, high contrast, no text, no letters, no logos, no watermark.
A circular sci-fi energy shield ring seen from the front: a glowing cyan (#2EF2FF) hexagon-patterned band forming a perfect ring, bright rim light on the outer edge, faint hexagon cells fading toward the inside, small light sparks along the edge. The whole center of the ring (about 60 percent of the diameter) is completely empty and transparent so a character portrait can show through. Centered, ring touches the image edges with a small margin.
Avoid: text, letters, numbers, watermark, logo, signature, real brands, real people, photorealistic, gore, blood, blurry, low detail, cluttered composition, any character or object inside the ring, filled center.
Transparent background (if not possible: flat solid #00FF00 green background with no shadow). Square 1:1 aspect ratio.
```

---

## 4. Cam çatlağı katmanı

- Dosya adı: `cam-catlagi.webp` (üretimde `capraz-cam-catlagi.png`)
- Oran: dikey 2:3 (en büyük dikey boy; oyun ekranı "cover" ile kaplar); **şeffaf zemin**
- Kullanım: final açılışında seni vurdularsa telefon ekranında kısa bir an beliren, sonra soluklaşan cam çatlağı.
  Okunabilirlik için oyun bunu yarı saydam gösterir; çizgiler ince olmalı, ekranı karartmamalı.
- Referans olarak yükle: `apps/client/public/assets/worlds/capraz-ates-portrait.webp`

```
Same style as the attached reference. Stylized cel-shaded comic illustration, bold dark outlines, dark moody base colors with vivid neon accents (cyan #2EF2FF, magenta #FF2BD6, amber #FFC23B, lime #B6FF3B, violet #8B5CFF), soft neon glow, clean shapes, slightly playful party-game mood, high contrast, no text, no letters, no logos, no watermark.
A cracked glass overlay: thin bright white crack lines radiating from an impact point slightly above and right of the center, with two irregular rings of cracks around it and a few long cracks reaching the edges, faint cyan glint on some edges. Only the crack lines are visible; everything else is fully transparent. Lines are thin and clean so text under them stays readable.
Avoid: text, letters, numbers, watermark, logo, signature, real brands, real people, photorealistic, gore, blood, blurry, low detail, cluttered composition, bullet, hole filled with black, background scenery, frame.
Transparent background (if not possible: flat solid #00FF00 green background with no shadow). Portrait 2:3 aspect ratio.
```

---

## İsteğe bağlı: silah/el (bugün kullanılmıyor)

Seçim ekranının altında kendi avatarının yanında bugün küçük bir CSS/SVG tabanca çizilir. Sahip isterse ileride
avatar büstleriyle birleşen bir el+tabanca görseli eklenebilir; bunun için kod yeri hazır değildir (avatar büstüyle
birleştirmek ayrı bir iş). Bu görsel şimdilik **üretilmez**.
