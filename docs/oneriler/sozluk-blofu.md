# Sözlük Blöfü — geliştirme önerileri

Bu dosya onay içindir. Her maddenin bir kodu var (ör. **SB-M2**). Cevabını tek satırda verebilirsin:

> SB-M1 evet, SB-M2 hayır, SB-U3 evet …

ya da yalnız **"önerilen paket evet"** dersen sondaki paket uygulanır. Her maddenin "ayrıntılar" bölümü onaylarsan
nasıl yapılacağını kesinleştirir; ek soru sormam gerekmez. Beğenmediğin ayrıntı varsa yalnız onu yaz.

Kodlar: **SB-M…** oyunu değiştiren (mekanik), **SB-U…** arayüz ve his, **SB-AI…** yapay zekâ. (SB öneki başka oyunda
kullanılmıyor.)

Not: Sonuç ekranı herkes **"Devam et"** deyince geçer (en çok 60 sn; zaten var, burada yeniden önerilmiyor). Yeni görsel
gerektiren maddeler **🎨 Görsel**, ses alanına iş açan maddeler **🔊 Ses** diye işaretli. Kelime havuzuna iş açan
maddeler bölüm 6'da **İçerik alanı** başlığında toplanır (havuz listelerini sen ya da İçerik Havuzu yapay zekâsı
yazar, oyundaki yapay zekâ üretmez).

---

## 1. Bugünkü oyun (özet)

- 3–8 oyuncu, tek kelime, tek tur. Havuzdan (yerleşik **87** girdi: kelime + gerçek tanım) rastgele bir kelime çekilir,
  büyük harfle "sözlük maddesi plakasında" gösterilir.
- **Yazma (50 sn):** herkes tek seferlik, en çok 100 karakterlik sahte tanım yazar. Gönder = Tamam, değiştirilemez.
  Sunucu tanımı "sözlük biçimine" sokar (sondaki nokta atılır, ilk harf küçülür). Gerçek tanımın birebir aynısı
  (klavyeden bağımsız) "Bu zaten gerçek anlam!" diye reddedilir. Bağlı herkes gönderince 1 sn sonra biter.
- **Seçme (30 sn):** gerçek tanım + bütün sahte tanımlar karışık, numaralı kartlar. Kendi kartın "Senin yazdığın"
  etiketiyle soluk ve seçilemez. Seçim Tamam'a kadar değişebilir.
- **Açılış (en az 12 sn):** gerçek kart en üstte açılır, sonra sahte kartlar azdan çoğa kandıranla sıralanır; kartta
  sahibi, "+n" ve seçenlerin 24 px avatarları. Üstte kendi puanın.
- **Puan:** gerçeği seçen +1; sahte kartın sahibi her seçen için +1. Eksi yok. **Mini puan genel skora olduğu gibi
  eklenir** (`awards = miniScores`), sıralamaya çevrilmez.
- Aynı oda içinde kelime tekrarını önleyen bir şey yok (oyun `contentUsed` bildirmiyor).

## 2. Gördüğüm sorunlar

**Oyun tasarımı**

1. **Genel skora tavansız puan akıyor.** 8 kişide tek bir blöf 7 kişiyi kandırırsa sahibi tek oyunda **+7** (gerçeği de
   bulamaz ama kandırma puanı yeter), 5 kişide bile +4–5 olağan. Maçtaki diğer oyunların çoğu en çok +2 veriyor; bir
   Sözlük Blöfü turu bütün maçın sıralamasını tek başına belirleyebiliyor.
2. **Tekrar önleme hiç çalışmıyor.** Oyun hangi kelimeyi çektiğini sunucuya bildirmiyor; ayrıca sunucunun tekrar
   süzgeci yalnız yöneticinin **değiştirdiği** havuzlara uygulanıyor, yerleşik havuz hiç süzülmüyor. 87 kelimelik
   havuzda aynı odada 12 Sözlük Blöfü oyunundan sonra en az bir kelimenin tekrar gelmiş olma ihtimali %50'yi geçer. Sözlük Blöfü'nde tekrar
   ölümcüldür: gerçeği hatırlayan herkes bedava +1 alır, blöfler boşa gider.
3. **Bazı kelimeler fazla tanıdık.** KORU, ÇİSE, SEHER, NALBANT, KALFA, AHİZE, İBRİK, TELVE, ŞIRA, SEDEF gibi
   kelimeleri masadaki birçok kişi bilir. Bilen kişi gerçeği seçip +1 alır, diğerleri ona blöf yazmış olur; tur
   bir "kim biliyor" yarışına döner. Havuzda zorluk ya da bilinirlik bilgisi yok, hangi kelimenin "yandığını"
   ölçecek bir veri de yok.
4. **Gerçek tanım üslubuyla ele veriyor.** Gerçek tanımlar TDK dilinde ve oyuncuların yazdığından belirgin biçimde
   farklı: noktalı virgüllü çift tanımlar ("gür, bol ve sık olan; seyrek olmayan", "güneşin batması; akşam vakti"),
   açıklama eki ("…; ayakkabı tabanında kullanılır"), 60–70 karakterlik uzunluk. Sunucunun biçim düzeltmesi yalnız
   ilk harf ve sondaki noktayla ilgileniyor; noktalı virgüllü kart görünce masada "bu gerçek" deniyor.
5. **Kelimenin türü bilinmiyor.** GÜMRAH ve MÜNZEVİ sıfat, diğerlerinin çoğu isim. Oyuncu bunu bilmediği için
   "gümrah: bir tür balık" yazıyor; sıfat olan gerçek tanım isim tanımlarının arasında tek başına göze batıyor.
6. **Aynı ya da çok benzer blöfler ikiz kart oluyor.** İki kişi aynı şeyi yazarsa (sık olur: "bir tür kuş") iki ayrı
   kart çıkar. Gerçek tanım asla iki kez çıkmayacağı için **ikiz kartın ikisi de kesin sahte** olur; iki oyuncunun
   blöfü birden yanar.
7. **3–4 kişide seçim fazla kolay.** 3 kişide 4 kart var ve kendi kartın seçilemiyor: her oyuncu 3 karttan birini
   seçiyor, rastgele bile 1/3 şansla gerçeği bulur. Blöf yazmanın değeri düşüyor.
8. **Anlatım puanın yarısını söylemiyor.** Üçüncü adım "Seni seçen her arkadaşın bir puan kazandırır" diyor; gerçeği
   bulmanın +1 olduğu hiçbir yerde yazmıyor.

**Arayüz** (390×844, 360×640, yatay 844×390 ve TV ekran görüntülerine bakarak)

9. **Yazma ekranının ortası boş.** Kelime plakası ile yazı alanı arasında ekranın ~%25'i karanlık boşluk; tek
   yönlendirme küçük gri "Gerçek gibi görünen sahte bir anlam yaz" satırı. Kalan süre yalnız en üstteki ince çubukta
   (sayı son 5 sn'de çıkıyor). Yazdığın tanımın kartta nasıl görüneceği (küçük harf, noktasız) belli değil.
10. **Kilit ekranı kuru.** "Tanımın kilitlendi" + tanımın + "3/5 hazır"; bekleyen için ne bakacak ne düşünecek bir şey
    var. Ekranın 2/3'ü yine boş.
11. **Seçme listesinde kendi kartın en değerli yeri kaplıyor.** Önizlemede "Senin yazdığın" kartı 1 numarada, en üstte
    duruyor; 8 kişide 9 kartın yalnız 6,5'i görünüyor, **8. kart Tamam düğmesinin altında kalıyor** (liste sonuna boşluk
    yok). 360×640'ta yalnız 5 kart sığıyor, ilki yine seçilemeyen kendi kartın. Yatayda 2,5 kart görünüyor.
12. **Açılışta gerilim yanlış yerde.** Gerçek anlam **ilk** açılıyor; oyunun en büyük anı ("gerçek hangisiydi?")
    açılışın ilk saniyesinde harcanıyor, sonrası puan dökümü. Briefing görselindeki "mühürlü kartlar ve mürekkep"
    fikri açılışta hiç yok.
13. **Açılışta kart numaraları kayboluyor.** Seçme ekranında "3'ü seçtim" diye hatırlayan oyuncu açılışta numarasız ve
    yeniden sıralanmış kartlarda kendi seçimini bulamıyor; "senin seçimin" işareti yok.
14. **Kimin kandırıldığı okunmuyor.** Seçenler isimsiz 24 px avatarlarla gösteriliyor; 8 kişide renkleri karışan
    yüzlerden "beni kim seçmiş" çıkmıyor. Masada en çok konuşulan şey ("Mert, sen buna mı inandın?!") ekranda yok.
15. **Üstteki "+3" neyin toplamı belli değil.** "Gerçeği buldun! 2 kişiyi kandırdın" yazıyor ama +1 ile +2'nin
    ayrımı yok; kimse kandırılmadıysa ya da gerçek bulunamadıysa ("Sözlük kazandı") özel bir an yok.
16. **İzleyici ekranı:** seçme aşamasında başlık "Gizli seçim"; izleyici kartları okuyor ama bir şey yapamıyor.
17. **TV'de özel görünüm yok:** telefon ekranı ortada dar bir sütunda, iki yan boş. Seçme aşamasında masanın birlikte
    okuyup tartışabileceği büyük kart duvarı yok.
18. **Yazarken sayfa yenilenirse ya da bağlantı kısa koparsa taslak kayboluyor** (yazı yalnız ekranın belleğinde).

---

## 3. Oyunu değiştiren öneriler (mekanik)

### SB-M1 · Blöf puanı sıralamaya dönsün — **önerim: EVET**
**Ne:** Oyun içinde **"blöf puanı"** bugünkü gibi toplanır (gerçeği bulmak +1, seni seçen her kişi +1). Oyun sonunda
genel skora **en yüksek +2, ikinci +1, diğerleri 0** gider. Eksi yok.
**Neden:** Sorun 1. Tek bir turun +7 vermesi diğer oyunları anlamsız kılıyor; onayladığın oyunların çoğu (Gizli
Alışveriş, Kendim, Yazı Yaz, Kule Ustası, Kara Borsa) +2 / +1 / 0 kullanıyor.
**Ayrıntılar:**
- Birincide eşitlik varsa hepsi **+2**; sonraki farklı toplam **+1** (iki kişi +2 aldıysa üçüncü toplam +1 alır).
- Blöf puanı 0 olan ödül almaz. Herkesin toplamı aynı ve 0'dan büyükse herkes **+1**; hepsi 0 ise kimse almaz.
- Ekranda iki sayı karışmasın: açılışta kartlarda ve üst başlıkta blöf puanı ("+3 blöf puanı"), en sonda madalya
  rozeti ("🥇 +2") ayrı gösterilir (bkz. SB-U9).
- Maç kartlarında "birinci" = en yüksek blöf puanı, "sonuncu" = en düşük (herkes eşitse kimse sonuncu değil).
- Bu madde onaylanmazsa: hiç değilse oyun başına genel skor tavanı +3 olsun (önerim yine de sıralama).

### SB-M2 · Aynı odada kelime tekrar etmesin — **önerim: EVET**
**Ne:** Bir odada son **40** Sözlük Blöfü oyununda çıkan kelime tekrar gelmez.
**Neden:** Sorun 2. Bu oyunda tekrar, oyunu tamamen bozar.
**Ayrıntılar:**
- Oyun, çektiği kelimeyi sunucuya bildirir (Yazı Yaz ve Kendim'deki gibi, `contentUsed`; anahtar = kelime).
- **Sunucu düzeltmesi (bütün oyunlara yarar):** tekrar süzgeci yerleşik havuza da uygulanır. Bugün yalnız yönetici
  panelinde değiştirilmiş havuzlar süzülüyor; Yazı Yaz ve Kendim'in yerleşik konu listesi de aynı açıktan etkileniyor.
- Süzülünce kalan girdi havuzun alt sınırının (10) altına düşerse süzgeç uygulanmaz (bugünkü güvenlik kuralı).
- Hafıza odaya bağlıdır ve yalnız bellekte durur; oda kapanınca sıfırlanır (maç verisi saklanmaz kuralı korunur).
- 87 girdide 40'lık hafıza her zaman en az 47 seçenek bırakır.

### SB-M3 · Kelimenin türü görünsün — **önerim: EVET**
**Ne:** Kelimenin altında sözlükteki gibi küçük italik bir tür satırı: **"isim"**, **"sıfat"**, **"fiil"** ya da **"zarf"**.
Örnek: ŞAKUL *isim* · GÜMRAH *sıfat*.
**Neden:** Sorun 5. Blöfler doğru türde yazılır, gerçek tanım türüyle ele vermez; oyuncuya "nasıl bir şey
yazayım" diye ilk tutamağı verir.
**Ayrıntılar:**
- Havuza yeni zorunlu alan: **Tür** (dört seçenekten biri). Yönetici formunda serbest metin değil açılır liste olur
  (bugün havuz alanlarında seçim türü yok; küçük bir kod işi).
- 87 yerleşik girdinin türünü İçerik alanı doldurur (bölüm 6). Türü boş eski girdi kalırsa satır hiç görünmez.
- Tür, yazma, seçme ve açılış ekranlarında ve TV'de kelimenin hemen altında durur.
- İsteğe bağlı ikinci adım (şimdilik önermiyorum): TDK'daki gibi **alan etiketi** ("denizcilik", "eski meslek",
  "hayvancılık"). Havuzda gemi (SEREN, KÜPEŞTE, BORDA, PALAMAR, FİLİKA, MAVNA) ve koşum (GEM, DİZGİN, YULAR, KAŞAĞI)
  kelimeleri yoğun; alan etiketi bu kümelerde tanımı fazla daraltır. Önce tür denensin.

### SB-M4 · İkiz blöfler tek kart olsun — **önerim: EVET**
**Ne:** İki (ya da daha çok) oyuncu klavyeden bağımsız karşılaştırmada aynı tanımı yazarsa seçme ekranında **tek kart**
çıkar. Kartı seçen her kişi için **her yazar** +1 alır.
**Neden:** Sorun 6. Bugün ikiz kart kendiliğinden "sahte" damgası yiyor; iki oyuncunun emeği birden yanıyor.
**Ayrıntılar:**
- Karşılaştırma gerçek tanım reddiyle aynı anahtarla yapılır (büyük/küçük harf, ç/c…, noktalama ve boşluk farkı yok).
- Kartta ilk gönderenin yazılışı görünür.
- Yazarlar yazma sırasında birbirinin aynısını yazdığını öğrenmez (gizlilik aynen kalır).
- Ortak kartın yazarlarından biri onu seçemez (kendi kartı); ikisi de "Senin yazdığın" etiketini görür.
- Açılışta kartın üstünde iki avatar ve isim: "Kaan & Defne · aynı blöf!" (bkz. SB-U8).
- Kart sayısı azalır; 3 kişide iki ikiz blöfle 2 kart kalırsa SB-M5'teki yem kartı devreye girer.

### SB-M5 · Sözlüğün yemi: küçük masada fazladan sahte kart — **önerim: EVET**
**Ne:** 3 ya da 4 kişilik oyunda kartların arasına **sistemin hazırladığı bir sahte tanım** ("yem") karışır. Yemi
seçen 0 alır, yemden kimse puan almaz.
**Neden:** Sorun 7. 3 kişide rastgele seçim bile 1/3 şansla gerçeği buluyordu; yem bunu 1/4'e indirir ve küçük
masada da blöf yazmayı değerli kılar.
**Ayrıntılar:**
- Havuza isteğe bağlı yeni alan: **Yem tanımı** (0–2 adet, gerçek tanımla aynı biçim kuralları). Yemleri İçerik
  alanı yazar; oyundaki yapay zekâ üretmez.
- 3 kişide en çok 1, 4 kişide en çok 1 yem; 5+ kişide yem yok. Kelimenin yemi yoksa oyun bugünkü gibi oynar.
- İki yem varsa biri rastgele seçilir. Bir oyuncunun blöfü yemle aynıysa (klavyeden bağımsız) yem çıkarılır.
- Yem, sahte kartlarla aynı görünür. Açılışta "📖 Sözlüğün yemi" etiketiyle, sahipsiz açılır; "Mert yeme
  takıldı" satırı masada ayrı bir kahkaha anıdır.
- Blöf puanı ve SB-M1 sıralaması değişmez; yem yalnız "rastgele seçim" şansını düşürür.

### SB-M6 · Gerçek tanım için havuz biçim kuralı — **önerim: EVET**
**Ne:** Gerçek tanımlar oyuncunun yazabileceği gibi yazılır: **tek cümle, en çok 70 karakter, noktalı virgül,
parantez ve "ör." yok**, ikinci anlam eklenmez.
**Neden:** Sorun 4. Gerçek kart üslubuyla değil içeriğiyle seçilsin.
**Ayrıntılar:**
- Yönetici formu ve havuz doğrulaması: tanımda `;` `(` `)` reddedilir, sınır 100'den 70'e iner ("Gerçek tanım kısa
  ve tek cümle olmalı").
- Yerleşik girdilerden kurala uymayanlar (ör. GÜMRAH, KÖSELE, GURUP, KÜPEŞTE, KARAYEL "yel, rüzgâr") İçerik alanınca
  yeniden yazılır; anlam TDK'dan sapmaz, yalnız sadeleşir.
- Oyuncu blöfünde bu kısıtlar yoktur (100 karakter aynen); oyuncu da isterse noktalı virgül kullanabilir.

### SB-M7 · "Bu kelimeyi biliyordum" işareti ve bilinirlik istatistiği — **önerim: EVET**
**Ne:** Açılış ekranında küçük bir **"Bu kelimeyi önceden biliyordum"** düğmesi. Puana hiç etkisi yok; yalnız
havuzun hangi kelimelerinin fazla tanıdık olduğunu ölçer.
**Neden:** Sorun 3. Hangi kelimenin "yandığını" bugün bilmenin yolu yok.
**Ayrıntılar:**
- Düğme açılışın ilk 1,5 sn'sinden sonra etkin, oyuncu başına bir kez, geri alınabilir; anonim sayılır (kim bastığı
  kaydedilmez, kimseye gösterilmez).
- Havuz istatistiğine kelime başına iki sayı yazılır: kaç oyunda çıktı, kaç "biliyordum" geldi. Cevap metni, oyuncu
  adı, oda kodu saklanmaz.
- Yönetici panelinde (İçerik) kelime başına **bilinirlik %** sütunu. En az 10 oyunda çıkmış ve %40'ı aşan kelimenin
  çekiliş ağırlığı yarıya iner; %60'ı aşanı İçerik alanı kapatma önerisine koyar.
- Bu, üretim belgesindeki ALT-10 "istatistik" maddesinin bu oyuna düşen parçasıdır.

### SB-M8 · Yazmayan, gerçeği bulsa da puan alamasın — **önerim: İSTEĞE BAĞLI**
**Ne:** Sahte tanım göndermeyen oyuncu seçme aşamasında yine kart seçebilir ama **gerçeği bulma +1'ini almaz**.
**Neden:** Kural "yazmak zorunludur" diyor ama yazmamanın hiçbir karşılığı yok; yazmayan yalnız seçerek +1 toplayabiliyor
ve masaya blöf eklemediği için oyunu zayıflatıyor.
**Ayrıntılar:**
- Eksi yok; yalnız bir kazanç kapısı kapanır. Ekranda yazma süresinin son 10 sn'sinde "Yazmazsan gerçeği bulsan da puan
  alamazsın" uyarısı.
- Yazma sırasında bağlantısı kopup seçmede dönen oyuncu da bu kurala girer (ayırt etmek adil olmaz).
- Neden kesin EVET demiyorum: arkadaş grubunda yavaş yazan ya da telefonu geç açan cezalandırılmış hisseder;
  SB-U2'deki kalıp düğmeleri yazmayı zaten kolaylaştırıyor. Önce onu görmek isteyebilirsin.

### SB-M9 · İki kelime, iki tur — **önerim: HAYIR**
**Ne:** Oyun iki kelimeyle iki tur oynanır (her tur 40 sn yazma + 25 sn seçme).
**Neden önermiyorum:** Tanıdık kelime şansını yarıya indirirdi ama oyun ~2,5 dakikaya çıkar; Yazı Yaz ve Sızma'da
iki turu reddettin. SB-M2, SB-M6 ve SB-M7 aynı sorunu süre eklemeden çözüyor.

---

## 4. Arayüz ve his önerileri

### 4a. Ana ekranlar ve akış

### SB-U1 · Yazma ekranı: sözlük sayfası — **önerim: EVET** · 🎨 Görsel
**Ne:** Boş orta alan, açık bir **sözlük sayfasına** döner: üstte madde başı (kelime + SB-M3 türü), altında yazı alanı
sözlük satırı gibi: **"ŞAKUL** *isim* — ______". Yazdıkça alanın altında **"Kartta böyle görünecek:"** önizlemesi
(sunucunun uyguladığı biçimle: ilk harf küçük, sondaki nokta yok).
**Neden:** Sorun 9. Boşluk dolar, oyuncu tanımının kartlarda gerçek tanımla aynı biçime gireceğini görür ve "büyük
harfle başladım, ele verir mi" kaygısı kalkar.
**Ayrıntılar:**
- Önizleme yalnız yazan kişide; 100 karakter sayacı önizlemenin sağında, 90'dan sonra amber.
- Kalan süre plakanın sağ üstünde **sayıyla** (ör. "38"), son 10 sn'de amber, son 5 sn'de kırmızı (bugünkü çubuk kalır).
- Klavye açılınca (sıkışık kip) sayfa görseli gizlenir, yalnız madde başı + alan + Gönder kalır.
- 🎨 Gereken: sözlük sayfası dokusu (eski kâğıt, kenarda harf sekmesi); CSS degrade ile de yapılabilir.

### SB-U2 · Tanım kalıpları: tek dokunuşla başlangıç — **önerim: EVET**
**Ne:** Yazı alanının üstünde yatay kaydırılan 6 kalıp düğmesi: **"bir tür …"**, **"… için kullanılan"**, **"… olan
kimse"**, **"eskiden …"**, **"… yapan usta"**, **"… gibi olan"** (SB-M3 türüne göre değişir: sıfatta "… olan",
"… gibi"; fiilde "… -mek").
**Neden:** Sorun 9 ve yeni oyuncunun "ne yazacağım" donması. Sözlük dili taklit edilince blöfler daha inandırıcı olur.
**Ayrıntılar:**
- Dokununca kalıp alana eklenir ve imleç boşluğa konur; klavye açık kalır.
- Kalıplar sabit bir listedir (koddaki 12 kalıp, tür başına 6); yapay zekâ üretmez, oyuncunun yazısını tamamlamaz.
- Oyuncu bir şey yazmaya başlayınca düğmeler soluklaşır ama kaybolmaz.

### SB-U3 · Bekleme ekranı: "Sözlüğe işleniyor" — **önerim: EVET**
**Ne:** Gönderince tanımın **kart olarak** sayfadan kopup sağa doğru ters dönerek bir deste üstüne iner; destede o ana
kadar gönderilen kart sayısı kadar kart birikir (içerikleri görünmez). Altında "4/6 tanım geldi".
**Neden:** Sorun 10. Bekleyen biri destenin büyüdüğünü görür; kilit hissi "mühürlendi" olur.
**Ayrıntılar:**
- Destede kartlar sahipsiz ve sırasız; kimin göndermediği yalnız alttaki avatar şeridinde görünür (bugünkü gibi).
- Kendi tanımın destenin üstünde 2 sn okunur, sonra ters döner; basılı tutunca yeniden görünür.
- Herkes gönderince deste karılır (kısa karıştırma animasyonu) ve seçme ekranına geçilir.

### SB-U4 · Seçme ekranı: kendi kartın kenara, son kart görünür — **önerim: EVET**
**Ne:** Kendi kartın listeden çıkar ve başlığın altında tek satırlık **"Senin blöfün: …"** şeridine dönüşür. Seçilebilir
kartlar 1'den başlar. Listenin sonuna Tamam çubuğu kadar boşluk eklenir.
**Neden:** Sorun 11. 8 kişide görünen kart sayısı 6,5'ten 8'e çıkar, Tamam'ın altında saklanan kart kalmaz.
**Ayrıntılar:**
- Kart numaraları bütün oyuncularda aynı kalmak zorunda (masada "3 numara!" diye konuşuluyor). Bu yüzden kendi kartın
  listeden çıkarılsa da numaralar ortak sıradan gelir; senin listende bir numara atlanır (ör. 1, 2, 4, 5) ve şeritte
  "Senin blöfün (3)" yazar.
- Kart yazısı 16 px, satır aralığı biraz daralır; 8 kişide kart yüksekliği ~%15 azalır.
- Seçili kartın metni Tamam çubuğunun üstünde tek satır özet olarak durur: "Seçimin: 4 · yüksek dağlarda…".

### 4b. Açılış/sonuç anı ve gerilim

### SB-U5 · "Gerçek anlam…" en sona: mühürlü açılış — **önerim: EVET** · 🎨 Görsel · 🔊 Ses
**Ne:** Açılış sırası tersine döner: önce **sahte kartlar** azdan çoğa kandırana doğru tek tek çevrilir, en son kalan
iki-üç kart titrerken "**Gerçek anlam…**" yazısı ve kısa davul; gerçek kart **mühürle** damgalanır ("SÖZLÜKTE"), kartın
arkasından mavi-amber mürekkep yayılır (briefing görselindeki fikir).
**Neden:** Sorun 12. Oyunun en büyük sorusu sona kalır; "ben buna inanmıştım!" anı herkesin gözü önünde olur.
**Ayrıntılar:**
- Zamanlama 12 sn'ye sığar: sahte kart başına 1,0 sn (8 kişide en çok 8 sahte kart = 8 sn), "Gerçek anlam…" 1,5 sn, mühür 1 sn,
  özet 1,5 sn. Sonra kartlar bugünkü sıraya (gerçek üstte) kayar ve "Devam et" bekler.
- Her sahte kart çevrilince seçenlerin avatarları karta **uçar** ve kart "+n" kazanır; kimse seçmediyse kart
  soluklaşıp küçülür ("0").
- Hareketi azaltma açıkken çevirme ve uçuş yok; kartlar aynı sırayla 0,6 sn arayla belirir.
- 🎨 Gereken: "SÖZLÜKTE" mührü (yuvarlak, mürekkep izli), mürekkep sıçraması dokusu.
- 🔊 Gereken: kart çevirme, davul (kısa), mühür vuruşu, mürekkep.

### SB-U6 · Açılışta numaralar ve "senin seçimin" — **önerim: EVET**
**Ne:** Açılış kartlarında seçme ekranındaki **numara** sol üstte kalır; senin seçtiğin kartın kenarında **"Senin
seçimin"** şeridi.
**Neden:** Sorun 13.
**Ayrıntılar:** Gerçeği seçtiysen şerit yeşil ✓, sahte seçtiysen amber ve "Kandırıldın · Elif'in blöfü". İzleyici
için şerit yok.

### SB-U7 · Kandırılanlar isimle — **önerim: EVET**
**Ne:** Kartın altındaki 24 px avatarlar yerine **isim çipleri** (28 px avatar + kısa ad): "Kandırdığı: Mert, Ayşe".
Gerçek kartta "Bulanlar: Cihad, Zeynep".
**Neden:** Sorun 14.
**Ayrıntılar:** İsim 8 harften uzunsa kesilir ("Gülizar…"); 4 çipten fazlası iki satıra iner; kendi adın yerine "Sen".

### SB-U8 · Özel anlar: Blöf Ustası, Sözlük kazandı, Aynı blöf — **önerim: EVET** · 🎨 Görsel
**Ne:** Açılışın sonunda tek bir özel damga:
- **"BLÖF USTASI"**: en çok kişiyi kandıran (tekse) kartın üstünde altın tüy kalem.
- **"SÖZLÜK KAZANDI"**: gerçeği kimse bulamadıysa gerçek kartın üstünde.
- **"HERKES BİLDİ"**: herkes gerçeği bulduysa (kimse kandırılmadı).
- **"AYNI BLÖF!"**: SB-M4 ikiz kartında.
**Neden:** Sorun 15. Masada konuşulacak anı ekrana koyar.
**Ayrıntılar:** Birden çok koşul varsa öncelik: Sözlük kazandı > Blöf Ustası > Aynı blöf > Herkes bildi. Blöf Ustası
eşitse damga çıkmaz. 🎨 Gereken: altın tüy kalem rozeti (küçük, PNG).

### SB-U9 · Puan başlığı iki satır — **önerim: EVET**
**Ne:** Üstte büyük toplam yerine iki parçalı satır: **"Gerçeği buldun +1 · 2 kişiyi kandırdın +2"**, altında toplam
"blöf puanı 3" ve (SB-M1 ile) madalya rozeti "+2 genel".
**Neden:** Sorun 15; ayrıca SB-M1 ile oyun içi puan ve genel skor ayrılır.
**Ayrıntılar:** Puan almayan için tek satır: "Bu sefer olmadı · blöfün kimseyi kandırmadı". Madalya rozeti açılış dizisi
bitince belirir (puanı önden ele vermez).

### 4c. Telefon ergonomisi ve okunurluk

### SB-U10 · Küçük ekran ve yatay düzen — **önerim: EVET**
**Ne:** 360×640'ta ve yatayda kart listesi sıkışık kipe geçer: kart metni 15 px, kart iç boşluğu yarıya, numara rozeti
24 px. **Yatayda kartlar iki sütun**, Tamam sağ altta sabit.
**Neden:** Sorun 11 (360×640'ta 5 kart, yatayda 2,5 kart görünüyor).
**Ayrıntılar:** İki sütunda kartlar satır satır numaralanır (1-2 / 3-4); uzun tanım iki sütunda 3 satırı geçerse kart
yüksekliği satırdaki en uzuna eşitlenir.

### SB-U11 · Taslak kaybolmasın — **önerim: EVET**
**Ne:** Yazdığın taslak cihazda geçici olarak saklanır; sayfa yenilenir ya da bağlantı kısa koparsa alan aynı yazıyla
geri gelir.
**Neden:** Sorun 18.
**Ayrıntılar:** Yalnız o oyunun yazma aşaması boyunca tutulur, gönderince ve oyun bitince silinir; sunucuya gitmez.

### 4d. İzleyici, kopan oyuncu ve TV

### SB-U12 · TV ekranı: büyük kart duvarı — **önerim: EVET**
**Ne:** TV'ye özel görünüm. **Yazma:** ortada büyük kelime plakası ve tür, çevresinde oyuncuların tüy kalemleri; gönderen
kalem mühürlenir ("4/6"). **Seçme:** bütün kartlar iki sütunda büyük numaralarla (masa birlikte okuyup tartışır), Tamam
diyenlerin avatarları köşede. **Açılış:** SB-U5 dizisi tam ekran, kandırılanların avatarları kartlara uçar.
**Neden:** Sorun 17.
**Ayrıntılar:** TV'de hiçbir aşamada "Senin yazdığın" işareti, sahip bilgisi ya da kimin neyi seçtiği açılıştan önce
görünmez (yalnız ortak görünüm). Kart metni en az 34 px.

### SB-U13 · İzleyici de tahmin etsin (sayılmaz) — **önerim: İSTEĞE BAĞLI**
**Ne:** İzleyici seçme aşamasında bir karta dokunabilir; seçimi yalnız kendi ekranında durur, kimseye sayılmaz. Açılışta
"Sen de bulmuştun!" ya da "Sen de kandırıldın".
**Neden:** Sorun 16. Başlık "Gizli seçim" yerine "Sen de tahmin et (sayılmaz)" olur.
**Ayrıntılar:** Seçim sunucuya gitmez, oyuncuların hazır sayacına girmez. Neden İSTEĞE BAĞLI: izleyiciyi oyuna
katmak sana göre gereksiz olabilir; ama maliyeti çok düşük.

### SB-U14 · Kopan oyuncunun kartı — **önerim: EVET**
**Ne:** Yazma sırasında tanımını gönderip bağlantısı kopan oyuncunun kartı oyunda kalır (bugünkü gibi); açılışta isim
çipi soluk ve "bağlantı koptu" etiketli. Seçme sırasında kopanın seçimi geçerlidir; açılışta "seçimini yaptı" görünür.
**Neden:** Kopan oyuncunun puanının nereden geldiği şu an anlaşılmıyor.

### 4e. Ses, titreşim ve hareket

### SB-U15 · Sözlük ses seti — **önerim: EVET** · 🔊 Ses
**Ne:** Gönderince tüy kalem **çizgisi** ve sayfa kapanma sesi; seçme başlarken deste karıştırma; kart seçince hafif kâğıt
sesi; açılışta SB-U5'teki çevirme/davul/mühür; kandırıldığın kart açılınca kısa "boing" ve tek titreşim; Blöf Ustası'nda
kısa fanfar.
**Neden:** Bugün oyun genel "hazır/başla/eşleşme" seslerini kullanıyor; oyunun kendi kimliği yok.
**Ayrıntılar:** **Yazarken tuş sesi yok** (yazılan uzunluğu yandakine duyurur). Ses kimliği: kâğıt, mürekkep, tahta
masa. Titreşim: gönder (kısa), kandırıldın (iki kısa), Blöf Ustası (uzun).

### 4f. İlk kez oynayan için öğretme

### SB-U16 · Anlatım: doğru puan ve canlı örnek — **önerim: EVET**
**Ne:** Anlatım adımları: (1) "Garip kelimeye **inandırıcı** sahte bir anlam yaz", (2) "Karışık anlamlardan
**gerçeğini** seç: bulursan +1", (3) "Senin blöfünü seçen her kişi +1 kazandırır". Görselde 4 saniyelik döngü: ŞAKUL →
üç kart → biri mühürlenir, birine iki avatar uçar.
**Neden:** Sorun 8.
**Ayrıntılar:** SB-M1 onaylanırsa adım 3'e "En çok puanlayan +2" eki. SB-M5 onaylanırsa küçük not: "Küçük masada sözlük
de bir yem kart koyar".

### SB-U17 · İlk oyunda ipucu baloncuğu — **önerim: İSTEĞE BAĞLI**
**Ne:** Bu oyunu ilk kez oynayan cihazda yazma ekranında bir kez beliren baloncuk: "İpucu: gerçek tanımlar kısa ve
sade; sen de sözlük gibi yaz." Seçme ekranında bir kez: "Kendi kartını seçemezsin; gerçek olduğunu düşündüğüne dokun."
**Neden:** İlk oyunda en sık iki hata: cümle gibi uzun yazmak ve kendi kartına basmaya çalışmak.
**Ayrıntılar:** Cihaz başına bir kez (yerel ayar), 4 sn sonra ya da dokununca kapanır.

### 4g. Erişilebilirlik

### SB-U18 · Okunurluk ve ekran okuyucu — **önerim: EVET**
**Ne:**
- Seçili kart yalnız renk ve ✓ ile değil, sağda **"SEÇİLDİ"** yazısıyla da belli olur; gerçek kart yeşilin yanında
  mühür simgesi taşır (renk körü için).
- Kartlar ekran okuyucuda "Kart 4: yüksek dağlarda yaşayan…, seçilebilir"; kendi kartın "senin blöfün, seçilemez".
- Aşama değişiminde ekran okuyucuya tek cümle: "Seçim başladı, 8 kart"; açılışta "Gerçek anlam 3 numaraydı, 2 kişi
  buldu. Blöfün 1 kişiyi kandırdı."
- Sistemin büyük yazı ayarında kart metni 20 px'e kadar büyür, kartlar uzar (kesilmez).
**Neden:** Bugün seçili kart ile "Senin yazdığın" kart aynı renk ailesinde; açılış yalnız görsel.

---

## 5. Yapay zekâ (AI) ile yapılabilecekler

### SB-AI1 · Gerçeğe çok yakın blöf uyarısı — **önerim: İSTEĞE BAĞLI**
**Ne:** Gönder'e basınca blöf gerçek tanımla **anlamca neredeyse aynıysa** ("ip ucunda ağırlık olan, duvar ölçen alet")
oyuncuya yalnız kendisine "Bu gerçeğe çok yakın, başka bir şey yaz" denir ve alan açık kalır.
**Neden:** Bugün yalnız birebir aynısı reddediliyor; kelimeyi bilen biri yeniden yazınca masada iki "gerçek" kart
çıkıyor ve oyun bozuluyor.
**Ayrıntılar:**
- Modele yalnız kelime, gerçek tanım ve blöf metni gider; oyuncu adı gitmez. Puanı belirlemez, yalnız kartın kabulüne
  karar verir; yine de karar oyunu etkilediği için eylem olarak kayda yazılır.
- Cevap 1,5 sn'de gelmezse ya da API yoksa blöf bugünkü kuralla kabul edilir (oyun beklemez).
- Neden İSTEĞE BAĞLI: yanlış reddedilen oyuncu sinirlenir; değerlendirme seti (50 örnek, yanlış ret ≤ %2) olmadan açılmamalı.

### SB-AI2 · Sözlük spikeri — **önerim: İSTEĞE BAĞLI**
**Ne:** Açılışın sonunda tek cümlelik esprili yorum: "Oyuncu3 ŞAKUL'u 'denizcilerin atkısı' sandı; üç kişi o atkıya
sarıldı." Ortak yorum altyapısıyla (API yoksa görünmez, oyun beklemez, yasaklı kelime süzgeci).
**Ayrıntılar:** Modele kelime, kartlar, kimin kimi kandırdığı ("Oyuncu1…N" olarak) gider; yorum adlar ekranda yerine
konarak gösterilir, saklanmaz.

### SB-AI3 · Canlı yapay zekâ blöfü — **önerim: HAYIR**
**Ne:** Küçük masada yapay zekâ anlık sahte tanım yazar.
**Neden önermiyorum:** SB-M5 aynı işi İçerik alanının önceden yazdığı, senin onayladığın yemlerle, gecikmesiz ve
maliyetsiz yapıyor; canlı üretimde uygunsuz ya da gerçeğe fazla yakın yem riski var.

---

## 6. İçerik ve üretim ekibine düşen işler

**İçerik alanı (İçerik Havuzu yapay zekâsı, senin onayınla):**
- SB-M3: 87 girdinin **türünü** doldurmak (isim/sıfat/fiil/zarf); yeni girdilerde zorunlu.
- SB-M5: her girdiye **1–2 yem tanımı** (gerçekle aynı biçim kuralı, gerçeğe anlamca yakın olmayan, inandırıcı).
- SB-M6: kurala uymayan gerçek tanımları sadeleştirmek (noktalı virgül, ikinci anlam, 70 karakter üstü).
- Havuzu büyütmek: hedef **250+** girdi; tanıdık kelimeleri (bölüm 2, sorun 3'teki liste) **kapatma önerisi**.
- SB-M7 istatistiği gelince: bilinirliği %60'ı aşanları kapatma, %40–60 arasını "kolay" etiketlemek.
- Kod isteği (yönetici yapar): havuz formunda seçim türü alan (Tür), isteğe bağlı çoklu alan (Yem), istatistik sütunu.

**Ses alanı:** SB-U5 (kart çevirme, kısa davul, mühür, mürekkep), SB-U15 (tüy kalem, sayfa kapanma, deste karıştırma,
kâğıt dokunuşu, "boing", kısa fanfar). Ses kimliği: kâğıt, mürekkep, tahta.

**Görsel (ChatGPT görev akışı):** SB-U1 sözlük sayfası dokusu, SB-U5 "SÖZLÜKTE" mührü ve mürekkep sıçraması, SB-U8 altın
tüy kalem rozeti.

**Müzik alanı:** isteğe bağlı oyun teması (sakin, kütüphane havası); şart değil.

---

## 7. Önerilen paket

**EVET:** SB-M1, SB-M2, SB-M3, SB-M4, SB-M5, SB-M6, SB-M7; SB-U1 … SB-U12, SB-U14, SB-U15, SB-U16, SB-U18.

**İSTEĞE BAĞLI:** SB-M8 (yazmayana gerçeği bulma puanı yok), SB-U13 (izleyici tahmini), SB-U17 (ilk oyun baloncuğu),
SB-AI1 (yakın blöf uyarısı), SB-AI2 (spiker).

**HAYIR:** SB-M9 (iki tur), SB-AI3 (canlı yapay zekâ blöfü).

Bu paketle oyun şöyle akar: sözlük sayfası açılır, "ŞAKUL *isim*" → kalıp düğmesiyle başlayıp tanımını yazarsın,
kartta nasıl görüneceğini canlı görürsün → kartın desteye uçar, deste büyür → seçmede kendi kartın kenarda, 8 kart
birden görünür; 3 kişilik masada bir de sözlüğün yemi vardır → açılışta sahte kartlar tek tek döner, kandırılanlar
isimleriyle kartlara uçar, en son "Gerçek anlam…" ve mühür → "Gerçeği buldun +1 · 2 kişiyi kandırdın +2", Blöf Ustası
damgası, genel skora +2 / +1 / 0.

**Değişen kurallar (paket onaylanırsa):** genel skora blöf puanı yerine sıralama ödülü (+2 / +1 / 0) gider; aynı odada
son 40 oyunda çıkan kelime gelmez (süzgeç yerleşik havuza da uygulanır); kelimenin türü gösterilir; klavyeden bağımsız
aynı iki blöf tek kart olur ve seçimde iki yazar da puan alır; 3–4 kişide havuzdan bir yem kart eklenir (seçen 0);
gerçek tanımlar tek cümle ve en çok 70 karakter. `docs/KURALLAR.md`, wiki ve testler buna göre güncellenir.

**Değişmeyenler:** 3–8 oyuncu, tek kelime, 50 sn yazma + 30 sn seçme + en az 12 sn açılış, 100 karakter sınırı,
tek seferlik gönderim, kendi kartını seçememe, gerçeğin birebir aynısının reddi, puan kalemleri (gerçeği bulmak +1, seni
seçen her kişi +1), eksi puan yok, kart sırasının herkes için aynı olması, 250 ms geç eylem payı, erken bitiş kuralları.

**🎨 Yeni görsel gerekenler (paket):** sözlük sayfası dokusu (SB-U1; CSS ile de olur), "SÖZLÜKTE" mührü ve mürekkep
sıçraması (SB-U5), altın tüy kalem rozeti (SB-U8).
