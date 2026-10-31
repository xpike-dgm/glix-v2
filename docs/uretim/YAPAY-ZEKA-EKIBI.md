# GLIX yapay zekâ üretim ekibi: 50 rol

Bu belge, GLIX'in sürekli üretim düzenini anlatır: sahip birden çok yapay zekâyla aynı anda üretim yapar, hiçbiri koda
girmez. Bütün teslimler **Üretim Merkezi** sitesine düşer, sahip orada görür ve onaylar. Onaylananlar ya tek tıkla
oyunun içerik havuzlarına gider ya da yönetici (Claude) "onaylananları ekle" denince koda yerleştirip test eder ve
uygun anda (kimse oynamıyorken) canlıya alır.

Belgenin bölümleri:
1. İlkeler
2. Üretim Merkezi (site) kısa planı
3. Ortak teslim biçimi
4. Rollerin listesi (özet tablo)
5. Her rolün ayrıntısı (50 rol, 7 grup)
6. Etaplar ve başlangıç sırası
7. Sahibin günlük akışı

---

## 1. İlkeler

1. **Hiçbir yapay zekâ koda, canlı sunucuya, veritabanına ya da başka bir yapay zekânın kutusuna dokunmaz.** Yalnız
   kendi teslim kutusuna dosya bırakır ve kendi geri bildirim dosyasını okur.
2. **Her yapay zekânın tek bir işi vardır.** Yetki alanı talimatında yazılıdır. Alanı dışında bir şey üretirse
   teslim otomatik olarak reddedilir ("alan dışı").
3. **Her yapay zekâ için ayrı ve kalıcı bir sohbet kullanılır.** Tarzını ve aldığı geri bildirimleri unutmasın diye
   aynı sohbet sürdürülür. Sohbet dolarsa yeni sohbet, sitedeki "devir notu" ile başlar.
4. **Otomatik ön kontrol önce, sahip sonra bakar.** Biçim, boyut, şeffaflık, uzunluk, tekrar ve yasaklı kelime gibi
   ölçülebilir her şeyi site denetler. Sahibe yalnız zevk ve karar kalır.
5. **Ret her zaman bir notla yapılır** (tek tıkla hazır notlar: "tarz uymuyor", "çok zor", "tekrar", "yazı var"…).
   Not o yapay zekânın geri bildirim dosyasına düşer, bir sonraki turda düzeltir.
6. **Onay, oyuna girmek demek değildir.** Onaylanan, "onaylananlar havuzuna" düşer. Oyuna ekleme ve canlıya alma
   yönetici adımıdır (içerik havuzlarında tek tık "panele aktar" istisnadır).
7. **Canlıya alma yalnız sahip isteyince ve kimse oynamıyorken yapılır.** Bu belgedeki hiçbir otomasyon canlıya almaz.
8. **Yapay zekâlara gerçek kişi adı, kullanıcı verisi, e-posta, anahtar ya da şifre verilmez.** Raporlayan yapay
   zekâlar oyuncu verisini yalnız toplu ve anonim görür.

---

## 2. Üretim Merkezi (site) kısa planı

Ayrıntılı plan ayrı bir öneri dosyası olarak madde kodlarıyla yazılacak; burada yalnız iskelet var.

- **Adres:** ayrı alt alan adı (ör. `uretim.dgmcraft.online`), oyundan ayrı kendi kabında. Site çökse de oyun
  etkilenmez.
- **Giriş:** yalnız sahip (ve yönetici). Mevcut yönetici paneli gibi tek kullanımlık kodla giriş.
- **Yapay zekâ erişimi:** her yapay zekânın kendine ait, yalnız kendi kutusuna yazabilen bir **teslim anahtarı**
  olur. Kök (root) SSH erişimi bu düzende kaldırılabilir. Sunucuya erişimi olmayan araçlar (ses, video) için sitede
  **sürükle-bırak yükleme ekranı** vardır; dosyayı sahip yükler, hangi role ait olduğunu seçer.
- **Durumlar:** `gelen → ön kontrolde → bekliyor → onaylandı / reddedildi (notlu) → oyuna eklendi → canlıda`.
- **Ekranlar:**
  - **Pano:** her rolün bekleyen sayısı, son teslim zamanı, onay oranı, otomasyon uyarıları (kırmızı/sarı).
  - **İnceleme:** türüne göre görünüm. Görsel: koyu zeminde, gerektiğinde oyundaki gerçek boyutta ve kapalı/açık
    hâli yan yana. Ses: oynat düğmesi ve dalga biçimi. Liste: tablo, havuzda zaten olanlar işaretli, toplu seçim.
    Mağaza ürünü: mağazadaki kart görünümünün önizlemesi. Belge: okunur metin, madde kodlarıyla onay kutuları.
  - **Toplu onay / ret**, klavye kısayolları (O = onayla, R = reddet, sonraki).
  - **"Benzerini daha üret"** düğmesi: beğenilen teslimi örnek göstererek o role yeni iş açar.
  - **İş aç:** sahip bir role yeni görev yazar ("Sızma için 50 yeni çift, mutfak temalı"). Görev o rolün
    kutusuna düşer.
  - **Onaylananlar havuzu:** oyuna eklenmeyi bekleyenler; "yöneticiye gönder" listesi.
  - **Raporlar:** otomasyon rollerinin günlük/haftalık raporları.
- **Talimat dosyaları:** her rolün kalıcı talimatı (`OKU-BENI`) sitede tutulur ve sürümlenir. Sahip ya da yönetici
  bir kuralı değiştirince yapay zekâ bir sonraki turda yenisini okur.

---

## 3. Ortak teslim biçimi

Her teslim bir klasördür: `<rol-kodu>/<tarih>-<kısa-ad>/`. İçinde:

- **Dosyalar:** PNG (şeffaf istenenlerde gerçek alfa), WAV/OGG (ses), JSON/CSV (listeler), MD (belgeler).
- **`teslim.json`:** `{ "rol": "...", "is": "<görev kimliği>", "ogeler": [ { "dosya": "...", "ad": "...",
  "aciklama": "...", "kullanim": "<oyun/ekran/an>", "notlar": "..." } ] }`
- **Liste teslimlerinde** her satır ilgili içerik havuzunun alanlarına birebir uyar (ör. Kendim: `konu | ipucu`).
- **Yasaklar (hepsinde):** gerçek marka, gerçek kişi, telifli karakter, siyasi/dini hassas içerik, şiddet,
  cinsellik, görsellerde yazı/harf/rakam (istenmedikçe).

---

## 4. Rollerin listesi

Kısaltmalar. **Ekleme:** P = panele aktar (tek tık, içerik havuzu), C = yönetici (Claude) koda ekler, R = yalnız
rapor ya da öneri (sahip karar verir, gerekirse yönetici uygular). **Etap:** 1 = hemen, 2 = sonra, 3 = oyunlar
bitmeye yakın.

| # | Rol | Grup | Araç türü | Ekleme | Etap |
|---|---|---|---|---|---|
| 1 | Oyun Görselleri | Görsel | Görsel üretici | C | 1 |
| 2 | Mağaza Ürünleri | Görsel | Görsel + metin | C | 1 |
| 3 | Karakter ve Kozmetik | Görsel | Görsel üretici | C | 2 |
| 4 | Maskot | Görsel | Görsel üretici | C | 2 |
| 5 | Anlatım Sahneleri | Görsel | Görsel üretici | C | 2 |
| 6 | Dünyalar ve Arka Planlar | Görsel | Görsel üretici | C | 2 |
| 7 | Rozet Görselleri | Görsel | Görsel üretici | C | 2 |
| 8 | Maç Kartları | Görsel | Görsel + metin | C | 3 |
| 9 | Arayüz İkon ve Süsleri | Görsel | Görsel üretici | C | 3 |
| 10 | Efekt Dokuları | Görsel | Görsel üretici | C | 3 |
| 11 | Sezon ve Etkinlik | Görsel | Görsel + metin | C | 3 |
| 12 | Tanıtım Görselleri | Görsel | Görsel üretici | R | 3 |
| 13 | Ses Efektleri | Ses | Ses efekti üretici | C | 1 |
| 14 | Müzik | Ses | Müzik üretici | C | 2 |
| 15 | Spiker Sesi | Ses | Seslendirme üretici | C | 2 |
| 16 | Tepki ve Emote Sesleri | Ses | Ses efekti üretici | C | 3 |
| 17 | Kelime Havuzları | İçerik | Metin | P | 1 |
| 18 | Sözlük ve Tanım | İçerik | Metin | P | 1 |
| 19 | Soru ve Cümle | İçerik | Metin | P | 1 |
| 20 | Kelime Çiftleri | İçerik | Metin | P | 1 |
| 21 | Moderasyon Listesi | İçerik | Metin | P | 2 |
| 22 | Görev ve Rozet Metinleri | İçerik | Metin | C | 2 |
| 23 | Duyuru ve Bildirim | İçerik | Metin | P/C | 2 |
| 24 | Metin Redaksiyonu | İçerik | Metin | R | 3 |
| 25 | Wiki Yazarı | İçerik | Metin | C | 2 |
| 26 | Öğretici ve İlk Oyun | İçerik | Metin | R | 3 |
| 27 | Hazır Espri Havuzu | İçerik | Metin | P | 2 |
| 28 | İsim ve Takma Ad | İçerik | Metin | P | 3 |
| 29 | Oyun Geliştirme Tasarımcısı | Tasarım | Metin | R | 1 |
| 30 | Yeni Oyun Mucidi | Tasarım | Metin | R | 2 |
| 31 | Oyun Dengesi Analisti | Tasarım | Veri + metin | R | 2 |
| 32 | Ekonomi ve Fiyat Analisti | Tasarım | Veri + metin | R | 2 |
| 33 | Arayüz Eleştirmeni | Tasarım | Görsel okuyabilen metin | R | 2 |
| 34 | Erişilebilirlik Denetçisi | Tasarım | Görsel okuyabilen metin | R | 3 |
| 35 | Bağlılık Tasarımcısı | Tasarım | Metin | R | 3 |
| 36 | Sağlık Nöbetçisi | Operasyon | Zamanlanmış | R | 1 |
| 37 | Hata Ayıklayıcı | Operasyon | Zamanlanmış | R | 2 |
| 38 | Geri Bildirim Tasnifçisi | Operasyon | Zamanlanmış | R | 3 |
| 39 | İçerik Açığı Bekçisi | Operasyon | Zamanlanmış | R | 2 |
| 40 | Bot Test Oyuncusu | Operasyon | Zamanlanmış | R | 3 |
| 41 | Görsel Gerileme Denetçisi | Operasyon | Zamanlanmış | R | 3 |
| 42 | Performans Bekçisi | Operasyon | Zamanlanmış | R | 3 |
| 43 | Güvenlik Bekçisi | Operasyon | Zamanlanmış | R | 2 |
| 44 | Şikâyet Nöbetçisi | Operasyon | Zamanlanmış | R | 2 |
| 45 | Mağaza Sayfası ve Tanıtım Metni | Büyüme | Metin | R | 3 |
| 46 | Sosyal Medya | Büyüme | Metin + görsel | R | 3 |
| 47 | Video ve Fragman | Büyüme | Video üretici | R | 3 |
| 48 | Topluluk Yöneticisi | Büyüme | Metin | R | 3 |
| 49 | Çeviri | Büyüme | Metin | C/P | 3 |
| 50 | Trend ve Rakip Araştırmacısı | Büyüme | Metin + web | R | 3 |

Önceki önerilerle eşleşme: 1 Oyun Görselleri, 2 Mağaza, 17–20 İçerik (kelime/cümle), 13–14 Ses, 22 + 7 Görev ve
Rozet, 21 Moderasyon, 24 + 45–46 Metin ve Tanıtım, 29 Oyun Tasarımcısı, 3 Karakter ve Kozmetik, 15 Spiker Sesi,
11 Sezon ve Etkinlik, 8 Maç Kartları, 49 Çeviri; zamanlanmış işler B1–B6 → 36, 37, 38, 31, 39, 40.

---

## 5. Rollerin ayrıntısı

Her rolde aynı başlıklar: **Amaç**, **Araç**, **Girdi** (ona ne verilir), **Teslim**, **Ön kontrol** (site
otomatik denetler), **İnceleme** (sahip ne görür), **Sınır** (yapamaz), **Ekleme**, **Örnek iş**.

### A. Görsel grubu

#### 1. Oyun Görselleri
- **Amaç:** Oyunlardaki eşya, sahne parçası ve efekt görselleri; yeni oyun geliştirmelerinin 🎨 işaretli maddeleri.
  Bugün ChatGPT ile yürüyen "OYUN-GELISTIRME-N" görevlerinin kalıcı hâli.
- **Araç:** ChatGPT (görsel üretim).
- **Girdi:** `docs/GORSEL-URETIM.md` stil öneki, oyun başına tarif dosyası (`docs/oneriler/<oyun>-gorsel.md`),
  referans görseller, oyunun bugünkü ekran görüntüsü.
- **Teslim:** şeffaf PNG, tarifteki oran; `teslim.json`'da kullanım yeri.
- **Ön kontrol:** oran ±%2, gerçek alfa (şeffaf istenenlerde kenarlar alfa 0), görselde yazı yok (yazı tanıma),
  dosya adı tarifteki ad.
- **İnceleme:** koyu zeminde büyük; oyundaki gerçek boyutta küçük önizleme; varsa kapalı/açık ya da parça/bütün
  yan yana.
- **Sınır:** mağaza ürünü, karakter, rozet üretmez.
- **Ekleme:** C. Yönetici WebP'ye çevirir, düşük alfa kalıntısını temizler, `assets/props/<oyun>/` altına koyar.
- **Örnek iş:** "Kara Borsa: beş kutunun açık hâli, kapalı hâliyle aynı açı ve boyda."

#### 2. Mağaza Ürünleri
- **Amaç:** Mağazayı sürekli büyütmek: yeni kozmetik ürün fikri, adı, açıklaması, nadirlik ve fiyat önerisi,
  görseli; tek pakette.
- **Araç:** ChatGPT (görsel + metin).
- **Girdi:** mevcut mağaza ürünlerinin listesi ve görselleri, nadirlik basamakları, fiyat aralıkları, ürün türleri
  (çerçeve, avatar süsü, efekt, rozet çerçevesi vb.).
- **Teslim:** ürün başına PNG + `urun.json` (`ad`, `aciklama`, `tur`, `nadirlik`, `fiyat_onerisi`, `koleksiyon`).
- **Ön kontrol:** ad tekrarı yok, ad ≤ 24 karakter, açıklama ≤ 90 karakter, fiyat aralık içinde, görsel boyut/alfa.
- **İnceleme:** mağazadaki ürün kartının birebir önizlemesi, aynı koleksiyonun diğer ürünleriyle yan yana.
- **Sınır:** fiyatı ve nadirliği yalnız önerir; son karar sahibin. Oyun görseli üretmez.
- **Ekleme:** C. Yönetici kataloğa ekler, görseli yerleştirir, mağaza testlerini çalıştırır.
- **Örnek iş:** "Neon gece koleksiyonu: 6 avatar çerçevesi, 2'si nadir, 1'i efsanevi."

#### 3. Karakter ve Kozmetik
- **Amaç:** Yeni avatar karakterleri ve mevcut karakterlerin poz, ifade ve renk varyantları.
- **Araç:** ChatGPT (görsel).
- **Girdi:** mevcut karakter görselleri (`assets/avatars`, `assets/karakter`), oranlar, büst kesimi kuralları.
- **Teslim:** büst ve tam boy PNG'ler; varyant tablosu.
- **Ön kontrol:** tuval boyu ve göz hizası mevcut karakterlerle aynı (yüz konumu ±%3), alfa, yazı yok.
- **İnceleme:** lobi avatar halkası içinde ve skor şeridinde küçük boyutta önizleme.
- **Sınır:** gerçek kişiye ya da bilinen karaktere benzetme yok.
- **Ekleme:** C.
- **Örnek iş:** "Mevcut 8 karakter için 'şaşkın' ve 'zafer' ifadeleri."

#### 4. Maskot
- **Amaç:** GLIX maskotunun yeni pozları: yükleniyor, bağlantı koptu, kazandın, boş liste, hata ekranı, bayram.
- **Araç:** ChatGPT (görsel).
- **Girdi:** mevcut maskot pozları (`assets/mascot`), hangi ekranda kullanılacağı.
- **Teslim:** şeffaf PNG, kare.
- **Ön kontrol:** tuval ve ölçek mevcut pozlarla aynı, alfa.
- **İnceleme:** ilgili ekranın içinde önizleme.
- **Sınır:** maskotun temel tasarımını değiştirmez.
- **Ekleme:** C.
- **Örnek iş:** "Hata ekranı için 'özür dileyen' ve 'tamir eden' pozları."

#### 5. Anlatım Sahneleri
- **Amaç:** Her oyunun anlatım (briefing) ekranındaki 2–3 sahne görseli; kural değişince yenileri.
- **Araç:** ChatGPT (görsel).
- **Girdi:** oyunun kural özeti (`docs/KURALLAR.md` ilgili bölüm), mevcut anlatım görselleri.
- **Teslim:** dikey PNG, sahne başına bir dosya.
- **Ön kontrol:** oran, boyut, yazı yok.
- **İnceleme:** anlatım ekranında kaydırılarak.
- **Sınır:** kural icat etmez; sahne kuralı doğru göstermeli.
- **Ekleme:** C.
- **Örnek iş:** "Kara Borsa'nın yeni Büyük Kutu kuralı için 3. anlatım sahnesi."

#### 6. Dünyalar ve Arka Planlar
- **Amaç:** Oyun arka planları (dikey, yatay, TV), gündüz/gece ya da sezon varyantları.
- **Araç:** ChatGPT (görsel).
- **Girdi:** mevcut dünya görselleri (`assets/worlds`), arayüzün üstüne bineceği alanlar (güvenli bölge şeması).
- **Teslim:** opak PNG, üç oran.
- **Ön kontrol:** oran, güvenli bölgede yüksek kontrastlı detay yok (okunurluk).
- **İnceleme:** gerçek oyun ekranının arkasında.
- **Sınır:** yazı, logo yok.
- **Ekleme:** C.
- **Örnek iş:** "Kule Ustası için gece şantiyesi varyantı."

#### 7. Rozet Görselleri
- **Amaç:** Rol 22'nin yazdığı rozetlerin görselleri.
- **Araç:** ChatGPT (görsel).
- **Girdi:** mevcut rozetler (`assets/badges`), rozet adı ve anlamı.
- **Teslim:** kare şeffaf PNG.
- **Ön kontrol:** boyut, alfa, yazı yok; küçük boyutta okunurluk (siluet kontrastı).
- **İnceleme:** profil rozet rafında, 48 px ve 96 px.
- **Sınır:** rozet adını o koymaz; rol 22'nin onaylanmış listesinden çalışır.
- **Ekleme:** C.
- **Örnek iş:** "Gece Kuşu, Hafıza Ustası serisine 4 yeni rozet."

#### 8. Maç Kartları
- **Amaç:** Maç kartı kataloğuna yeni kart fikirleri: ad, kart metni, nadirlik, hedef türü, saldırı mı; ve görseli.
- **Araç:** ChatGPT (görsel + metin).
- **Girdi:** `docs/KURALLAR.md` kart bölümü, mevcut kart kataloğu ve görselleri.
- **Teslim:** kart başına PNG + `kart.json`.
- **Ön kontrol:** ad tekrarı yok, metin ≤ 90 karakter, nadirlik ve hedef türü geçerli değerlerden.
- **İnceleme:** kart yüzü önizlemesi; yanında "bu kart hangi kartlarla etkileşir" özeti.
- **Sınır:** kart kuralının uygulanabilirliğine yönetici karar verir; uygulanamayan kart reddedilir.
- **Ekleme:** C (kural kodu + test).
- **Örnek iş:** "2 sıradan, 1 nadir savunma kartı."

#### 9. Arayüz İkon ve Süsleri
- **Amaç:** Tutarlı ikon seti (ayarlar, ses, çıkış, arkadaş, mağaza…), çerçeve köşeleri, düğme süsleri.
- **Araç:** görsel üretici (SVG üretebilen tercih edilir).
- **Girdi:** mevcut ikonlar, renk değişkenleri.
- **Teslim:** SVG ya da şeffaf PNG.
- **Ön kontrol:** SVG'de dış bağlantı ve betik yok, tek renk ya da tema değişkeniyle boyanabilir.
- **İnceleme:** 16, 24, 32 px'te açık ve koyu temada.
- **Sınır:** ekran yerleşimini değiştirmez.
- **Ekleme:** C.

#### 10. Efekt Dokuları
- **Amaç:** Parçacık ve efekt dokuları: kıvılcım, konfeti, duman, cam kırığı, ışık huzmesi, neon iz.
- **Araç:** görsel üretici.
- **Girdi:** mevcut `assets/fx`, hangi animasyonda kullanılacağı.
- **Teslim:** şeffaf PNG, gerekiyorsa sprite şeridi.
- **Ön kontrol:** boyut ≤ 256 px (performans), alfa, döşenebilirlik (gerekenlerde).
- **İnceleme:** canlandırılmış önizleme.
- **Sınır:** büyük dosya yok.
- **Ekleme:** C.

#### 11. Sezon ve Etkinlik
- **Amaç:** Takvim dönemleri için tema paketi: arka plan varyantı, sınırlı mağaza ürünleri, etkinlik görevleri,
  duyuru metni.
- **Araç:** ChatGPT (görsel + metin).
- **Girdi:** takvim (bayramlar, yılbaşı, okul tatili), mevcut tarz.
- **Teslim:** paket klasörü: görseller + `etkinlik.json` (tarihler, ürünler, görevler).
- **Ön kontrol:** tarih çakışması yok, ürün ve görev biçimleri rol 2 ve 22 ile aynı kurallarda.
- **İnceleme:** paket önizlemesi (lobi + mağaza + görev ekranı).
- **Sınır:** dini ya da siyasi hassasiyet taşıyan sembol yok.
- **Ekleme:** C. Etkinlik en az 2 hafta önce onaylanır.
- **Örnek iş:** "Yılbaşı: kar yağışlı lobi, 5 sınırlı ürün, 3 etkinlik görevi."

#### 12. Tanıtım Görselleri
- **Amaç:** Uygulama mağazası ekran görüntüsü çerçeveleri, sosyal medya görselleri, afiş.
- **Araç:** görsel üretici.
- **Girdi:** wiki ekran görüntüleri, logo, renkler.
- **Teslim:** platform ölçülerinde PNG.
- **Ön kontrol:** ölçü, dosya boyutu.
- **İnceleme:** platform önizlemesi.
- **Sınır:** oyunda olmayan özelliği göstermez.
- **Ekleme:** R (sahip yayımlar).

### B. Ses grubu

#### 13. Ses Efektleri
- **Amaç:** Bugün kodla sentezlenen seslerin yerine gerçek ses efektleri: tokmak, cam kırılması, kasa açılması,
  geri sayım tiki, kazanma, kaybetme, dokunma, kart çevirme, vinç cızırtısı…
- **Araç:** ses efekti üretim aracı (ör. ElevenLabs Sound Effects).
- **Girdi:** oyun başına "ses anları" listesi (yönetici çıkarır: an, süre sınırı, duygu).
- **Teslim:** OGG/WAV, mono, ≤ 2 sn (efekt), sessizlikten başlayan.
- **Ön kontrol:** süre, ses düzeyi (LUFS aralığı), baş/son sessizlik kırpılmış, kırpılma (clipping) yok.
- **İnceleme:** oynat; aynı anın eski sentez sesiyle karşılaştır.
- **Sınır:** telifli ses yok.
- **Ekleme:** C. Yönetici sıkıştırır, ses setine bağlar; "sessizde çal" ve ses düzeyi ayarları korunur.
- **Örnek iş:** "Kara Borsa: tokmak vuruşu, kapak açılması, lanet dumanı."

#### 14. Müzik
- **Amaç:** Kısa, döngüye girebilen müzikler: lobi, oyun içi gerilim, sonuç, final.
- **Araç:** müzik üretim aracı (ör. Suno).
- **Girdi:** her oyunun havası, süre, tempo.
- **Teslim:** OGG, 30–90 sn, kusursuz döngü.
- **Ön kontrol:** döngü dikişi (baş/son dalga uyumu), ses düzeyi, süre.
- **İnceleme:** döngüyü 3 kez arka arkaya çal.
- **Sınır:** sözlü müzik yok (konuşmayı bastırmasın).
- **Ekleme:** C. Müzik düzeyi ayarına bağlanır.

#### 15. Spiker Sesi
- **Amaç:** Tek ve tutarlı bir spiker karakterinin seslendirdiği kısa anonslar: "3, 2, 1!", "SATILDI!",
  "Kusursuz!", "Son tur!", "Kazanan…".
- **Araç:** seslendirme üretim aracı (tek ses kimliği sabit tutulur).
- **Girdi:** oyun başına anons listesi (10–20 satır).
- **Teslim:** satır başına OGG.
- **Ön kontrol:** süre ≤ 2,5 sn, düzey, metin-ses eşleşmesi (konuşma tanımayla).
- **İnceleme:** satır satır oynat.
- **Sınır:** oyuncu adı okumaz (adlar canlı üretilmez).
- **Ekleme:** C.

#### 16. Tepki ve Emote Sesleri
- **Amaç:** Oyuncuların gönderdiği tepkiler (gülme, şaşırma, alkış, "ooo") için kısa sesler.
- **Araç:** ses efekti üretim aracı.
- **Teslim / Ön kontrol / Ekleme:** rol 13 ile aynı; ≤ 1 sn.

### C. İçerik grubu

Bu gruptaki liste rolleri yönetici panelindeki içerik havuzlarına **tek tıkla** aktarılır. Her havuzun alan
kuralları (karakter sınırları) talimata yazılır ve ön kontrolde birebir denetlenir. Mevcut havuzlar: Sözlük Blöfü
kelimeleri ve tanımları, Sızma kelime çiftleri, Karalama Defteri kelime çiftleri, Çağrışım Ağı kelimeleri, Laf
Sokma soruları, Yazı Yaz konuları, Kendim konuları. Yeni oyunlar havuz eklendikçe listeye girer.

#### 17. Kelime Havuzları
- **Amaç:** Tek kelimelik ve konu havuzları: Çağrışım Ağı kelimeleri, Yazı Yaz konuları, Kendim konuları.
- **Araç:** metin yapay zekâsı.
- **Girdi:** havuzun alan kuralları, mevcut liste (tekrar olmasın), zorluk ve yaş hedefi (aile dostu).
- **Teslim:** CSV/JSON, havuz alanlarıyla birebir.
- **Ön kontrol:** uzunluk, Türkçe karakter, tekrar (mevcut havuz + aynı teslim), yasaklı kelime, büyük/küçük harf
  kuralı.
- **İnceleme:** tablo; satır başına onay, toplu onay.
- **Sınır:** marka, ünlü adı, argo yok.
- **Ekleme:** P.
- **Örnek iş:** "Yazı Yaz: 50 yeni konu, okul ve tatil temalı."

#### 18. Sözlük ve Tanım
- **Amaç:** Sözlük Blöfü için az bilinen ama gerçek Türkçe kelimeler ve doğru, kısa tanımları.
- **Araç:** metin yapay zekâsı (web erişimi olursa doğrulama için iyi).
- **Girdi:** havuz kuralları, mevcut liste.
- **Teslim:** `kelime | gerçek tanım | kaynak notu`.
- **Ön kontrol:** uzunluk, tekrar, tanımda kelimenin kendisi geçmiyor.
- **İnceleme:** tablo; şüpheli olanlar işaretli (kaynak notu boş).
- **Sınır:** uydurma kelime yok; tanım doğru olmalı.
- **Ekleme:** P.

#### 19. Soru ve Cümle
- **Amaç:** Cümle ve soru isteyen havuzlar: Laf Sokma soruları ve ileride soru isteyen yeni oyunlar.
- **Araç:** metin yapay zekâsı.
- **Girdi:** havuz kuralları (ör. soru işaretiyle biten tek cümle, 12–90 karakter), ton (esprili, kimseyi kırmayan).
- **Teslim:** satır başına bir soru.
- **Ön kontrol:** uzunluk, soru işareti, tekrar ve benzerlik (neredeyse aynı soru), yasaklı kelime.
- **İnceleme:** tablo.
- **Sınır:** gerçek kişi, siyaset, din, sağlık sorunu, aşağılama yok.
- **Ekleme:** P.

#### 20. Kelime Çiftleri
- **Amaç:** Yakın anlamlı çiftler: Sızma ve Karalama Defteri.
- **Araç:** metin yapay zekâsı.
- **Girdi:** havuz kuralları, "yakın ama ayrılabilir" ölçütü, örnek iyi ve kötü çiftler.
- **Teslim:** `birinci | ikinci`.
- **Ön kontrol:** uzunluk, iki kelime aynı değil, biri diğerinin içinde geçmiyor, tekrar.
- **İnceleme:** tablo; zorluk etiketi (kolay/orta/zor).
- **Ekleme:** P.

#### 21. Moderasyon Listesi
- **Amaç:** Serbest yazılı oyunlar için yasaklı kelime listesi: küfür ve argonun farklı yazılışları, harf ve sayı
  oyunları (ör. harf yerine rakam), birleşik yazımlar.
- **Araç:** metin yapay zekâsı.
- **Girdi:** mevcut yasaklı kelime listesi, eşleştirme kurallarının özeti (tam kelime / içinde geçme).
- **Teslim:** satır başına bir kalıp + tür (küfür, hakaret, cinsel, nefret).
- **Ön kontrol:** zararsız sık kelimeleri yanlışlıkla yakalıyor mu (örnek metin taraması: yanlış alarm sayısı).
- **İnceleme:** tablo; yanlış alarm riski yüksek olanlar sarı.
- **Sınır:** yalnız liste üretir; ceza ya da yasaklama kararı vermez.
- **Ekleme:** P.

#### 22. Görev ve Rozet Metinleri
- **Amaç:** Günlük, haftalık ve uzun vadeli görevler; rozet adları ve açıklamaları.
- **Araç:** metin yapay zekâsı.
- **Girdi:** mevcut görev ve rozet listesi, ölçülebilen olaylar (oyun oynadı, kazandı, X oyununda Y yaptı…), ödül
  aralıkları.
- **Teslim:** `gorev.json` (koşul, hedef sayı, ödül, süre), `rozet.json` (ad, açıklama, koşul).
- **Ön kontrol:** koşul ölçülebilir olaylar listesinde var, ödül aralıkta, ad tekrarı yok.
- **İnceleme:** görev ekranı önizlemesi.
- **Sınır:** ölçülemeyen koşul yazmaz.
- **Ekleme:** C (koşul kodu + test). Rozet görseli rol 7'ye iş olarak düşer.

#### 23. Duyuru ve Bildirim
- **Amaç:** Site duyuruları, telefon bildirimleri, e-posta şablonları, güncelleme notları ("Yeni sürüm: Kara
  Borsa'ya Büyük Kutu geldi!").
- **Araç:** metin yapay zekâsı.
- **Girdi:** değişiklik listesi (yönetici verir), ton.
- **Teslim:** başlık + metin + (bildirimse) ≤ 90 karakter kısa sürüm.
- **Ön kontrol:** uzunluk, teknik kelime yok (ör. "sunucu", "sürüm kodu").
- **İnceleme:** telefon bildirimi ve duyuru şeridi önizlemesi.
- **Ekleme:** P (duyuru paneli) / C (şablon).

#### 24. Metin Redaksiyonu
- **Amaç:** Bütün arayüz metinlerini tek dilde toplamak: kısa, tutarlı, esprili; aynı şeye iki farklı ad yok.
- **Araç:** metin yapay zekâsı.
- **Girdi:** yönetici her sürümde arayüz metinlerinin dökümünü verir (dosya + metin).
- **Teslim:** `eski | yeni | gerekçe` listesi.
- **Ön kontrol:** yeni metin aynı yere sığıyor mu (karakter sınırı, düğmeler için daha sıkı).
- **İnceleme:** ekran görüntüsü üstünde eski/yeni karşılaştırma.
- **Sınır:** kural değiştirmez; yalnız dil.
- **Ekleme:** R → onaylananları yönetici uygular.

#### 25. Wiki Yazarı
- **Amaç:** Wiki oyun sayfaları: nasıl oynanır, ipuçları, sık sorulanlar; kural değişince güncelleme.
- **Araç:** metin yapay zekâsı.
- **Girdi:** `docs/KURALLAR.md`, wiki JSON biçimi, ekran görüntüleri.
- **Teslim:** wiki JSON biçiminde taslak.
- **Ön kontrol:** JSON şeması, her ekran girdisinin görseli var.
- **İnceleme:** wiki sayfası önizlemesi.
- **Sınır:** `KURALLAR.md` ile çelişemez (kural kaynağı orasıdır).
- **Ekleme:** C.

#### 26. Öğretici ve İlk Oyun
- **Amaç:** İlk kez gelen oyuncu için öğretici akış önerileri: ilk oyun hangisi, hangi ipucu ne zaman, boş ekran
  metinleri.
- **Araç:** metin yapay zekâsı.
- **Teslim:** madde kodlu öneri belgesi (M/U kodlarıyla, bugünkü öneri dosyası biçiminde).
- **Ekleme:** R.

#### 27. Hazır Espri Havuzu
- **Amaç:** Yapay zekâ yorumu kapalıyken ya da gelmediğinde gösterilecek hazır spiker esprileri; oyun ve durum
  başına ("kimse kâr etmedi", "berabere", "tek bulan").
- **Araç:** metin yapay zekâsı.
- **Girdi:** oyun başına durum listesi, yer tutucular ({kazanan}, {sayi}).
- **Teslim:** `oyun | durum | metin`.
- **Ön kontrol:** yer tutucular geçerli, uzunluk, yasaklı kelime, aşağılama yok.
- **Ekleme:** P (yeni havuz açılınca).

#### 28. İsim ve Takma Ad
- **Amaç:** Lobide "rastgele takma ad" önerileri, bot adları, oda adı önerileri.
- **Araç:** metin yapay zekâsı.
- **Teslim:** liste.
- **Ön kontrol:** uzunluk, yasaklı kelime, gerçek ünlü adı yok.
- **Ekleme:** P.

### D. Tasarım grubu

#### 29. Oyun Geliştirme Tasarımcısı
- **Amaç:** Öneri dosyası olmayan oyunlar (Sözlük Blöfü, Çağrışım Ağı, Butona Bas, Rus Ruleti, Gizli Hırsız, Kör
  Kronometre, Kör Bomba, Rüşvet-Darbe, Açgözlülük Limiti, Ortalamanın Yarısı, Gizli Kareler, Karalama Defteri,
  İttifak, Son Kişi, Çizgiyi Geçme) için bugünkü biçimde öneri dosyaları: M/U/AI kodlu maddeler, her maddede
  "önerim", 🎨 işareti, önerilen paket.
- **Araç:** metin yapay zekâsı (ekran görüntüsü okuyabilen).
- **Girdi:** oyunun kuralı, kodu değil kod özeti (yönetici çıkarır), bugünkü ekran görüntüleri, sahibin genel
  kararları (`docs/UI-GELISTIRME.md` "Tüm oyunlar": eksi puan yok, +2/+1/0 sıralama ödülü, "Devam et" 60 sn…),
  örnek öneri dosyaları (`docs/oneriler/*.md`).
- **Teslim:** `docs/oneriler/<oyun>.md` biçiminde belge.
- **Ön kontrol:** biçim (her maddede kod, önerim, paket), genel kararlarla çelişki taraması (ör. "eksi puan"
  geçiyor mu).
- **İnceleme:** belge; her maddenin yanında onay kutusu. Sahip kodları işaretler, onaylar doğrudan karar defterine
  yazılır.
- **Sınır:** kod yazmaz; uygulanabilirliği yönetici son kez denetler.
- **Ekleme:** R → onaylanan maddeleri yönetici yaptırır.

#### 30. Yeni Oyun Mucidi
- **Amaç:** Tamamen yeni parti oyunu fikirleri; telefon başına gizli bilgi, 3–8 oyuncu, 2–5 dakika.
- **Araç:** metin yapay zekâsı.
- **Girdi:** mevcut oyun listesi (tekrar olmasın), oyun çatısının sınırları (sunucu tek otorite, gizli bilgi
  yalnız hak sahibine), sahibin beğendiği oyunlar.
- **Teslim:** tek sayfalık oyun kartı: ad, bir cümle, kurallar, neden eğlenceli, gereken görsel/içerik, tahmini
  zorluk.
- **Ön kontrol:** mevcut oyunlara benzerlik uyarısı; var olan ticari bir oyunun kopyası olmamalı.
- **Ekleme:** R.

#### 31. Oyun Dengesi Analisti
- **Amaç:** Maç verisinden denge bulguları: kazanma oranları (sıra, rol, oyuncu sayısına göre), ortalama süre, en
  çok terk edilen oyun, puan dağılımı.
- **Araç:** zamanlanmış analiz (yönetici kurar) + metin yapay zekâsı özet yazar.
- **Girdi:** anonim, toplu maç istatistikleri.
- **Teslim:** haftalık rapor + somut öneri ("Kule'de 2 kişide ilk oynayan %64 kazanıyor; ilk sıra rastgele olsun").
- **Ekleme:** R.

#### 32. Ekonomi ve Fiyat Analisti
- **Amaç:** Glix ekonomisi: kazanma hızı, mağaza fiyatları, görev ödülleri, enflasyon; hangi ürün satılmıyor.
- **Araç:** zamanlanmış analiz + metin.
- **Girdi:** toplu glix defteri ve satın alma istatistikleri (anonim).
- **Teslim:** aylık rapor + fiyat önerileri.
- **Ekleme:** R.

#### 33. Arayüz Eleştirmeni
- **Amaç:** Her ekranın görüntüsüne bakıp "gerçek oyun hissi" için U kodlu iyileştirme önerileri.
- **Araç:** ekran görüntüsü okuyabilen metin yapay zekâsı.
- **Girdi:** wiki ekran görüntüleri (her boyut), tasarım kuralları (`docs/TASARIM.md`).
- **Teslim:** oyun başına U maddeleri.
- **Ekleme:** R.

#### 34. Erişilebilirlik Denetçisi
- **Amaç:** Kontrast, renk körü modu, yazı boyutu, dokunma alanı (≥ 44 px), hareket azaltma.
- **Araç:** ekran görüntüsü okuyabilen metin yapay zekâsı + otomatik kontrast ölçümü.
- **Teslim:** bulgu listesi (ekran, öğe, sorun, öneri).
- **Ekleme:** R.

#### 35. Bağlılık Tasarımcısı
- **Amaç:** Oyuncuyu geri getiren düzenekler: günlük ödül, seri, arkadaşla oynama teşviki, oyun gecesi
  hatırlatması; karanlık desen olmadan.
- **Teslim:** madde kodlu öneri belgesi.
- **Sınır:** kumar benzeri düzenek (şans kutusu satın alma vb.) önermez.
- **Ekleme:** R.

### E. Operasyon grubu (zamanlanmış, kendi kendine çalışır)

Bu roller yönetici tarafından zamanlanmış görev olarak kurulur. Hiçbiri kodu, canlıyı ya da veritabanını
değiştirmez; yalnız okur ve sitede rapor açar. Bulgu "düzeltilsin" diye işaretlenirse yöneticiye iş olarak düşer.

#### 36. Sağlık Nöbetçisi
- **Ne zaman:** her gün sabah ve her canlıya almadan 10 dk sonra.
- **Ne yapar:** sunucu sağlığı, çalışma süresi, bellek; son 24 saatin telefon hataları ve oyun çökmeleri; glix
  defteri = bakiye tutarlılığı; yedeklerin alınıp alınmadığı; disk doluluğu.
- **Teslim:** yeşil/sarı/kırmızı kart; kırmızıda sahibe bildirim.

#### 37. Hata Ayıklayıcı
- **Ne zaman:** her saat (yeni hata varsa).
- **Ne yapar:** telefon hatalarını gruplar, hangi oyun/ekran/sürüm/tarayıcı olduğunu bulur, ilk ortaya çıktığı
  sürümü işaretler, olası nedeni ve düzeltme önerisini yazar ("canlıya alma sonrası eski sürüm parçası" gibi).
- **Teslim:** hata kartı; "düzelt" düğmesi yöneticiye iş açar.

#### 38. Geri Bildirim Tasnifçisi
- **Ne zaman:** günlük.
- **Ne yapar:** oyuncu geri bildirimlerini ve wiki geri bildirimlerini konuya göre ayırır (hata, öneri, içerik,
  övgü), tekrar edenleri birleştirir.
- **Teslim:** haftalık özet; içerik önerileri ilgili içerik rolüne iş olarak düşer.

#### 39. İçerik Açığı Bekçisi
- **Ne zaman:** haftalık.
- **Ne yapar:** hangi havuzun küçük kaldığını, hangi içeriğin çok sık çıktığını, hangi kelimenin sık "atlandığını"
  bulur.
- **Teslim:** otomatik iş açar ("Sızma için 50 yeni çift"); sahip yalnız onaylar.

#### 40. Bot Test Oyuncusu
- **Ne zaman:** her gece (kimse oynamıyorken, ayrı test sunucusunda; canlıya dokunmaz).
- **Ne yapar:** botlarla bütün oyunları farklı oyuncu sayılarında kısa turlarla oynatır; takılan evre, hatalı
  puan, gizli bilgi sızıntısı, kırılan ekran arar.
- **Teslim:** oyun başına geçti/kaldı tablosu + kalanların ekran görüntüsü.
- **Not:** sahibin "uçtan uca testi ben isteyince yapacağız" kararını değiştirmez; bu hafif ve sürekli bir ön
  uyarıdır.

#### 41. Görsel Gerileme Denetçisi
- **Ne zaman:** her ana dal değişikliğinden sonra.
- **Ne yapar:** önizleme ekranlarının görüntüsünü alır, onaylı görüntülerle karşılaştırır; taşma, kesilen yazı,
  üst üste binme bulur.
- **Teslim:** fark görüntüleri.

#### 42. Performans Bekçisi
- **Ne zaman:** haftalık.
- **Ne yapar:** paket boyutu, ilk yükleme süresi, sunucu tik süresi, bellek eğilimi, görsel toplam boyutu.
- **Teslim:** eğilim grafiği; eşik aşılırsa uyarı.

#### 43. Güvenlik Bekçisi
- **Ne zaman:** haftalık.
- **Ne yapar:** bağımlılık açıkları, güvenlik başlıkları, açık portlar, kayıtlarda sızmış gizli bilgi taraması,
  sertifika süresi.
- **Teslim:** bulgu listesi (önem sırasıyla).

#### 44. Şikâyet Nöbetçisi
- **Ne zaman:** saatlik.
- **Ne yapar:** oyuncu şikâyetlerini ve yasaklı kelime yakalamalarını özetler, kanıtı (maç kaydı) bağlar,
  önem derecesi önerir.
- **Sınır:** ceza vermez; karar sahibin.
- **Teslim:** şikâyet kartı.

### F. Büyüme grubu

#### 45. Mağaza Sayfası ve Tanıtım Metni
- **Amaç:** Uygulama mağazası açıklaması, anahtar kelimeler, ekran görüntüsü başlıkları, tanıtım sayfası metni.
- **Teslim:** platform sınırlarına uygun metin seti.
- **Ekleme:** R.

#### 46. Sosyal Medya
- **Amaç:** Haftalık gönderi takvimi, gönderi metinleri, kısa video senaryoları, "bu hafta yeni" gönderileri.
- **Girdi:** güncelleme notları (rol 23), yeni ürünler (rol 2), etkinlikler (rol 11).
- **Ekleme:** R.

#### 47. Video ve Fragman
- **Amaç:** Oyun içi kayıtlardan kısa tanıtım klipleri ve fragman; video üretim aracıyla geçiş ve efekt.
- **Girdi:** önizleme ekranlarının kayıtları, dans klibi özelliği çıktıları.
- **Sınır:** oyunda olmayan bir şeyi göstermez.
- **Ekleme:** R.

#### 48. Topluluk Yöneticisi
- **Amaç:** Topluluk kanalları için yanıt taslakları, etkinlik duyuruları, oyun gecesi organizasyonu metinleri.
- **Sınır:** yalnız taslak; gönderen sahip.
- **Ekleme:** R.

#### 49. Çeviri
- **Amaç:** İngilizce sürüm: arayüz, wiki, içerik havuzları (birebir değil, kültüre uyarlanmış; ör. kelime
  çiftleri yeniden seçilir).
- **Ne zaman:** oyunlar bittikten sonra.
- **Ekleme:** C (arayüz) / P (havuzlar).

#### 50. Trend ve Rakip Araştırmacısı
- **Amaç:** Parti oyunu trendleri, başarılı mekanikler, oyuncu yorumlarında öne çıkan istekler; rol 30'a fikir
  besler.
- **Teslim:** aylık kısa rapor.
- **Sınır:** başka bir oyunu kopyalama önerisi yapmaz.
- **Ekleme:** R.

---

## 6. Etaplar ve başlangıç sırası

| Etap | Roller | Ne zaman | Neden |
|---|---|---|---|
| 0 | Üretim Merkezi sitesi | önce | Bütün rollerin teslim ve onay yeri. Site olmadan bugünkü klasör akışıyla yalnız 1 sürer. |
| 1 | 1, 2, 13, 17, 18, 19, 20, 29, 36 | site açılınca | En çok değer: görsel, mağaza, ses, içerik, kalan 15 oyunun önerileri, sağlık uyarısı. |
| 2 | 3, 4, 5, 6, 7, 14, 15, 21, 22, 23, 25, 27, 30, 31, 32, 33, 37, 39, 43, 44 | Etap 1 oturunca | Derinlik ve bakım. |
| 3 | 8, 9, 10, 11, 12, 16, 24, 26, 28, 34, 35, 38, 40, 41, 42, 45–50 | oyunlar bitmeye yakın | Cila, büyüme, yayın. |

Bir rolü açmanın ön koşulu: talimat dosyası yazıldı, ön kontrolleri sitede tanımlandı, ilk teslim yönetici
tarafından deneme olarak eklendi.

---

## 7. Sahibin günlük akışı

1. **Pano:** kırmızı uyarı var mı (sağlık, şikâyet, hata)? Varsa önce o.
2. **Bekleyenler:** rol rol inceleme; toplu onay, notlu ret. "Benzerini daha üret" ile iyi giden rolleri besle.
3. **İş aç:** yeni ihtiyaçları rollere yaz (ya da İçerik Açığı Bekçisi'nin açtığı işleri onayla).
4. **Yöneticiye gönder:** onaylananlar havuzunu "ekle" ile yöneticiye ver. Yönetici ekler, test eder ve "canlıya
   almaya hazır" der.
5. **Canlıya alma:** kimse oynamıyorken sahip "al" der.

Tahmini sahip yükü: etap 1'de günde 20–30 dakika inceleme; toplu onay ve ön kontrol sayesinde rol sayısı arttıkça
yük doğrusal artmaz.

---

## 8. Her rol için gereken model gücü

Ölçüt kaynağı: [Artificial Analysis liderlik tabloları](https://artificialanalysis.ai/leaderboards/models). Model,
rolün **güç basamağına** göre seçilir. Basamakların bugünkü karşılıkları (31 Ekim 2026'da tablodan okunan modeller ve
puanlar) bu bölümün sonundaki "Güncel model önerileri" kısmındadır; tablo sık değiştiği için her ay yenilenir.

### Basamaklar

Metin modelleri için ana ölçüt tablodaki **Intelligence Index** (zekâ endeksi) sıralamasıdır. Yardımcı ölçütler: fiyat
(1M token başına), hız (token/sn), bağlam penceresi, görsel okuyabilme.

| Basamak | Tanım (liderlik tablosuna göre) | Ne zaman gerekir |
|---|---|---|
| **S (en üst)** | Zekâ endeksinde ilk 5 içindeki akıl yürüten (reasoning) modeller | Kural tasarımı, çelişki yakalama, uzun belge, doğruluğu kritik iş |
| **A (güçlü)** | İlk 6–20 arası; genelde S'nin yarı fiyatı, daha hızlı | Yaratıcı ama kurallı üretim, analiz raporları |
| **B (hızlı ve ucuz)** | İlk 20'nin dışında kalan, hızı yüksek, fiyatı düşük modeller | Çok sayıda kısa ve kolay denetlenen satır, sınıflandırma, özet |
| **G (görsel)** | Text-to-Image Arena sıralamasında ilk 5; ayrıca **şeffaf PNG** ve **referans görsel** desteği şart | Görsel rolleri |
| **SE (ses efekti/müzik)** | Ses ve müzik tablolarında ilk 5 içindeki üreticiler; ticari kullanım izni şart | 13, 14, 16 |
| **TTS (seslendirme)** | Text-to-Speech Arena'da ilk 5; **Türkçe telaffuz** ve **sabit ses kimliği** şart | 15 |
| **V (video)** | Video tablosunda ilk 5 | 47 |

**Türkçe kuralı:** içerik ve metin rollerinde (17–28, 45–49) tablodaki sıranın yanında, işe başlamadan önce
**20 satırlık Türkçe deneme** yapılır (doğal Türkçe, doğru ek ve ünlü uyumu, kültüre uygun espri). Denemeyi geçemeyen
model, sıralaması yüksek olsa da kullanılmaz.

**Aynı işe iki farklı aileden model:** doğruluğu kritik rollerde (18, 21, 29) bir model üretir, **farklı bir
sağlayıcının** modeli denetler. Aynı ailenin iki modeli aynı hatayı yapma eğilimindedir.

### Rol başına basamak

| # | Rol | Basamak | En önemli ölçüt | Not |
|---|---|---|---|---|
| 1 | Oyun Görselleri | G | Arena sırası + şeffaflık + referansa sadakat | Aynı sohbette tarz tutarlılığı |
| 2 | Mağaza Ürünleri | G + A | Görsel kalite; metin için A yeterli | Fiyat önerisini S değil A yapabilir, son karar sahipte |
| 3 | Karakter ve Kozmetik | G | Karakter tutarlılığı (aynı yüz) | Referans görsel desteği zorunlu |
| 4 | Maskot | G | Karakter tutarlılığı | |
| 5 | Anlatım Sahneleri | G | Sahne anlatımı | |
| 6 | Dünyalar ve Arka Planlar | G | Yüksek çözünürlük | |
| 7 | Rozet Görselleri | G | Küçük boyutta okunurluk | |
| 8 | Maç Kartları | G + S | Kart kuralı için S (kural etkileşimi) | |
| 9 | Arayüz İkon ve Süsleri | G (SVG yapabilen) | Vektör çıktı | |
| 10 | Efekt Dokuları | G | Döşenebilirlik | |
| 11 | Sezon ve Etkinlik | G + A | | |
| 12 | Tanıtım Görselleri | G | | |
| 13 | Ses Efektleri | SE | Kısa ve temiz efekt | Ticari lisans |
| 14 | Müzik | SE | Döngü kalitesi, sözsüz | Ticari lisans |
| 15 | Spiker Sesi | TTS | Türkçe telaffuz, ses kimliği | |
| 16 | Tepki ve Emote Sesleri | SE | | |
| 17 | Kelime Havuzları | B (+ Türkçe denemesi) | Hız, fiyat | Ön kontrol hataları yakalar |
| 18 | Sözlük ve Tanım | S + web erişimi | Doğruluk | İkinci aileden denetçi |
| 19 | Soru ve Cümle | A | Espri, Türkçe doğallık | |
| 20 | Kelime Çiftleri | A | "Yakın ama ayrılabilir" muhakemesi | |
| 21 | Moderasyon Listesi | A | Kapsam | İkinci aileden denetçi; bazı modeller küfür listesi üretmeyi reddeder, reddetmeyen seçilir |
| 22 | Görev ve Rozet Metinleri | A | Kurallı JSON | |
| 23 | Duyuru ve Bildirim | B | Kısa ve net | |
| 24 | Metin Redaksiyonu | A | Türkçe dil hâkimiyeti | |
| 25 | Wiki Yazarı | A | Uzun bağlam | |
| 26 | Öğretici ve İlk Oyun | A | | |
| 27 | Hazır Espri Havuzu | A | Mizah | |
| 28 | İsim ve Takma Ad | B | | |
| 29 | Oyun Geliştirme Tasarımcısı | S + görsel okuma | Muhakeme, uzun bağlam (kural + kararlar + ekranlar) | İkinci aileden denetçi; en kritik rol |
| 30 | Yeni Oyun Mucidi | S | Yaratıcılık + kural tutarlılığı | |
| 31 | Oyun Dengesi Analisti | A | Veri yorumu | Hesabı kod yapar, model yorumlar |
| 32 | Ekonomi ve Fiyat Analisti | A | | |
| 33 | Arayüz Eleştirmeni | S + görsel okuma | Görsel muhakeme | |
| 34 | Erişilebilirlik Denetçisi | A + görsel okuma | | Kontrastı kod ölçer |
| 35 | Bağlılık Tasarımcısı | A | | |
| 36 | Sağlık Nöbetçisi | B | Hız, fiyat | Kontroller koddur; model yalnız özetler |
| 37 | Hata Ayıklayıcı | S | Kod ve hata muhakemesi | |
| 38 | Geri Bildirim Tasnifçisi | B | Sınıflandırma | |
| 39 | İçerik Açığı Bekçisi | B | | |
| 40 | Bot Test Oyuncusu | — (kod) | | Model gerekmez; kalan testleri A özetler |
| 41 | Görsel Gerileme Denetçisi | — (kod) + A görsel okuma | | Farkı kod bulur, model yorumlar |
| 42 | Performans Bekçisi | B | | |
| 43 | Güvenlik Bekçisi | A | | Tarama araçları koddur |
| 44 | Şikâyet Nöbetçisi | A | Hassas içerik muhakemesi | |
| 45 | Mağaza Sayfası ve Tanıtım Metni | A | | |
| 46 | Sosyal Medya | A | | |
| 47 | Video ve Fragman | V | | |
| 48 | Topluluk Yöneticisi | A | | |
| 49 | Çeviri | S | Kültürel uyarlama | İkinci aileden denetçi |
| 50 | Trend ve Rakip Araştırmacısı | A + web erişimi | Güncel bilgi | |

### Özet: kaç farklı model gerekir?

- **Görsel:** 1 ana görsel model (G), gerekirse SVG için ikinci bir model.
- **Ses:** 1 efekt ve müzik aracı (SE), 1 seslendirme aracı (TTS).
- **Video:** 1 (V), yalnız etap 3'te.
- **Metin:** 3 basamak yeterli. **S** basamağından farklı sağlayıcılardan 2 model (biri üretir, biri denetler),
  **A** basamağından 1, **B** basamağından 1. Aynı model birden çok role atanabilir; rol ayrımı model değil, sohbet
  ve talimat dosyasıyla yapılır.

Her ay ilk hafta: tablo açılır, her basamakta daha iyi ya da aynı güçte daha ucuz model çıktıysa rol tablosundaki
model sütunu (Üretim Merkezi'nde tutulur) güncellenir. Değişiklikten sonra o role 20 satırlık deneme yaptırılır.

### Güncel model önerileri (31 Ekim 2026, Artificial Analysis tablolarından)

Puanlar tablodan okunduğu gibidir. Metin fiyatı, giriş ve çıkış fiyatının 3:1 harmanıdır (1M token başına, yaklaşık).
Görsel ve ses fiyatları tablodaki fiyattır.

**Metin (Intelligence Index v5.0; en yüksek puan 59,4):**

| Basamak | Model | Sağlayıcı | Endeks | Fiyat ($/1M) | Not |
|---|---|---|---|---|---|
| S | Gemini 4 Carbon (High) | Google | 59,4 | ~8 | Tablonun 1.'si |
| S | Claude Opus 5.5 (Max) | Anthropic | 58,4 | ~8 | 2.; S rollerinde Gemini ile **çift denetim** için ideal ikili |
| S (alternatif) | GPT-6 Astra (Max) | OpenAI | 56,9 | ~20 | Güçlü ama 2,5 kat pahalı |
| A | GPT-6.1 Sol (Max) | OpenAI | 54,5 | ~4 | Fiyat/performans çok iyi; S'ye yakın |
| A | Claude Sonnet 5.5 (Max) | Anthropic | 54,2 | ~4 | Sol ile aynı düzey |
| A (ucuz) | GPT-6.1 Terra (Max) | OpenAI | 51,0 | ~2 | A basamağının en ucuzu |
| A (alternatif) | Kimi K3.1 Pro | Kimi | 46,0 | ~4 | |
| B | Claude Haiku 5.5 (Max) | Anthropic | 36,2 | ~0,2 | Çok ucuz; oyundaki yapay zekâ yorumu da bu aileden |
| B | DeepSeek V4.1 Flash (Max) | DeepSeek | 32,5 | ~0,5 | Açık ağırlıklı |
| B | Gemini 3.8 Flash (High) | Google | 30,5 | ~1,5 | |

Önerilen metin kadrosu (4 model, 3 sağlayıcı):
- **S üretici:** Claude Opus 5.5. **S denetçi:** Gemini 4 Carbon. Çift denetimli rollerde (18, 21, 29, 49) biri
  üretir, diğeri denetler. Rol 29 ve 30'da ikisi yer değiştirerek de çalışabilir.
- **A:** GPT-6.1 Sol ya da Claude Sonnet 5.5. Türkçe denemesinde hangisi iyi çıkarsa o seçilir.
- **B:** Claude Haiku 5.5.

**Görsel üretim (Text-to-Image Arena, Elo):**

| Model | Elo | Fiyat ($/1000 görsel) | Not |
|---|---|---|---|
| GPT Image 2.5 Sunburst (max) | 1222 | 210,7 | 1.; ChatGPT'nin görsel tarafı bu aileden |
| GPT Image 2.5 Flare (max) | 1207 | 210,7 | |
| GPT Image 2 (high) | 1186 | 211,0 | |
| Nano Banana 2.1 | 1176 | 33,6 | İlk 5'te, ~6 kat ucuz |
| MAI-Image-2.6 | 1166 | 38,9 | |
| Grok Imagine Image 2.0 | 1166 | 60,0 | |

**Görsel düzenleme (Image Editing Arena, referansa sadakat için önemli):** GPT Image 2.5 Sunburst (max) 1199,
MAI-Image-2.7-Preview 1193 (API yok), GPT Image 2.5 Flare (max) 1182, MAI-Image-2.6 / Krea 3 (Ultra) /
Nano Banana 2.1 1151.

Görsel önerisi: **ana model ChatGPT (GPT Image 2.5)**, yani bugünkü akış zaten en üst sırada. Çok sayıda görsel
isteyen rollerde (3, 7, 10) maliyet önemliyse **Nano Banana 2.1** ikinci model olarak denenir. Her iki modelde de
**gerçek şeffaf PNG** desteği ilk denemede doğrulanır; desteklemiyorsa yeşil zemin + otomatik dekupe kullanılır.

**Seslendirme (Text-to-Speech Arena, sağlayıcı sesleri, Elo):**

| Model | Elo | Fiyat ($/1M karakter) |
|---|---|---|
| Eleven v4 Turbo | 1336 | 40 |
| Eleven v4 | 1334 | 80 |
| Qwen-Audio-3.1-TTS-Plus | 1305 | 19,3 |
| Sonic 3.6 | 1296 | 49 |
| Gemini 3.8 Flash TTS | 1283 | 16,5 |

Spiker (rol 15) önerisi: **Eleven v4 Turbo**. Tablo İngilizce oylarla oluşur; Türkçe telaffuz için ilk üç model
20 anonsluk denemeyle karşılaştırılır.

**Müzik (Music Arena, enstrümantal, Elo):** Suno v6 1148, Suno v6-mini 1114, Mureka V9.5 1084, Mureka V9 1083,
Lyria 3 Pro 1080. Müzik (rol 14) önerisi: **Suno v6** (sözsüz). Ticari kullanım lisansı abonelik türüne bağlıdır,
başlamadan kontrol edilir.

**Ses efektleri (rol 13, 16):** sitede ayrı bir ses efekti tablosu yok. Seslendirmede 1. olan sağlayıcının
(ElevenLabs) ses efekti aracı ilk aday; 20 efektlik denemeyle karar verilir.

**Video (Text-to-Video Arena, Elo):** Wan 3.0 1175, Utopai X 1166 (API yok), MiniMax H3 (768p) 1161,
Dreamina Seedance 2.5 1157, FLUX 3 Max 1157. Video (rol 47) önerisi: **Wan 3.0** (dakikası 12 $); ucuz alternatif
**MiniMax H3** (dakikası 4,8 $).

### Kesinleşen kadro (sahip kararı, 31 Ekim 2026)

Otomasyonlarda ve üretim rollerinde **Claude kullanılmaz** (yöneticinin kendi kullanım sınırı ayrı tutulur; Claude
yalnız yönetici olarak çalışır). Kullanılacak modeller: **Gemini 3.8 (High)**, **GPT-6.1 Sol (Medium / High)**,
**GPT-6 Sol (Max)** ve **OpenCode Go** üyeliğindeki ücretsiz ve normal modeller. Görselde bugünkü gibi **ChatGPT**
(GPT Image) kullanılır.

Tablodaki karşılıkları (Intelligence Index v5.0; sıra 275 model içinde):

| Model | Nereden | Endeks | Sıra | Basamak | Not |
|---|---|---|---|---|---|
| GPT-6.1 Sol (Max) | OpenAI | 54,5 | 7 | **S** | GPT-6 Sol (Max)'ın yeni sürümü; tabloda GPT-6 Sol için puan yok. Erişim varsa 6.1 tercih edilir |
| GPT-6 Sol (Max) | OpenAI | — | — | S (varsayım) | Tabloda puanı yayımlanmamış; 6.1 Sol ile aynı rollerde yedek |
| GPT-6.1 Sol (High) | OpenAI | 50,2 | 14 | **S / A** | Günlük işlerin ana modeli |
| GPT-6.1 Sol (Medium) | OpenAI | 46,1 | 21 | **A** | Toplu ve tekrar eden işler |
| Gemini 4 Argon (High) | OpenCode Go | 50,4 | 13 | **S denetçi** | Go'da var; Gemini 3.8'den çok daha güçlü. OpenAI'dan farklı aile olduğu için **çift denetimin** denetçisi. Go sınırı ~440 istek/5 sa |
| Kimi K3.1 Pro | OpenCode Go | 46,0 | 22 | **A** (farklı aile) | Türkçe denemesinde iyi çıkarsa A rollerinde Sol'un yedeği. Go sınırı ~147 istek/5 sa (düşük) |
| Gemini 3.8 Flash (High) | Google | 30,5 | 41 | **B** | Hızlı ve ucuz; görsel okuyabilir |
| DeepSeek V4.1 Flash (Max) | OpenCode Go | 32,5 | 38 | **B** (toplu) | Go sınırı çok yüksek (~43 bin istek/5 sa); büyük listelerin ilk taslağı. Go'da "Global" bölge açılmadan çalışmaz |
| GLM-5.3-Flash, MiMo-V2.6-Flash | OpenCode Go | 27,8 / 26,7 | 52 / 53 | **B** | Yedek B modelleri |
| Beam Free, Iceman Contributor Free | OpenCode Go (ücretsiz, süreli) | 17,7 / — | 70 / — | **Ücretsiz taslak** | Yalnız ön eleme ve kaba taslak; hiçbir teslim doğrudan bunlardan çıkmaz. Ücretsiz modeller yalnız OpenCode istemcisinden çalışır |

**Gizlilik kuralı:** oyuncu verisi gören rollerde (31, 32, 36–44) yalnız ücretli ve "istek verisiyle eğitim yapmayan"
uç noktalar kullanılır. Ücretsiz modeller ve Go'da "veriyle eğitim yapan uç noktalar" ayarı gereken modeller (ör. Muse
Spark) bu rollere verilmez. Bu rollere giden veri zaten anonim ve topludur.

**Rol → model eşlemesi:**

| Basamak | Model | Roller |
|---|---|---|
| S üretici | GPT-6.1 Sol (Max), yedek GPT-6 Sol (Max) | 8 (kart kuralı), 18, 29, 30, 33, 37, 49 |
| S denetçi | Gemini 4 Argon (High) | 18, 21, 29, 49'un teslimlerini denetler; 30'da ikinci görüş |
| A | GPT-6.1 Sol (High) | 19, 20, 22, 24, 25, 26, 27, 31, 32, 34, 35, 43, 44, 50 |
| A (toplu) | GPT-6.1 Sol (Medium), yedek Kimi K3.1 Pro | 2 (metin kısmı), 11 (metin), 21, 45, 46, 48 |
| B | Gemini 3.8 Flash (High) | 23, 28, 36, 38, 39, 42; görsel okuma gereken hafif işler (41 yorumu) |
| B (toplu) | DeepSeek V4.1 Flash | 17'nin ilk taslağı (sonra A ile elenir) |
| Ücretsiz | Beam Free / Iceman | 17 ve 28 için kaba fikir listesi; yalnız ön eleme |
| Görsel | ChatGPT (GPT Image 2.5) | 1–12 |
| Ses / müzik / video | Eleven v4 Turbo, ElevenLabs ses efektleri, Suno v6, Wan 3.0 | 13–16, 47 (ayrı abonelikler; sahip karar verir) |

Basamak yükseltme kuralı: bir rolün teslimlerinin onay oranı üst üste iki hafta %60'ın altına düşerse o rol bir üst
basamağa alınır; %90'ın üstündeyse bir alt basamak denenir (maliyet düşer).
