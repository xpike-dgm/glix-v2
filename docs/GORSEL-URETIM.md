# GLIX — Görsel Üretim Planı (yapay zekâ ile)

Kapsam: oyun dünyaları, oyun nesneleri, karakterler, anlatım + oyun kartları, küçük görseller.
Kapsam dışı (şimdilik): pazarlama/mağaza, sezon/etkinlik.

Görselleri sahip **ChatGPT Images 2.5** ile üretir (araç VDS'teki çalışma alanına erişebilir); yönetici (Claude) her aşamada tarifleri hazırlar, gelen
dosyaları kontrol eder, sıkıştırır (WebP), adlandırır ve oyunlara yerleştirir.

---

## Görsel üreten araca (ChatGPT) talimat — önce bunu oku

1. **Erişim:** Dosyalar sahibin VDS sunucusunda. Sunucuya **`dgmcraft_agent_root` SSH bağlantısıyla** bağlan.
   Bütün çalışma `/srv/glix/gorsel/` klasöründe yapılır.
2. **Okuma:** Önce bu belgeyi (`/srv/glix/gorsel/OKU-BENI.md`) baştan sona oku. Referans görseller
   `/srv/glix/gorsel/referans/` altında: `avatarlar/` (karakter stili), `ekranlar/` (oyunların bugünkü ekranları),
   `secilen/` (onaylanan görseller — varsa her üretimde referans olarak kullan).
3. **Yazma:** Ürettiğin görselleri yalnız `/srv/glix/gorsel/gelen/asama-<N>/` klasörüne kaydet (dosya adı tablodaki
   numara + ad, ör. `1.2-kadeh-v2.png`). Aşama bitince aynı klasörde boş bir `TAMAM` dosyası oluştur.
4. **Sınırlar:** `/srv/glix/gorsel/gelen/` dışında hiçbir dosyayı silme, değiştirme veya oluşturma. Sunucudaki diğer
   klasörlere, servislere, Docker kapsayıcılarına, `/opt/dgmcraft` ve `/srv/glix/` altındaki diğer dizinlere dokunma;
   paket kurma, servis yeniden başlatma yapma. Yalnız okuma (referanslar) ve `gelen/` altına yazma.
5. **Bir aşamayı bitirince dur;** sahip ve yönetici seçimi yapıp `referans/secilen/` klasörünü güncelleyince sonraki
   aşamaya geç.

---

## 0. Ortak kurallar (her görselde geçerli)

### Stil referansı
Mevcut avatarlar (`apps/client/public/assets/avatars/busts/*.webp`): çizgi roman / cel-shaded çizim, kalın koyu kontur,
koyu tonlu kıyafetler, yüz yerine parlayan geometrik neon maske. Bütün görseller bu aileden görünmeli.

### Stil öneki (her tarifin başına eklenir)
```
Stylized cel-shaded comic illustration, bold dark outlines, dark moody base colors with vivid neon accents
(cyan #2EF2FF, magenta #FF2BD6, amber #FFC23B, lime #B6FF3B, violet #8B5CFF), soft neon glow, clean shapes,
slightly playful party-game mood, high contrast, no text, no letters, no logos, no watermark.
```

### Yasaklar (negatif tarif)
```
text, letters, numbers, watermark, logo, signature, real brands, real people, photorealistic, gore, blood,
blurry, low detail, cluttered composition
```

### Araç: ChatGPT Images 2.5 — kullanım notları
- **Referans görsel ver:** her istekte ilgili referansı (VDS'ten okuyarak) ekle (avatar büstü, `referans/secilen/` altındaki onaylı
  görseller). "Same style as the attached reference" cümlesi tarifin başına konur. Karakter tutarlılığı için en önemli adım.
- **Doğal cümleyle tarif:** bu modeller etiket listesinden çok açıklayıcı cümleleri iyi izler; tablodaki tarifler bu
  yüzden cümle biçiminde. Stil öneki + tarif + yasaklar tek paragraf hâlinde verilebilir.
- **Boyutlar:** model kendi oranlarında üretir (genelde kare, dikey 2:3, yatay 3:2). Arka planlar için dikey/yatay
  en geniş seçeneği kullan; 9:16 / 16:9'a yönetici kırpar ("cover"). Bu yüzden ilgi noktası kenarlara değil merkeze
  yakın olmalı.
- **Şeffaf arka plan:** destekleniyorsa "transparent background" seçeneğiyle üret. Desteklenmiyorsa düz, gölgesiz
  **#00FF00 yeşil** zemin iste; yönetici zemini temizler.
- **Yazı:** model yazıda iyi olsa da Türkçe karakter riski ve çeviri esnekliği için görsellerde yazı istenmez.
- **Seri üretim:** aynı türden görselleri (ör. 8 kadeh, 12 ürün) aynı sohbette sırayla üret; ilk onaylanan görseli
  referans olarak tutup "same lighting, same outline thickness, same camera angle" ile devam et.
- **Dosya adı:** indirilen dosyayı tablodaki numara + adla kaydet (ör. `3.1-kadeh-1.png`, `4-zehirli-kadeh-dikey.png`).

### Teknik kurallar
| Tür | Boyut (üretim) | Arka plan | Teslim | Hedef ağırlık |
|---|---|---|---|---|
| Arka plan (dikey) | modelin en büyük dikey oranı (yönetici 9:16 kırpar) | dolu | PNG/JPG | WebP ≤ 300 KB |
| Arka plan (yatay) | modelin en büyük yatay oranı (yönetici 16:9 kırpar) | dolu | PNG/JPG | WebP ≤ 300 KB |
| Nesne / ikon | kare (1024) | **şeffaf** (yoksa düz yeşil #00FF00) | PNG | WebP ≤ 60 KB |
| Avatar / maskot | 1024×1024 | şeffaf | PNG | WebP ≤ 60 KB |
| Anlatım karesi | 1024×768 | dolu, koyu | PNG/JPG | WebP ≤ 120 KB |
| Oyun kart kapağı | 1200×675 (16:9) | dolu | PNG/JPG | WebP ≤ 150 KB |

- Görselin içinde **yazı yok** (Türkçe harfler bozuk çıkar; yazılar kodda eklenir).
- Arka planlarda orta-alt bölge **sade ve koyu** kalmalı (önünde düğmeler/kartlar duracak): kompozisyonun ilgi
  noktası üst 1/3'te.
- Zehirli Kadeh gibi gizli bilgi içeren oyunlarda görsel **hiçbir ipucu vermemeli** (ör. tüm kadehler aynı "temizlikte").
- Aracın **ticari kullanım** izni kontrol edilir; ünlü karakter/marka/gerçek kişi benzerliği yok.

### VDS çalışma alanı (görsel üreten araç doğrudan kullanır)
```
/srv/glix/gorsel/
  OKU-BENI.md                 bu belgenin kopyası
  referans/avatarlar/         mevcut 8 avatar büstü (stil referansı)
  referans/ekranlar/          her oyunun bugünkü ekranı (390×844) — kompozisyon/yerleşim referansı
  referans/secilen/           her aşamada onaylanan görseller (sonraki üretimlerde referans)
  gelen/asama-1 … asama-5/    üretilen ham görseller buraya (dosya adı = tablodaki ad, ör. 1.2-kadeh.png)
  islenmis/                   yöneticinin sıkıştırıp yerleştirdikleri (dokunmayın)
```
Kural: üretici yalnız `gelen/` altına yazar; mevcut dosyaları silmez/değiştirmez. Her aşama bitince
`gelen/asama-N/TAMAM` adlı boş bir dosya bırakır.

### Teslim ve adlandırma
Yönetici dosyaları şu yapıya yerleştirir:
```
apps/client/public/assets/
  worlds/<oyun-id>-portrait.webp, <oyun-id>-landscape.webp
  props/<oyun-id>/<nesne>.webp
  avatars/moods/p<1-8>-<renk>-<ifade>.webp
  mascot/<poz>.webp
  badges/<unvan>.webp
  briefing/<oyun-id>-<1|2|3>.webp
  cards/<oyun-id>.webp
  misc/<ad>.webp
```

---

## Aşama 1 — Stil seti ve deneme (onay aşaması)

Amaç: 27 oyunun hepsine yayılmadan önce stili kilitlemek. Her öğeden 3–4 varyasyon üretin, en iyisini seçeriz;
seçilenler sonraki aşamaların **referans görseli** olur (araç destekliyorsa her üretimde referans olarak verin).

| # | Görsel | Tarif (stil önekinden sonra) |
|---|---|---|
| 1.1 | Zehirli Kadeh arka planı (dikey) | `A dim royal banquet hall at night, long dark marble table seen from above at a slight angle, candles and violet-green neon light, ornate arches in the dark background, empty space in the lower center, portrait 9:16` |
| 1.2 | Kadeh (nesne) | `A single ornate goblet with glowing liquid, silver and dark metal, neon rim light, centered, isolated on transparent background` |
| 1.3 | Avatar ifadesi: cyan "seviniyor" | `Same character as the reference: dark jacket, faceless glowing cyan hexagon visor with an arrow symbol, now celebrating with both fists raised, visor glowing brighter, half-body, isolated on transparent background` |
| 1.4 | Maskot taslağı | `A small friendly round robot mascot for a party game, glossy dark body, big glowing cyan screen face showing a simple happy expression, tiny antenna, magenta accents, full body, isolated on transparent background` |

Kapı: sahip 1.1–1.4'ü onaylar → stil öneki ve referans görseller kilitlenir.

**Durum (2026-10-26): TAMAMLANDI.** Seçilenler `referans/secilen/`: `stil-arka-plan-zehirli-kadeh.png` (v2),
`stil-nesne-kadeh.png` (v3), `stil-avatar-p1-cyan-happy.png` (v2), `stil-maskot.png` (v1). Ayrıntılı Aşama 2 talimatı:
`docs/gorsel/ASAMA-2.md` (VDS: `/srv/glix/gorsel/ASAMA-2.md`).

**Zehirli Kadeh notu (Aşama 3):** 8 kadeh `stil-nesne-kadeh.png` biçiminden birebir türetilir; süs, parlaklık ve
dolgunluk aynı, yalnız sıvı rengi oyuncu rengine göre değişir — hiçbir kadeh diğerinden "şüpheli" görünmemeli.

---

## Aşama 2 — Karakterler

### 2.1 Avatar ifadeleri (8 avatar × 4 ifade = 32 görsel)
Her avatarın mevcut büst görseli referans verilir; yüz yok, ifade **maske parlaklığı + duruş** ile anlatılır.

| İfade | Dosya eki | Tarif eki |
|---|---|---|
| Bekliyor | `idle` | `relaxed pose, arms crossed, visor softly glowing` |
| Seviniyor | `happy` | `celebrating, fists raised, visor glowing bright, small sparkles around` |
| Şaşırdı | `shock` | `leaning back in surprise, hands up, visor flickering` |
| Elendi | `out` | `slumped shoulders, visor cracked and dimmed, desaturated colors, small smoke wisps` |

Avatarlar: p1 cyan (ok), p2 magenta (kalp), p3 amber (şimşek), p4 lime (çubuklar), p5 violet (dalga),
p6 orange (uyarı üçgeni), p7 emerald (elmas), p8 cobalt (artı). Tarif: `Same character as the reference … <ifade eki>,
half-body, isolated on transparent background`.

### 2.2 Maskot pozları (6 görsel)
Aşama 1'de seçilen maskot referans: `waving hello`, `thinking with hand on chin`, `surprised jumping`,
`celebrating with confetti`, `sleeping / waiting with Zzz shapes (no letters)`, `holding a wrench, fixing something (error screen)`.

### 2.3 Unvan rozetleri (10 görsel, şeffaf, 512×512 yeterli)
`A round neon badge emblem, <sembol>, metallic rim, glowing, isolated on transparent background`

| Unvan | Sembol |
|---|---|
| Blöf Kralı | a crown on a theatre mask |
| Laf Ustası | a microphone with lightning |
| Soğukkanlı | a stopwatch covered in frost |
| Son Kaçan | a running figure leaving a door |
| Hayatta Kalan | a heart with a shield |
| Açgözlü | a coin stack overflowing |
| Dedektif | a magnifying glass over an eye |
| Sanatçı | a paint brush and palette |
| Hafıza Ustası | a glowing brain with circuit lines |
| Turun Yıldızı | a five-pointed star with rays |

---

## Aşama 3 — Oyun nesneleri (şeffaf arka plan)

| Oyun | Nesne(ler) | Tarif |
|---|---|---|
| Gizli Alışveriş (12) | hologram çıkartma, enerji içeceği, neon rozet, retro kartuş, mini hoparlör, arcade eldiveni, piksel kamera, jet çanta, kristal kulaklık, holo kask, mini drone, gizli sandık | `A single <ürün> as a game shop item icon, isometric 3/4 view, neon accents, isolated on transparent background` (her ürün ayrı görsel) |
| Zehirli Kadeh (8) | 8 farklı kadeh (aynı "temizlikte") | `An ornate goblet variant <1..8> with glowing <renk> liquid, all goblets equally clean and innocent looking, isolated` |
| Kara Borsa (5) | ahşap sandık, çelik kasa, hediye kutusu, antika sandık, lanetli kutu efekti | `A mysterious <kutu> for a black-market auction, closed, glowing seams, isolated`; lanetli: `purple-black cursed smoke and skull-shaped wisps rising (no actual skull icon)` |
| Kör Bomba / Zaman Bombası (4) | bomba gövdesi, fitil, kıvılcım, patlama | ayrı parçalar: `A cartoon round bomb body, dark metal, neon cyan stripes, no fuse`, `a short burning fuse`, `a bright spark burst`, `a stylized cartoon explosion cloud` |
| Rus Ruleti (2) | neon tabanca, tambur | `A stylized neon revolver, toy-like, not realistic, cyan and magenta glow, side view, isolated`, `a revolver cylinder seen from the front` |
| Kontrol Paneli Kaosu (6) | 4 kablo rengi (mavi, yeşil, kırmızı, sarı), kesik kablo, kıvılcım | `A thick insulated cable in a metallic channel, <renk>, horizontal, isolated`; `the same cable cut in half with sparks` |
| Butona Bas (2) | arcade düğmesi (normal, basılı) | `A big glossy red arcade button on a dark metal base, top 3/4 view, isolated` + `the same button pressed down, glowing` |
| Rüşvet ve Darbe (6) | taht, rüşvet jetonu, taş, kağıt, makas elleri, darbe mühürü | `A dramatic neon throne…`, `a gold bribe coin with a crown emblem (no letters)`, `a cartoon hand showing rock / paper / scissors` (üç ayrı) |
| Aşırı Yükleme (2) | enerji çekirdeği (normal, aşırı yüklü) | `A glowing energy core reactor sphere`, `the same core overloaded, cracking with red light` |
| Kör Kronometre (1) | kronometre gövdesi (yelkovansız) | `A sleek stopwatch body without hands or numbers, neon rim` |
| Gizli Hırsız (1) | kasa | `A heavy vault door with a glowing dial (no numbers)` |
| Son Kişi (1) | kaçış kolu / kapı | `A big emergency escape lever on a wall, red warning light` |
| İttifak (1) | el sıkışma | `Two neon hands shaking, one cyan one magenta, light trails` |
| Çapraz Ateş (1) | hedef nişangâhı | `A neon crosshair target reticle` |

Toplam ≈ 55 görsel.

---

## Aşama 4 — Oyun dünyaları (27 oyun × dikey + yatay = 54 arka plan)

Hatırlatma: ilgi noktası üst 1/3, orta-alt sade ve koyu. Önce dikey (9:16); yatay oyunlarda (Kör Bomba) ve masaüstü
için 16:9 sürüm. Tarif: `<sahne>, empty calm area in the lower center for UI, portrait 9:16` (yatay için `landscape 16:9`).

| Oyun | Sahne | Palet |
|---|---|---|
| Açgözlülük Limiti | an overflowing neon vault of glowing coins, pressure gauges near the red line | amber + kırmızı |
| Aşırı Yükleme | a sci-fi reactor room, a huge glowing core in the distance, warning stripes | cyan + kırmızı |
| Bozuk Telefon | a messy art studio, easels, paint splashes, a tangled old phone cord across the scene | magenta + amber |
| Butona Bas | a retro arcade hall, rows of arcade cabinets glowing in the dark | kırmızı + cyan |
| Çağrışım Ağı | a vast dark space with a glowing web of connected nodes like constellations | cyan + violet |
| Çapraz Ateş | a neon shooting gallery, crossing laser beams in fog | magenta + cyan |
| Çizgiyi Geçme | a neon race track finish area with a glowing line across the ground | lime + cyan |
| Gizli Alışveriş | a neon night market with shelves and hanging signs (no readable text) | magenta + amber |
| Gizli Hırsız | a dark bank vault corridor with laser tripwires | kırmızı + cyan |
| Gizli Kareler | a dark floor of glowing hexagon/square tiles, some faintly lit | cyan + violet |
| İttifak | a secret round meeting table in candle and neon light, chairs around | amber + violet |
| Kara Borsa | a foggy underground black market, stalls, crates, dim amber lamps | amber + siyah |
| Karalama Defteri | a cozy sketchbook desk at night, pencils, paper sheets, desk lamp glow | amber + cyan |
| Kendim | a hall of mirrors with soft neon reflections | violet + magenta |
| Kontrol Paneli Kaosu | a spaceship control room with blinking panels and cables | cyan + kırmızı |
| Kör Bomba (yatay öncelikli) | a bomb-disposal bunker, warning lights, sandbags | kırmızı + amber |
| Kör Kronometre | a dark room full of floating clock gears, time distortion | cyan + violet |
| Laf Sokma Düellosu | a stand-up comedy stage with spotlight and two microphone stands | amber + magenta |
| Ortalamaya En Yakın | a futuristic stock exchange board glowing with abstract graphs (no numbers) | lime + cyan |
| Rus Ruleti | a smoky underground casino with a round table under a single lamp | kırmızı + violet |
| Rüşvet ve Darbe | a marble palace hall with a throne on stairs, red banners (no symbols/text) | amber + kırmızı |
| Sızma | a spy headquarters with screens and silhouettes behind frosted glass | cyan + lime |
| Son Kişi | a long neon corridor with an exit door at the end, red alarm light | kırmızı + cyan |
| Sözlük Blöfü | an ancient library with floating glowing books | amber + violet |
| Yazı Yaz | a dark room with two glowing vintage typewriters on desks | lime + amber |
| Zaman Bombası Hafızası | a memory-game panel with four big colored pads glowing, alarm light | dört oyun rengi |
| Zehirli Kadeh | (Aşama 1'de seçilen) royal banquet hall | violet + lime |

---

## Aşama 5 — Anlatım kareleri, oyun kartları, küçük görseller

### 5.1 Oyun kartı kapakları (27 görsel, 16:9)
Lobideki oyun şeridi için. Aşama 4 sahnesi + aşama 3 nesnesi birleşik, daha yakın ve dramatik kadraj:
`Key art for the party game "<oyun teması>", <ana nesne> in the foreground with dramatic neon lighting, <sahne> blurred
in the background, 16:9, no text`.

### 5.2 Anlatım kareleri (27 oyun × 3 kare = 81 görsel)
Her oyunun KURALLAR.md'deki 3 öğretici adımı birer kareye çevrilir; karakterler avatarlardır (Aşama 2 referansı).
Tarif kalıbı: `Comic panel, <adımın görsel anlatımı>, characters are the faceless neon-visor avatars from the
reference, clear simple composition, dark background, no text`.
Örnek (Zehirli Kadeh): 1) `several avatars around a table each holding a goblet, question-mark shaped glow above the
goblets (no characters)`, 2) `two avatars swapping goblets with a light trail between them`, 3) `goblets revealed:
most glowing gold, one emitting purple-black smoke, avatars reacting`.
Yönetici her oyun için 3 kare tarifini aşama başında `docs/gorsel/briefing-tarifleri.md` olarak çıkarır.

### 5.3 Küçük görseller (≈ 8)
| Görsel | Tarif |
|---|---|
| Yükleme | maskot `holding a spinning neon ring` |
| Bağlantı koptu | maskot `tangled in a cable, confused` |
| Odada kimse yok | maskot `alone on a big empty stage, waving` |
| Oda bulunamadı | maskot `looking through a magnifying glass at an empty floor` |
| Parçacık: kıvılcım, duman, konfeti, jeton | `a sprite sheet of 6 <parçacık> variations on transparent background, evenly spaced` |

---

## Aşama özeti

| Aşama | İçerik | Adet (yaklaşık) | Yönetici işi |
|---|---|---|---|
| 1 | Stil seti | 4 (+ varyasyonlar) | stil kilidi |
| 2 | Avatar ifadeleri, maskot, rozetler | 48 | ifade sistemi, rozetlerin unvanlara bağlanması |
| 3 | Oyun nesneleri | ~55 | oyun ekranlarına yerleştirme, Alışveriş ikonları |
| 4 | Oyun dünyaları | 54 | GameShell sahne katmanı, önceden yükleme |
| 5 | Kart kapakları, anlatım kareleri, küçük görseller | ~116 | lobi şeridi, animasyonlu anlatım, boş durumlar |

Her aşama sonunda: sıkıştırma + boyut bütçesi kontrolü (ilk açılış görsel yükü ≤ 500 KB; oyun görselleri anlatım
ekranında önceden yüklenir), `ui:check` (kontrast: arka plan değişince yazılar okunur kalmalı), önizlemede yayın.
