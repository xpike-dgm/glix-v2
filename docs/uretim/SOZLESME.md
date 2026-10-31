# Üretim Merkezi ↔ oyun: arayüz sözleşmesi

Üretim Merkezi (`apps/uretim`) ile oyun (`apps/server`, `apps/client`, `packages/engine`) arasındaki bütün
bağlantılar bu dosyada tanımlıdır. İki taraf bu sözleşmeye göre **birbirinden bağımsız** geliştirilir. Sözleşme
değişecekse önce bu dosya değişir (yönetici onayıyla).

Karar kaynağı: `docs/oneriler/uretim-merkezi.md` (onaylanan paket), `docs/uretim/YAPAY-ZEKA-EKIBI.md`.

## 1. Paylaşılan doğrulama (`packages/engine`)

Site, oyuna girecek her veriyi oyunla **aynı kodla** doğrular. Engine şu dışa aktarımları sağlar (bugün var olanlar
korunur, yenileri eklenir):

- İçerik havuzları: `CONTENT_POOLS` (bütün havuzların listesi), her havuz için `fromFields`, `toFields`, `key`, `fields`
  (bugünkü `ContentPool` arayüzü). Site havuz satırını bunlarla doğrular.
- Yasaklı kelime eşleştirme: `moderation` modülündeki bugünkü eşleştirici.
- Mağaza (MG-1/2/3): `validateShopCatalog(json)` → `{ok, errors[]}`; `validateShopItem(item, catalog)`;
  `SHOP_PRICE_RANGES` (`siradan: [100, 250]`, `nadir: [300, 600]`, `efsanevi: [800, 1500]`); `COSMETIC_TYPES`.
- Efekt tarifi (MG-4): `EFFECT_ENGINES` (motor adları, izinli türler, parametre şeması), `validateEffectRecipe(r)`.
- Dans ve giysi (MG-5): `validateDance(json, rig)`, `validateWardrobeLayer(json, rig)`.

Oyun tarafı bunları ekleyene kadar site, mağazaya özel kontrolleri (UM-K5) "henüz yok" diye atlar. Ortak, görsel,
ses ve havuz kontrolleri bağımsız çalışır.

## 2. Mağaza kataloğu dosyası (MG-1)

- Yol: `packages/engine/src/katalog/magaza.json`.
- Biçim: `{ "surum": 1, "urunler": [ CosmeticItem + { "satista": bool, "koleksiyon"?: string, "cikis"?: "YYYY-MM-DD", "efekt"?: EffectRecipe } ] }`.
- `price` her üründe açık yazılır. Bugünkü ürünler bugünkü fiyatlarında kalır.
- Ürün kimlikleri değişmez.

## 3. Oyun sunucusunun Üretim Merkezi uçları

- Yalnız `GLIX_URETIM_TOKEN` ortam değişkeni doluysa açılır; boşsa bütün uçlar 404 döner.
- İstek başlığı `Authorization: Bearer <token>`. Karşılaştırma sabit sürede yapılır.
- Uçlar yalnız sunucunun kendi ağından çağrılır. Caddy bu yolu dışarıya kapatır:
  `@uretim path /api/uretim/*` → `respond 404`. Site oyuna Docker ağı ya da `127.0.0.1:3900` üzerinden ulaşır.
- Bütün yanıtlar JSON'dur.
- Yazma işlemleri `admin_audit` kaydına `uretim` işleyicisiyle düşer.

| Yöntem ve yol | Ne yapar | Yanıt |
|---|---|---|
| `GET /api/uretim/havuzlar` | Bütün içerik havuzlarının **canlıdaki** etkin listesi (yerleşik + panel düzenlemeleri) | `{ havuzlar: [{ id, gameId, label, fields, kayitlar: [{ anahtar, alanlar, kaynak: "yerlesik"\|"panel", acik: bool }] }] }` |
| `POST /api/uretim/havuzlar/:poolId/ekle` | Satır ekler (havuzun `fromFields` kuralıyla doğrular; tekrarları atlar) | `{ aktarimId, eklenen: n, atlanan: [{ satir, neden }] }` |
| `POST /api/uretim/havuzlar/:poolId/kapat` | `{ anahtarlar: [...] }` kayıtları kapatır (silmez) | `{ aktarimId, kapatilan: n }` |
| `POST /api/uretim/aktarim/:aktarimId/geri-al` | O aktarımın eklediklerini kapatır, kapattıklarını açar | `{ ok: true }` |
| `GET /api/uretim/moderasyon` | Yasaklı kelime listesi | `{ kaliplar: [{ kalip, tur, kaynak }] }` |
| `POST /api/uretim/moderasyon/ekle` | Kalıp ekler | `{ aktarimId, eklenen, atlanan }` |
| `GET /api/uretim/magaza/istatistik` | Son 30 gün, ürün başına toplu sayılar (anonim) | `{ donem: "30g", urunler: [{ id, satis, kusanan, firsatSatis }] }` |
| `GET /api/uretim/saglik` | Sürüm (`revision`) ve canlılık | `{ ok, revision }` |

Kurallar:
- Bir istekte en çok 500 satır.
- Hız sınırı: dakikada 30 yazma isteği.
- Hesap kimliği, takma ad ya da e-posta hiçbir yanıtta yer almaz.

## 4. Önizleme sayfası (UM-U4, MG-6)

- Oyunun istemcisinde ayrı bir giriş sayfası olur: `apps/client/onizleme.html`, canlıda
  `https://glix.dgmcraft.online/onizleme.html`.
- Oyunculara bağlantı verilmez. Sayfa yalnız bir iframe içinde ve yalnız `https://uretim.dgmcraft.online`
  kaynağından gömülünce çalışır. Bunu iki koruma sağlar:
  - **Gömme izni:** `Content-Security-Policy: frame-ancestors https://uretim.dgmcraft.online` (geliştirmede
    `http://localhost:*`).
  - **İleti kaynağı:** `postMessage` ile yalnız bu kaynaktan gelen iletiler kabul edilir.
- Protokol:
  - Sayfa hazır olunca üst pencereye `{ tur: "hazir", surum: 1 }` gönderir.
  - Site şunu gönderir:
    ```
    { tur: "goster",
      ekran: "magaza-kart" | "avatar-lobi" | "skor-seridi" | "kursu" | "zafer" | "giris" | "kart-arkasi" | "koleksiyon" | "ses-ani" | "oyun-ani",
      katalogSatiri?: object,
      dosyalar: { "<oyundaki yol>": "<data: URL ya da blob: URL>" },
      secenekler?: { oyun?: string, an?: string, tema?: "koyu" } }
    ```
  - Sayfa çizer ve `{ tur: "cizildi", boyut: { w, h } }` ya da `{ tur: "hata", neden }` döner.
- Taslak dosyalar yalnız bellekte tutulur; oyunun önbelleğine ve hizmet çalışanına (service worker) yazılmaz.

## 5. Entegrasyon paketi (UM-İ7)

- Site, onaylananları `/srv/glix/uretim/aktarim/<YYYYMMDD-HHMM>/` altına yazar. Geliştirmede yol
  `URETIM_AKTARIM_DIR` ortam değişkeninden okunur.
- İçerik:
  - `ozet.json`: `{ olusturma, ogeler: [{ alan, teslimId, tur, ad, hedefYollar: [...], katalogSatirlari: [...] }] }`
  - `dosyalar/`: oyunun deposundaki yollarla birebir aynı düzen. Örnekler:
    - `apps/client/public/assets/shop/cerceve/<ad>.webp`
    - `packages/engine/src/katalog/magaza.json.yama`
- Katalog değişiklikleri tam dosya olarak değil, yama olarak gelir: `{ ekle: [...], degistir: [{ id, eski, yeni }], satistanKaldir: [...] }`.
  Yönetici yamayı uygular, testleri çalıştırır.
- Dönüştürme kuralları:
  - **Görsel:** WebP, kalite 82. Şeffaflıkta alfa < 24 olan pikseller 0 yapılır.
  - **Ses:** OGG Opus, mono, -16 LUFS (efekt) / -20 LUFS (müzik).
  - **SVG:** temizlenmiş.

## 6. Ortam değişkenleri

| Değişken | Nerede | Anlamı |
|---|---|---|
| `GLIX_URETIM_TOKEN` | oyun ve site | Bölüm 3'teki uçların anahtarı (boşsa uçlar kapalı) |
| `URETIM_OYUN_URL` | site | Oyun sunucusunun iç adresi (ör. `http://glix:3900`) |
| `URETIM_DB` | site | Sitenin SQLite dosyası |
| `URETIM_DEPO_DIR` | site | İçerik adresli dosya deposu |
| `URETIM_AKTARIM_DIR` | site | Entegrasyon paketleri |
| `URETIM_REPO_DIR` | site | Oyun deposunun salt okunur aynası (katalog okuma, UM-A4) |
| `URETIM_SAHIP_EPOSTA` | site | Girişe izinli e-postalar (virgülle) |
| `GLIX_RESEND_API_KEY`, `GLIX_MAIL_FROM` | site | Giriş kodu e-postası (oyunla aynı servis) |
| `URETIM_PUBLIC_URL` | site | `https://uretim.dgmcraft.online` |
| `URETIM_AI_KEY` | site | İstek → iş/istem dönüştürücü (UM-R1) için model anahtarı; boşsa sabit kalıp kullanılır. **Sahip kararı:** oyunun mevcut anahtarı (`GLIX_AI_KEY`, `/srv/glix/shared/.env`) kullanılır; compose'da `URETIM_AI_KEY: ${GLIX_AI_KEY:-}` olarak aynı dosyadan okunur, değeri hiçbir yere kopyalanmaz |

## 7. Yapay zekâ bağlantı kanalları (ek karar)

Yapay zekâlara sunucunun genel MCP'si verilmez. İki kanal vardır, ikisi de aynı alan anahtarı ve aynı yetkiyle
sitenin iç API'sine gider:

| Kanal | Adres | Kimlik | Ne görür |
|---|---|---|---|
| MCP | `https://uretim.dgmcraft.online/mcp` (Streamable HTTP) | `Authorization: Bearer <alan anahtarı>` | Yalnız alanın araçları |
| SSH | `uretim-<alan>@<vds>` | Alanın SSH açık anahtarı (sitede alana eklenir) | `ForceCommand` → `uretim` komut aracı; SFTP yalnız `/srv/glix/uretim/ssh/<alan>/{gelen,okunur}` (chroot) |

- SSH kullanıcıları `uretim-alanlari` grubundadır; `sshd_config` içinde ayrı `Match Group uretim-alanlari` bloğu:
  `ChrootDirectory`, `ForceCommand`, `AllowTcpForwarding no`, `X11Forwarding no`, `AllowAgentForwarding no`,
  `PermitTTY no`, `PasswordAuthentication no`.
- `uretim` komut aracının alt komutları MCP araçlarıyla birebir aynıdır: `talimat-oku`, `isleri-listele`, `is-oku`,
  `katalog-oku`, `geri-bildirim-oku`, `dosya-yukle`, `on-kontrol`, `teslim-et`, `istek-karti-ac`, `kod-istegi-ac`.
  Çıktı JSON'dur.
- `gelen/` klasörüne bırakılan paket site tarafından alınır, ön kontrolden geçer ve klasörden kaldırılır.
- Kurulum betikleri `deploy/uretim/ssh/` altında durur. Sunucuya uygulamayı yönetici, sahibin onayıyla yapar.

## 8. Her alan için iki kanal (sahip kararı)

12 alanın hepsinde **MCP ve SSH ikisi birden** açıktır; sahip yapay zekâyı limitlere göre değiştirdikçe uygun kanalı
kullanır. Alanın sürekliliği sitededir (talimat, zevk profili, geri bildirim, işler), aracın hafızasında değil.
- **MCP:** alan başına birden çok anahtar (araç başına ayrı); her biri ayrı adlandırılır ve tek tek iptal edilir.
- **SSH:** alan başına birden çok açık anahtar; her biri adlandırılır ve tek tek kaldırılır.
- **İş kilidi:** bir işi `is_oku`/`is-oku` ile ilk alan oturum kilitler. Diğer oturumlar "üzerinde çalışılıyor" görür ve
  sıradakine geçer. Kilit 2 saat hareketsizlikte açılır; sahip elle açabilir. Teslim, kilit sahibinden gelmezse uyarı
  verir ama kabul edilir.
- **Araç bilgisi:** her teslimde kanal (mcp/ssh), anahtar adı ve yapay zekânın bildirdiği araç ve model (`arac`,
  `model` alanları, isteğe bağlı) saklanır. Alan sayfasında araç başına onay oranı gösterilir.
- **Hazır istem (UM-R1):** her iş için MCP ve SSH kalıbı birlikte üretilir; iş kartında sekmeyle seçilir.
