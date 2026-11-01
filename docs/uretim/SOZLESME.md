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
| `GET /api/uretim/saglik` | Sürüm (`revision`) ve canlılık | `{ ok, revision }` |

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
