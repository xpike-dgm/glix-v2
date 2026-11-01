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
| `POST /api/uretim/aktarim/:aktarimId/geri-al` | O aktarımın eklediği girdileri siler (yalnız o aktarımın eklediklerini), kapattıklarını yeniden açar; ikinci kez geri alma reddedilir | `{ ok: true }` |
| `GET /api/uretim/moderasyon` | Yasaklı kelime listesi | `{ kaliplar: [{ kalip, tur, kaynak }] }` |
| `POST /api/uretim/moderasyon/ekle` | Kalıp ekler | `{ aktarimId, eklenen, atlanan }` |
| `GET /api/uretim/magaza/istatistik` | Son 30 gün, ürün başına toplu sayılar (anonim) | `{ donem: "30g", urunler: [{ id, satis, kusanan, firsatSatis }] }` |
| `GET /api/uretim/saglik` | Sürüm (`revision`) ve canlılık; oyun alanında (test2) ek olarak katman kimliği | `{ ok, revision }` — test2: `{ ok, revision, ortam: "test2", katman, taslak }` |
| `GET /api/uretim/magaza/taslak` | **Yalnız test2.** Taslak katmanındaki mağaza ürünleri (bölüm 13) | `{ katman, urunler: [{ id, urun, dosyalar: [yol], zaman }] }` |
| `POST /api/uretim/magaza/taslak` | **Yalnız test2.** Taslak ürün yükler ya da aynı kimlikliyi değiştirir | `{ ok, id, katman, degisti }` |
| `DELETE /api/uretim/magaza/taslak/:id` | **Yalnız test2.** Taslağı kaldırır (yoksa da başarılı) | `{ ok, silindi, katman }` |

Kurallar:
- Bir istekte en çok 500 satır.
- Hız sınırı: dakikada 30 yazma isteği.
- Hesap kimliği, takma ad ya da e-posta hiçbir yanıtta yer almaz.

İstek gövdeleri ve hata yanıtları (oyun tarafının uyguladığı ayrıntı; yukarıdaki tabloyu değiştirmez):
- `ekle`: `{ "satirlar": [ { "<alan>": "<değer>" } | "<satır>" ] }` — alan adları `havuzlar` yanıtındaki `fields[].key`;
  düz metin satırda çok alanlı havuzlar `;` ile ayrılır. `atlanan[].satir` 1'den başlayan sıradır.
- `kapat`: `{ "anahtarlar": [ "<anahtar>" ] }` — yalnız yerleşik ve açık girdiler sayılır.
- `moderasyon/ekle`: `{ "kaliplar": [ "<kalıp>" | { "kalip": "<kalıp>" } ] }`. `moderasyon` yanıtında `tur`: yerleşik
  süzgeçte `kufur-kok` / `kufur-onek` / `kufur-kelime` / `nefret-onek`, panel listesinde `kelime`.
- `:poolId` eğik çizgi taşır (`cagrisim-agi/kelimeler`): düz ya da `%2F` ile yazılabilir. `aktarimId` biçimi `YYYYMMDD-<12 hex>`.
- `magaza/istatistik`: `kusanan` şu an kuşanan hesap sayısıdır (30 günle sınırlı değildir); armağanlar satış sayılmaz.
- Hatalar `{ ok: false, code, message }`: 401 anahtar yanlış/eksik, 404 uç ya da havuz yok (anahtar boşsa her şey),
  409 aktarım zaten geri alındı, 413 satır sınırı, 415 gövde JSON değil, 429 hız sınırı.
- Taslak uçları (`magaza/taslak`) canlıda ve test'te yoktur: üçü de 404 (DELETE dahil); sağlık yanıtı orada
  değişmeden `{ ok, revision }` kalır. Ayrıntı ve gövde biçimi bölüm 13.

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
  - `ozet.json`: `{ olusturma, ogeler: [{ alan, alanAdi, teslimId, ogeId, tur, ad, hedefYollar: [...], katalogSatirlari: [...], havuzSatirlari? }] }`
    (`havuzSatirlari` yalnız içerik öğesinde: `{ "<havuz>": [satır] }`).
  - `icerik.json` (yalnız içerik öğesi varsa): `{ havuzlar: [{ havuz, ekle: [{ <alan>: <değer> }], kapat: [anahtar] }] }`
    — `ekle` satırları bölüm 3'teki `havuzlar/:poolId/ekle` gövdesiyle, `kapat` anahtarları `kapat` gövdesiyle aynı.
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
| `URETIM_OYUN_URL` | site | Oyun sunucusunun iç adresi (compose varsayılanı `http://glix-glix-1:3900`: site test2'nin ağına da katıldığı için hizmet adı `glix` iki ağda birden geçer, kap adı kullanılır) |
| `URETIM_DB` | site | Sitenin SQLite dosyası |
| `URETIM_DEPO_DIR` | site | İçerik adresli dosya deposu |
| `URETIM_AKTARIM_DIR` | site | Entegrasyon paketleri |
| `URETIM_REPO_DIR` | site | Oyun deposunun salt okunur aynası (katalog okuma, UM-A4) |
| `URETIM_SAHIP_EPOSTA` | site | Girişe izinli e-postalar (virgülle) |
| `GLIX_RESEND_API_KEY`, `GLIX_MAIL_FROM` | site | Giriş kodu e-postası (oyunla aynı servis) |
| `URETIM_PUBLIC_URL` | site | `https://uretim.dgmcraft.online` |
| `URETIM_TEST2_URL` | site | Oyun alanının (test2) iç adresi (compose varsayılanı `http://glix-test2-glix-1:3900`, ortak ağ `glix-oyun-alani`); boşsa test2 bağlantısı kapalı (bölüm 13) |
| `URETIM_TEST2_TOKEN` | site | test2'nin **kendi** `GLIX_URETIM_TOKEN`'ı (`/srv/glix/ortam/gizli/.env.test2`); canlınınkinden ayrı |
| `URETIM_TEST2_PUBLIC_URL` | site | Sahibin açtığı adres (`https://test2.glix.dgmcraft.online`; "test2'de aç" bağlantıları) |
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

## 9. SSH parolası ve istemde bağlantı bilgisi (sahip kararı)

- Her alanın SSH kullanıcısının (`uretim-<alan>`) **kendi parolası** vardır: en az 24 karakter, rastgele, sitede
  üretilir. Sitede yalnız özeti saklanır; açık hâli yalnız kopyalama anında, sahibin oturumunda bir kez çözülebilen
  şifreli kayıttan üretilir. Sahip tek tıkla yeniler; eski parola hemen geçersiz olur. İsteğe bağlı kendiliğinden
  yenileme süresi vardır (varsayılan kapalı; seçenekler 7/30/90 gün).
- Parolayla giriş **yalnız** `Match Group uretim-alanlari` bloğunda açıktır (`PasswordAuthentication yes`,
  `KbdInteractiveAuthentication no`). Sunucunun genel ayarı değiştirilmez. Anahtarla giriş de açık kalır.
- Parola değişince site, sistem parolasını `chpasswd` ile günceller (kurulum betiğindeki eşitleyici; root olarak
  çalışır, yalnız `uretim-*` kullanıcılarına dokunur).
- Kaba kuvvet önlemi: bu kullanıcılar için art arda 5 başarısız denemede 15 dakika engel (fail2ban ya da sshd
  `MaxAuthTries` + `PerSourcePenalties`; kurulumda sunucudaki sürüme göre seçilir). Başarılı ve başarısız girişler
  sitede alan sayfasında görünür.
- **İstem (UM-R1):** SSH seçildiğinde hazır istem sunucu adresi, kullanıcı adı ve parolayı içerir. **Parola modele
  (Haiku) asla gönderilmez:** model metni `{{SSH_ADRES}}`, `{{SSH_KULLANICI}}`, `{{SSH_PAROLA}}` yer tutucularıyla
  üretir. Site, sahip "Kopyala"ya bastığında yer tutucuları doldurur. Ekranda parola `••••` olarak görünür; yalnız
  panoya giden metinde açıktır. MCP seçildiğinde istem uç adresini ve "bağlantı ayarına şu anahtarı gir" bilgisini
  içerir; anahtar da modele gitmez, kopyalarken eklenir.
- Kopyalama olayı (kim, ne zaman, hangi alan) denetim kaydına yazılır; parola ve anahtar kayda yazılmaz.

## 10. Görsel kuralı (sahip kararı)

Görsel üreten alanlarda (Mağaza, Rozet, Maç Kartları, İkon ve Süs, Efekt Dokuları) görseller bir **görsel üretim
becerisi ya da aracıyla** üretilir (ör. Codex'in imagegen becerisi, ChatGPT görsel oluşturma). Oyundaki mevcut
görseller böyle üretildi; kalite çıtası onlardır.

- **Yasak:** Python/PIL, SVG, canvas ya da benzeri kodla görsel çizmek. Beceri ortamda yoksa yapay zekâ görsel teslim
  etmez, bunu açıkça yazar (yalnız "görsel üretilemedi" notlu metin önerisi gönderir ya da durur).
- **Kural metni sabittir:** talimatın başlığının hemen altına, kopyalanan istemin ikinci satırına, istek → iş
  taslağının (model ya da kalıp) açıklamasının başına ve kısıtlarına, `is_oku` çıktısına (`gorselKurali`) site kodla
  ekler; model ya da talimat düzenlemesi çıkaramaz (`apps/uretim/src/ortak/gorselKurali.ts`).
- **Bildirim:** teslim `uretimYontemi: "gorsel-model" | "kod"` alanını taşır (SSH: `uretim teslim-et <paket>
  gorsel-model` ya da `teslim.json`). Görsel içeren yapay zekâ tesliminde `"kod"` ön kontrolde **kalır**; alan yoksa
  **uyarı** verilir. Sahibin elle yüklemesi bu denetimin dışındadır.
- **Belirti (yalnız uyarı):** "kodla çizilmiş olabilir": görünür piksellerde 64'ten az farklı renk, ya da piksel
  başına 0,25 bayttan küçük PNG, ya da 1000'den az renk ile 0,5 bayttan küçük PNG (en az 4096 görünür piksel).
  Eşikler oyundaki bütün gerçek görsellerde yanlış alarm vermeyecek biçimde seçildi ve testle denetlenir.
- **Referanslar:** her görsel alanın chroot'unda `okunur/referans/<klasör>/` oyunun canlı varlıklarının salt okunur
  kopyasıdır (`deploy/uretim/ssh/referans.sh`, eşleme `referanslar.txt`; kaynak
  `/srv/glix/current/apps/client/public/assets`). Mağaza: `shop`, `karakter`; Rozet: `badges`; Maç Kartları:
  `cards`; İkon ve Süs: `props`, `avatars`, `mascot`, `brand`; Efekt Dokuları: `fx`, `props`, `worlds`. İstem ve
  talimat bu klasörü gösterir; yapay zekâ üretmeden önce bakar.


## 11. Teslim paketi biçimi (SSH ve MCP)

- SSH: `gelen/<paket>/` klasörüne dosyalar ve **kökte `teslim.json`** (başka ad kabul edilmez). Biçim:
  `{ tur, isId?, arac?, model?, uretimYontemi?, ogeler: [{ ad, aciklama?, gerekce?, dosyalar?: [{ dosya, hedefYol?,
  rol? }], satirlar?, onizleme?, rapor? }] }`; `dosya` paketteki dosya adıdır. MCP'de aynı biçim; dosyalar önce
  `dosya_yukle` ile yüklenir ve `dosya` yerine dönen `dosyaId` yazılır.
- Alana uygun doldurulmuş örnek: SSH `uretim ornek-paket` (eşi `paket-bicimi`), MCP `paket_bicimi`
  (`apps/uretim/src/ortak/paketBicimi.ts`). Test → senaryo/rapor, Mağaza → ürün satırı + görsel, İçerik → satırlar.
  `uretim yardim` komutları ve teslim.json'u tek ekranda özetler.
- `teslim.json` yoksa hata bunu adıyla söyler (ör. "Pakette teslim.json yok (paket.json değil). Biçim için: uretim
  ornek-paket"); eksik dosya yalnız adıyla bildirilir, yol gösterilmez.
- Kopyalanan SSH isteminde ve talimatın sonundaki "Teslim paketi" bölümünde bu kural site kodundan eklenir; model ya
  da talimat düzenlemesi çıkaramaz.
- Test alanı: test koşusu başlatma ve zamanlayıcı (ör. 12 saatte bir) **henüz yok** (ikinci aşama); alan yalnız
  senaryo ve rapor teslim eder. Talimat ve paket biçimi bunu açıkça yazar.
- **Tek istek:** `uretim on-kontrol <paket>` ve `uretim teslim-et <paket>` paketi tek istekle gönderir (iç araç
  `ssh_paket`, yalnız SSH kanal anahtarıyla, listede görünmez). Site `gelen/<paket>/`i kendisi okur: paket önce
  yapay zekânın giremediği klasöre taşınır, yalnız düz dosyalar okunur (bağlantı, alt klasör, aygıt yok); ön
  kontrolden sonra yerine konur, teslimde silinir. Alan anahtardan gelir; paket adı `^[a-z0-9][a-z0-9._-]{0,80}$`.
  Dosyalar günlük dosya sınırına (500) sayılır; istek sınırına (60/dk) paket bir istek sayılır.
- **Paket sınırları:** en çok 200 dosya (teslim.json ve TAMAM hariç), toplam 45 MB; tek dosya 20 MB görsel / 30 MB
  ses / 2 MB metin; öğe başına en çok 40 dosya, teslim başına en çok 50 öğe. Talimat ve `ornek-paket` bunu yazar.

## 12. Üretim Merkezi 2, aşama 1: fikir panosu, uygulama işi, rapor panosu, kabul havuzu

Plan: `docs/uretim/URETIM-2-PLAN.md`. Biçim `apps/uretim/src/ortak/fikir.ts`, `rapor.ts`; örnekler `paket_bicimi` →
`ornekler`. Talimatın sonundaki "Fikir ve rapor biçimi" bölümü ve istemdeki biçim satırı site kodundan eklenir.

- **Fikir teslimi** (`tur: "fikir"`): her öğe `ad` (başlık), `ozet` (tek cümle, ≤ 160), `kategori` (≤ 30), `etki`
  (`dusuk|orta|yuksek`), `zahmet` (`kucuk|orta|buyuk`), `gerekce`; isteğe bağlı tek küçük önizleme görseli. Bu
  alanlardan biri yazılırsa hepsi zorunludur; yalnız fikir teslimlerinde geçerlidir. Eski düz metin fikir (ad +
  aciklama) yine kabul edilir, basit kart olarak görünür (ön kontrolde uyarı).
- **Fikir aşaması** kayıtlardan türetilir (elle tutulmaz): `fikir → onaylandi → uygulaniyor → teslim_edildi →
  kabul_edildi → ana_kodda → canlida` (`reddedildi` ayrı). Onay/ret fikir panosunda tek tek ya da toplu
  (`POST /api/fikir/toplu`, ret notlu); karta not `POST /api/oge/:id/not`. "Fikir turu" (2–3 fikirden birini seçme)
  yalnız o seçenekle açılan işte geçerlidir; fikir panosu işlerinde ("30 fikir ver") sınır yoktur ve bir fikrin
  onayı kardeşlerini arşive atmaz.
- **"Onaylananları uygula"**: iş isterken onaylı fikirler seçilir (`fikirler: [id]`; yalnız aynı alanın `onaylandi`
  fikirleri). İş taslağının açıklamasına "Uygulanacak fikirler" (başlık + özet + sahip notu), kısıtlarına fikirId
  kuralı kodla eklenir; kopyalanan istem fikirleri kimlikleriyle gösterir; `is_oku` → `fikirler: [{ fikirId, baslik,
  ozet, kategori, etki, zahmet, not }]`. Teslimin her öğesi `fikirId` taşır (onaylı değilse ön kontrolde kalır, işin
  fikri değilse uyarı). Teslim kabul edilince fikir kendiliğinden ilerler.
- **Rapor teslimi** (`tur: "rapor"`): öğede `rapor` nesnesi: `ozet` kutucukları ({ ad, deger, birim, onceki, iyi:
  yukari|asagi }, ≤ 12), `seriler` ({ ad, tur: cizgi|cubuk, etiketler, degerler (aynı uzunlukta, ≤ 200), birim,
  esik }, ≤ 12), `tablolar` ({ ad, sutunlar (≤ 12), satirlar (≤ 200) }, ≤ 8), `bulgular` ({ baslik, onem:
  kritik|yuksek|orta|dusuk, oyun, adimlar, kanit, oneri, siklik }, ≤ 100). Biri varsa sıkı doğrulanır; yoksa eski
  rapor olduğu gibi kalır (basit kart). Site panoda SVG grafiklerle gösterir, aynı alanın önceki raporuyla
  karşılaştırır (kutucuk farkı, önceki seri, yeni/çözülen bulgular) ve raporlar boyunca gidişatı çizer; bulgu tek
  tıkla iş olur. `GET /api/raporlar?alan=` bütün alanlar.
- **Kabul**: incelemede teslimler için "Kabul et" (fikirlerde "Onayla"). **Kabul havuzu** (`GET /api/kabul`):
  `kabulde → yöneticide → ana kodda → test'te → canlıda` (öğe durumları `havuzda`, `pakette`, `oyuna_eklendi` +
  paket `testte`, `canlida`). "Yöneticiye gönder" = entegrasyon paketi (bölüm 5); tek tık alanlar "Oyuna aktar"
  (geri alınabilir, bölüm 3). Paket ana koda eklenince sürümü yazılır (`POST /api/paket/:id/oyuna-eklendi`), test
  ortamına çıkınca `POST /api/paket/:id/testte`; canlı sürüm o sürümü içerince öğeler kendiliğinden canlıda olur.
- Yeni ekranlar (`/fikirler`, `/raporlar`, `/kabul`, alan sayfasındaki "Onaylanan fikirler" şeridi, İş iste'deki
  "Onaylanan fikirleri uygula") canlı güncellenir (`/api/olaylar`).

## 13. Oyun alanı (test2) bağlantısı ve taslak katmanı (Üretim Merkezi 2, aşama 3 ilk dilim)

Sahip kararı: yapay zekâların uyguladığı yer test alanıdır. Teslim test2'de canlı görünür; sahip orada oynayıp bakar,
Üretim Merkezi'nde kabul eder; kabul edilen kabul havuzuna düşer, canlıya **yalnız** yönetici "ekle" ile (paket,
bölüm 5) gider. Plan: `docs/uretim/URETIM-2-PLAN.md` Aşama 3.

**Akış:** `teslim → ön kontrol geçti (bekliyor) → test2'ye kendiliğinden yüklenir → sahip test2'de dener → kabul →
kabul havuzu (test2'de yüklü kalır) → "Yöneticiye gönder" (paket) → yönetici test eder, ana koda ekler`. Ret →
test2'den geri alınır.

**Bağlantı.** Site test2'ye canlıyla aynı yoldan, iç Docker ağından gider: test2 kabı ortak `glix-oyun-alani` ağına
katılır (`deploy/ortamlar/docker-compose.oyun-alani.yml`, yalnız test2), site kabı da (`deploy/uretim/
docker-compose.yml`). Adres `URETIM_TEST2_URL=http://glix-test2-glix-1:3900`, anahtar test2'nin kendi
`GLIX_URETIM_TOKEN`'ı (`URETIM_TEST2_TOKEN`). Uçlar bölüm 3'teki uçların aynısıdır (aynı kurallar: Bearer, vekilden
gelen istek 404, dakikada 30 yazma). Canlı bağlantısı (`URETIM_OYUN_URL`) ve "Oyuna aktar" akışı değişmedi.

**Hangi teslimler gider** (bugün; diğer alanlar ALT-4…12 ile):
- İçerik havuzu (`icerik`): satır teslimi (`yeni`/`duzenleme` → `havuzlar/:id/ekle`; `kaldirma-onerisi` →
  `havuzlar/:id/kapat`). Geri alma `aktarim/:id/geri-al`.
- Mağaza (`magaza`): `tur: "yeni"` ve katalog satırı olan öğe → her satır için `POST /api/uretim/magaza/taslak`.
  Görseller öğenin `apps/client/public/assets/shop/...` hedef yollu dosyalarından, ürünün kullandıkları seçilir; PNG
  paketteki gibi WebP'ye çevrilir (kalite 82, alfa < 24 → 0; dönüştürücü yoksa PNG gider). Geri alma
  `DELETE magaza/taslak/:id`.

**Öğe durumuna göre** (site, `apps/uretim/src/oyunAlani.ts`):
- `bekliyor`, `duzeltme_istendi`, `onaylandi`, `havuzda` (kabulde), `pakette` (yöneticide): test2'de yüklü olmalı.
- `reddedildi`, `arsiv` (yeni sürüm geldi), `kaldi`: test2'den geri alınır.
- `oyuna_eklendi`, `canlida`: dokunulmaz (ana koda girdi; gece yenilemesinde test2 kodu zaten taşır).
- Sahip teslim kartından "test2'den geri al" diyebilir (karar değişmez, kendiliğinden yeniden yüklenmez) ve "yeniden
  yükle" ile geri getirir (`POST /api/oge/:id/test2-geri-al`, `/test2-yukle`; elle eşitleme `POST /api/test2/esitle`).
- Öğenin test2 durumu `test2: { durum: yuklu|bekliyor|hata|geri_alindi, ozet, hata, zaman, baglanti }` olarak öğe,
  kuyruk, arşiv ve kabul yanıtlarında; pano ve içerik/mağaza alan sayfasında `test2: { ayarli, calisiyor, revision,
  katman, sonDenetim, sonSifirlama, taslak, yuklu, hata, baglanti, sorun }`.

**Gece sıfırlaması (UM-O2 "taslaklar kaybolmaz").** test2 her gece sıfırlanır (`test2-yenile.sh` → `ortamYenile
--sifirla`): veritabanı ve taslak katmanı klasörü (`<veri>/oyun-alani/`) silinir, katmanın kimliği yenilenir. Site 5
dakikada bir `saglik`'e bakar; `katman` değiştiyse son sıfırlamayı yazar ve yüklü olması gereken öğeleri yeniden
yükler (turda en çok 12; hız sınırına takılan sonraki turda). Yükleyemediği öğe `hata` olur ve her turda yeniden denenir.

**Taslak katmanı (oyun sunucusu, `apps/server/src/oyunAlani.ts`, yalnız `GLIX_ORTAM=test2`).**
- `POST /api/uretim/magaza/taslak` gövdesi (en çok 18 MB):
  ```
  { "urun": <magaza.json ürün satırı (bölüm 2)>,
    "dosyalar": [ { "yol": "cerceve/neon-gece.webp", "veri": "<base64>" } ] }
  ```
  `yol` `/assets/shop/` altında göreli (`apps/client/public/assets/shop/` önekiyle de yazılabilir), `.webp` adlı;
  `veri` WebP ya da PNG (imza denetlenir), tek dosya ≤ 4 MB, ürün başına ≤ 12 MB, en çok 12 dosya.
- Doğrulama: `validateShopItem` (katalog + diğer taslaklarla kimlik/ad tekrarı), efekt tarifi, tür yalnız
  `DRAFT_SHOP_TYPES` (`unvan`, `ad-efekti`, `cerceve`, `kart-arkasi`, `zafer`, `tepki`, `giris`; dans ve giysiler
  karakter varlığı gerektirir), aynı türde katalogdaki bir `asset` adı kullanılamaz (görseller birbirini ezmesin),
  ürünün kullandığı her görsel (`cosmeticAssetFiles` + efekt dokuları) ya gönderilir ya oyunda vardır, kullanmadığı
  görsel gönderilemez. Hata: 400 `{ ok: false, code: "invalid_item", message, errors: [...] }`; katman dolu (100
  ürün) 409 `layer_full`.
- Taslaklar motorun önizleme katmanına (`setPreviewItems`) konur: sunucu satın almayı ve kuşanmayı bu katmanla
  doğrular (sahte hesaplar, ör. `Zengin`, alıp kuşanabilir). Katman diskte durur (yeniden başlatmada kalır).
- Genel uçlar (yalnız test2; Caddy giriş korumasının arkasında, anahtar gerekmez):
  `GET /api/oyun-alani/magaza` → `{ ok, urunler: [satır], dosyalar: { "/assets/shop/<yol>": "/api/oyun-alani/dosya/<sha256>.<webp|png>" } }`,
  `GET /api/oyun-alani/dosya/<ad>` (yalnız katmanda kullanılan dosyalar; içerik özetli ad, değişmez önbellek).
- İstemci (`apps/client/src/net/oyunAlani.ts`) yalnız sayfada `data-glix-ortam="test2"` şeridi varken (sunucu
  test2'de ekler) katmanı okur: ürünleri önizleme katmanına, görsel adreslerini `assetOverride` tablosuna koyar;
  mağaza taslakları **TASLAK** etiketiyle gösterir. Canlıda ve test'te hiçbir istek atılmaz, davranış birebir aynıdır.
- Derin bağlantı (yalnız test2): `https://test2.glix.dgmcraft.online/?ekran=magaza` girişten sonra mağazayı açar.
  İçerik için oyuna özel derin bağlantı yok; "test2'de aç" ana sayfayı açar.
- Bu dilimde katman test2'nin tamamında ortaktır (UM-O3'teki oda başına katman ve `oyun_alani_*` araçları sonraki
  dilim).

**Yapay zekâ istemi:** içerik ve mağaza alanında kopyalanan istemde (MCP ve SSH) ve talimatın "Teslim paketi"
bölümünde sabit satır: "Teslimin test2'ye (oyun alanı: test2.glix.dgmcraft.online) kendiliğinden yüklenir; sahip
orada dener." (`apps/uretim/src/ortak/oyunAlani.ts`, kodla eklenir.)

**Yöneticinin "ekle" paketi** (bölüm 5, `POST /api/paket` = "Yöneticiye gönder"): kabul havuzundaki öğeler —
içerik satırları dahil — tek pakette:
- Mağaza: `dosyalar/packages/engine/src/katalog/magaza.json.yama` (`{ ekle: [ürün satırı], degistir, satistanKaldir }`)
  + `dosyalar/apps/client/public/assets/shop/<klasör>/<ad>.webp` (WebP, kalite 82) + `ozet.json` içinde öğe başına
  `hedefYollar` (deposundaki yollar) ve `katalogSatirlari`.
- İçerik: kökte `icerik.json` (havuz başına `ekle` satırları ve `kapat` anahtarları) + `ozet.json` içinde
  `havuzSatirlari`. Yönetici satırları yerleşik havuza ya da (sahip isterse) bölüm 3 `ekle` ile canlıya ekler.
- Yönetici: yamayı `magaza.json`'a uygular, görselleri hedef yollara koyar, `pnpm check/typecheck/test/build`, ana
  dala birleştirir, `POST /api/paket/:id/oyuna-eklendi { revizyon }` → test'e çıkınca `/testte`.
