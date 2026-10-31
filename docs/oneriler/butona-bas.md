# Butona Bas — geliştirme önerileri

Bu dosya onay içindir. Her maddenin bir kodu var (ör. **BB-M2**; **BB** = **B**utona **B**as). Cevabını tek satırda
verebilirsin:

> BB-M1 evet, BB-M2 hayır, BB-U3 evet …

ya da yalnız **"önerilen paket evet"** dersen sondaki paket uygulanır. Her maddenin "ayrıntılar" bölümü onaylarsan
nasıl yapılacağını kesinleştirir; ek soru sormam gerekmez. Beğenmediğin ayrıntı varsa yalnız onu yaz.

Not: Oyunun kendi sonuç ekranı zaten herkes **"Devam et"** deyince geçiyor (en çok 60 sn); burada yeniden önerilmedi.
Yeni görsel gerektiren maddeler **🎨 Görsel**, ses alanına iş açan maddeler **🔊 Ses** diye işaretli.

---

## 1. Bugünkü oyun (özet)

- 2–8 oyuncu. Ekranın ortasında dev kırmızı arcade butonu, üstte "Tur 1/3 · Pencere 300 ms", ortada kendi puanın,
  altta oyuncu avatarları ve canlı puanları.
- **3 tur × 15 sn**, turlar arasında **3 sn ara** (ara sırasında buton kilitli, "Pencere daralıyor 300 ms → 200 ms").
  Toplam 51 sn; basışların sayıldığı süre 45 sn.
- Her tur, turun başından itibaren sabit **pencerelere** bölünür: 1. turda 300 ms, 2. turda 200 ms, 3. turda 120 ms.
- Bir pencerede **iki ya da daha çok farklı oyuncu** basarsa basanların her biri **+1**; **tek kişi** basarsa o kişi
  **−1**; kimse basmazsa değişmez. Aynı pencerede tekrar basmak tek sayılır (istemci de ikinciyi göndermez).
- Basışın hangi pencereye düştüğünü **sunucunun basışı aldığı an** belirler (oyuncunun parmağının değdiği an değil).
- Pencere kapanınca sonuç yayınlanır: kendi basışın için "+1" (yeşil) ya da "−1" (kırmızı) yüzer, ses ve titreşim;
  basanların avatarları 0,48 sn yeşil/kırmızı parlar.
- Mini puan 3 turda toplanır (eksiye düşebilir). Genel skor oyun sonunda bir kez: **tek lider +2, sıradaki +1**;
  en yüksek toplam eşitse paylaşanların hepsi **+1**, +2 verilmez. Gizli bilgi yoktur.

## 2. Gördüğüm sorunlar

**Oyun tasarımı**
1. **Oyun "birlikte basma" değil, "en hızlı parmak" oyunu.** Bir pencerede iki kişinin basması yeter; aynı pencerede
   fazladan basmanın cezası yok. Herkes durmadan basarsa neredeyse her pencere eşleşir ve herkes +1 toplar; kim
   daha hızlı basıyorsa daha çok pencere yakalar. 1. turda saniyede 3–4, 2. turda 5, 3. turda 8–9 basış her pencereyi
   kapatmaya yetiyor (15 sn'de en çok 50 / 75 / 125 pencere). Kural metnindeki "arkadaşlarınla aynı anda bas"
   anı (birlikte "üç, iki, bir, BAS!") hiç gerekmiyor; −1 yalnız kimse basmıyorken basana çıkıyor.
2. **Sabit pencere ızgarası şans yaratıyor.** Pencereler turun başından sayıldığı için iki oyuncu 10 ms arayla bassa
   bile sınır aralarına düşerse ikisi de "tek başına" sayılır ve ikisi de −1 alır. 3. turda (120 ms) iki
   basış arasındaki fark 60 ms ise bölünme olasılığı yaklaşık yüzde 50.
3. **Ağ gecikmesi adaleti bozuyor.** Pencereyi sunucunun basışı aldığı an belirliyor. Wi-Fi'deki oyuncuyla mobil
   veride 80–150 ms geride olan oyuncu aynı anda bassa da farklı pencerelere yazılabiliyor; 120 ms'lik turda bu
   neredeyse her seferinde oluyor. Wiki de bunu "bilinen sorun" diye yazıyor. Oysa Kule Ustası'nda aynı sorun
   çözülmüş: istemci dokunma anını gönderiyor, sunucu en çok 400 ms eskiyse kabul ediyor.
4. **Hiç basmamak genel skor kazandırıyor.** Kimse basmazsa herkesin puanı 0, "en yüksek toplam eşit" sayılıyor ve
   herkes +1 alıyor. Diğer oyunlarda onayladığın düzende (Gizli Alışveriş, Kule Ustası) 0 puanlı ödül almıyor.
5. **Kalabalığın değeri yok.** 8 kişinin 2'si aynı pencereye basınca da +1, 8'i birden basınca da +1. Odanın
   tamamının "ŞİMDİ!" diye bağırıp birlikte bastığı en güzel an ekranda ve puanda sıradan bir an.
6. **Üç tur birbirinin aynısı.** Değişen tek şey pencere süresi ve araya giren bir yazı. Turun sonunda "bu turda ne
   oldu, kim öne geçti" anı yok.

**Arayüz** (ekran görüntülerine bakarak: 390×844, 360×640, 844×390, TV 1920×1080)
7. **Üç ayrı "1/3".** Sol üstte oyun adının altında maçın oyun sırası "1/3", ortada üç nokta, altında "Tur 1/3".
   İlk bakışta hangisinin tur olduğu anlaşılmıyor.
8. **"Pencere 300 ms" teknik bir birim.** TASARIM.md "milisaniye gösterilmez" diyor; oyuncu "300 ms"in ne kadar dar
   olduğunu hissetmiyor, yalnız okuyor.
9. **Alttaki şerit isimsiz ve küçük.** Avatarlar 46 px, altında yalnız küçük bir sayı; 8 kişide daha da küçülüyor.
   Kiminle eşleştiğini, kimin önde olduğunu okuyamıyorsun; parlama 0,48 sn sürüyor ve yalnız renkle (yeşil/kırmızı)
   anlatılıyor.
10. **Ekranın üst yarısı tek bir sayı.** "PUANIN 4" var ama sıran, lidere farkın yok. Butonun üstünde ve çevresinde
    büyük boş alan var; butonun kendisi ise 360×640'ta bile çok büyük (iyi), ama çevresi bilgi taşımıyor.
11. **Yatayda buton küçülüyor** (≈130 px kapak), puanlar küçük; sol şeritte oyun adı "Butona / Bas" diye ikiye
    bölünüyor.
12. **TV'de iki farklı puan karışıyor.** Sağdaki büyük panelde herkesin genel skoru "0" yazıyor (bu oyunla ilgisiz),
    oyunun canlı puanları ise ortadaki telefon çerçevesinin altında 1080p'de 12 px civarı rakamlar. "Tur 1/3 ·
    Pencere 300 ms" de okunmayacak kadar küçük.
13. **Ara ekranı yalnız yazı.** 3 sn'lik arada butonun üstüne "Pencere daralıyor 300 ms → 200 ms" çıkıyor; turun
    özeti, sıralama değişimi, daralmanın görsel karşılığı yok.
14. **İzleyicide "En yüksek puan" kimsesiz.** Büyük bir sayı var, kimin olduğu yok.
15. **Anlatım oyunun asıl numarasını öğretmiyor.** "Yüksek sesle birlikte sayın" ipucu yok; ilk kez oynayan grup
    rastgele basıp −1'ler yiyor ya da (sorun 1) bu kez durmadan basıyor.

---

## 3. Oyunu değiştiren öneriler (mekanik)

### BB-M1 · Buton dolsun: her basıştan sonra 1 sn bekleme — **önerim: EVET**
**Ne:** Bastıktan sonra buton **1 saniye "dolar"**: kapağın çevresindeki halka boşalıp dolarken basış sayılmaz.
Halka dolunca küçük bir "çıt" ve buton yeniden parlar.
**Neden:** Sorun 1. Durmadan basmak kazandırmaz; her basış bir karar olur ve oyun yeniden "aynı anı yakala" oyunu
olur. Odada "üç, iki, bir, BAS!" diye sayan grup kazanır, en hızlı parmak değil.
**Ayrıntılar:**
- Bekleme **sunucuda** uygulanır: oyuncunun sayılan son basışından 1000 ms geçmeden gelen basış sayılmaz (sessizce
  yok sayılır, ceza yok). İstemci bekleme bitmeden göndermez.
- Bekleme yalnız **sayılan** basıştan başlar; ara sırasında basılamadığı için aranın bitişinde bekleme yoktur, her tur
  "dolu" başlar.
- Bir turda en çok 15 basış yapılabilir; 3 turda en çok 45. Puan aralığı buna göre küçülür (genel skor dönüşümü
  değişmez).
- BB-M3 (kayan pencere) ile birlikte bir basış yalnız bir pencereye girer; 1 sn bekleme en uzun pencereden (300 ms)
  uzun olduğu için aynı oyuncu bir pencereye iki kez giremez.
- 2 oyuncuda da aynı kural.

### BB-M2 · Kalabalık bonusu — **önerim: EVET**
**Ne:** Bir pencerede basanların sayısı odadaki **bağlı katılımcıların yarısından fazlaysa** basanların her biri
+1 yerine **+2** alır; ekranda "KALABALIK!" yazar. Herkes bastıysa "TAM EKİP!" (yine +2).
**Neden:** Sorun 5. Odanın birlikte bağırdığı an oyunun en büyük ödülü olur; 8 kişilik masada 2 kişilik küçük
eşleşmeler yerine bütün grubu toplamak için konuşma başlar.
**Ayrıntılar:**
- Yalnız **4 ve üstü bağlı katılımcıda** geçerlidir (3 kişide 2 kişi zaten yarıdan fazla, 2 kişide her eşleşme
  "herkes" olur; bu yüzden 2–3 kişide eşleşme hep +1).
- Eşik: basan sayısı > bağlı katılımcı sayısı / 2 (4 kişide 3, 5 kişide 3, 6 kişide 4, 7 kişide 4, 8 kişide 5).
- Bağlı katılımcı sayısı pencerenin **açıldığı** anki sayıdır (pencere içinde biri koparsa eşik değişmez).
- Tek basış −1, normal eşleşme +1 aynen kalır.

### BB-M3 · Kayan pencere: pencere ilk basışla açılır — **önerim: EVET**
**Ne:** Pencereler turun başından sabit dilimlerle sayılmaz. **Bir basış geldiğinde o anda bir pencere açılır** ve
turun pencere süresi kadar (300 / 200 / 120 ms) açık kalır. Bu sürede basan herkes o pencereye girer. Pencere
kapanınca bir sonraki basış yeni pencere açar.
**Neden:** Sorun 2. İki oyuncu 10 ms arayla bastığında asla "sınır yüzünden" ayrılmazlar; ayrıldılarsa gerçekten
pencere süresinden geç basmışlardır. Kural oyuncunun anladığı hâle gelir: "ilk basandan sonra 0,3 sn içinde bas".
**Ayrıntılar:**
- Pencere açılış anı = penceredeki **ilk basışın anı** (BB-M4 ile oyuncunun dokunma anı).
- Pencere tur bitişini geçemez: turun son 300 ms'sinde açılan pencere tur bitince kapanır.
- Açık pencere varken gelen basış o pencereye girer; açık pencere yokken gelen basış yeni pencere açar. Aynı anda
  iki pencere açık olmaz.
- Puanlama değişmez: 2+ farklı oyuncu +1 (BB-M2 ile +2), tek kişi −1.
- Anlatım 3. adımı: "3 tur: ilk basandan sonra 0,3 → 0,2 → 0,12 sn içinde bas" olur.

### BB-M4 · Gecikme düzeltmesi: dokunduğun an sayılır — **önerim: EVET**
**Ne:** İstemci basışla birlikte **dokunma anını** (sunucu saatine göre) gönderir. Sunucu bu anı, **en çok 250 ms
eskiyse** ve turun içindeyse kabul eder; yoksa kendi aldığı anı kullanır. Kule Ustası'ndaki gecikme korumasının aynısı
(orada 400 ms).
**Neden:** Sorun 3. Telefonu mobil veride olan oyuncu, Wi-Fi'deki arkadaşıyla aynı anda bastığında ayrı pencerelere
düşmez. 120 ms'lik turda bu fark oyunu belirliyordu.
**Ayrıntılar:**
- Kabul aralığı: `[tur başlangıcı, sunucunun aldığı an]` içinde ve sunucunun aldığı andan en çok 250 ms önce. Gelecekten
  gelen an (saat hatası) sunucunun aldığı ana çekilir.
- **Hileye karşı:** pencere sonuçları, pencere kapandıktan **250 ms sonra** puanlanır ve yayınlanır. Böylece kimse
  bir pencerenin "tek başına" kaldığını görüp geriye tarihli basışla o pencereye giremez (sonuç ortaya çıktığında o
  pencereye girme süresi dolmuştur). Oyuncu "+1"i bugünkünden en çok 0,25 sn geç görür.
- BB-M3 ile: pencereler basışların **dokunma anlarına** göre kurulur. Geç ulaşan ama daha erken dokunulmuş bir basış
  gelirse pencerenin açılış anı ona çekilir (puanlama 250 ms beklediği için bu her zaman mümkündür). BB-M1 beklemesi de
  dokunma anlarına göre ölçülür.
- Neden 250 ms (Kule Ustası'nda 400): bu oyunda her pencerenin sonucu ekranda bekleniyor; sınır büyüdükçe "+1" geç
  gelir. 250 ms mobil verinin olağan gecikmesini karşılar.
- Turun bitişinden sonra gelen basış eskisi gibi reddedilir (zamanlama oyunlarında geç gelen eylem payı yoktur; bu
  madde yalnız **ölçümü** düzeltir, süreyi uzatmaz).
- Saat farkı istemcide bugünkü ping ölçümünden (ortanca) hesaplanır; ek ağ trafiği yoktur.

### BB-M5 · Hiç puanı olmayan ödül almaz — **önerim: EVET**
**Ne:** Genel skor ödülü yalnız **toplamı 0'dan büyük** olanlara verilir. Toplamı 0 ya da eksi olan +2/+1 alamaz.
**Neden:** Sorun 4. Kimse basmayınca herkesin +1 alması biter; Gizli Alışveriş ve Kule Ustası'nda onayladığın
"0 olan ödül almaz" kuralıyla aynı.
**Ayrıntılar:**
- Tek lider (toplam > 0) +2; sıradaki farklı toplam (> 0) +1.
- Liderler eşitse (toplam > 0) hepsi +1, +2 verilmez (bugünkü kural).
- Herkesin toplamı ≤ 0 ise kimse ödül almaz.
- Kartlar değişmez: "birinci/sonuncu" bugünkü gibi mini puan sıralamasından okunur (kart kuralı maç düzeyindedir,
  bu madde yalnız ham ödülü değiştirir).

### BB-M6 · Altın an: 3. turda tek seferlik ×3 — **önerim: İSTEĞE BAĞLI**
**Ne:** 3. turun içinde rastgele bir anda buton **1,5 sn boyunca altına döner** ("ALTIN AN!"). Bu sürede açılan
pencerelerde eşleşen herkes **+3** alır (tek basış yine −1).
**Neden:** Sorun 6. Son tura herkesin aynı anda gördüğü bir doruk ekler: bütün masa "ŞİMDİ!" diye bağırır. Geride
kalanın toparlanma şansı olur.
**Ayrıntılar:**
- Altın anın başlangıcı turun 4. ile 11. saniyesi arasında, tohumlu rastgele seçilir; herkese **0,8 sn önceden**
  "Hazır ol" parlaması gelir (ağ gecikmesi herkesi aynı anda yakalasın diye; sunucu saatine göre çizilir).
- BB-M1 beklemesi altın anda da geçerli: bu 1,5 sn'de bir oyuncu en çok 2 kez basabilir.
- BB-M2 ile çakışırsa büyük olan geçerli (+3).
- Tek seferlik; 1. ve 2. turda yok.
- **Neden isteğe bağlı:** oyun 51 sn'lik bir refleks oyunu; BB-M1–M3 oyunu zaten yeniden kuruyor. Önce onlar
  denensin, son tur hâlâ düz kalırsa bu eklensin.

### BB-M7 · Gizli eş — **önerim: HAYIR**
**Ne:** Her turun başında herkese gizlice bir "eş" atanır (yalnız kendisi görür). Eşinle aynı pencerede basarsan
+1 yerine +2. Tur sonunda eşler açılır.
**Neden önermiyorum:** Kulağa eğlenceli geliyor ama 15 sn'lik turda "eşim kim" diye konuşmaya vakit yok; oyuncu
ekrandaki eş adına bakarken butonu kaçırır. Oyunun gücü sadeliği; gizli bilgi eklemek anlatımı da uzatır. Yazılı
dursun diye ekledim.

---

## 4. Arayüz ve his önerileri

### 4a. Ana ekranlar ve akış

### BB-U1 · Tek tur göstergesi, ms yerine görsel pencere — **önerim: EVET**
- Üstteki üç ayrı "1/3" (sorun 7) yerine tek bir rozet: büyük **"TUR 2"** ve altında üç parçalı çubuk (biten tur
  dolu, süren tur nabız atıyor). Sol üstteki oyun sırası "Oyun 1/3" olarak küçük ve soluk kalır.
- "Pencere 300 ms" yazısı kalkar (sorun 8). Yerine butonun çevresinde **pencere halkası**: 1. turda kalın, 2. turda
  orta, 3. turda ince bir neon halka. Basınca halka dalgası tam pencere süresi kadar yayılır (bugün de pencere
  süresine bağlı; yalnız kalınlık eklenir).
- Rozetin altında tek kelime: **"Geniş"**, **"Dar"**, **"İğne ucu"**.
- Anlatım ekranı sayıları yine söyler (sahibin O8 metni: "300, 200, 120 ms"); oyun ekranında ms yazmaz.

### BB-U2 · İsimli canlı şerit ve sıralama — **önerim: EVET**
- Alttaki şerit iki sıraya geçer (8 kişide 4 + 4): avatar 52 px, altında **ad** (en çok 7 harf, taşan "…") ve puan.
- Lider(ler)in avatarında küçük taç; kendi avatarın biraz büyük ve çerçeveli.
- Sıralama değişince avatarlar yer değiştirmez (göz karışmasın); yalnız taç ve puan güncellenir.
- Kopan oyuncu gri, adının yerinde "koptu".
- Sorun 9 ve 10'u çözer.

### BB-U3 · Dolum halkası (BB-M1 ile) — **önerim: EVET (BB-M1 onaylanırsa)**
- Bastıktan sonra kapağın çevresinde 1 sn'de dolan beyaz halka; dolarken kapak hafif soluk ve "BAS" yazısı
  **"DOLUYOR"** olur.
- Dolunca halka bir kez parlar, küçük "çıt" sesi, 6 ms titreşim: "hazırsın".
- Dolarken basarsan buton hafifçe "boş" sallanır (ceza yok, ses yok): oyuncu neden sayılmadığını anlar.

### BB-U4 · Kiminle eşleştin — **önerim: EVET**
- Kendi basışın eşleşince butonun hemen üstünde 0,9 sn **eşleşme satırı**: eşleştiğin oyuncuların küçük avatarları
  yan yana, aralarında neon çizgi, üstte "+1" (BB-M2 ile "+2 KALABALIK!").
- Tek kalınca satırda yalnız senin avatarın ve **"Yalnız kaldın −1"**.
- Şeritte de aynı pencerede basanlar birbirine kısa bir çizgiyle bağlanır (bugünkü 0,48 sn parlama 0,8 sn olur).
- Böylece "kimle tutturuyorum" konuşması başlar.

### BB-U5 · Tur arası özet — **önerim: EVET**
3 sn'lik ara yalnız "Pencere daralıyor" yazısı olmaktan çıkar (sorun 13):
- 0–1,2 sn: **"TUR 1 BİTTİ"** ve bu turun yıldızı: "Elif +9".
- 1,2–2,2 sn: şeritte herkesin bu turda kazandığı puan küçük "+6", "−2" etiketleriyle yükselir.
- 2,2–3 sn: pencere halkası görsel olarak incelir, **"DARALIYOR!"** yazar, buton yeniden parlar.
- Süre değişmez (3 sn); buton aranın sonuna kadar kilitli kalır (bugünkü kural).

### 4b. Açılış/sonuç anı ve gerilim

### BB-U6 · Tur sonu son 3 saniye — **önerim: EVET** · 🔊 Ses
- Her turun son 3 sn'sinde üstteki tur çubuğu kırmızıya döner, butonun çevresindeki ışıklar hızlanır, her saniyede
  bir "tık" (son saniyede iki tık).
- 3. turun son 3 sn'si: **"SON ŞANS!"** bandı.
- Süre değişmez; yalnız gösteri.

### BB-U7 · Son açılış: uyum haritası — **önerim: EVET**
Oyunun kendi sonuç ekranı (Devam et ile geçilen) bugün yalnız son ekranı gösteriyor. Yerine:
- Önce toplamlar sondan başa sayarak açılır; lider en son, taçla.
- Altında **"En uyumlu ikili: Elif & Mert — 7 ortak pencere"** ve **"Yalnız kurt: Kaan — 5 kez tek bastı"**.
- Her oyuncunun satırında üç küçük tur çubuğu (Tur 1 / 2 / 3 puanı) — kim hangi turda öne geçti görünür.
- Gerekli veri: sunucu, oyun bitince her ikilinin ortak pencere sayısını ve oyuncu başına tek basış sayısını
  herkese açık sonuca ekler (gizli bilgi yok; zaten herkesin gördüğü pencerelerden hesaplanır).

### 4c. Telefon ergonomisi ve okunurluk

### BB-U8 · Basma alanı bütün alt yarı — **önerim: EVET**
- Basış yalnız butonun kapağına değil, **ekranın şerit hariç alt üçte ikisine** dokunulunca da sayılır (buton yine
  görsel merkez). Heyecanda kapağın kenarını ıskalayan parmak boşa gitmez.
- Uzun basma, iki parmakla yakınlaştırma, metin seçme ve sistem menüsü bu alanda kapalı (bugün buton için var,
  alana genişler).
- İkinci parmak aynı anda basarsa tek basış sayılır (BB-M1 beklemesi zaten bunu sağlar).

### BB-U9 · Yatay ve küçük ekran düzeni — **önerim: EVET**
- Yatayda (844×390) düzen iki sütun: solda büyük buton (yüksekliğin %80'i), sağda tur rozeti, puanın ve 2 sütunlu
  şerit. Bugün buton ekranın ortasında küçük kalıyor (sorun 11).
- 360×640'ta puan yazısı ile buton arasındaki boşluk kısalır, şerit iki sıraya geçtiğinde (BB-U2) buton %8 küçülür;
  hiçbir öğe üst üste binmez.

### 4d. İzleyici, kopan oyuncu ve TV

### BB-U10 · İzleyici ekranı — **önerim: EVET**
- "En yüksek puan 6" yerine lider avatarı ve adı: **"Önde: Elif · 6"** (sorun 14).
- Buton izleyicide soluk ve basılmaz (bugün basılabilir görünüyor, sunucu reddediyor); üstünde "İzliyorsun".
- İzleyici de eşleşme çizgilerini (BB-U4) ve tur arası özeti (BB-U5) görür.

### BB-U11 · TV ekranı — **önerim: EVET** · 🎨 Görsel
TV'ye özel görünüm (sorun 12):
- Ortada büyük buton, çevresinde çember hâlinde **bütün oyuncular** (avatar 120 px, ad, bu oyundaki puan büyük).
- Bir pencere puanlanınca eşleşen oyuncular arasında neon çizgiler çakar; KALABALIK'ta (BB-M2) bütün çember yanar,
  tek basışta o oyuncunun avatarı kırmızı titrer.
- Üstte "TUR 2 · Dar" ve tur süresi. Sağdaki genel skor paneli bu oyunda "Bu oyunda" puanını gösterir; genel skor
  küçük, ikinci satırda.
- Tur arası özet (BB-U5) ve son açılış (BB-U7) TV'de tam ekran.
- 🎨 Gereken: oyuncu çemberinin arkasına koyu arcade salonu zemini (mevcut arka plan TV oranında yeniden
  kadrajlanabilirse yeni görsel gerekmez).

### BB-U12 · Kopan ve geri dönen oyuncu — **önerim: EVET**
- Kopan oyuncunun şeritteki avatarı gri ve "koptu" yazılı; puanı donuk kalır.
- Geri dönen oyuncu ekrana girince 1,5 sn **"Tur 2 sürüyor — bas!"** bandı görür; buton o anki tura göre açılır
  (bugün de açılıyor, yalnız haber verilmiyor).
- BB-M2 eşiği yalnız bağlı oyunculara bakar; kopan biri "kalabalığı" zorlaştırmaz.

### 4e. Ses, titreşim ve hareket

### BB-U13 · Arcade ses seti — **önerim: EVET** · 🔊 Ses
Bugün tüm oyunlarla ortak sentez sesler çalıyor. Butona Bas'a özel:
- Basış: kalın, mekanik arcade "KLAK" (yay sesiyle).
- Eşleşme: yükselen iki nota; eşleşen kişi sayısı arttıkça akor kalabalıklaşır (2 kişi iki nota, 4+ kişi üç nota,
  KALABALIK'ta kısa "tezahürat" vuruşu).
- Tek basış: kısa "bzzzt" buzzer.
- Dolum bitti (BB-M1): çok kısa "çıt".
- Tur başı: "gong"; ara: "vuuş" (pencere daralıyor); son 3 sn tıkları; oyun sonu: kısa fanfar.
- Ses yalnız kendi basışına ve kendi sonucuna çalar; başkalarının pencereleri yalnız görsel (8 kişide ses yığılmasın).

### BB-U14 · Titreşim ve buton hissi — **önerim: EVET**
- Basış: 10 ms; eşleşme: kısa çift; KALABALIK: üçlü; tek basış: 45 ms tek uzun (bugünkü düzen korunur, KALABALIK
  eklenir).
- Titreşim olmayan telefonda (iPhone'larda çoğu zaman) buton gömülmesi ve flaş bir kademe güçlenir (genel
  telafi ayarı bugün de var; bu oyunda kapak gömülmesi 6 px → 9 px).
- Kapak dokunuşta **aynı karede** gömülür (bugün de öyle); bırakınca 90 ms'de çıkar.

### 4f. İlk kez oynayan için öğretme

### BB-U15 · Anlatımda deneme butonu ve "sesli say" ipucu — **önerim: EVET**
- Anlatım görselinin altında küçük bir **deneme butonu**: basınca halka dalgası, dolum halkası (BB-M1) ve "KLAK"
  sesi; puan yok, sunucuya gitmez. "Hazırım" demeden önce eli ısınır.
- Anlatım maddeleri (BB-M1–M3 ile):
  1. "Birlikte bas: aynı anda basanlar +1, tek kalan −1"
  2. "Bastıktan sonra buton 1 sn dolar; yüksek sesle '3, 2, 1, BAS!' deyin"
  3. "3 tur: pencere her turda daralır (300, 200, 120 ms)"
- İlk tura girerken 1 sn'lik ipucu bandı: **"Sayın: 3… 2… 1… BAS!"** (yalnız bu oyunu ilk kez oynayan hesapta;
  hesap yoksa her seferinde).

### 4g. Erişilebilirlik

### BB-U16 · Renk körü dostu sonuçlar — **önerim: EVET**
- Eşleşme/tek basış bugün yalnız yeşil/kırmızı (kırmızı-yeşil renk körlüğünün tam üstü). Renk körü modunda avatar
  parlamasının üstüne **✓** (eşleşme) ve **✕** (tek) işareti, yüzen "+1/−1" yazısı kalınlaşır.
- Mod kapalıyken de yüzen yazıda işaret (+1 ✓, −1 ✕) bulunur; ucuz ve görünümü bozmaz.
- Lider tacı yalnız renkle değil şekille (taç simgesi) zaten ayrılır.

### BB-U17 · Hareket azaltma, yazı boyutu ve ekran okuyucu — **önerim: EVET**
- Hareket azaltma: halka dalgası yerine kapağın kenarında sabit ince çerçeve (pencere süresi kadar yanar), buton
  sarsıntısı yok, flaş yarı güçte; eşleşme çizgileri animasyonsuz belirir.
- Yazı boyutu "büyük"te şeritteki adlar ve puanlar büyür; 8 kişide ad 5 harfe kısalır, puan küçülmez.
- Ekran okuyucu: her pencere okunmaz (çok konuşur). Yalnız tur sonunda "Tur 1 bitti. Puanın 9, ikincisin." ve
  oyun sonunda sıralama okunur. Buton etiketi "Bas"; dolarken "Doluyor".

---

## 5. Yapay zekâ (AI) ile yapılabilecekler

### BB-AI1 · Uyum spikeri — **önerim: HAYIR**
Oyun sonunda tek cümle: "Oyuncu2 ile Oyuncu5 üç turda 11 kez aynı anda bastı; Oyuncu3 ise yalnız kurt." Ortak yapay
zekâ yorum altyapısıyla; modele yalnız "Oyuncu1…N" etiketleri ve sayılar gider, puana karışmaz, hata olursa hiç
görünmez.
**Neden önermiyorum:** 51 sn'lik refleks oyunu; konuşulacak malzeme BB-U7'deki "En uyumlu ikili / Yalnız kurt"
satırlarıyla zaten kural tabanlı ve bedavaya çıkıyor. Kule Ustası'nda da aynı gerekçeyle reddettin.

---

## 6. İçerik ve üretim ekibine düşen işler

- **Ses Efektleri yapay zekâsı (🔊):** BB-U13 seti — arcade "KLAK" (2–3 varyasyon), eşleşme notaları (2 / 3 nota +
  kalabalık vuruşu), "bzzzt", dolum "çıt", tur gongu, ara "vuuş", son saniye tıkları; BB-U6 tıkları. Hepsi ≤ 0,4 sn
  (gong ve fanfar ≤ 2 sn).
- **Müzik yapay zekâsı:** yeni iş yok; kabuktaki ortak gerilim katmanı turların son saniyelerinde zaten çalıyor.
- **Efekt Dokuları yapay zekâsı:** eşleşme çizgisi (neon iz), KALABALIK parlaması, altın an parıltısı (BB-M6
  onaylanırsa). Hareket azaltmada sade sürüm şart.
- **Görsel (ChatGPT görev akışı, 🎨):** yalnız BB-U11 için gerekirse TV oranında arcade salonu zemini. Buton görselleri
  (normal / basılı) var; altın buton (BB-M6) mevcut görselin renk varyantı olarak CSS ile yapılır.
- **İçerik Havuzu:** iş yok (oyunda metin havuzu yok).
- **Wiki:** kural değişiklikleri (BB-M1–M5) onaylanırsa oyun sayfası, strateji ve "bilinen sorunlar" güncellenir
  (gecikme ve 0 puanlı +1 maddeleri kalkar).

---

## 7. Önerilen paket

**EVET:** BB-M1, BB-M2, BB-M3, BB-M4, BB-M5, BB-U1 … BB-U17.
**İSTEĞE BAĞLI:** BB-M6 (altın an).
**HAYIR:** BB-M7 (gizli eş), BB-AI1.

Bu paketle oyun şöyle akar: anlatımda deneme butonuna basıp "3, 2, 1, BAS!" ipucunu görürsün → "TUR 1 · Geniş",
kalın halka → masa birlikte sayar, basarsın; buton 1 sn dolar → pencere ilk basanla açılır, 0,3 sn içinde basan
herkes içeride → butonun üstünde kiminle eşleştiğin çizilir ("+1 Elif, Mert"), masanın yarısından fazlası bastıysa
"+2 KALABALIK!" → tur sonunda "TUR 1 BİTTİ · Elif +9", halka incelir → 3. turda "İğne ucu" ve "SON ŞANS!" → son
açılışta "En uyumlu ikili" ve "Yalnız kurt".

**Değişen kurallar (paket onaylanırsa):** her sayılan basıştan sonra 1 sn bekleme (sunucuda); pencere ilk basışla
açılır ve tur süresi kadar (300/200/120 ms) açık kalır; 4+ bağlı oyuncuda yarıdan fazlası aynı pencerede basarsa +2;
basış anı istemcinin dokunma anıdır (en çok 250 ms eski, pencereler kapanıştan 250 ms sonra puanlanır); toplamı
0 ya da altı olan genel skor ödülü almaz. Anlatım maddeleri BB-U15'teki gibi olur. `docs/KURALLAR.md` §6, wiki ve
testler buna göre güncellenir.

**Değişmeyenler:** 2–8 oyuncu; 3 tur × 15 sn, 3 sn ara, toplam 51 sn; pencere süreleri 300 / 200 / 120 ms; eşleşme +1,
tek basış −1, kimse basmazsa değişmez (mini puanda eksi kalır, genel skorda eksi yok); genel skor oyun sonunda bir
kez, tek lider +2, sıradaki +1, eşit liderler +1; turun bitişinden sonra gelen basış reddedilir (geç eylem payı yok);
gizli bilgi olmaması; oyunun sonuç ekranının "Devam et" ile geçmesi.

**🎨 Yeni görsel gerekenler (paket):** yalnız TV için gerekirse arcade salonu zemini (BB-U11). Halkalar, çizgiler,
taç ve işaretler CSS/SVG ile yapılır.
**🔊 Ses işi (paket):** BB-U6, BB-U13.
