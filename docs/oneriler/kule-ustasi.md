# Kule Ustası — geliştirme önerileri

Bu dosya onay içindir. Her maddenin bir kodu var (ör. **KU-M2**). Cevabını tek satırda verebilirsin:

> KU-M1 evet, KU-M2 hayır, KU-U3 evet …

ya da yalnız **"önerilen paket evet"** dersen sondaki paket uygulanır. Her maddenin "ayrıntılar" bölümü onaylarsan
nasıl yapılacağını kesinleştirir; ek soru sormam gerekmez. Beğenmediğin ayrıntı varsa yalnız onu yaz.

Not: Sonuç ekranı herkes **"Devam et"** deyince geçer (en çok 60 sn). Yeni görsel gerektiren maddeler **🎨 Görsel**
diye işaretli.

---

## 1. Bugünkü oyun (özet)

- 2–8 oyuncu, maç başında karıştırılan sabit bir sırayla dönülür. Herkes ortak bir kuleye blok bırakır.
- Sırası gelenin ekranında blok kulenin üstünde sağa sola kayar; doğru anda dokunup bırakır (sıra en çok 6 sn;
  dokunmazsan 6. saniyede kendiliğinden bırakılır).
- Alttaki bloğun dışına taşan kısım kesilir, kule daralır. Taşma bloğun %4'ünden azsa kesilmez: **"Kusursuz!"**
- Hiç denk getiremeyen kuleyi yıkar ve **oyundan çıkar**; kule baştaki genişliğe ve hıza döner.
- Her başarılı katta hız %6 artar (en çok 2,5 kat).
- Oyuncuların yarısı çıkınca ya da 90 sn dolunca biter. Puan: çıkanlar **−1**, kalanlar **+1**, en çok kusursuz
  yapan(lar) ek **+1**.

## 2. Gördüğüm sorunlar

**Oyun tasarımı**
1. **Eksi puan var ve puan pasif.** Çıkan −1 alıyor; kalanlar hiçbir şey yapmasa da +1 alıyor. Yani 8 kişide sıran
   bir kez bile gelmeden +1 kazanabilirsin. Sen diğer oyunlarda eksiyi çoğunlukla kaldırdın; bu oyunda eksi oyunun
   özü değil (özü "kuleyi düşürme" gerilimi, ceza değil).
2. **Kimseye bir şey yapamıyorsun.** Sıra sabit; daralmış, hızlanmış zor kuleyi kime bırakacağın şansa kalıyor.
   Masada "dur sana bir kule bırakayım" anı yok. (Zaman Bombası'nda aynı sorunu "bombayı at" ile çözdük.)
3. **Dar kulede "Kusursuz" imkânsızlaşıyor.** Eşik bloğun genişliğine oranlı (%4). Geniş kulede pencere
   ~35 milisaniye, dar ve hızlı kulede ~5–10 milisaniyeye iniyor; yani dar kulede kusursuz beceriyle değil şansla
   oluyor. Ödül kolay anlara gidiyor.
4. **Kule yalnız daralıyor.** Bir kez kötü bir kesme olunca kule toparlanmıyor; sıradakiler için oyun "kim
   ıskalayacak" beklemesine dönüyor. Kusursuzun da tek etkisi "daralmamak".

**Arayüz**
5. **Kayan blok kulenin parçası gibi görünüyor.** Ekran görüntülerinde kayan blok kulenin en üst katına yapışık
   duruyor, yalnız biraz daha parlak. Hangi bloğu bırakacağın ilk bakışta belli değil; "bırakınca düşme" hissi yok.
6. **Havada duran soluk blok.** "Kusursuz!" ve ıska ekranlarında sol tarafta yarı saydam bir blok havada asılı
   duruyor (sıradaki blok bekliyor). Kesilip düşen bir parça gibi okunuyor; kusursuzda kesilen parça olmadığı hâlde.
7. **"BIRAK" yazısı yanlış yerde ve okunmuyor.** Taban bloğunun içinde, soluk mavi üstüne soluk mavi; kulenin
   en altında. Dokunacağın yer ve an belirsiz.
8. **İki süre çubuğu üst üste.** Üstte toplam süre çubuğu, onun altında sıra çubuğu; ikisi de aynı renk ve
   kalınlıkta. Hangisinin "senin 6 saniyen" olduğu anlaşılmıyor. Sıra süresi bitmek üzereyken uyarı yok.
9. **Kule alanının üstü boş, yükseklik hissi yok.** Bloklar kalın ve kısa; ekranın üst üçte biri boş. Kaçıncı
   katta olunduğu, hızın ne kadar arttığı hiç yazmıyor.
10. **Iska anı sönük.** Iska ekranında kule alanı neredeyse tamamen boş kalıyor (bir taban, bir soluk blok);
    "kule yıkıldı" gösterisi görünmüyor.
11. **Şeritteki puanlar kafa karıştırıyor.** Oyun başlar başlamaz herkesin altında "+1" yazıyor ("şimdi bitseydi"
    puanı); bir oyuncuda nedensiz "+2". Altın kenarlı katların kusursuz olduğu hiçbir yerde açıklanmıyor.
12. **Sonuç ekranı nedeni söylemiyor.** Podyumda "2", "1" var ama kimin kaç kat koyduğu, kaç kusursuz yaptığı yok.
13. **TV'de özel düzen yok:** telefon ekranı büyütülüyor; dikey kule yatay ekranın ortasında ince bir sütun.

---

## 3. Oyunu değiştiren öneriler (mekanik)

### KU-M1 · Usta puanı: eksi yok, sonunda +2 / +1 / 0 — **önerim: EVET**
**Ne:** Oyun boyunca **usta puanı** toplanır; oyun sonunda sıralamaya çevrilir: **en yüksek +2, ikinci +1,
diğerleri 0.** Eksi puan kalkar.
**Neden:** Sorun 1. Diğer oyunlarla aynı aralık (0…+2); pasif "+1" biter, iyi oynayan öne geçer.
**Ayrıntılar:**
- Oturttuğun her kat **+1**, kusursuz kat **+2** (+1 yerine).
- Oyun bittiğinde **hâlâ oyunda olan +3** ("ayakta kaldın").
- Iskalayıp çıkan oyuncunun usta puanı **korunur** (silinmez, eksiye düşmez); yalnız +3'ü alamaz.
- Süre dolarken sırası iptal olan oyuncu bugünkü gibi cezasız; ayakta sayılır.
- Eşitlik: birincide eşitlik varsa hepsi +2, sonraki farklı toplam +1; usta puanı 0 olan ödül almaz; herkesin
  toplamı aynı ve 0'dan büyükse herkes +1.
- **2 oyuncuda:** ıskalayıp çıkan, usta puanı ne olursa olsun **0** alır; kalan **+2**. Iska olmadan 90 sn
  dolarsa usta puanı yüksek olan +2, diğeri +1 (eşitse ikisi de +2).
- Kartlar ortak kurala göre: "birinci" = +2 alan(lar), "sonuncu" = en düşük usta puanlı(lar).
- Rozet ("Kule Ustası": tek oyunda 3 kusursuz) aynen kalır.

### KU-M2 · Kuleyi sen ver: sıradakini sen seçersin — **önerim: EVET**
**Ne:** Bloğu oturtan oyuncu, **kuleyi kime bırakacağını kendisi seçer**. Sabit sıra kalkar. Daralmış, hızlanmış
kuleyi rakibine bırakmak oyunun yeni hamlesi olur.
**Neden:** Sorun 2. Zaman Bombası'nda onayladığın "bombayı at" ile aynı his: "bana verme!", intikam, ittifak.
Kimse "sıram çok uzakta" diye kopamaz.
**Ayrıntılar:**
- Başarılı bırakıştan sonraki 0,9 sn'lik ara yerine **3 sn'lik seçim**: oturtanın ekranında şeritteki avatarlar
  büyür, birine dokunur. Diğerleri "Elif kuleyi kime verecek?" görür. Seçmezse karışık başlangıç sırasında
  sıradaki seçilebilir oyuncuya geçer.
- **Kendine veremezsin.** Kuleyi az önce sana vereni **hemen geri seçemezsin** (3 ve üstü aktif oyuncuda).
- **Kimse kaçamaz:** bırakış sayısı, en az bırakış yapmış aktif oyuncununkinden **2 ya da daha fazla** olan
  seçilemez (avatarında kilit). Bu kurallar herkesi kilitlerse yalnız "kendine yok" kuralı uygulanır.
- **Iskadan sonra:** ıskalayan çıkar, yeni tabanı kime vereceğini **kuleyi ıskalayana veren** seçer ("seçimin işe
  yaradı, bir daha seç"). O kişi bağlı değilse sıradaki seçilebilir oyuncuya geçer. Iska sonrası ara 2,2 sn aynen,
  seçim bunun içinde yapılır (ek süre yok).
- Oyunun ilk sırası ve ıskayı yapan ilk kişi (kimse vermediyse) karışık sıradan gelir.
- **2 aktif oyuncu kalınca** seçim ekranı çıkmaz (tek seçenek); ara 0,9 sn.
- Seçim süresi oyunu uzattığı için **toplam süre 90 sn → 110 sn** olur. Diğer bitiş kuralı (yarısı çıkınca)
  aynen.

### KU-M3 · Adil kusursuz eşiği — **önerim: EVET**
**Ne:** Kusursuz eşiği "bloğun %4'ü" yerine **"bloğun %4'ü ya da 12 birim, hangisi büyükse"** olur.
**Neden:** Sorun 3. Geniş kulede hiçbir şey değişmez (400 genişlikte eşik bugünkü gibi 16 birim); dar kulede
kusursuz yeniden beceriyle yapılabilir olur ve en zor anda yapılan kusursuz ödüllenir.
**Ayrıntılar:**
- Önce ıska kontrol edilir (hiç örtüşme yoksa ıska); sonra kusursuz eşiğine bakılır.
- Eşik, bloğun yarısından büyük olamaz (çok dar blokta yarısı kullanılır).
- Tam eşik kadar taşma bugünkü gibi kusursuz değildir (kesin küçüklük).

### KU-M4 · Kusursuz kuleyi onarır — **önerim: EVET**
**Ne:** Kusursuz bırakılan blok, alttakinden **20 birim geniş** oturur (her iki yana 10 birim). Kule daralmanın
yanında yeniden genişleyebilir.
**Neden:** Sorun 4. Kule toparlanabilir; kusursuz gerçek bir "kurtarış" olur. KU-M2 ile ince bir seçim doğar:
kusursuzla kuleyi onardın, şimdi bu güzel kuleyi kime vereceksin?
**Ayrıntılar:**
- Genişlik başlangıç genişliğini (400) geçmez.
- Blok pistin kenarına dayanıyorsa taşan genişlik diğer yana eklenir.
- Hız artışı bugünkü gibi (her başarılı katta %6); onarım hızı düşürmez.

### KU-M5 · Çıkanlar rüzgâr eser — **önerim: HAYIR (isteğe bağlı)**
**Ne:** Oyundan çıkanlar oyun boyunca **bir kez** "rüzgâr" düğmesine basabilir: o anki sırada blok 1 sn boyunca
%30 hızlanır.
**Neden önermiyorum:** Çıkanlara yapacak bir şey verir ama sonucu oyunculardan çok izleyenlere bıraktırır ve
"beni rüzgâr düşürdü" tartışması doğurur. KU-M2'den sonra çıkanlar zaten "kim kime veriyor" izlemekle meşgul.
Oynandıktan sonra gerekirse eklenir.

---

## 4. Arayüz ve his önerileri

### KU-U1 · Vinç ve düşen blok — **önerim: EVET** · 🎨 Görsel
- Kayan blok artık kuleye yapışık değil: kulenin **bir kat yukarısında**, ekranın üstünden inen bir **vinç
  kancasına asılı** kayar (arka plandaki vinçlerle uyumlu). Kayan blokla kule arasında net bir boşluk olur.
- Dokununca kanca açılır, blok 0,2 sn'de aşağı düşer ve oturur (yalnız gösteri; sonuç dokunduğun ana göre
  hesaplanır, değişmez). Oturunca kısa toz ve "tak" sesi.
- Sıradaki blok sol üstte havada soluk beklemez (sorun 6); ara bitince kanca yeni blokla yukarıdan iner.
- Bloklar düz renk yerine anlatım görselindeki gibi **parlak kristal/cam dokulu**.
- 🎨 Gereken: vinç kancası + halat (kanca ucu tek parça), kristal blok dokusu (tek doku, renkler boyanarak).

### KU-U2 · Yükseklik hissi: kat sayacı, rekor çizgisi, hız — **önerim: EVET**
- Bloklar bugünkünün yarı kalınlığında; ekranda 8 yerine **14 kat** görünür, kule yükseldikçe görüntü yukarı
  kayar. Kule alanının üstü boş kalmaz.
- Kulenin yanında büyük **"KAT 9"** sayacı; her başarılı katta sayı zıplayarak artar.
- Bu oyundaki en yüksek kule kesik altın çizgiyle gösterilir: **"Rekor 12"**; geçilince çizgi parlar, "Yeni
  rekor!" yazar.
- Küçük hız rozeti: **"HIZ ×1,4"**; 2'yi geçince turuncu, tavanda (×2,5) kırmızı.

### KU-U3 · Tek bakışta süre — **önerim: EVET**
- Üstteki iki aynı çubuk ayrılır: **toplam süre** üstte küçük ve ortalı "0:48" sayacı (çubuksuz, ince);
  **senin 6 saniyen** vinç kancasının üstünde küçük azalan halka.
- Son 2 saniyede halka kırmızıya döner, tik sesi hızlanır, blok hafifçe titrer ("2… 1…") ki kendiliğinden bırakma
  sürpriz olmasın.
- Son 10 saniyede toplam sayaç kırmızı ve büyük.

### KU-U4 · Sıra sende ve dokunma ipucu — **önerim: EVET**
- Taban bloğundaki soluk "BIRAK" yazısı kalkar (sorun 7).
- Sıra sana gelince: güçlü titreşim, kule çerçevesinin kenarları yanar, yukarıdan **"SIRA SENDE!"** bandı iner
  (Zaman Bombası'nda onayladığın uyarıyla aynı). Blok uyarıdan sonra kaymaya başlar (sıra süresi bu uyarıdan
  sonra işler; uyarı 0,6 sn).
- Kule alanının altında nabız atan büyük **"DOKUN · BIRAK"** bandı ve parmak simgesi; dokunulacak yer bütün kule
  alanı olarak kalır.

### KU-U5 · Kesilme ve kusursuz anı — **önerim: EVET**
- Kesilen parça bugünkü gibi soluk durmaz: **dönerek aşağı düşer** ve ekrandan çıkar; yanında küçük kırmızı
  "−34" (kaç birim kesildi).
- **Kusursuz:** blok oturunca altın şimşek dalgası, ortada **"KUSURSUZ!"** damgası, "ding". Art arda
  kusursuzlarda (kim yaparsa yapsın) ses bir nota yükselir ve **"SERİ ×3"** yazar.
- (KU-M4 ile) kusursuz blok iki yana doğru genişleyerek oturur; "+ onarıldı".
- Kusursuz katlar kulede altın kenarlı + küçük ★ ile kalır; anlatımın 2. maddesine "altın kat = kusursuz" eklenir.

### KU-U6 · Yıkılış anı — **önerim: EVET**
- Iskada kule boş ekrana dönmez (sorun 10): katlar **yukarıdan aşağı tek tek yana savrulur ve düşer**, toz bulutu,
  ekran sarsılır, gürültülü yıkılma sesi.
- Iskalayanın avatarı şeritte çatlar ve griye döner.
- 2,2 sn'lik aranın sonunda yeni taban vinçle iner: **"Yeni kule!"** (KU-M2 ile ardından seçim).

### KU-U7 · Oyuncu şeridi — **önerim: EVET**
- Şeritte "şimdi bitseydi" puanı (+1/−1) yerine **usta puanı** ve altında **★ kusursuz sayısı** (KU-M1 ile).
- Çıkanlar kırmızı "−1" yerine gri ve "çıktı" etiketli.
- (KU-M2 ile) seçim sırasında şerit büyür ve dokunulabilir olur; seçilemeyenlerde kilit simgesi; kuleyi az önce
  verenin avatarında küçük "geri yok" işareti. Seçim yapılınca blok seçilen avatara doğru kayarak uçar.
- (KU-M2 yoksa) sıradaki oyuncunun avatarında küçük "sıradaki" oku.

### KU-U8 · Sonuç ekranına "neden" satırı — **önerim: EVET**
- Ortak podyum ekranı aynen; her oyuncunun altına tek satır: **"7 kat · ★2 · ayakta"** ya da **"4 kat · çıktı"**.
- Başlık altında: **"Gecenin en yüksek kulesi: 14 kat"**.

### KU-U9 · Ses ve titreşim seti — **önerim: EVET**
Vinç cızırtısı (blok kayarken hafif), bırakma "klik", oturma "tak", kesilme "çat", kusursuz "ding" (seride
yükselen), hızlanan tik (son 2 sn), yıkılma gürültüsü, "Yeni kule" vinç sesi, (KU-M2 ile) kuleyi verme "vuuş".
Titreşim: bırakışta kısa, kusursuzda çift, ıskada uzun.

### KU-U10 · TV ekranı — **önerim: EVET**
TV'de kule ekranın ortasında büyük ve yüksek (14+ kat görünür), solda büyük oyuncu sütunu (avatar, ad, usta puanı,
★, durum: sırada / çıktı), sağda büyük "KAT", "Rekor" ve "HIZ" göstergeleri, üstte toplam süre. Kusursuz ve
yıkılış TV'de tam ekran efektli. Boş yan alan kalmaz.

---

## 5. Yapay zekâ (AI) ile yapılabilecekler

### KU-AI1 · Kule spikeri — **önerim: HAYIR (isteğe bağlı)**
Oyun sonunda tek cümlelik esprili özet: "Mert dar kuleyi üç kez Elif'e verdi; Elif ikisini kusursuz oturttu,
üçüncüde kuleyle birlikte gitti." Ortak yapay zekâ yorum altyapısıyla (API bağlanınca açılır, hata olursa görünmez,
oyun beklemez, yasaklı kelime süzgeci); modele yalnız kat geçmişi, kim kime verdi ve ıskalar gider. Puana karışmaz.
**Neden önermiyorum:** Hızlı bir refleks oyunu; konuşacak malzeme az, KU-U8'deki "neden" satırı ve rekor yeterli.

---

## 6. Önerilen paket

**KU-M1, KU-M2, KU-M3, KU-M4 ve KU-U1 … KU-U10 hepsi.** (KU-M5 ve yapay zekâ pakete dahil değil.)

Bu paketle oyun şöyle akar: vinç ilk bloğu indirir → "SIRA SENDE!" bandı, blok kancada kayar, halka azalır →
dokunursun, blok düşer; taşan parça dönerek kopar ya da "KUSURSUZ!" ile kule onarılır → kat sayacı yükselir, hız
artar → daralmış kuleyi kime vereceğini seçersin ("bana verme!") → biri ıskalayınca kule kat kat yıkılır, kuleyi ona
veren yeni kurbanı seçer → sonda usta puanına göre +2 / +1 / 0, podyumda "7 kat · ★2 · ayakta".

**Değişen kurallar (paket onaylanırsa):** puan: oturtulan kat +1, kusursuz kat +2, sonda ayakta kalan +3 usta puanı;
mini puan +2 / +1 / 0, eksi yok (2 oyuncuda çıkan 0); sabit sıra yerine oturtanın seçtiği oyuncuya geçiş (kendine
yok, hemen geri yok, "kimse kaçamaz" kilidi, ıskadan sonra veren seçer); toplam süre 110 sn; kusursuz eşiği
%4 ya da 12 birim (büyük olan); kusursuz blok 20 birim geniş oturur (400'ü geçmez). Anlatımın 3. maddesi
"Iskalayan kuleyi yıkar ve çıkar; ayakta kalan ve çok kat koyan kazanır" olur. `docs/KURALLAR.md`, wiki ve testler
buna göre güncellenir.

**Değişmeyenler:** 2–8 oyuncu, pist ve 400 birimlik taban, kayan bloğun hareketi ve hızı (450 birim/sn, katta %6,
en çok ×2,5), 6 sn sıra süresi ve kendiliğinden bırakış, gecikme hilesi koruması (400 ms), ıskada çıkış ve kulenin
sıfırlanması, oyuncuların yarısı çıkınca bitiş, süre dolarken cezasız iptal, "Kule Ustası" rozeti, gizli bilgi
olmaması.

**🎨 Yeni görsel gerekenler (paket):** vinç kancası + halat (KU-U1), kristal/cam blok dokusu (KU-U1). Toz bulutu,
kesilen parça, altın şimşek ve halka CSS ile yapılır.
