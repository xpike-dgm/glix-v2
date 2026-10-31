# Mağaza kataloğu: teknik ek

Mağaza yapay zekâsının talimat taslağının (`docs/uretim/YAPAY-ZEKA-EKIBI.md` 4.1) teknik ekidir. Ürünün oyunda nasıl
tanımlandığını, hangi dosyaların nereye gittiğini, efekt motorlarını ve sınırları anlatır. Kurallar koddadır; bu
belge onları özetler. Çelişki olursa kod ve `docs/uretim/SOZLESME.md` geçerlidir.

Doğrulayıcılar (`@glix/engine`; Üretim Merkezi ön kontrolü aynı kodu çağırır):

| Dışa aktarım | Ne yapar |
|---|---|
| `validateShopCatalog(json)` | Katalog dosyasının tamamı: `{ ok, errors[] }` (hata satırı ve kimlikle) |
| `validateShopItem(item, catalog)` | Tek satır; `catalog` (liste ya da `{ urunler }`) tekrar denetimi için |
| `SHOP_PRICE_RANGES` | Nadirliğe göre fiyat aralığı |
| `COSMETIC_TYPES` | Türler, Türkçe adları, kuşanma anahtarı |
| `EFFECT_ENGINES`, `validateEffectRecipe(r, tur?)` | Efekt motorları, parametre şeması, tarif doğrulaması |
| `validateDance(json, rig)`, `validateWardrobeLayer(json, rig, urun?)` | Dans dosyası ve giysi katmanı (`rig` = `rig.json` içeriği) |

## 1. Katalog dosyası

Yol: `packages/engine/src/katalog/magaza.json`. Biçim:

```json
{ "surum": 1, "urunler": [ <ürün satırı>, ... ] }
```

Dosya sırası mağazadaki sıradır. Dosya oyun yüklenirken doğrulanır; hatalı tek satır testleri ve derlemeyi düşürür.
Entegrasyon paketinde katalog tam dosya olarak değil, yama olarak gelir (`magaza.json.yama`: `{ ekle, degistir, satistanKaldir }`).

### Ürün satırı

| Alan | Zorunlu | Kural |
|---|---|---|
| `id` | evet | küçük harf, rakam, tire; en az iki parça (`cerceve-neon-gece`); en çok 64; **bir kez verildi mi değişmez** |
| `type` | evet | aşağıdaki türlerden biri |
| `rarity` | evet | `siradan`, `nadir`, `efsanevi` |
| `price` | evet | tam sayı Glix, nadirliğin aralığında |
| `name` | evet | 1–24 karakter, aynı türde tekrar yok (büyük/küçük harf duyarsız) |
| `description` | evet | 1–90 karakter |
| `satista` | evet | `true` / `false`. `false`: mağazada görünmez, satın alınamaz; sahibi kullanmaya devam eder |
| `koleksiyon` | hayır | 1–32 karakter (örn. `Neon Gece`); aynı koleksiyondan 2+ ürün satıştaysa mağazada şerit |
| `cikis` | hayır | `YYYY-MM-DD`; o günün İstanbul gece yarısından önce görünmez ve satılmaz |
| `asset` | türe göre | dosya öneki (aşağıdaki tablo); unvan, ad efekti ve çerçevede **yazılmaz** |
| `covers` | yalnız kostüm | kapladığı yuvalar: `sapka`, `ust`, `alt`, `ayakkabi` (parçaların kemiklerinden türer) |
| `efekt` | türe göre | efekt tarifi (bölüm 4); ad efekti ve çerçevede **zorunlu**, giriş ve zaferde isteğe bağlı ek katman |

Bilinmeyen alan hatadır. Satılmış ürün silinmez: `satista: false` yapılır.

### Fiyat aralıkları (`SHOP_PRICE_RANGES`)

| Nadirlik | Aralık (Glix) | Bugünkü ürünlerin fiyatı |
|---|---|---|
| Sıradan | 100–250 | 150 |
| Nadir | 300–600 | 400 |
| Efsanevi | 800–1500 | 1000 |

Günün fırsatı: her İstanbul günü satıştaki ücretli ürünlerden 2 tanesi, ürünün kendi fiyatının %70'i (5'e yuvarlanır).
Fiyat değişikliği ileriye dönüktür.

## 2. Türler ve dosyalar

Görseller `apps/client/public/assets/shop/` altında, WebP (kalite 82; alfa < 24 olan pikseller 0).

| Tür (`type`) | Ad | `asset` | Dosyalar | Not |
|---|---|---|---|---|
| `unvan` | Lakap | — | — | yalnız metin (levha nadirlikten) |
| `ad-efekti` | Ad efekti | — | efekt dokuları (varsa) | `efekt` zorunlu |
| `cerceve` | Çerçeve | — | `cerceve/<ad>.webp` 384x384, ortada %62 şeffaf delik | `efekt` zorunlu; görsel tarifin `doku`su |
| `dans` | Dans | dans kimliği | `karakter/dans/<asset>.json` (`glix-dance-3`) | `validateDance` |
| `sapka`, `ust`, `alt`, `ayakkabi`, `aksesuar`, `kostum` | Giysiler | `rig.json` katman adı | `karakter/giysi/<katman>_<kemik>[_arka].webp` + `rig.json` → `wardrobe.<asset>` | `validateWardrobeLayer`; 5 neon renkle giyilir |
| `kart-arkasi` | Kart arkası | dosya adı | `kart-arkasi/<asset>.webp` 480x720 | tarif henüz kabul edilmez |
| `zafer` | Zafer kutlaması | önek | `zafer/<asset>-1..4.webp` (4 kare, 128 px) | isteğe bağlı ek tarif |
| `tepki` | Tepki paketi | paket kimliği | `tepki/<asset>-1..6.webp` (6 çıkartma, 192 px) | tarif henüz kabul edilmez; çıkartma adları `STICKER_NAMES` |
| `giris` | Giriş efekti | önek | `giris/<asset>-zemin.webp`, `giris/<asset>-isik.webp` (256 px) | isteğe bağlı ek tarif |

Yeni efekt dokuları `efekt/<ad>.webp` klasörüne gider.

## 3. Dans ve giysi

- **Dans** (`validateDance`): biçim `glix-dance-3` (`{ format, fps, loop, bones, y, a }`); kemikler `rig.json`'da olmalı
  (tekrarsız, en çok 32); süre (kare / fps) **1–10 sn**; kök kayması en çok 300 px; açılar en çok 720°; dosya en çok
  40 000 karakter. Döngüde son kareden ilk kareye 45°'den büyük sıçrama **uyarıdır** (hata değil).
- **Giysi katmanı** (`validateWardrobeLayer`): `{ slot, pieces: [{ file: "giysi/<ad>.webp", size, bone, sourceOrigin,
  pivot?, layer?: "on"|"arka", drawAfter? }] }`; şapka/üst/alt/ayakkabı katmanının en az bir parçası o yuvanın
  kemiğinde (`head`; `torso`/kol; uyluk/baldır; ayak); aksesuar her kemikte olabilir; kostümde `covers` parçaların
  kemiklerinden türeyen yuvalarla aynı olmalı. Ürün verilirse türü katmanın yuvasıyla aynı olmalı.

## 4. Efekt motorları ve tarif

Tarif: `{ "motor": "<motor>", "parametreler": { ... } }`. Bilinmeyen parametre hatadır; zorunlular dolu olmalı.

Ortak sınırlar: tek efekt **en çok 60 parçacık**; parçacık/kare dokusu **en çok 256 px** (çerçeve görseli 384x384,
kart arkası 480x720 ürün görseli olduğu için ayrı sınırdadır). Parçacıklar yalnız transform/opacity ile oynar. "Hareket
azaltma" açıkken (oyunun ayarı ya da cihazın `prefers-reduced-motion`'ı) her motor sade sürümünü çizer.

Renk: `#rrggbb`, `#rrggbbaa` ya da `rgba(r, g, b, a)`. Doku: `cerceve|kart-arkasi|zafer|tepki|giris|efekt/<ad>.webp`.

| Motor | Türler | Parametreler | Sade sürüm |
|---|---|---|---|
| `parlama` | ad efekti, çerçeve | `renk` (adda zorunlu: metin rengi), `isiklar` [{renk, yaricap ≤ 40}] 1–4 (zorunlu), `tepeIsiklar` (nabız tepesi), `nabizHizi` 0–10 sn (0 sabit), `yogunluk` 0,25–2, `doku` (çerçevede zorunlu) | ışık sabit; nabızlı adda yalnız renk |
| `akan-renk` | ad efekti, çerçeve | `renkler` 2–8 (zorunlu), `duraklar` (yüzde, artan), `aci` 0–360 (90), `genislik` 100–400 % (200), `akisHizi` 0,5–30 sn (zorunlu), `hareket` `akis`/`salinim`, `yon` `ileri`/`geri`, `dolgu` (yedek renk), `isik` {renk, yaricap ≤ 24}, `doku` (çerçevede zorunlu: maske) | geçiş durur |
| `kivilcim` | ad efekti, çerçeve, giriş | `renk` (zorunlu), `doku` (≤ 256 px; yoksa ışık noktası), `sayi` 1–60 (12), `hiz` 0,4–6 sn (1,6), `boyut` 2–24 px (6) | kıvılcım çizilmez |
| `donen-halka` | çerçeve | `doku` (zorunlu, çerçeve görseli), `donusHizi` 1–120 sn (zorunlu), `katman` 1–3 (ek katmanlar ters yönde, hızlı, yarı saydam), `yon` `saat`/`ters` | dönmez |
| `parcacik-yagmuru` | giriş, zafer | `dokular` 1–4 (zorunlu, ≤ 256 px), `yogunluk` 1–60 (24), `yon` `asagi`/`yukari`/`patlama`, `sure` 0,5–6 sn (2,4) | birkaç parçacık sabit |
| `kare-animasyon` | zafer, tepki, giriş | `kareler` 2–12 doku (zorunlu, ≤ 256 px), `kareSuresi` 40–1000 ms (120), `dongu` (true) | ilk kare |
| `doku-katmani` | çerçeve, kart arkası | `doku` (zorunlu), `karisim` `normal`/`screen`/`lighten`/`overlay`/`plus-lighter`, `hareket` `yok`/`kayma`/`salinim`, `hareketHizi` 1–60 sn (8) | sabit |

Oyunun bugün çizdiği yerler: ad efekti (her yerde ad), çerçeve (her yerde avatar), giriş (lobi koltuğunda görsel
katmanların üstüne ek katman), zafer (final ekranında görsel kutlamanın üstüne ek katman). Kart arkası ve tepki paketi
için motor tanımlıdır ama katalog henüz tarif kabul etmez; gerekirse kod isteği açılır (UM-İ6).

## 5. Örnek satırlar

Bugünkü ürünlerden (değişmeden tarife çevrilmiş):

```json
{ "id": "ad-neon-mavi", "type": "ad-efekti", "rarity": "siradan", "price": 150, "name": "Neon Mavi",
  "description": "Adın mavi neon gibi parlar.", "satista": true,
  "efekt": { "motor": "parlama", "parametreler": { "renk": "#8dfaff",
    "isiklar": [ { "renk": "rgba(46, 242, 255, 0.7)", "yaricap": 6 }, { "renk": "rgba(46, 242, 255, 0.4)", "yaricap": 14 } ] } } }

{ "id": "cerceve-donen-neon", "type": "cerceve", "rarity": "nadir", "price": 400, "name": "Dönen Neon",
  "description": "Avatarının çevresinde dönen neon.", "satista": true,
  "efekt": { "motor": "donen-halka", "parametreler": { "doku": "cerceve/donen-neon.webp", "donusHizi": 14, "katman": 1, "yon": "saat" } } }

{ "id": "giris-portal", "type": "giris", "rarity": "nadir", "price": 400, "name": "Portal",
  "description": "Lobiye bir portaldan geçersin.", "asset": "portal", "satista": true }
```

Yeni ürün örneği (koleksiyon ve çıkış tarihiyle):

```json
{ "id": "cerceve-neon-gece", "type": "cerceve", "rarity": "efsanevi", "price": 1200, "name": "Neon Gece",
  "description": "Gece mavisi halkada süzülen kıvılcımlar.", "satista": true, "koleksiyon": "Neon Gece",
  "cikis": "2026-12-01",
  "efekt": { "motor": "parlama", "parametreler": { "doku": "cerceve/neon-gece.webp",
    "isiklar": [ { "renk": "#2ef2ffaa", "yaricap": 6 } ], "nabizHizi": 3 } } }
```

## 6. Önizleme

Üretim Merkezi taslağı oyunun gerçek bileşenleriyle `onizleme.html` sayfasında gösterir (sözleşme bölüm 4). Ekranlar:
`magaza-kart`, `avatar-lobi` (lakap/ad efekti/çerçeve), `skor-seridi` (sonuç sıralaması), `kursu` (dans ve giysi),
`zafer`, `giris`, `kart-arkasi` (kör seçimde eldeki kartlar), `koleksiyon` (mağaza şeridi; aynı koleksiyondan en az
iki satıştaki ürün gerekir, `katalogSatiri` bunun için satır listesi de olabilir), `oyun-ani` (`secenekler.oyun` +
`secenekler.an` → oyunun önizleme ekranı, örn. `kule` + `oyun`), `ses-ani` (ses olay haritası henüz yok: "henüz yok").
`dosyalar` oyundaki yollarla verilir (`apps/client/public/assets/...` ya da `/assets/...`), adresi `data:` ya da `blob:`.

Görünüm denetimi: `pnpm efekt:karsilastir` (önce/sonra ekran görüntüsü, piksel farkı) ve `pnpm onizleme:check`.
