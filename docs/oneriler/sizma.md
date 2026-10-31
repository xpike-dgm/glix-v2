# Sızma — geliştirme önerileri

Bu dosya onay içindir. Her maddenin bir kodu var (ör. **SZ-M2**). Cevabını tek satırda verebilirsin:

> SZ-M1 evet, SZ-M2 hayır, SZ-U3 evet …

ya da yalnız **"önerilen paket evet"** dersen sondaki paket uygulanır. Her maddenin "ayrıntılar" bölümü onaylarsan
nasıl yapılacağını kesinleştirir; ek soru sormam gerekmez. Beğenmediğin ayrıntı varsa yalnız onu yaz.

Not: Sonuç ekranı herkes **"Devam et"** deyince geçer (en çok 60 sn). Yeni görsel gerektiren maddeler **🎨 Görsel**
diye işaretli.

---

## 1. Bugünkü oyun (özet)

- 3–8 oyuncu. Çoğunluk aynı kelimeyi (ör. ÇAY), tek bir "sızma" ona yakın başka bir kelimeyi (KAHVE) görür.
  **Sızma, sızma olduğunu bilmez**; herkes yalnız "Senin kelimen"i görür.
- Ekranda numaralı bir söyleme sırası var. Herkes sırayla, **yüksek sesle**, iki tur ipucu verir; uygulama sırayı ve
  turları takip etmez. Süre yok; herkes "Oylamaya geç" deyince oylama başlar.
- Gizli oylama (30 sn): herkes bir kişiye oy verir (kendine de olur), "Tamam" ile kilitler.
- "Sızma sen miydin?" (8 sn): herkes gizlice Evet / Hayır der. Sızma Evet derse **+1**.
- Sızma **tek başına** en çok oyu alırsa yakalanır: diğer **herkes +1**, sızma 0. Yoksa (eşitlik dahil) kurtulur:
  sızma **+2**, diğerleri 0. Eksi puan yok.

## 2. Gördüğüm sorunlar

**Oyun tasarımı**
1. **"Sızma sen miydin?" sorusu bedava puan.** Sızma olmayan biri Evet derse hiçbir şey kaybetmiyor. Oyuncular bunu
   fark edince herkes her seferinde Evet der; sızma da böylece **her oyunda garanti +1** alır. Soru bir karar değil,
   bir formalite olur.
2. **Yakalayınca herkes puan alıyor, yanlış oy verenler de.** Sızmaya hiç oy vermeyen, hatta masumu suçlayan oyuncu da
   +1 alıyor. Kendi tahminin puanına yansımıyor; "ben bilmiştim!" anı ödüllendirilmiyor.
3. **Eşitlik çok sık ve sessiz bitiriyor.** 6–8 kişide oylar kolayca dağılıyor; 2–2 çıkınca sızma otomatik kurtuluyor.
   Masa "neredeyse yakalıyorduk" gerilimini yaşamadan oyun bitiyor.
4. **Sıra ve tur takibi oyunculara kalmış.** Ekranda "1, 2, 3…" sırası var ama kimin konuştuğu, kaçıncı turda
   olunduğu gösterilmiyor. Kalabalıkta "kimdeydi?", "ikinci tur bitti mi?" karışıklığı oluyor; ekran bu sürede
   tamamen hareketsiz.
5. **Yakalanan sızmanın hiç şansı yok.** Maske düştüğü an oyun bitiyor; sızma için son bir "kurtuluş" anı yok.
6. **Bağlantısı kopan sızma dokunulmaz oluyor:** kopan oyuncuya oy verilemediği için yakalanması imkânsızlaşıyor.

**Arayüz** (ekran görüntülerine göre)
7. **İpucu ekranında "SENİN KELİMEN" yazısı havada duruyor:** kristalin ~300 piksel yukarısında, arka plandaki tabelanın
   üstünde; aradaki alan boş. Sıra listesinin altı ile "Oylamaya geç" düğmesi arası da boş (~250 piksel). Sıra
   kartlarının sağ yarısı boş; kimin konuştuğu belli değil.
8. **Oylamada son satır sola yaslı:** 5 kişide Zeynep–Kaan, 8 kişide Burak–Ayşe soldan diziliyor, ortalanmıyor.
   Seçilen oyuncu yalnız küçük bir ✓ ile işaretleniyor; diğerleri sönükleşmiyor, seçim bir bakışta fark edilmiyor.
   8 kişide seçilen Zeynep'in halkası pembe görünüyor, sıra ekranında yeşil (renk tutarsızlığı).
9. **"Sızma sen miydin?" ekranı boş:** ortada küçük maske ve soru, altta iki eş görünümlü düğme; ekranın yarısı boş.
   Kelimen hatırlatılmıyor (oylamadan sonra "ben neydim?" diye düşünen oluyor). 8 sn bu karar için kısa.
10. **Sonuç ekranında maske avatarın sağ üstünde yapıştırılmış gibi havada duruyor;** "düştü" hissi yok.
    "Sızma kendini fark etmedi" satırı başlıkla aynı kalın yazıda, başlığın devamı gibi okunuyor.
11. **Kurtuldu ekranında neden kurtulduğu yazmıyor:** Elif 3, Zeynep 3, Mert (sızma) 0. "Oylar eşit" bilgisi yok;
    oyuncu "Mert'e kimse oy vermedi, neden kaçtı?" diye kalıyor. Kimin kime oy verdiği hiç gösterilmiyor.
12. **Alt kısım boş, puan satırı küçük:** "+0 genel skora eklendi" ekranın dibinde tek başına; kendi puanın vurgusuz.
    Oy listesinde "Sen" etiketi yok (yalnız adın kalın).
13. **Anlatım ekranında kelime bölünmesi:** 2. adım "İki turda sırayla yüksek sesle ipucu / ver" diye "ver" tek
    başına alt satıra düşüyor.
14. **TV için özel düzen yok:** telefon ekranı büyütülüp gösteriliyor; TV'nin geniş alanı boşa gidiyor, sırayı ve
    oyları uzaktan takip etmek zor.

---

## 3. Oyunu değiştiren öneriler (mekanik)

### SZ-M1 · Doğru oy verene puan — **önerim: EVET**
**Ne:** Sızma yakalanırsa **yalnız sızmaya oy verenler +1** alır; başkasına oy veren ya da oy vermeyen 0. Sızma
kurtulursa bugünkü gibi sızma +2, diğerleri 0.
**Neden:** Sorun 2. Herkesin oyu kendi puanını belirler; "masaya uyup bedavaya +1" biter. Eksi yok.
**Ayrıntılar:**
- Sayılan oy, oylamanın (SZ-M4 ile ikinci oylamanın) **son geçerli oyudur**. Sızma kendine oy verse de bu puanı almaz.
- Yakalanma koşulu değişmez: sızma tek başına en çok oyu alırsa yakalanır.
- **+2 / +1 / 0 sıralamaya çevirme bu oyunda önerilmez:** oyun "herkes bir kişiye karşı"; puanlar zaten 0…+2
  (fark bonusuyla en çok +3) aralığında ve eksisiz. Sıralamaya çevirmek yakalama durumunda herkesi eşit "birinci"
  yapıp anlamı bozar.
- Kart etkisi: "birinci" = en yüksek puanlılar (yakalandıysa doğru oy verenler), "sonuncu" = en düşükler; bugünkü
  genel hesap aynen.
- (Seçenek, ayrıca yazarsan: **"SZ-M1 tavanlı"** → kurtulan sızma Evet dese de en çok +2 alır; böylece hiçbir
  oyuncu bu oyundan +2'den fazla alamaz.)

### SZ-M2 · "Sızma sen miydin?" artık bedava değil — **önerim: EVET**
**Ne:** **Evet diyen ama sızma olmayan oyuncu, yakalama puanını (+1) alamaz.** Sızmanın Evet bonusu (+1) aynen kalır.
**Neden:** Sorun 1. Şimdi soru gerçek bir karar: "Ya sızma bensem?" diyen Evet'le kumar oynar; emin olan Hayır der.
Eksi puan yok, yalnız kazancı riske atıyorsun.
**Ayrıntılar:**
- Süre **8 sn → 10 sn** (gerçek bir karar olduğu için). Herkes cevaplarsa yine 1 sn sonra biter.
- Cevap vermeyen bugünkü gibi Hayır sayılır.
- Sızma kurtulursa diğerleri zaten 0 aldığı için Evet'in bedeli olmaz; bu bilinçli bırakılır (yakalanacağını
  düşünmek de bir tahmindir).
- Diğer oyuncuların cevapları yine hiç açılmaz; yalnız kendi sonucun "Evet dedin, yakalama puanı alamadın" diye
  **sadece sana** gösterilir.
- Kurala bağlı açıklama soru ekranında bir satır: "Sızmaysan Evet: +1 · Değilsen Evet: yakalama puanı yanar".

### SZ-M3 · Konuşma sırası uygulamada ilerlesin — **önerim: EVET**
**Ne:** Sırası gelen oyuncu ekranda vurgulanır ("Konuşan: Mert"), üstte **"TUR 1 / 2"**. Konuşan ipucunu söyleyince
kendi ekranındaki **"Söyledim"** düğmesine basar, sıra bir sonrakine geçer. İki tur bitince oylama kendiliğinden
başlar (3 sn geri sayım).
**Neden:** Sorun 4. Kimse "sıra kimdeydi" demez; ekran canlanır; ikinci turun bittiği net olur.
**Ayrıntılar:**
- Her konuşma hakkının üst sınırı **15 sn**; dolarsa sıra kendiliğinden geçer (ceza yok). Sırası gelenin telefonu
  titrer.
- "Söyledim"e yalnız sırası gelen basabilir. Bağlantısı kopuk oyuncunun sırası anında atlanır.
- "Oylamaya geç" kalır: **bağlı herkes** basarsa kalan sıralar atlanıp oylamaya geçilir (bugünkü kural).
- Sıra iki turda da aynıdır. 5 dk teknik tavan değişmez (8 kişide en kötü durum 8 × 2 × 15 = 4 dk).
- Uygulama ipucunun içeriğini yine denetlemez (yazılı ipucu yok).

### SZ-M4 · Eşitlikte ikinci oylama — **önerim: EVET**
**Ne:** Oylamada en çok oyu alanlar eşitse, **yalnız eşit adaylar arasında 15 sn'lik ikinci oylama** yapılır.
**Neden:** Sorun 3. "2–2 kaldık!" anı masanın en heyecanlı tartışmasını doğurur; sızma kurtulacaksa hak ederek kurtulur.
**Ayrıntılar:**
- Ekranda "EŞİTLİK! Elif mi, Zeynep mi?" ve yalnız eşit adayların portreleri; oy sayıları gösterilmez (yalnız
  isimler). İlk oylamanın oyları silinir; herkes (adaylar dahil) yeniden oy verir, Tamam ile kilitler.
- Tek ikinci oylama vardır. Yine eşitse ya da kimse oy vermezse **sızma kurtulur** (bugünkü kural).
- İlk oylamada hiç oy yoksa ikinci oylama olmaz, sızma kurtulur.
- Sızma eşit adaylar arasında değilse de ikinci oylama yapılır (kimin sızma olduğu belli edilmez); sonuç yine
  "kurtuldu" olur.
- Herkes Tamam derse 1 sn sonra biter. Ardından "Sızma sen miydin?" gelir.
- 3 oyuncuda (1–1–1) da geçerlidir: üç aday arasında yeniden oylanır.

### SZ-M5 · Son şans: yakalanan sızma ortak kelimeyi tahmin eder — **önerim: EVET**
**Ne:** Sızma yakalanınca maskesi düşer ve **15 sn** içinde **ortak kelimeyi yazarak tahmin eder**. Bilirse
"KELİMEYİ ÇALDI!" ve sızma **+1**. Yakalayanların puanı değişmez.
**Neden:** Sorun 5. Bütün masa susup sızmanın telefonuna bakar; yakalanmak bile bir an daha heyecanlı olur.
Ortak kelimeyi çok açık söyleyenleri de dolaylı olarak cezalandırır (ipucu dengesi korunur).
**Ayrıntılar:**
- Bu sırada ortak kelime **kimsenin ekranında görünmez**; sızma yalnız kendi kelimesini görür. Diğerleri
  "Mert ortak kelimeyi tahmin ediyor…" görür. Tahminden sonra iki kelime açılır.
- Tek tahmin hakkı. Karşılaştırma: Türkçe büyük harf, baştaki/sondaki boşluklar ve noktalama atılır, şapkalı harf
  düz sayılır (Â = A). Ek almış hâl (ÇAYI) doğru sayılmaz.
- Sızma bağlantısı kopuksa ya da süre dolarsa tahmin yok sayılır.
- Puan: yakalanan sızma Evet +1 ve doğru tahmin +1 ile en çok +2 alabilir. Kurtulan sızmaya bu aşama gelmez.
- "Devam et" düğmesi bu aşama bitince açılır.

### SZ-M6 · Kopan oyuncuya da oy verilebilsin — **önerim: EVET**
**Ne:** Oyun başında oyuncu olan herkes, bağlantısı kopmuş olsa da oylanabilir (portresi soluk ama seçilebilir).
**Neden:** Sorun 6. Bağlantısı kopan sızma bugün yakalanamıyor.
**Ayrıntılar:** kopan oyuncu oy veremez, cevap veremez; bekleme sayımlarında yine beklenmez (bugünkü gibi).

### SZ-M7 · Kelimesiz sızma — **önerim: HAYIR (isteğe bağlı)**
**Ne:** Bazı oyunlarda sızmaya kelime yerine "???" gösterilir; sızma rolünü bilir ve blöf yapar.
**Neden önermiyorum:** Oyunun kimliği "sızma kendini bilmez" fikri; bu ayrı bir oyun gibi olur ve kuralı karıştırır.

### SZ-M8 · İki raunt — **önerim: HAYIR (isteğe bağlı)**
**Ne:** Aynı oyunda farklı kelime çifti ve yeni sızmayla ikinci raunt; puanlar toplanır.
**Neden önermiyorum:** İki ipucu turu zaten 1,5–2,5 dk; iki raunt oyunu 5 dk'ya çıkarır. SZ-M3 ile oyun hızlanırsa
sonra düşünülebilir.

---

## 4. Arayüz ve his önerileri

### SZ-U1 · İpucu ekranı yeni düzen — **önerim: EVET**
- "SENİN KELİMEN" yazısı kristalin hemen üstüne yapışır; kristal ekranın üst üçte birine çıkar, üstteki boşluk kalkar.
- Kristalin altında büyük **"TUR 1 / 2"** rozeti ve (SZ-M3 ile) **"Konuşan: Mert"** satırı.
- Sıra listesi tek sütun, büyük kartlar: konuşanın kartı büyür, parlar, yanında 🎤 ve 15 sn'lik ince süre çubuğu;
  konuşmuş olanların numarası ✓ olur; sıradaki kartında "Sıradaki" etiketi. 8 kişide iki sütuna döner.
- Sırası gelende alttaki ana düğme **"SÖYLEDİM"** olur (büyük); "Oylamaya geç" ikincil, daha küçük düğme olarak kalır.
- Sıra sana gelince güçlü titreşim ve kenar ışığı: "SIRA SENDE · ipucunu söyle".

### SZ-U2 · Gözetleme koruması — **önerim: İSTEĞE BAĞLI**
Yan yana oturulduğu için komşu, ekrandaki büyük kelimeyi görebiliyor. Kristal ilk 5 sn açık kalır, sonra buğulanır;
**basılı tutunca** kelime görünür, bırakınca kapanır. Oylama ekranındaki "Kelimen" satırı da aynı şekilde.
(Arkadaş grubunda sorun yaşanmıyorsa gerek yok.)

### SZ-U3 · Oylama ekranı — **önerim: EVET**
- Portre ızgarasında son satır **ortalanır** (5 kişide 3 + 2, 8 kişide 3 + 3 + 2 ortalı).
- Seçilen portre büyür ve parlar, diğerleri sönükleşir; başlık seçilen adı (bugünkü gibi) gösterir. Portre halkası
  her ekranda oyuncunun kendi rengini korur (seçim rengi ayrı bir dış parıltıdır).
- "Kelimen ÇAY" satırı büyür, başlığın hemen altında kart gibi durur.
- Düğme yazısı "OYUMU VER"; kilitlenince bugünkü "HAZIRSIN" bekleme durumu.
- Son 5 sn'de süre çubuğu kırmızı nabız atar, tik sesi.
- (SZ-M4 ile) ikinci oylamada yalnız adaylar büyük ve yan yana: "Elif mi, Zeynep mi?".

### SZ-U4 · "Sızma sen miydin?" ekranı — **önerim: EVET**
- Ortada büyük maske ve soru; altında **"Senin kelimen: ÇAY"** hatırlatması.
- (SZ-M2 ile) kural satırı: "Sızmaysan Evet: +1 · Değilsen Evet: yakalama puanı yanar".
- Düğmeler ayrışır: **Evet** pembe maske simgeli, **Hayır** düz gri. Basınca seçilen düğme kilit simgesiyle kalır,
  diğeri kaybolur; "Cevabın kilitlendi · 3/5 cevapladı".
- Boş alt yarıda cevap verenlerin avatarları sırayla belirir (cevabın ne olduğu değil).

### SZ-U5 · Sonuç açılışı — **önerim: EVET** · 🎨 Görsel
- **Oylar uçsun:** her oyuncunun küçük avatarı oy verdiği kişinin portresine uçar (az oydan çoğa, bugünkü sırayla);
  böylece kimin kime oy verdiği görünür.
- (Eşitlikte, SZ-M4 olmadan) açık yazı: **"Oylar eşit: sızma kurtuldu"**; (SZ-M4 ile) "İkinci oylamada da eşitlik".
- **Maske düşsün:** sızmanın portresindeki maske sallanır, düşer ve kırılır; yüzü açılır. Kurtulduysa maske
  yerinde kalır, göz kırpar ve "KURTULDU!" damgası.
- "Sızma kendini fark etti / etmedi" başlıktan ayrı, küçük bir rozet olarak portrenin altında.
- Oy listesinde kendi kartında **"Sen"** etiketi; doğru oy verenlerin kartında ✓ (SZ-M1 ile puanın nedeni görünür).
- Alttaki puan satırı büyür ve kendi kartının üstüne çıkar: "+1 · Doğru oy". Puan yoksa "+0" yerine
  "Bu sefer puan yok".
- 🎨 Gereken: kırılan maske parçaları (mevcut maske çiziminin kırık hâli; CSS/SVG ile de yapılabilir).

### SZ-U6 · Son şans ekranı (SZ-M5 ile) — **önerim: EVET**
- Sızmanın ekranında büyük yazı alanı, "Ortak kelime neydi?" ve 15 sn'lik halka; klavye açılınca alan klavyenin
  hemen üstünde.
- Diğerlerinde sızmanın portresi ortada, "Mert tahmin ediyor…" ve yazıyor animasyonu (üç nokta).
- Doğruysa "KELİMEYİ ÇALDI!" ve alkış; yanlışsa yazdığı kelimenin üstü çizilir, "Tutmadı!".

### SZ-U7 · Anlatım metni — **önerim: EVET**
Adım 2 kısalır: **"İki turda sırayla sesli ipucu ver"** (tek kelimenin alt satıra düşmesi biter). Paket onaylanırsa
adım 3: "Sızmayı oyla; eşitlikte yeniden oylanır".

### SZ-U8 · Ses ve titreşim seti — **önerim: EVET**
Sıra sana gelince "ding" + titreşim, "Söyledim"de hafif tık, oylamada son 5 sn tik, eşitlik "gong", oyların
uçuşunda tek tek "tok" sesleri, maske kırılma "çat", kurtulma kahkahası, "Kelimeyi çaldı" alkışı.

### SZ-U9 · TV ekranı — **önerim: EVET**
TV'ye özel yatay düzen: solda büyük söyleme sırası (konuşan büyük, "TUR 1/2"), sağda oyuncular ve kimlerin
hazır/kilitli olduğu; kelimeler TV'de hiç görünmez. Oylamada "Herkes oy veriyor" ve kilitleyen avatarlar; eşitlikte
iki aday karşı karşıya; sonuçta oyların uçuşu ve maskenin düşüşü tam ekran.

---

## 5. Yapay zekâ (AI) ile yapılabilecekler

### SZ-AI1 · Sızma spikeri — **önerim: İSTEĞE BAĞLI**
Sonuçta tek cümlelik esprili yorum: "Elif ile Zeynep birbirini suçlarken Mert kahvesini yudumlayıp kaçtı."
Ortak yapay zekâ yorum altyapısıyla (API bağlanınca açılır, hata olursa görünmez, oyun beklemez, yasaklı kelime
süzgeci). Modele yalnız isimler, iki kelime, kimin kime oy verdiği ve sonuç gider. Kelime çiftleri yapay zekâyla
üretilmez; puanı yapay zekâ belirlemez.

(Başka bir yapay zekâ önerisi yok: ipuçları sesli verildiği için uygulama onları duymuyor; değerlendirecek metin yok.)

---

## 6. Önerilen paket

**SZ-M1, SZ-M2, SZ-M3, SZ-M4, SZ-M5, SZ-M6 ve SZ-U1, SZ-U3 … SZ-U9.** (SZ-M7, SZ-M8, SZ-U2 ve yapay zekâ pakete
dahil değil.)

Bu paketle oyun şöyle akar: kelimeni görürsün → ekran "TUR 1/2 · Konuşan: Mert" diye sırayı yürütür, sıran gelince
telefon titrer, ipucunu söyleyip "Söyledim"e basarsın → iki tur bitince oylama → oylar eşitse "Elif mi, Zeynep
mi?" ikinci oylama → "Sızma sen miydin?" artık bir kumar → oylar avatarlarla uçar, maske düşüp kırılır → yakalanan
sızma son şansla ortak kelimeyi yazmaya çalışır → doğru oy verenler +1.

**Değişen kurallar (paket onaylanırsa):**
- Yakalanırsa yalnız sızmaya oy verenler +1 (Evet diyen sızma olmayan hariç); kurtulursa sızma +2.
- "Sızma sen miydin?" 10 sn; sızma olmayan Evet derse yakalama puanını alamaz; sızmanın Evet bonusu +1 aynen.
- Konuşma sırası uygulamada ilerler ("Söyledim" ya da 15 sn); iki tur bitince oylama kendiliğinden başlar;
  "Oylamaya geç" erken çıkış olarak kalır.
- En çok oyda eşitlikte tek seferlik 15 sn'lik ikinci oylama (yalnız eşit adaylar); yine eşitse sızma kurtulur.
- Yakalanan sızma 15 sn içinde ortak kelimeyi yazarak tahmin eder; doğruysa +1.
- Bağlantısı kopan oyuncuya da oy verilebilir.
- Puan aralığı 0…+3, eksi yok (kurtulan sızma + Evet = 3; istenirse "tavanlı" seçenekle 2).
`docs/KURALLAR.md`, wiki ve testler buna göre güncellenir.

**Değişmeyenler:** 3–8 oyuncu, tek sızma ve rastgele seçimi, sızmanın kendini bilmemesi, kelime çifti havuzu
(160 elle hazırlanmış çift, yönetici panelinden düzenlenir) ve yazı-tura, yazılı ipucu olmaması, iki ipucu turu,
gizli oylama 30 sn, kendine oy serbestliği, "tek başına en çok oy = yakalandı" kuralı, eşitlikte sonunda sızmanın
kurtulması, sızmanın Evet bonusu, diğer oyuncuların cevaplarının hiç açılmaması, eksi puan olmaması.

**🎨 Yeni görsel gerekenler (paket):** kırılan maske parçaları (SZ-U5; mevcut maske çiziminin kırık hâli, CSS/SVG ile
de yapılabilir). Başka yeni görsel gerekmez.
