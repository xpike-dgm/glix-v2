# Üretim Merkezi — öneri dosyası

> **Sahip kararı (31 Ekim 2026): önerilen paket onaylandı.** Yapılacaklar: UM-A1…A5, UM-G1, G2, G4, G5, G6 (geçişten
> sonra), G7, UM-İ1…İ10, UM-K1…K6, UM-U1…U9, MG-1…MG-7, UM-Y1…Y3. Yapılmayacak: UM-G3.

Bu dosya onay içindir. Her maddenin bir kodu var (ör. **UM-G2**). Cevabını tek satırda verebilirsin:

> UM-A1 evet, UM-G3 hayır, MG-4 evet …

ya da yalnız **"önerilen paket evet"** dersen sondaki paket uygulanır. Her maddenin ayrıntıları, onaylarsan nasıl
yapılacağını kesinleştirir; ek soru sormam gerekmez. Beğenmediğin ayrıntı varsa yalnız onu yaz.

Bağlam: `docs/uretim/YAPAY-ZEKA-EKIBI.md` (10 alan yöneticisi). Bu dosya iki şeyi kapsar:
1. **Üretim Merkezi sitesi:** yapay zekâların teslim bıraktığı, senin görüp onayladığın yer.
2. **Mağaza altyapısı:** ilk açılacak alan olan mağazanın, koda girmeden yönetilebilmesi için oyunda yapılacak
   tek seferlik değişiklikler (ALT-1/2/3).

Kod önekleri:
- **UM-A** mimari
- **UM-G** giriş ve güvenlik
- **UM-İ** iş akışı
- **UM-K** otomatik ön kontrol
- **UM-U** arayüz
- **MG** mağaza altyapısı
- **UM-Y** yapay zekâların başlatılması

Yeni görsel gerektiren madde yok.

---

## 1. Hedef (tek paragraf)

Sen telefondan ya da bilgisayardan tek bir siteye girersin. Panoda hangi yapay zekânın ne teslim ettiğini,
neyin onay beklediğini, bir uyarı olup olmadığını görürsün. Teslimleri oyundaki gerçek görünümleriyle incelersin;
bir mağaza ürününü mağaza kartında ve kuşanılmış avatarda, bir sesi oyunun o anında görürsün. Onaylar ya da notla
reddedersin. Yapay zekâlar notunu okuyup düzeltir. Onaylananlar birikir; bana "ekle" dediğinde tek bir paket hâlinde
bana gelir, ben oyuna yerleştirip test ederim. Kimse oynamıyorken sen "al" deyince canlıya çıkar. İçerik havuzu ve
moderasyon listesi gibi veriler ise bana gerek kalmadan tek tıkla oyuna gider.

---

## 2. Mimari (UM-A)

### UM-A1 · Ayrı site, ayrı kap, ayrı adres — **önerim: EVET**
**Ne:**
- Üretim Merkezi kendi uygulaması olarak yazılır: depoda `apps/uretim`, oyunla aynı teknoloji (Node 22 sunucu,
  SolidJS arayüz).
- Kendi Docker kabında çalışır, adresi `uretim.dgmcraft.online` olur.
- Caddy'ye ayrı bir site bloğu eklenir. Var olan `glix.dgmcraft.online` bloğuna dokunulmaz.

**Neden:**
- Site çökse, dolsa ya da yoğun yük alsa bile oyun etkilenmez.
- Yapay zekâ trafiği oyunun sunucusuna hiç uğramaz.

**Neden yönetici panelinin içinde değil:**
- Panel oyun sunucusunun içinde çalışıyor. Büyük dosya yüklemeleri, görsel ve ses işleme oyunun gecikmesini
  bozabilir.
- Yapay zekâ anahtarlarının oyunla aynı sürece girmemesi daha güvenli.

**Ayrıntılar:**
- Ortak doğrulama kodu (içerik havuzu kuralları, kozmetik türleri, kart ve rozet biçimleri) `packages/engine`'den
  paylaşılır. Böylece site "bu satır oyuna girer mi" sorusunu oyunla birebir aynı kuralla yanıtlar.
- DNS'te `uretim` kaydı yoksa eklenmesi gerekir. Yapım sırasında ben bakarım; senden yalnız gerekirse tek bir DNS
  satırı isterim.

### UM-A2 · Veri: kendi veritabanı + içerik adresli dosya deposu — **önerim: EVET**
**Ne:**
- Kayıtlar (teslimler, işler, notlar, durumlar, istek kartları, denetim kaydı) kendi SQLite veritabanında durur.
  Oyunda kullandığımız yerleşik `node:sqlite`; yeni bağımlılık yok.
- Dosyalar `/srv/glix/uretim/depo/` altında **içerik özetiyle** (sha256) saklanır. Aynı dosya iki kez gelirse tek
  kopya tutulur.
- Her teslim yalnız bu dosyalara işaret eder.

**Ayrıntılar:**
- Dosya boyutu sınırları: görsel 20 MB, ses 30 MB, metin 2 MB.
- Toplam kota: 20 GB. Dolmaya yaklaşınca panoda uyarı çıkar.
- Reddedilen ve arşivlenen dosyalar 90 gün sonra silinir; onaylananlar silinmez.

### UM-A3 · Oyunla bağ tek yönlü ve dar — **önerim: EVET**
**Ne:** Site oyunun canlı sunucusuna, veritabanına ya da koduna **yazmaz**. Oyuna giden yalnız iki yol var:
1. **Entegrasyon paketi:** onaylananlar "yöneticiye gönder" ile bir pakete dönüşür (UM-İ7). Paketi ben alır, koda
   ekler, test ederim.
2. **Tek tık aktarım:** yalnız içerik havuzu ve moderasyon listesi için, oyun yönetici panelinin var olan toplu
   ekleme ucuna, ayrı ve yalnız bu işe yetkili bir anahtarla gider (UM-İ8).

### UM-A4 · Oyunun güncel kataloğunu okur — **önerim: EVET**
**Ne:** Site her saat oyunun ana dalındaki katalogları okur (sunucudaki depo aynası `/srv/glix/repo.git`):
- mağaza ürünleri, rozetler, kartlar, içerik havuzları;
- ikon ve efekt kayıtları, ses ve müzik haritaları.

**Neden:** Tekrar kontrolü ("bu ürün adı zaten var"), fark görünümü ve önizleme gerçek ve güncel veriyle yapılır.
Canlıdaki havuz kayıtları (panelden eklenenler) için yönetici panelinin salt okunur dışa aktarımı kullanılır.

### UM-A5 · Yedek — **önerim: EVET**
**Ne:**
- Veritabanı ve onaylanan dosyalar her gece `/srv/glix/yedek/uretim/` altına yedeklenir; son 14 gün tutulur.
- Bugünkü oyun yedeğinin yanında durur, aynı disk kotasını izleriz.

---

## 3. Giriş ve güvenlik (UM-G)

### UM-G1 · Sahip girişi: e-postaya tek kullanımlık kod — **önerim: EVET**
**Ne:** Yönetici panelindeki gibi: e-postana 6 haneli kod gelir, 10 dakika geçerli, en çok 5 deneme.

**Ayrıntılar:**
- Oturum güvenilir cihazda 30 gün sürer; telefondan sık onay yapacağın için kısa tutmadım.
- Yalnız tanımlı hesaplar girebilir: sen ve yönetici rolünde ben.
- Bütün girişler ve işlemler denetim kaydına yazılır (UM-G7).

### UM-G2 · Yapay zekâ erişimi: alan başına anahtar ve MCP ucu — **önerim: EVET**
**Ne:** Her yapay zekâya kendi **teslim anahtarı** verilir. Anahtar yalnız o alana yetkilidir: mağaza anahtarıyla
rozet teslim edilemez. Erişim, yapay zekâ araçlarının doğrudan bağlanabildiği bir **MCP ucu** üzerinden olur
(ChatGPT bugün VDS'e de bir bağlantıyla erişiyor; OpenCode da MCP destekler). Yapay zekânın göreceği araçlar:
- `talimat_oku`: alanının kalıcı talimatı (UM-İ3)
- `isleri_listele`, `is_oku`: ona açılmış işler
- `katalog_oku`: alanının güncel kataloğu (salt okunur; ör. mağaza ürünleri, fiyatları, satış sayıları özet hâlinde)
- `geri_bildirim_oku`: ret notları, sahibin yorumları
- `dosya_yukle`, `teslim_et`: teslim paketi (UM-İ1)
- `istek_karti_ac`, `kod_istegi_ac`
- `on_kontrol`: teslim etmeden önce kendi paketini denetletme ("bu geçer mi?")

**Neden:** Bugünkü `dgmcraft_agent_root` bağlantısı sunucuda tam yetkili. Bu düzende yapay zekâ yalnız kendi
kutusunu görür: sunucuya, oyuna ve diğer alanlara erişemez.

**Ayrıntılar:**
- Anahtarlar sitede üretilir, bir kez gösterilir, istenince iptal edilip yenilenir.
- Anahtar başına hız sınırı: dakikada 60 istek, günde 500 dosya.

### UM-G3 · Yedek kanal: alan başına kısıtlı SFTP — **önerim: İSTEĞE BAĞLI**
**Ne:** MCP bağlayamayan araçlar için her alana kendi klasörüne kapalı (chroot) bir SFTP kullanıcısı açılır. Klasöre
bırakılan paket site tarafından alınır.

**Önerim:** önce gerek yok. MCP ve elle yükleme (UM-G4) yeter. Bir araç ikisini de yapamazsa açarım.

### UM-G4 · Elle yükleme ekranı — **önerim: EVET**
**Ne:** Sunucuya erişimi olmayan araçlar (ses, müzik, bazı görsel araçlar) için sitede sürükle-bırak yükleme olur.
Dosyayı sen bırakırsın, alanı ve işi seçersin, kısa bir açıklama yazarsın. Teslim, yapay zekâ teslimiyle aynı
sıradan geçer.

### UM-G5 · Dosya güvenliği — **önerim: EVET**
**Ne:**
- **Yalnız izinli türler:** PNG, WebP, OGG, WAV, JSON, SVG, MD, CSV.
- **Dosya içi tür denetimi:** uzantıya değil, dosyanın gerçek içeriğine bakılır.
- **Görseller yeniden kodlanır:** üst veri (EXIF) silinir, gizli içerik kalmaz.
- **SVG temizlenir:** betik, dış bağlantı ve olay öznitelikleri atılır.
- **JSON'lar şemayla doğrulanır.**
- **Hiçbir dosya çalıştırılmaz.**

### UM-G6 · Tam yetkili `dgmcraft_agent_root` bağlantısının kaldırılması — **önerim: EVET (geçişten sonra)**
**Ne:** Oyun içi görsel görevleri de siteye taşındıktan sonra ChatGPT'nin root SSH erişimi kaldırılır; ChatGPT yalnız
MCP ucunu kullanır.

**Ayrıntılar:**
- Geçiş bitene kadar bugünkü akış (OYUN-GELISTIRME-N görevleri) aynen sürer.
- Kaldırma ayrı bir adımdır, ben "hazır" deyince sen onaylarsın.

### UM-G7 · Denetim kaydı — **önerim: EVET**
**Ne:** Kim, ne zaman, ne yaptı:
- teslim, onay, ret, aktarım, anahtar üretme ve iptal, giriş.

**Ayrıntılar:**
- 1 yıl saklanır.
- Anahtarlar ve kodlar kayda yalnız özet olarak yazılır.

---

## 4. İş akışı (UM-İ)

### UM-İ1 · Teslim ve durumlar — **önerim: EVET**
**Ne:** Her teslim `docs/uretim/YAPAY-ZEKA-EKIBI.md` bölüm 3'teki paket biçimindedir. Durumlar şöyle ilerler:

`gelen → ön kontrolde → bekliyor → onaylandı | reddedildi (notlu) | düzeltme istendi → onaylananlar havuzunda →
pakete alındı → oyuna eklendi → canlıda`

**Ayrıntılar:**
- **"Düzeltme istendi":** reddetmeden küçük bir değişiklik istersin ("rengi biraz daha koyu"). Aynı teslimin yeni
  sürümü gelir.
- **"Canlıda":** canlıdaki sunucunun sürümü (sağlık ucu) teslimi içeren sürüme ulaşınca kendiliğinden işaretlenir.

### UM-İ2 · İşler — **önerim: EVET**
**Ne:**
- **Senin açtığın işler:** alana yazdığın görevlerdir; başlık, açıklama, adet, son tarih ve örnek taşırlar.
  Örnek: "Neon gece koleksiyonu, 8 ürün".
- **Yapay zekânın önerdiği işler:** alanını incelerken "şunu yapmalıyım" dediği işlerdir; sen onaylayınca iş olur.
  Örnek: "satılmayan 5 ürünün fiyatı düşsün".

İşler bir sıra hâlinde durur; yapay zekâ en üsttekinden başlar.

### UM-İ3 · Kalıcı talimat dosyaları — **önerim: EVET**
**Ne:** Her alanın talimatı (OKU-BENI) sitede sürümlü durur. İçinde şunlar vardır:
- alanı, yetkileri, sınırları;
- stil öneki, biçimler, örnekler;
- ön kontrol kuralları.

Talimat değişince yapay zekâ bir sonraki turda yenisini okur. Talimatları ilk sürümde ben yazarım, sonra sen ya da
ben düzenleriz.

### UM-İ4 · Geri bildirim döngüsü — **önerim: EVET**
**Ne:**
- Ret ve düzeltme isteği her zaman not ister.
- Hazır notlar tek dokunuşla seçilir: tarz uymuyor, yazı var, çok zor, tekrar, kalitesiz, oran yanlış, alan dışı.
- Notlar yapay zekânın `geri_bildirim_oku` aracına düşer.

**Ayrıntılar:**
- Aynı not bir alanda 3 kez tekrar ederse site, talimata o kuralı eklemeni önerir ("Bu alanda 3 kez 'yazı var' notu
  verildi; talimata eklensin mi?").

### UM-İ5 · İstek kartları (alanlar arası) — **önerim: EVET**
**Ne:** Bir alan başka bir alandan bir şey isteyebilir: açan alan, istenen alan, ne, neden, son tarih. Örneğin
mağaza, ses alanından "tepki paketi sesi" ister.

**Ayrıntılar:**
- Kartı **sen onaylamadan** istenen alana iş olarak düşmez. Böylece yapay zekâlar birbirine sınırsız iş açamaz.
- Sonuç teslim edilince açan alanın teslimine bağlanır.

### UM-İ6 · Kod istekleri — **önerim: EVET**
**Ne:** Veriyle yapılamayan şeyler (yeni efekt türü, yeni rozet koşulu, yeni kart etkisi) kod isteği olarak gelir:
gerekçe, örnek, etki. Sen onaylarsan yönetici iş listesine düşer; ben yapınca alan o şeyi artık veriyle yönetir.

### UM-İ7 · Onaylananlar havuzu ve entegrasyon paketi — **önerim: EVET**
**Ne:** Onaylananlar alan alan birikir. "Yöneticiye gönder" dediğinde site bir **entegrasyon paketi** hazırlar:
- dönüştürülmüş dosyalar: WebP, OGG, temizlenmiş SVG;
- katalog satırları;
- bir özet dosyası.

Paket `/srv/glix/uretim/aktarim/<tarih>/` altına konur. Sonra bana "onaylananları ekle" dersin. Ben paketi alırım,
koda eklerim, testleri ve ekran görüntüsü kontrolünü yaparım, ana dala gönderip "canlıya almaya hazır" derim.

**Ayrıntılar:**
- Dönüştürme (WebP'ye çevirme, düşük alfa kalıntısının temizliği, sesin ses düzeyine göre normalizasyonu) sitede
  yapılır. Bugün bu işleri ben elle yapıyorum.
- Paket, oyundaki dosya yollarıyla birebir aynı klasör düzenindedir.

### UM-İ8 · Tek tık aktarım: içerik havuzu ve moderasyon — **önerim: EVET**
**Ne:** Bu iki alanda onaylanan satırlar "oyuna aktar" düğmesiyle doğrudan oyunun yönetici panelindeki havuza ya da
yasaklı kelime listesine eklenir. Canlıya alma gerekmez, oyun bir sonraki maçtan itibaren kullanır.

**Ayrıntılar:**
- Aktarım yalnız ekleme ve kapatma yapar, silmez.
- Her aktarım geri alınabilir: "son aktarımı geri al".
- Oyun tarafında bu işe özel, yalnız havuz ve liste ekleme yetkisi olan bir anahtar kullanılır.

### UM-İ9 · Sürüm ve arşiv — **önerim: EVET**
**Ne:** Bir öğenin her yeni teslimi yeni sürümdür, eskisi arşivde kalır. Onaylanmış bir öğenin yeni sürümü gelirse
eski ve yeni yan yana gösterilir. Arşivde arama vardır: alan, ad, tarih, durum.

### UM-İ10 · "Benzerini daha üret" — **önerim: EVET**
**Ne:** Beğendiğin bir teslimde tek düğmeyle o alana iş açılır: "Bunun gibi 5 tane daha; şu farkla …".

---

## 5. Otomatik ön kontrol (UM-K)

### UM-K1 · Ortak kontroller — **önerim: EVET**
Biçim (paket şeması), dosya türü ve boyutu, alan yetkisi, ad tekrarı, aynı dosyanın daha önce gelip gelmediği
(özet karşılaştırması).

### UM-K2 · Görsel kontrolleri — **önerim: EVET**
**Ne:**
- oran (izin verilen sapma %2), en küçük boyut;
- gerçek şeffaflık: şeffaf istenenlerde kenarlar ve belirtilen iç alanlar alfa 0;
- düşük alfa kalıntısı: "temizlensin mi?" önerisi;
- tamamen boş ya da tek renk görsel;
- alanın özel ölçüleri: 48 px'te siluet okunurluğu, sprite ızgarası.

**Ayrıntılar:** "Görselde yazı var mı" kontrolü ilk sürümde yok. Yazı tanıma ek bir bağımlılık ister. Hazır not
("yazı var") ile elle yakalanır; sık tekrar ederse eklerim.

### UM-K3 · Ses kontrolleri — **önerim: EVET**
**Ne:**
- süre, kanal sayısı, örnekleme hızı;
- algılanan ses yüksekliği (LUFS) aralığı;
- kırpılma (clipping), baş ve sondaki sessizlik;
- müzikte döngü dikişi: son ve ilk dalga uyumu.

**Ayrıntılar:** Ölçümler için kapta `ffmpeg` kullanılır. Bu, oyun koduna değil yalnız sitenin kabına eklenen bir
araçtır.

### UM-K4 · Metin ve havuz kontrolleri — **önerim: EVET**
**Ne:**
- Oyunun kendi havuz kuralları birebir uygulanır (`packages/engine` içindeki aynı doğrulama): karakter sınırları,
  tek kelime, soru işareti.
- Havuzdaki kayıtlarla ve aynı teslimdeki satırlarla tekrar kontrolü yapılır; çok benzeyen satırlar da yakalanır.
- Yasaklı kelime taraması yapılır.
- Çiftlerde iki kelime aynı olmamalı ve biri diğerinin içinde geçmemeli.
- Tanımda kelimenin kendisi geçmemeli.

### UM-K5 · Alan özel kontroller — **önerim: EVET**
**Ne:** Her alanın kendi kuralları `YAPAY-ZEKA-EKIBI.md` bölüm 4'teki "Ön kontrol" satırlarından gelir. Mağaza için
örnekler:
- fiyat aralıkta;
- zafer 4, tepki 6 kare;
- dans JSON'u iskelete uygun;
- efekt tarifi geçerli bir motoru kullanıyor.

### UM-K6 · Kontrol sonucu ve kendiliğinden geri dönüş — **önerim: EVET**
**Ne:** Sonuç üç türlüdür: **geçti**, **uyarı** (sana gösterilir, sarı işaretli), **kaldı**. "Kaldı" olan teslim sana
hiç gelmez; nedeniyle birlikte yapay zekâya geri döner ve o düzeltip yeniden teslim eder.

**Ayrıntılar:** Panoda "son 24 saatte kendiliğinden geri dönenler" sayısı görünür. İstersen alan başına "kalanları da
göster" açılabilir.

---

## 6. Arayüz (UM-U)

### UM-U1 · Pano — **önerim: EVET**
**Ne:** Tek ekranda:
- **Alan kartları:** her alan için bekleyen sayısı, son teslim zamanı, son 7 günün onay oranı.
- **Kırmızı ve sarı uyarılar:** test ve performans uyarıları, kota, kendiliğinden geri dönüş patlaması.
- **Bekleyen istek kartları ve kod istekleri.**
- **"Onaylananlar havuzu: 23 öğe, yöneticiye gönderilmeye hazır" satırı.**

### UM-U2 · Alan sayfası — **önerim: EVET**
**Ne:** Alanın bekleyenleri (en eski üstte), açık işleri, talimatı, anahtarı, istatistikleri (teslim ve onay
sayıları, ortalama inceleme süresi) ve arşivi.

### UM-U3 · İnceleme görünümleri — **önerim: EVET**
**Ne:** Türüne göre ayrı görünüm:
- **Görsel:** koyu zeminde büyük; oyundaki gerçek boyutta küçük kopya; şeffaf alanlar dama deseniyle. Varsa
  kapalı/açık ya da parça/bütün yan yana.
- **Animasyon:** oynat/durdur, kare kare ilerlet, hız.
- **Ses:** oynat, dalga biçimi; eski (sentez) ve yeni yan yana.
- **Müzik:** döngüyü 3 kez arka arkaya çal.
- **Liste:** tablo, satır başına onay kutusu, filtre (uyarılılar, zorluk), toplu seçim.
- **Kart, rozet, ikon:** gerçek boyut ve oyundaki yeri.
- **Wiki:** sayfa önizlemesi, eski/yeni fark.
- **Rapor:** okunur metin, grafikler, "düzelt" düğmesi.

### UM-U4 · Oyunun gerçek bileşenleriyle önizleme — **önerim: EVET**
**Ne:**
- **Önizleme sayfası:** oyunun istemcisine, dışarıya kapalı bir önizleme sayfası eklenir. Bugün kullandığım
  `?mock=` ekranlarının genişletilmiş hâlidir.
- **Taslakla gösterim:** sayfa, teslimdeki taslak dosyaları ve katalog satırlarını yükleyip oyunun gerçek ekranında
  gösterir.
- **Mağaza ürünü:** mağaza kartında, lobideki avatarda, skor şeridinde ve kürsüde görünür.
- **Ses:** oyunun o anında çalar.

**Neden:** "Oyunda nasıl duracak?" sorusu tahminle değil gerçek ekranla yanıtlanır. Bugün bunu ben ekran görüntüsü
alarak yapıyorum.

**Ayrıntılar:**
- Önizleme sayfası yalnız sitenin içinden açılır; oyunculara görünmez.
- Taslak dosyalar oyunun canlı dosyalarına karışmaz.

### UM-U5 · Hızlı inceleme: toplu işlem, kısayol, telefonda kaydırma — **önerim: EVET**
**Ne:**
- **Bilgisayarda:** O = onayla, R = reddet (not penceresi), D = düzeltme iste, → sonraki.
- **Telefonda:** sağa kaydır onayla, sola kaydır reddet (hazır notlar çıkar), yukarı kaydır düzeltme iste.
- **Listelerde:** "uyarısızların hepsini onayla".

**Neden:** Yapay zekâ sayısı arttıkça darboğaz senin inceleme süren olur. Bu madde o süreyi en çok kısaltır.

### UM-U6 · Fark görünümü — **önerim: EVET**
**Ne:** Düzenleme teslimlerinde eski ve yeni yan yana gösterilir:
- **Fiyat:** 400 → 350.
- **Metin:** değişen kelimeler işaretli.
- **Görsel:** kaydırmalı karşılaştırma.

Gerekçe her zaman üstte yazar.

### UM-U7 · Bildirimler — **önerim: EVET**
**Ne:** Site telefona kurulabilir (oyunla aynı PWA altyapısı). İki tür bildirim gelir:
- **Kırmızı uyarı:** hemen gelir.
- **Günlük özet:** sabah gelir; "12 teslim bekliyor, 2 istek kartı, onaylananlar havuzu 30".

Bildirim saatleri ayarlanabilir; gece sessiz.

### UM-U8 · Görünüm — **önerim: EVET**
**Ne:**
- **Tarz:** GLIX'in koyu neon tarzı ve aynı yazı tipleri. Ama oyun değil iş ekranı olduğu için daha sade: az efekt,
  yüksek okunurluk.
- **Telefona uygunluk:** telefonda tek elle kullanılır.
- **Yazı boyutu:** ayarlanabilir.

### UM-U9 · Rapor sayfası — **önerim: EVET**
**Ne:** Test, hata ve performans alanının raporları:
- gece test sonuçları (oyun başına geçti/kaldı);
- hata kartları (önem sırasıyla);
- performans eğilim grafikleri;
- her canlıya almadan sonraki kontrolün sonucu.

"Düzelt" düğmesi bana iş açar.

---

## 7. Mağaza altyapısı (MG) — oyun tarafı

Mağaza yapay zekâsının koda girmeden mağazayı tam yönetebilmesi için oyunda yapılacak tek seferlik değişiklikler.
Bunlar oyuncuya görünen hiçbir şeyi bozmaz; bugünkü ürünler aynen kalır.

### MG-1 · Mağaza kataloğu dosyaya taşınır — **önerim: EVET**
**Ne:** Bugün ürünler `packages/engine/src/cosmetics.ts` içinde kod olarak yazılı. Ürünler `katalog/magaza.json`
dosyasına taşınır. Kod bu dosyayı okur ve derleme sırasında doğrular. Hatalı bir satır derlemeyi durdurur, canlıya
çıkmaz.

**Ayrıntılar:** Ürün kimlikleri değişmez; oyuncuların sahip olduğu ve kuşandığı her şey aynen kalır. Bunu bir test
güvenceye alır.

### MG-2 · Ürün başına fiyat — **önerim: EVET**
**Ne:** Bugün fiyat yalnız nadirlikten türüyor (sıradan 150, nadir 400, efsanevi 1000 Glix). Her ürün kendi fiyatını
taşıyabilir.

| Nadirlik | Yapay zekânın fiyat aralığı | Bugünkü sabit fiyat |
|---|---|---|
| Sıradan | 100–250 Glix | 150 |
| Nadir | 300–600 Glix | 400 |
| Efsanevi | 800–1500 Glix | 1000 |

**Ayrıntılar:**
- Bugünkü ürünler bugünkü fiyatlarında kalır.
- Fiyat değişikliği yalnız ileriye dönüktür; daha önce alanlara iade ya da ek ücret yok.
- Günün fırsatı indirimi ürünün kendi fiyatı üzerinden hesaplanır.

### MG-3 · Satıştan kaldırma, koleksiyon, çıkış tarihi — **önerim: EVET**
**Ne:** Her ürüne şu alanlar eklenir:
- **"satışta":** evet/hayır. Kaldırılan ürün mağazada görünmez ama sahibi kullanmaya devam eder.
- **"koleksiyon":** ör. "Neon Gece".
- **"çıkış tarihi":** ürün o tarihte mağazaya kendiliğinden düşer. Sezon ve etkinlik için önceden hazırlanabilir.

**Ayrıntılar:** Mağazada koleksiyonlar ayrı bir şerit olarak gösterilebilir. Bu bir arayüz değişikliği olduğu için
ayrı madde, MG-6'nın parçası.

### MG-4 · Efekt motorları ve efekt tarifi — **önerim: EVET**
**Ne:** Bugün ad efektleri ve çerçeveler kodla çiziliyor. Hazır **efekt motorları** yazılır. Yapay zekâ yeni bir
efekt için kod değil, bir **tarif** (motor + parametreler + doku dosyası) verir. İlk motorlar:

| Motor | Kullanım | Parametreler |
|---|---|---|
| `parlama` | ad efekti, çerçeve | renkler, nabız hızı, yoğunluk |
| `akan-renk` | ad efekti, çerçeve | renk listesi, akış hızı, yön |
| `kivilcim` | ad efekti, çerçeve, giriş | doku, sayı, hız, renk |
| `donen-halka` | çerçeve | doku, dönüş hızı, katman sayısı |
| `parcacik-yagmuru` | giriş, zafer | doku, yoğunluk, yön, süre |
| `kare-animasyon` | zafer, tepki, giriş | kareler, kare süresi, döngü |
| `doku-katmani` | çerçeve, kart arkası | doku, karışım modu, hareket (kayma, salınım) |

**Ayrıntılar:**
- Bugünkü kodla çizilen ürünler aynı görünümü veren tariflere çevrilir; görünüş değişmez, bunu ekran görüntüsü
  karşılaştırmasıyla doğrularım.
- Performans sınırı: tek efekt en çok 60 parçacık, doku ≤ 256 px. "Hareket azaltma" açıkken sade sürüm çizilir.
- Motorlarda olmayan bir efekt gerekirse yapay zekâ kod isteği açar (UM-İ6).

### MG-5 · Dans ve giysi doğrulayıcı — **önerim: EVET**
**Ne:** Kürsü dansları (`karakter/dans/<ad>.json`) ve giysiler (`rig.json` katmanları) için bir doğrulama aracı
eklenir. Site ön kontrolde de bunu kullanır:
- dans iskeletin kemiklerini kullanıyor mu, süresi sınırda mı, döngüsü düzgün mü;
- giysi doğru yuvada mı, kostüm kapladığı yuvaları doğru bildiriyor mu.

### MG-6 · Mağaza önizleme ekranları — **önerim: EVET**
**Ne:** UM-U4'teki önizleme sayfasına mağazaya özel ekranlar eklenir:
- mağaza kartı (her tür için);
- ürün kuşanılmış avatar (lobi, skor şeridi);
- kürsüde dans ve giysi;
- zafer kutlaması (final ekranı);
- giriş efekti (lobi koltuğu);
- kart arkası (oyundaki el);
- koleksiyon şeridi.

### MG-7 · Satış verisi (anonim, toplu) — **önerim: EVET**
**Ne:** Mağaza yapay zekâsının `katalog_oku` aracına ürün başına toplu sayılar verilir:
- son 30 günde kaç kez satıldığı;
- kaç kez kuşanıldığı;
- günün fırsatında kaç kez alındığı.

Fiyat önerileri bu veriye dayanır. Oyuncu kimliği ya da adı hiçbir zaman gitmez.

---

## 8. Yapay zekâların başlatılması (UM-Y)

### UM-Y1 · İlk alan: Mağaza — **önerim: EVET**
**Ne:**
1. Site ve mağaza altyapısı bitince mağaza alanının talimatını yazarım: stil öneki, ürün türleri, her türün dosya
   biçimi, fiyat aralıkları, efekt motorları, örnek paketler.
2. Senin için yapıştıracağın tek bir başlangıç istemi hazırlarım (UM-Y2).
3. İlk iş: "Neon Gece" deneme koleksiyonu (6 ürün, farklı türlerden).
4. İlk teslimi birlikte inceleriz, takılan yerleri talimata işlerim, sonra alan kendi başına üretir.

### UM-Y2 · Başlangıç istemi şablonu — **önerim: EVET**
**Ne:** Her alan için kısa bir istem:
- hangi MCP ucuna, hangi anahtarla bağlanacağı;
- önce `talimat_oku`, sonra `isleri_listele` ve `geri_bildirim_oku` çağıracağı;
- iş bitince `on_kontrol` ve `teslim_et`.

Model seçimi sende; istem modelden bağımsızdır.

### UM-Y3 · Diğer alanların açılış sırası — **önerim: EVET**
`YAPAY-ZEKA-EKIBI.md` bölüm 6'daki sıra:
1. mağaza;
2. ses ve müzik;
3. içerik havuzu, moderasyon ve wiki;
4. test, hata ve performans;
5. rozet ve maç kartları;
6. ikon ve efekt dokuları.

Her alanın kendi altyapısı (ALT-4…12) ayrı bir öneri dosyası olarak sırası gelince yazılır ve madde koduyla
onaylanır.

---

## 9. Yapım sırası ve süre

| Adım | Maddeler | Sonuç |
|---|---|---|
| 1 | UM-A1…A5, UM-G1, UM-G2, UM-G4, UM-G5, UM-G7 | Site ayakta, giriş var, yapay zekâ teslim edebiliyor |
| 2 | UM-İ1…İ10, UM-K1…K6 | Akış ve ön kontrol çalışıyor |
| 3 | UM-U1…U3, UM-U5…U9 | İnceleme ekranları |
| 4 | MG-1, MG-2, MG-3, MG-5, MG-7 | Mağaza veriyle yönetiliyor (oyuncuya görünen değişiklik yok) |
| 5 | MG-4 | Efekt motorları; bugünkü ürünler tariflere çevrilmiş, görünüm aynı |
| 6 | UM-U4, MG-6 | Gerçek oyun önizlemesi |
| 7 | UM-Y1, UM-Y2 | Mağaza yapay zekâsı başlar |
| 8 | UM-G6 | ChatGPT görsel akışı da siteye taşınınca root SSH kapatılır |

İşi bugünkü gibi alt ajanlarla paralel yürütürüm: site (adım 1–3) ile mağaza altyapısı (adım 4–5) birbirinden
bağımsız ilerler.

Canlıya alma kuralı aynı:
- Oyun tarafındaki değişiklikler (MG) yalnız sen "al" deyince ve kimse oynamıyorken canlıya çıkar.
- Site oyundan ayrı olduğu için onu canlıya almak oyuncuları etkilemez. Yine de ilk açılışı sana haber vererek
  yaparım.

---

## 10. Önerilen paket

**EVET:**
- **Mimari:** UM-A1, UM-A2, UM-A3, UM-A4, UM-A5
- **Giriş ve güvenlik:** UM-G1, UM-G2, UM-G4, UM-G5, UM-G6 (geçişten sonra), UM-G7
- **İş akışı:** UM-İ1 … UM-İ10
- **Ön kontrol:** UM-K1 … UM-K6
- **Arayüz:** UM-U1 … UM-U9
- **Mağaza altyapısı:** MG-1 … MG-7
- **Başlatma:** UM-Y1, UM-Y2, UM-Y3

**İSTEĞE BAĞLI (şimdilik yapılmaz):**
- UM-G3 (SFTP yedek kanalı)
