# Üretim Merkezi 2 — iş yapan alanlar, test alanı ve kabul akışı (plan)

Sahip geri bildirimi (2026-11-01):
- "Üretim merkezinde sadece fikir biriktiriyormuşum gibi hissediyorum."
- Test ve Performans'ta yapay zekânın sonuçları metin değil, grafikli güzel bir rapor sayfasında görünmeli.
- "30 fikir ver" → birkaçını onaylarım → yeni işte "onaylananları uygula" deyince yapmalı; her alan kendi işinde iş
  becerebilmeli.
- Fikirler metin metin değil, güzel bir arayüzde çıkmalı.
- **Yapay zekâların uyguladığı yer test alanı olmalı. Orada kabul edersem kabule düşer; sahip "ekle" deyince yönetici
  test eder ve ana koda ekler.**

Bu plan, daha önce onaylanan UM-O1…O7 (ortamlar), UM-F1 (yapay zekâ işini görür) ve UM-İ akışını bu isteklere göre
somutlaştırır. Oyuna dokunan her şey yalnız test ortamlarına gider; canlıya alma yine yalnız sahibin "canlıya al"
sözüyle ve kimse oynamıyorken.

## Akış (tek cümle)
`fikir (pano) → onay → uygulama işi → yapay zekâ test2'de uygular ve görür → teslim (test2 bağlantısı + ekran
görüntüleri) → sahip Üretim Merkezi'nde ve test2'de bakar → KABUL → kabul havuzu → sahip "ekle" der → yönetici
test eder, ana koda birleştirir → test.glix'e çıkar → sahip "canlıya al" der → aynı imaj canlıya`

## Aşama 1 — Üretim Merkezi'nde "iş yapan" arayüz (yalnız site)
1. **Fikir panosu.** Fikir teslimi yapılandırılmış olur: başlık, tek cümle özet, kategori, etki (düşük/orta/yüksek),
   zahmet (küçük/orta/büyük), gerekçe, isteğe bağlı küçük önizleme. Sitede kart ızgarası; kategori/etki/zahmet
   süzgeci, arama, sıralama; çoklu seçim ile toplu onay/ret; karta not ("şöyle olsun"). 30 fikir tek bakışta taranır.
2. **Fikir yaşam döngüsü.** Durumlar: `fikir → onaylandı → uygulanıyor → teslim edildi → kabul edildi → ana kodda →
   canlıda`. Alan sayfasında "Onaylanan fikirler" şeridi.
3. **"Onaylananları uygula" işi.** İş isterken onaylanan fikirlerden seçilir; Haiku istemi bu fikirleri (başlık + özet +
   sahip notu) içerir; `is_oku` fikir kimliklerini döndürür; teslim her öğede `fikirId` taşır. Teslim kabul edilince
   fikir kendiliğinden ilerler.
4. **Rapor panoları.** Rapor türü teslim yapılandırılmış JSON olur: özet sayılar (kutucuk), seriler (çizgi/çubuk),
   tablolar, bulgular (önem: kritik/yüksek/orta/düşük, oyun, adımlar, kanıt). Site bunları grafikli bir panoda
   gösterir (yeni bağımlılık yok; SVG grafikler). Raporlar birikir: önceki raporla karşılaştırma ve gidişat. Bulgu
   tek tıkla iş ya da başka alana istek kartı olur. İlk kullanan: Test ve Performans; Moderasyon (yanlış alarm),
   İçerik (karne) aynı altyapıyı kullanır.
5. **Alana özel teslim görünümleri.** Mağaza: mağaza kartı önizlemesi; içerik: tablo; ses/müzik: oynatıcı + dalga;
   görsel alanlar: galeri + koyu/açık zemin; rapor: pano; fikir: pano. Hiçbir teslim düz metin yığını olarak
   görünmez.
6. **Kabul havuzu.** "Onaylandı" yerine açık bir **Kabul** adımı ve "Kabul havuzu" sayfası: kabul edilenler alan
   alan listelenir; "Yöneticiye gönder" ile tek bir entegrasyon paketi (UM-İ7) hazırlanır; durum: `kabulde →
   yöneticide → ana kodda → test'te → canlıda`.

## Aşama 2 — Ortamlar: test.glix ve test2.glix (UM-O1, UM-O2, UM-O7)
- İki ayrı kap, ayrı veritabanı, ayrı gizli anahtarlar; bellek sınırı (test 512 MB, test2 512 MB). Sunucuda ~12 GB
  boş bellek var.
- Erişim yalnız sahip + davetli + yapay zekâ anahtarları; `noindex`; e-posta/telefon bildirimi kapalı.
- test: ana daldaki son derleme. test2: test'teki imaj + her gece içerik canlıdan yeniden kopyalanır, odalar/sahte
  hesaplar sıfırlanır, sahte hesaplar (zengin, yeni, tüm rozetler) yeniden üretilir.
- Canlıya alma betiği: aktif maç varsa durur; test'teki imajın aynısını taşır.
- **Hazırlandı (sunucuya kurulmadı):** `deploy/ortamlar/` (kurulum, test'e çıkarma, canlıya alma, gece yenileme,
  içerik kopyalama, erişim; adımlar `deploy/ortamlar/README.md`) ve sunucuda `GLIX_ORTAM=canli|test|test2` bayrağı
  (`apps/server/src/ortam.ts`). Erişim: Caddy `basic_auth` + giriş çerezi; yapay zekâlar için ayrı kullanıcı.

## Aşama 3 — Taslak katmanı ve oyun alanı araçları (UM-O3, UM-O4, UM-F1)
- Veriyle yönetilen alanlarda (önce içerik havuzları ve mağaza, sonra diğerleri ALT-4…12 ile) teslimler test2'ye
  **taslak katmanı** olarak kendiliğinden yüklenir; katman odaya bağlıdır.
- Yapay zekâ araçları: `oyun_alani_yukle`, `oyun_alani_oda_ac` (botlarla), `oyun_alani_ekran` (telefon/yatay/TV),
  `oyun_alani_an_tetikle`, `oyun_alani_kayit`, `oyun_alani_kapat`.
- Teslim kartında "test2'de aç" bağlantısı ve yapay zekânın kendi ekran görüntüleri.
- Test ve Performans alanı için: test2'de bot koşusu başlatma ve sonuçları rapor panosuna yazma (12 saatlik
  zamanlayıcı dahil).

### Aşama 3 ilk dilim — durum: **kodda hazır, sunucuya kurulmadı** (ayrıntı: `SOZLESME.md` bölüm 13)
- **Site → test2 bağlantısı:** `URETIM_TEST2_URL`/`URETIM_TEST2_TOKEN` (test2'nin kendi anahtarı); ortak
  `glix-oyun-alani` Docker ağı. Canlıya giden "Oyuna aktar" değişmedi; varsayılan yol test2.
- **İçerik havuzu:** ön kontrolden geçen teslim test2 havuzuna kendiliğinden eklenir; kartta "test2'de yüklü · geri
  al"; ret geri alır; kabul kabul havuzunda kalır (canlıya gitmez); gece sıfırlaması katman kimliğinden algılanır,
  bekleyen/kabuldeki/yöneticideki öğeler yeniden yüklenir.
- **Mağaza:** test2'de çalışma anında taslak katalog katmanı (`/api/uretim/magaza/taslak`, yalnız `GLIX_ORTAM=test2`;
  canlı ve test'te 404). Taslak ürün test2 mağazasında **TASLAK** etiketiyle görünür, sahte hesaplarla alınıp
  kuşanılır; görselleri sunucunun veri klasöründen gelir. Dans ve giysi taslakları henüz yok (karakter varlığı).
- **Arayüz:** teslim kartında, incelemede ve kabul havuzunda test2 şeridi + "test2'de aç" (mağaza:
  `?ekran=magaza`); pano ve içerik/mağaza alan sayfasında test2 durumu (çalışıyor mu, sürüm, son sıfırlama, yüklü,
  taslak). İstemde ve talimatta sabit satır "Teslimin test2'ye kendiliğinden yüklenir; sahip orada dener."
- **Kabul → yönetici:** "Yöneticiye gönder" paketi içerik satırlarını da taşır (`icerik.json`); mağaza için yama +
  WebP + hedef yollar (bölüm 5 ve 13).
- **Sonraki dilim:** oda başına katman (UM-O3), `oyun_alani_*` araçları (UM-O4), yapay zekânın kendi ekran
  görüntüleri, diğer alanlar.

## Aşama 4 — "Ekle" komutu (yönetici)
Sahip "kabul havuzundakileri ekle" deyince yönetici: paketi okur → kendi dalında uygular (kod, veri, görsel) → dört
denetim + ilgili oyun testleri → ana dala birleştirir → test'e çıkar → sahibe "test'te, bakabilirsin" der. Canlıya
alma yalnız "canlıya al" ile.

## Sıra
Aşama 1 ile Aşama 2 paralel başlar (biri yalnız site, diğeri yalnız altyapı). Aşama 3 ikisinin üstüne kurulur.
Aşama 4 bir çalışma biçimidir; ilk kabul paketi geldiğinde uygulanır.
