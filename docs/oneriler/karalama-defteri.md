# Karalama Defteri — geliştirme önerileri

Bu dosya onay içindir. Her maddenin bir kodu var (ör. **KD-M2**). Cevabını tek satırda verebilirsin:

> KD-M1 evet, KD-M2 hayır, KD-U3 evet …

ya da yalnız **"önerilen paket evet"** dersen sondaki paket uygulanır. Her maddenin "ayrıntılar" bölümü onaylarsan
nasıl yapılacağını kesinleştirir; ek soru sormam gerekmez. Beğenmediğin ayrıntı varsa yalnız onu yaz.

Kodlar: **KD-M…** oyunu değiştiren (mekanik), **KD-U…** arayüz ve his, **KD-AI…** yapay zekâ. (KD öneki başka oyunda
kullanılmıyor.)

Not: Sonuç ekranı herkes **"Devam et"** deyince geçer (en çok 60 sn; zaten var, yeniden önerilmiyor). Yeni görsel
gerektiren maddeler **🎨 Görsel**, ses alanına iş açanlar **🔊 Ses** diye işaretli. Kelime çifti havuzuna düşen işler
bölüm 6'da **İçerik alanı** başlığında toplanır (listeleri sen ya da İçerik Havuzu yapay zekâsı yazar; oyundaki yapay
zekâ üretmez). Çizim tahtası Bozuk Telefon'la ortaktır; BT-U3'te onayladığın 10 renk / 4 kalınlık Bozuk Telefon'a
özeldir, Karalama kuralda yazdığı gibi 6 renkle kalır.

---

## 1. Bugünkü oyun (özet)

- 3–8 oyuncu. Havuzdan bir kelime çifti çekilir (yerleşik 166 çiftten oynanabilir **161**'i; ör. elma / armut).
  Rastgele **bir oyuncu bilgisizdir**: çoğunluk ana kelimeyi (elma), bilgisiz yakın kelimeyi (armut) görür. Bilgisizin
  ekranında ilk 7 sn sarı **"yakın sinyal"** etiketi yanar; yani bilgisiz, bilgisiz olduğunu bilir.
- **Çizim (75 sn):** kare koyu tuval, 6 renk, silgi, 3 kalınlık, geri al, temizle. Süre bitene kadar düzenlenebilir;
  "Bitti" kilitler. Bağlı herkes Bitti derse oylama 1 sn sonra başlar.
- **Oylama (20 sn):** sergi duvarında bütün çizimler (her biri ~1,5 sn'de baştan çizilir), dokununca büyür. Herkes bir
  oy verir (kendine veremez, **bağlantısı kopuk oyuncuya veremez**), Tamam'a kadar değiştirir.
- **Puan (doğrudan genel skora):** bilgisiz **tek başına** en çok oyu aldıysa "yakalandı": **bilgisiz dışındaki herkes
  +1**. Eşitlikte ya da hiç oy yoksa "kurtuldu": **bilgisiz +1**. Eksi yok.
- **Bitiş:** oylama süresi biter bitmez oyun "biter"; telefonda oylama duvarı "Devam et" düğmesiyle kalır. Bilgisizin
  kim olduğu ve iki kelime **genel sonuç ekranının üstünde** küçük bir kartla açılır. TV'nin kendi görünümü var.
- Aynı oda içinde çift tekrarını önleyen bir şey yok.

## 2. Gördüğüm sorunlar

**Oyun tasarımı**

1. **Puanın büyük kısmı bedava.** Bilgisiz yakalanınca **yanlış kişiye oy veren ya da hiç oy vermeyen** de +1 alıyor.
   Senin oyunun hiçbir bireysel karşılığı yok; çizimleri dikkatle inceleyen ile telefonu masaya bırakan aynı puanı alıyor.
2. **Bilgisizin elinde tek koz var: saklanmak.** Yakalandığı an oyun bitiyor. Bilgisiz bütün çizimleri gördükten sonra
   ana kelimeyi tahmin etme şansı (Sızma'da onayladığın "son şans" gibi) yok; oysa "elmaymış, biliyordum!" anı bu tür
   oyunların en güzel anı.
3. **Kopan bilgisiz kendiliğinden kurtuluyor.** Bağlantısı kopuk oyuncuya oy verilemiyor; bilgisiz oylama sırasında
   uygulamadan çıkarsa (ya da telefonu kilitlenirse) oy alamaz ve "kurtuldu" +1 alır. Sızma'da kopan oyuncuya oy
   vermeyi onaylamıştın.
4. **Kelime ekranda kocaman ve sarı etiket ele veriyor.** Çizim ekranının tepesinde kelime ~40 px; bilgisizde bir de sarı
   "yakın sinyal" etiketi. Yan yana oturan biri başını çevirince hem kelimeyi hem bilgisizi görüyor. Oylamada da başlığın
   altında "Kelimen: armut" yazıyor.
5. **Çiftlerin zorluğu çok dengesiz ve etiketsiz.** Bazı çiftler çizimle neredeyse ayırt edilemez (kiraz / vişne,
   portakal / mandalina, kurabiye / bisküvi, sosis / sucuk, çita / leopar, kek / pasta, kazak / hırka): bilgisiz hiç
   yakalanmaz. Bazıları fazla uzak (nehir / yol, okul / hastane, yumurta / ampul, kaya / patates, kalp / yıldız):
   bilgisiz ilk çizgide belli olur. Yönetici panelinde bunu gösteren etiket ya da sonuç verisi yok.
6. **5 çift sessizce oyundan düşüyor.** güneş / ay, çadır / ev, at / eşek, ok / yay, saz / ud: bir kelime 3 harften kısa
   olduğu için oynanamaz sayılıyor ve hiç çıkmıyor. Bazı kelimeler de birden çok çiftte geçiyor (ördek, helikopter,
   televizyon, havuz, nar, gemi, çanta, balon, ahtapot, eşek).
7. **Çift hep aynı yönde.** "elma" hep çoğunluğun, "armut" hep bilgisizin kelimesi. Aynı odada aynı çift yeniden gelirse
   herkes kimin hangi kelimeyi alacağını bilir.
8. **Tekrar önleme hiç çalışmıyor.** Oyun çektiği çifti bildirmiyor; sunucunun tekrar süzgeci de yalnız yönetici
   panelinde değiştirilmiş havuzlara uygulanıyor.
9. **8 kişide 20 sn oylama dar.** Yedi çizimi (her biri 1,5 sn'de yeniden çiziliyor) bakıp karşılaştırmak, büyütüp
   oy vermek 20 sn'ye zor sığıyor; 3 kişide aynı süre bol.
10. **Çizime yazı yazmak yasak değil.** Kural ve anlatım "kelimeyi yazma" demiyor; "ELMA" yazan oyun bitiriyor.

**Arayüz** (390×844, 360×640, yatay 844×390 ve TV 1920×1080 ekran görüntülerine bakarak)

11. **Oyunun kendi açılışı yok.** Oylama bitince telefonda aynı oylama duvarı "Devam et" ile 60 sn'ye kadar kalıyor; kimin
    bilgisiz olduğu, kimin kime oy verdiği bu ekranda **hiç** görünmüyor. Bilgisiz ancak genel sonuç ekranının üstündeki
    küçük kartta açılıyor; oyların kime gittiği telefonda hiçbir yerde gösterilmiyor (yalnız TV'de oy sayıları var).
    Kuralda yazan "oylama kartları seçilen portreye doğru kıvrılan ışık izleri" yok.
12. **Bitti sonrası bekleme ekranı boş.** Önizlemede "Bitti" deyince tuval boş görünüyor, palet sönük, altta "Diğerleri
    bekleniyor · 3/5"; kendi çizimin ve sergiye asılma hissi yok.
13. **8 kişide sergi duvarında isimler kayboluyor.** Sütun dar olunca isim gizleniyor, kartın altında yalnız 30 px avatar
    kalıyor; 360×640'ta 4 sütunda çizimler ~70 px. Kendi çizimin de duvarda bir hücre kaplıyor (oylanamaz).
14. **Süre ve mürekkep görünmüyor.** Çizimde kalan süre yalnız ince çubukta (sayı son 5 sn'de); nokta kotası
    (`pointsLeft`) ekranda yok, dolunca sürpriz uyarı.
15. **Yatayda oylama duvarı tek satır ve küçük:** 6 çizim ~70 px, isim yok, yönlendirme satırı yok.
16. **İzleyici çizimde yalnız kalem simgesi görüyor;** oylamada "Kelimeyi bilmeyen kim?" başlığı ve duvar var ama
    tahmin edemiyor.
17. **Bağlantısı kopuk oyuncunun kartı sessizce basılamıyor;** neden oy verilemediği yazmıyor.

---

## 3. Oyunu değiştiren öneriler (mekanik)

### KD-M1 · Bilgisizin son şansı: ana kelimeyi bil — **önerim: EVET**
**Ne:** Oylama bitince bilgisiz açıklanır ve **12 sn** içinde ana kelimeyi tahmin eder (yazarak). Doğruysa **+1**.
**Neden:** Sorun 2. Bilgisiz çizerken de "elma mı, kiraz mı?" diye çizimleri okumaya başlar; yakalansa bile oyun bitmez,
masa onun tahminini bekler.
**Ayrıntılar:**
- Son şans, bilgisiz **yakalansa da kurtulsa da** oynanır (ikisinde de +1 değerinde). Bilgisizin en yüksek puanı:
  kurtulma +1 + doğru tahmin +1 = **+2**.
- Eşleşme genel kurala uyar (klavyeden bağımsız); 6+ harfli kelimede tek harf farkı kabul (Yazı Yaz YY-M7 ile aynı).
  Tek tahmin; Gönder kesindir. Yakın kelimesini (armut) yazarsa doğru sayılmaz.
- Bilgisiz son şans sırasında bütün çizimleri (sergi duvarı) görür; kelime ipucu, harf sayısı verilmez.
- Diğerleri "Mert kelimeyi tahmin ediyor…" ve geri sayım görür; tahmin gelince kart çevrilir: "elma ✓" ya da "kiraz ✗".
- Bilgisiz bağlı değilse ya da 12 sn'de yazmazsa tahmin yok sayılır (0), oyun beklemez. Bağlı herkes beklenmez; yalnız
  bilgisizin gönderişi son şansı erken bitirir (1 sn sonra).
- Son şans, açılışta (KD-U5) bilgisiz açıklanıp damga vurulduktan hemen sonra başlar; oyuna en çok 12 sn ekler.

### KD-M2 · Doğru oy verene puan — **önerim: EVET**
**Ne:** Puan kalemleri:
- Bilgisize **oy veren her oyuncu +1** (bilgisiz yakalansa da yakalanmasa da).
- Bilgisiz **kurtulursa +1** (bugünkü gibi: tek başına en çok oyu almadıysa).
- KD-M1: bilgisiz ana kelimeyi bilirse **+1**.
- Yanlış oy, oy vermemek 0. Eksi yok. Puanlar bugünkü gibi doğrudan genel skora gider (en çok +2).
**Neden:** Sorun 1. Oyun "grup kazandı" değil "kim buldu" oyunu olur; çizimleri incelemek ödüllenir. Bilgisiz kurtulsa
bile onu doğru gören azınlık boşa gitmez.
**Ayrıntılar:**
- "Yakalandı / Kurtuldu" hâlâ gösterilir (bilgisizin +1'ini belirler); tanım aynen: bilgisiz tek başına en çok oyu
  almalı, eşitlikte kurtulur.
- 3 kişi: iki kişi de bilgisize oy verirse ikisi +1, bilgisiz yakalanır (0, son şansla +1). Biri bilgisize, öteki diğer
  kişiye verirse eşitlik: bilgisiz kurtulur (+1), doğru oy veren +1.
- Maç kartlarında "birinci" = bu oyunda en çok puan alan(lar), "sonuncu" = 0 alanlar (hepsi eşitse kimse sonuncu değil).
- Bu madde onaylanmazsa bugünkü kural kalır; KD-M1 yine çalışır (bilgisizin ek +1'i).

### KD-M3 · Kopan oyuncuya da oy verilebilsin — **önerim: EVET**
**Ne:** Oylamada bağlantısı kopuk oyuncunun çizimine de oy verilebilir.
**Neden:** Sorun 3. Bugün bilgisiz uygulamadan çıkarak kurtulabiliyor. Sızma'da aynı kuralı onayladın.
**Ayrıntılar:** Kopan oyuncunun kartında "bağlantı koptu" etiketi (KD-U12). Kopuk oyuncu oy veremez, Tamam beklenmez
(bugünkü erken bitiş kuralı). Kopan bilgisiz son şansa (KD-M1) katılamaz.

### KD-M4 · Çift yönü rastgele — **önerim: EVET**
**Ne:** Çift çekilince **%50 ihtimalle yön değişir**: bazen "elma" çoğunluğun, "armut" bilgisizin; bazen tersi.
**Neden:** Sorun 7. Havuz pratikte iki katına çıkar; aynı çift yeniden gelse bile kimin hangi kelimeyi aldığı
bilinemez.
**Ayrıntılar:** Havuzdaki "Ana kelime" / "Yakın kelime" alan adları "Kelime 1" / "Kelime 2" olur; ikisi de çizilebilir
olmak zorunda (bugünkü kural). Yönü sabit kalması gereken bir çift varsa İçerik alanı "yön sabit" işaretiyle belirtir
(varsayılan: rastgele). Tekrar önleme anahtarı zaten yönden bağımsız.

### KD-M5 · Aynı odada çift tekrar etmesin — **önerim: EVET**
**Ne:** Bir odada son **50** Karalama oyununda çıkan çift tekrar gelmez.
**Neden:** Sorun 8.
**Ayrıntılar:**
- Oyun çektiği çifti sunucuya bildirir (`contentUsed`; anahtar bugünkü yönsüz çift anahtarı).
- **Sunucu düzeltmesi (bütün oyunlara yarar):** tekrar süzgeci yerleşik havuza da uygulanır.
- Ayrıca son 10 oyunda çıkmış çiftlerin **kelimelerinden biri** yeni çiftte varsa (ör. ördek / kaz'dan sonra kuğu / ördek)
  o çift de bu süre içinde atlanır; havuz alt sınırının altına düşülürse bu ek kural uygulanmaz.
- Hafıza oda bellekte durduğu sürece; oda kapanınca sıfırlanır.

### KD-M6 · Yakınlık etiketi ve oyuncu sayısına göre çift — **önerim: EVET**
**Ne:** Her çift bir **yakınlık** etiketi taşır: **çok yakın** (kiraz / vişne), **yakın** (elma / armut), **uzak**
(nehir / yol). Çekiliş:
- 3–5 oyuncu: yalnız **yakın**;
- 6–8 oyuncu: %50 **yakın**, %50 **çok yakın**;
- **uzak** çiftler hiç çekilmez (İçerik alanı yeniden eşler ya da kapatır).
**Neden:** Sorun 5. Kalabalık masada çoğunluğun 5–7 çizimi ortak bir "dil" kurar, bilgisiz daha kolay sırıtır; daha yakın
çift onu dengeler. Küçük masada çok yakın çift bilgisizi görünmez yapar.
**Ayrıntılar:** Etiket havuz formunda açılır liste; etiketsiz çift "yakın" sayılır. Uygun etiketli çift kalmazsa (tekrar
süzgecinden sonra) etiket şartı düşer.

### KD-M7 · Oylama süresi oyuncu sayısına göre — **önerim: EVET**
**Ne:** Oylama 3–4 oyuncuda **20 sn**, 5–6 oyuncuda **25 sn**, 7–8 oyuncuda **30 sn**.
**Neden:** Sorun 9.
**Ayrıntılar:** Erken bitiş aynen (bağlı herkes Tamam derse 1 sn sonra). En uzun oyun: 75 + 30 + ~5 açılış + 12 son şans (KD-M1) = ~122 sn;
erken bitişle pratikte 70–90 sn.

### KD-M8 · Çift karnesi: yakalanma ve tahmin oranı — **önerim: EVET**
**Ne:** Her oyunda çift için iki sayı havuz istatistiğine eklenir: **bilgisiz yakalandı mı** ve (KD-M1) **ana kelimeyi
bildi mi**. Yönetici panelinde (İçerik) çift başına "kaç oyunda çıktı · yakalanma % · tahmin %" sütunları.
**Neden:** Sorun 5. Yakınlık etiketi tahminden veriye döner: hep yakalanan çift "uzak", hiç yakalanmayan "çok yakın"
önerisi alır.
**Ayrıntılar:**
- Yalnız sayılar saklanır; çizim, oyuncu adı, oda kodu saklanmaz (maç verisi saklanmaz kuralı korunur).
- Öneri eşikleri (en az 8 oyundan sonra): yakalanma ≥ %85 → "uzak" önerisi; ≤ %15 → "çok yakın" önerisi. Öneriler
  sahip onayına gider; kendiliğinden uygulanmaz.
- Üretim belgesindeki ALT-10 "istatistik" maddesinin bu oyuna düşen parçası.

### KD-M9 · Bilgisiz kendini bilmesin — **önerim: HAYIR**
**Ne:** "Yakın sinyal" kalkar; bilgisiz farklı kelimede olduğunu bilmeden çizer (Undercover tarzı).
**Neden önermiyorum:** Kuralı sen açıkça "yakın sinyal" ile kurdun; bilmeyen bilgisiz KD-M1 son şansını anlamsız kılar
ve çoğu zaman masum armut çizip ilk turda yakalanır. Not olarak bırakıyorum: farklı bir oyun hissi verir, ileride ayrı
bir oyun olabilir.

---

## 4. Arayüz ve his önerileri

### 4a. Ana ekranlar ve akış

### KD-U1 · Gizli kelime kartı: basılı tutunca görünür — **önerim: EVET** · 🎨 Görsel
**Ne:** Çizim başında tam ekran **ters kart**: "Kelimeni görmek için basılı tut · ekranını sakla". Basılı tutunca kart
döner, kelime görünür; bilgisizde kelimenin üstünde sarı **"yakın sinyal"** ve kısa ipucu (KD-U15). Bırakınca kart
küçülüp tuvalin üstünde **"Kelimeni gör"** çubuğuna dönüşür; kelime bir daha yalnız basılı tutunca görünür.
**Neden:** Sorun 4. Bugün yan bakan biri hem kelimeyi hem bilgisizi okuyabiliyor.
**Ayrıntılar:**
- İki kartın arka yüzü, boyutu ve animasyonu birebir aynı; basılı tutmayan biri farkı göremez.
- "Yakın sinyal" yalnız kart açıkken görünür (bugünkü 7 sn kuralı yerine); bilgisiz kelimesini her açışında görür.
- Kart açılmadan çizime başlanabilir (tuval kilitli değil) ama ilk dokunuşta kısa titreşimle "Önce kelimene bak" uyarısı.
- Oylamadaki "Kelimen: armut" satırı da aynı çubuğa döner (basılı tutunca görünür).
- 🎨 Gereken: defter sayfası görünümlü kart arkası (tek görsel; ön yüz CSS).

### KD-U2 · Çizim ekranı: süre ve mürekkep — **önerim: EVET**
**Ne:** Tuvalin sağ üst köşesinde kalan süre **sayıyla** (son 10 sn amber, son 5 sn kırmızı ve tik); tuvalin altında
ince **mürekkep çubuğu** (kalan nokta kotası), %20 kalınca amber, bitince "Mürekkep bitti · geri al ya da sil".
**Neden:** Sorun 14.
**Ayrıntılar:** Mürekkep çubuğu silgi kullanınca dolmaz (kota darbeye göredir), geri al ve temizle doldurur.

### KD-U3 · Bitti sonrası: "Sergiye asıldı" — **önerim: EVET**
**Ne:** Bitti'ye basınca çizimin küçülüp bir **çerçeveye** girer ve duvara asılır; altında "Sergiye asıldı · 3/5". Diğer
oyuncuların çerçeveleri boş ve örtülü durur, bitiren her oyuncunun çerçevesi örtüsünü kapatır (içerik görünmez).
**Neden:** Sorun 12. Bekleme bir sergi açılışı beklentisine döner.
**Ayrıntılar:** Çerçeveler oylamadaki duvar düzeniyle aynı sırada; oylama başlayınca örtüler kalkar (KD-U6).

### KD-U4 · Sergi duvarı: isimler hep görünür, kendi çizimin kenarda — **önerim: EVET**
**Ne:**
- Kendi çizimin duvardan çıkar, başlığın sağında küçük bir küçük resim olarak durur ("Senin çizimin").
- Kalan çizimler büyür: 8 kişide 7 çizim 2 sütun × 4 satır (son satır ortalı), 390 px'te ~165 px.
- İsim **her zaman** görünür (en çok 7 harf, kesilir); dar sütunda avatar küçülür, isim kalır.
- Büyütme penceresinde sağa-sola kaydırarak sonraki/önceki çizim; pencerede **"BU KİŞİ"** oy düğmesi.
**Neden:** Sorun 13. Oy, yüzden değil isimden verilir; 8 kişide yanlış kişiye oy riski azalır.
**Ayrıntılar:** Duvar düzeni oyuncu sayısına göre: 3–4 → 1 × 2–3 büyük; 5–6 → 2 × 2–3; 7–8 → 2 × 4. 360 × 640'ta duvar
kaydırılabilir, Tamam sabit.

### 4b. Açılış/sonuç anı ve gerilim

### KD-U5 · Oyunun kendi açılışı: ışık izleri, maske, iki kelime — **önerim: EVET** · 🎨 Görsel · 🔊 Ses
**Ne:** Oylama bitince telefonda (ve TV'de) sergi duvarı üstünde sırayla:
1. **Oylar uçar:** her oy, oy verenin avatarından seçtiği çizime doğru kıvrılan bir **ışık izi** (kuraldaki görsel);
   oylar 0,25 sn arayla, çizimlerin köşesinde sayaç büyür.
2. **"Kelimeyi bilmeyen…"** kısa davul; bilgisizin çiziminin üstünde maske düşer (Sızma'daki kırılan maske görseli
   yeniden kullanılır), altında iki kelime yan yana: "Ortak: **elma** · Onun: **armut**".
3. Damga: **"YAKALANDI!"** ya da **"KURTULDU!"**.
4. KD-M1 son şansı (KD-U7).
5. Puan şeridi: "Doğru oy: Cihad, Zeynep +1 · Mert kurtuldu +1".
**Neden:** Sorun 11. Bugün oyunun en büyük anı telefonda hiç yaşanmıyor; "Devam et" düğmesi bir şey açılmamış ekranda
duruyor.
**Ayrıntılar:**
- Süre: oylar en çok 8 × 0,25 = 2 sn, davul + maske 2 sn, damga 1 sn, son şans en çok 12 sn, puan 1,5 sn.
- Genel sonuç ekranındaki küçük açılış kartı kalır (özet olarak), ama artık ilk kez orada öğrenilmez.
- Hareketi azaltmada ışık izleri düz çizgi, maske düşmeden kaybolur.
- 🎨 Gereken: ışık izi parçacığı, "YAKALANDI / KURTULDU" damgası (maske Sızma'dan).
- 🔊 Gereken: oy "vınn" (her biri), davul, maske kırılma, damga.

### KD-U6 · Sergi açılışı — **önerim: EVET**
**Ne:** Oylama başında çerçevelerin örtüleri soldan sağa 0,3 sn arayla kalkar; her çizim bugünkü gibi baştan çizilerek
oynar. İlk 2 sn oy kapalı değildir ama Tamam ilk 3 sn pasiftir.
**Neden:** Herkes bütün çizimleri bir kez görsün; acele eden ilk çizime oy verip Tamam'a basmasın.
**Ayrıntılar:** KD-M7 ile süre zaten uzuyor; açılış en çok 2,4 sn (8 çizim).

### KD-U7 · Son şans ekranı — **önerim: EVET (KD-M1 onaylanırsa)**
**Ne:** **Bilgisizde:** duvar üstte küçülür, altta büyük alan "Ortak kelime neydi?" ve Gönder; 12 sn geri sayım kırmızı
halka. **Diğerlerinde:** bilgisizin avatarı büyük, üstünde "düşünüyor…" ve aynı geri sayım; tahmin gelince kart döner.
**Neden:** Masanın gözü bilgiside olsun; bu bir "final" anı.
**Ayrıntılar:** Doğruysa yeşil zil ve "BİLDİ!", yanlışsa kısa "bzzt" ve yazdığı kelime üstü çizili. Bilgisizin yazarken
yazdıkları kimseye gösterilmez (yalnız gönderdiği).

### 4c. Telefon ergonomisi ve okunurluk

### KD-U8 · Çizim tahtası ergonomisi — **önerim: EVET**
**Ne:**
- **İkinci parmak çizmez:** çizerken ekrana ikinci bir parmak (avuç, başparmak) değerse yeni çizgi başlamaz.
- 360 × 640'ta renk ve araç satırları tek satırda birleşir (6 renk + silgi + kalınlık + geri al), tuval ~%12 büyür.
- Geri al düğmesi basılı tutulunca art arda geri alır (0,15 sn arayla).
- Temizle iki adımlı: ilk dokunuşta "Emin misin? Tekrar dokun" (2 sn).
**Neden:** Telefonu iki elle tutan oyuncunun kazara çizgileri ve yanlışlıkla silinen çizim; küçük ekranda dar tuval.

### KD-U9 · Yatay düzen — **önerim: EVET**
**Ne:** Yatayda oylama duvarı **2 satır**, isimler görünür, yönlendirme satırı ve Tamam sağda dikey sütunda.
**Neden:** Sorun 15.
**Ayrıntılar:** Çizim aşaması dikey kalır (oyun dikey); yatay tutulursa tuval ortada kare, araçlar sağda.

### 4d. İzleyici, kopan oyuncu ve TV

### KD-U10 · TV: açılış ve son şans büyük ekranda — **önerim: EVET**
**Ne:** TV'nin bugünkü çizim ve oylama görünümü kalır; eklenenler: çizim sırasında her oyuncunun avatarında hareketli
kalem (bitti diyenin kalemi masaya bırakılır), oylama sonunda KD-U5 açılışı tam ekran (ışık izleri büyük duvarda),
KD-M1 son şansında ortada bilgisizin avatarı ve geri sayım.
**Neden:** Bugün TV oylamadan sonra doğrudan genel sonuca geçiyor; açılış anı TV'de de yok.
**Ayrıntılar:** TV hiçbir aşamada kelimeleri, bilgisizi ya da çizimleri oylamadan önce göstermez (bugünkü gizlilik).

### KD-U11 · İzleyici tahmini (sayılmaz) — **önerim: İSTEĞE BAĞLI**
**Ne:** İzleyici oylamada bir çizime "bence bu" işareti koyabilir; yalnız kendi ekranında kalır, açılışta "Sen de
bulmuştun!" görür.
**Neden:** Sorun 16. İzleyicinin ekranı bugün yalnız seyir.
**Ayrıntılar:** Sunucuya gitmez, oy sayısına ve hazır sayacına girmez. İzleyiciye kelimeler açılıştan önce gösterilmez.

### KD-U12 · Kopan oyuncunun kartı — **önerim: EVET**
**Ne:** Bağlantısı kopuk oyuncunun çiziminin altında soluk isim ve **"bağlantı koptu"** etiketi; KD-M3 ile oy verilebilir.
KD-M3 onaylanmazsa etiket "bağlantı koptu · oy verilemez" olur.
**Neden:** Sorun 17.

### 4e. Ses, titreşim ve hareket

### KD-U13 · Defter ses seti — **önerim: EVET** · 🔊 Ses
**Ne:** Ses kimliği "kâğıt, kurşun kalem, ahşap çerçeve":
- çizerken çok hafif kalem cızırtısı (yalnız kendi telefonunda, çizgi hızına göre; ayarlarda ses kapalıysa yok);
- silgi sürtme, geri al "fıs", temizle kâğıt buruşturma;
- Bitti: defter kapanma; sergiye asılma "tık";
- oy verince raptiye "çıt" ve kısa titreşim; Tamam'da çerçeve vuruşu;
- açılış: KD-U5 sesleri; son şans: saat tiki, doğruysa zil.
**Neden:** Bugün genel "dokunma/hazır/eşleşme" sesleri kullanılıyor.
**Ayrıntılar:** Kalem cızırtısı başkasına duyurulmaz (kimin hâlâ çizdiğini zaten şerit söylüyor ama ses masada kafa
karıştırır); yalnız çizen duyar.

### 4f. İlk kez oynayan için öğretme

### KD-U14 · Anlatım: yazı yasağı, son şans, puan — **önerim: EVET**
**Ne:** Anlatım adımları: (1) "Çoğunluk aynı kelimeyi, biri yakın kelimeyi görür; kelimene **basılı tutarak** bak",
(2) "Kelimeni çiz; **harf ve yazı yasak**", (3) "Bilgisize oy ver: doğru oy +1. Bilgisizsen saklan ve sonunda ortak
kelimeyi tahmin et". Görselde elma / elma / armut çizimleri ve bir ışık izi.
**Neden:** Sorun 10; yeni kurallar (KD-M1, KD-M2) anlatımda yer almalı.
**Ayrıntılar:** Yazı yasağını sistem denetlemez; anlatımda ve çizim ekranının ilk 3 sn'sinde tuvalin üstünde "Yazı yok,
yalnız çizim" notu. Yazı yazan masada uyarılır (sözlü), kural ihlali puanı değiştirmez.

### KD-U15 · Role göre kısa strateji ipucu — **önerim: EVET**
**Ne:** KD-U1 kartı açıkken kelimenin altında tek satır:
- Çoğunlukta: **"Biri yakın bir kelimede. Çok açık çizersen o da anlar; çok kapalı çizersen sen şüpheli olursun."**
- Bilgisizde: **"Senin kelimen farklı ama yakın. Genel hatlarıyla çiz, ayrıntıya girme."**
**Neden:** İlk oyunda çoğunluk kelimeyi açıkça (yazıyla bile) çiziyor, bilgisiz de kendi kelimesini ayrıntılı çizip hemen
yakalanıyor. İpucu oyunun asıl gerilimini öğretir.
**Ayrıntılar:** İki satır aynı uzunlukta yazılır (yan bakana satır uzunluğuyla rol sızmasın). Cihazda bu oyun 3 kez
oynandıktan sonra gösterilmez.

### 4g. Erişilebilirlik

### KD-U16 · Renk, okunurluk ve ekran okuyucu — **önerim: EVET**
**Ne:**
- Palet düğmeleri ekran okuyucuda ve basılı tutunca adıyla: "beyaz, pembe, sarı, yeşil, turkuaz, turuncu"; seçili renk
  yalnız halkayla değil, altında küçük bir noktayla da belli.
- "Yakalandı / Kurtuldu" yalnız yeşil/amber değil, damga yazısı ve simgeyle (✓ / kaçan ayak izi).
- Oy verdiğin çizim yalnız ✓ ile değil, isim çubuğunda **"OYUN"** yazısıyla da belli.
- Çizimler ekran okuyucuda "Elif'in çizimi, büyütmek için dokun"; açılış sırayla okunur: "Kelimeyi bilmeyen Mert. 3 oy
  aldı, yakalandı. Ortak kelime elma, onun kelimesi armut."
- Büyük yazı ayarında isimler ve kelime çubuğu büyür; duvar kaydırılabilir olur.
**Neden:** Açılış ve oy durumu bugün renk ve küçük işaretle anlatılıyor.

---

## 5. Yapay zekâ (AI) ile yapılabilecekler

### KD-AI1 · Sanat eleştirmeni yorumu — **önerim: İSTEĞE BAĞLI**
**Ne:** Açılışın sonunda en çok oy alan çizim için tek cümlelik esprili "eleştirmen" yorumu: "Oyuncu2'nin elması o kadar
armutsu ki üç kişi ikna oldu." Ortak yorum altyapısıyla (API yoksa görünmez, oyun beklemez, yasaklı kelime süzgeci).
**Ayrıntılar:** Modele küçültülmüş tek çizim (≤ 256 px), iki kelime ve oy sayıları gider; oyuncular "Oyuncu1…N" olur, ad
ekranda yerine konur; saklanmaz. Puanı etkilemez. Neden İSTEĞE BAĞLI: görsel girdi metin yorumlardan pahalıdır; önce
metinli spiker yorumlarının (Kara Borsa, Sızma) nasıl karşılandığını görmek isteyebilirsin.

### KD-AI2 · Çizimde yazı denetimi — **önerim: HAYIR**
**Ne:** Yapay zekâ çizimde harf/yazı var mı diye bakar, varsa çizimi reddeder.
**Neden önermiyorum:** ⚠️ Oyunu yapay zekâ kararı etkiler; yanlış alarm (ör. "Y" şeklinde bir ağaç) masada haksızlık
olur, gecikme oylamayı bekletir. Yazı yasağı anlatımla (KD-U14) ve masadaki sosyal baskıyla yeterli.

### KD-AI3 · Çizim betimleme (ekran okuyucu) — **önerim: HAYIR**
**Ne:** Görme engelli oyuncu için her çizimin kısa sözlü betimlemesi.
**Neden önermiyorum:** Oylama başına 3–8 görsel çağrı pahalı ve oylama süresi içinde gecikmeli; betimleme ("yuvarlak
bir meyve") oyunun sırrını da çözebilir. KD-U16'daki okunurluk adımları önce gelir.

---

## 6. İçerik ve üretim ekibine düşen işler

**İçerik alanı (İçerik Havuzu yapay zekâsı, senin onayınla):**
- KD-M6: 166 çiftin hepsine **yakınlık** etiketi (çok yakın / yakın / uzak). Hedef dağılım: %30 çok yakın, %60 yakın,
  %10'dan az uzak; uzak çiftler (nehir / yol, okul / hastane, yumurta / ampul, kaya / patates, kalp / yıldız …) yeniden
  eşlenir ya da kapatılır.
- Oynanamayan 5 çiftin yeniden yazılması (güneş / ay, çadır / ev, at / eşek, ok / yay, saz / ud): kelimeler 3+ harf,
  biri ötekinin içinde geçmeyecek, havuzda başka çiftte geçmeyen kelimeler seçilecek (ör. güneş / dolunay, çadır /
  kulübe değil çünkü kulübe zaten var: çadır / iglo gibi).
- Aynı kelimenin birden çok çiftte geçtiği durumları (ördek, helikopter, televizyon, havuz, nar, gemi, çanta, balon,
  ahtapot, eşek) azaltmak; KD-M5'in ek kuralı bunları zaten ayırıyor ama havuz çeşitliliği artar.
- KD-M4 için yönü sabit kalması gereken çiftlere "yön sabit" işareti (beklenen: çok az).
- Havuzu büyütmek: hedef **300** çift; tema dengesi (hayvan, yiyecek, ev eşyası, taşıt, doğa, giyim, müzik, spor).
- KD-M8 verisi geldikçe etiket düzeltmeleri.
- Kod isteği (yönetici yapar): yakınlık alanı (açılır liste), "yön sabit" onay kutusu, istatistik sütunları, alan
  adlarının "Kelime 1 / Kelime 2" olması.

**Ses alanı:** KD-U5 (oy "vınn", davul, maske kırılma, damga), KD-U7 (saat tiki, zil, "bzzt"), KD-U13 (kalem cızırtısı,
silgi, geri al, kâğıt buruşturma, defter kapanma, raptiye, çerçeve). Ses kimliği: kâğıt, kurşun kalem, ahşap.

**Görsel (ChatGPT görev akışı):** KD-U1 defter sayfası kart arkası; KD-U5 ışık izi parçacığı ve "YAKALANDI / KURTULDU"
damgası (maske Sızma'nın görseli); KD-U3 ahşap çerçeve ve örtü (CSS ile de olur).

**Müzik alanı:** isteğe bağlı oyun teması (gece atölyesi havası); son şansta kısa gerilim katmanı.

---

## 7. Önerilen paket

**EVET:** KD-M1, KD-M2, KD-M3, KD-M4, KD-M5, KD-M6, KD-M7, KD-M8; KD-U1 … KD-U10, KD-U12 … KD-U16.

**İSTEĞE BAĞLI:** KD-U11 (izleyici tahmini), KD-AI1 (sanat eleştirmeni).

**HAYIR:** KD-M9 (bilgisiz kendini bilmesin), KD-AI2 (yazı denetimi), KD-AI3 (çizim betimleme).

Bu paketle oyun şöyle akar: ters defter kartına basılı tutarsın → "elma" (ya da sarı sinyalle "armut" ve "genel hatlarıyla
çiz" ipucu) → çizersin, sağ üstte süre, altta mürekkep → Bitti: çizimin çerçevelenip duvara asılır → oylamada örtüler
tek tek kalkar, isimli büyük çizimler, büyütüp kaydırarak bakar, "BU KİŞİ" dersin → oylar ışık izleriyle çizimlere uçar,
bilgisizin maskesi düşer, "YAKALANDI!" → bilgisiz 12 sn'de "elma" yazar, kart döner, "BİLDİ!" → doğru oy verenler +1,
bilgisiz kurtulduysa +1, kelimeyi bildiyse +1.

**Değişen kurallar (paket onaylanırsa):** bilgisize oy veren her oyuncu +1 (yakalanmadan bağımsız); bilgisiz kurtulursa +1
ve oylamadan sonra 12 sn'lik son şansta ortak kelimeyi bilirse +1; kopan oyuncuya oy verilebilir; çift yönü rastgele;
aynı odada son 50 oyunda çıkan çift (ve son 10 oyunda geçen kelimeyi içeren çift) gelmez; çift oyuncu sayısına göre
yakınlık etiketinden seçilir; oylama 20 / 25 / 30 sn; çizimde yazı yasağı kurala yazılır. `docs/KURALLAR.md`, wiki ve
testler buna göre güncellenir.

**Değişmeyenler:** 3–8 oyuncu, rastgele tek bilgisiz, bilgisizin yakın kelimeyi ve "yakın sinyal"i görmesi, 75 sn çizim,
6 renk + silgi + 3 kalınlık, süre bitene kadar düzenleme, çizimlerin oylamada aynı anda açılması, kişi başı tek oy, kendine
oy yok, eksik oyun kura ile doldurulmaması, eşitlikte bilgisizin kurtulması, eksi puan yok, puanların doğrudan genel
skora gitmesi, erken bitiş kuralları.

**🎨 Yeni görsel gerekenler (paket):** defter sayfası kart arkası (KD-U1), ışık izi parçacığı ve "YAKALANDI / KURTULDU"
damgası (KD-U5), ahşap çerçeve ve örtü (KD-U3; CSS ile de olur). Maske görseli Sızma'dan yeniden kullanılır.
