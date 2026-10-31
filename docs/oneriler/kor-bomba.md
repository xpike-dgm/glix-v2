# Kör Bomba — geliştirme önerileri

Bu dosya onay içindir. Her maddenin bir kodu var (ör. **BM-M2**; **BM** = Kör **B**o**m**ba; "KB" Kara Borsa'da
kullanıldığı için). Cevabını tek satırda verebilirsin:

> BM-M1 evet, BM-M2 hayır, BM-U3 evet …

ya da yalnız **"önerilen paket evet"** dersen sondaki paket uygulanır. Her maddenin "ayrıntılar" bölümü onaylarsan
nasıl yapılacağını kesinleştirir; ek soru sormam gerekmez. Beğenmediğin ayrıntı varsa yalnız onu yaz.

Not: Oyunun kendi sonuç ekranı zaten herkes **"Devam et"** deyince geçiyor (en çok 60 sn); burada yeniden önerilmedi.
Yeni görsel gerektiren maddeler **🎨 Görsel**, ses alanına iş açan maddeler **🔊 Ses** diye işaretli.

---

## 1. Bugünkü oyun (özet)

- 2–8 oyuncu, **yatay** ekran: ortada elips bir masa, çevresinde oyuncuların koltukları (sen altta), masanın
  ortasından her koltuğa kablo.
- Bomba **rastgele bir bağlı oyuncuda** başlar. Fitil ilk verilişten **15–20 sn** sonra patlar.
- **Taşıyan** süreyi görmez: ekranında siyah çekirdekli bir bomba ve "PAS VER" yazar; koltuklardan birine dokunup
  **istediği an, sınırsız** pas verir (kendine ve bağlı olmayana veremez).
- **Diğerleri** bombanın üstünde gerçek kalan süreyi görür ("9,1") ve sözle kandırır ya da ikna eder. Son 5 sn'de
  bomba onların ekranında kırmızılaşıp hızlı nabız atar.
- Her pas fitile **rastgele 1–4 sn** ekler (yalnız süreyi görenlerde "+2,5" kıvılcımı).
- Taşımayanlar **her el için** gizlice "Patlar" ya da "Patlamaz" der; el başına bir kez, değiştirilemez. Bomba o elde
  patlarsa "Patlar" diyenler **+1** (oyun başına en çok +1). Pas olunca her tahminci yalnız kendi sonucunu görür.
- Bomba kimin elinde patlarsa **−1**, diğerleri 0 (bu oyunda eksi oyunun özü; sahip kararı). Patlamadan 2 sn sonra oyunun
  son ekranı ("Devam et").

## 2. Gördüğüm sorunlar

**Oyun tasarımı**
1. **"Sıcak patates" oyunu bitmeyebilir.** Bombayı alan için en güvenli hamle hemen pas vermek. Her pas fitile
   ortalama 2,5 sn eklerken bir pas 0,5 sn bile sürmüyor; iki oyuncu bombayı birbirine hızla atarsa fitil kısalmaz,
   **uzar**. Oyunun süre üst sınırı yok (wiki de "sınırsız pas" diyor). Sözle kandırma, oyunun özü olan "tut mu,
   ver mi" kararı devre dışı kalıyor.
2. **"Patlar" tahmini bedava; tahmin karar değil, alışkanlık.** Yanlış "Patlar" hiçbir şey kaybettirmiyor, her elde
   yeniden verilebiliyor. Taşımayan herkesin en iyi hamlesi her elde gözü kapalı "Patlar"a basmak; böylece patlamada
   taşıyıcı dışındaki herkes +1 alabiliyor. "Patlamaz" düğmesinin ise hiçbir getirisi yok.
3. **Süre komşunun ekranında yazıyor.** Masada yan yana oturuluyor; taşıyıcının yanındaki oyuncunun telefonunda bomba
   üstünde iri rakamlarla kalan süre, son 5 sn'de de kırmızı hızlı nabız var. Taşıyıcı bir bakışla "kör"lükten
   kurtuluyor. (Sızma'da aynı sorun için gözetleme korumasını onayladın ve uygulandı.)
4. **Patlama anı sunucuda 100 ms'lik adımlarla fark ediliyor.** Fitil bitiminden sonra gelen pas doğru reddediliyor,
   ama patlama yayını bir sonraki sunucu adımını bekliyor: süreyi görenlerde sayaç "0,0"da asılı kalıp patlama bir an
   sonra geliyor. Oyunun en büyük anı hafif "takılıyor".
5. **Kalabalık masada çoğu kişi bombaya hiç dokunmuyor.** 8 kişide bomba 3–4 kişi arasında gidip geliyor; kalanların
   tek işi (sorun 2'deki) bedava tahmin düğmesi.

**Arayüz** (ekran görüntülerine bakarak: 844×390, 640×360, 390×844)
6. **"PAS VER" yazısı masanın üst koltuklarına biniyor.** Dev yazı masanın üst kenarında, 6 ve 8 kişide üstteki
   koltuğun adı ("Zeynep", "Kaan") yazının hemen üstünde sıkışıyor. Hangi koltuklara verebileceğin ayrıca
   işaretlenmiyor.
7. **Tahmin satırı bağlamsız.** Sol altta iki küçük düğme "Patlar / Patlamaz"; soru ("Bu elde patlar mı?") yalnız
   ekran okuyucuya açık, görünmüyor. Kimin elinden söz edildiği yazmıyor. Seçince küçük "Tahminin alındı" kutusu.
8. **Patlama sonucu söylenmiyor.** Patlamada taşıyıcının avatarı beyaz silüete dönüyor, ama "kimde patladı, kaç puan"
   yazısı yok; "−1" hiçbir yerde görünmüyor. "Bildin!" bildirimi üstteki koltuğun avatarının üstüne biniyor; "Mert ve
   Sen bildi!" kutusu en çok iki ad gösteriyor (üçüncü ve sonrası yazılmıyor).
9. **Pas geçmişi ve el sayısı yok.** Kim kime kaç kez attı, şimdi kaçıncı el, ekranda iz bırakmıyor; sonrasında
   konuşulacak "bombanın yolculuğu" kayboluyor.
10. **Süreyi görenlerde rakam küçük.** "9,1" bombanın üstünde ~22 px; bomba taşıyıcının koltuğuna yakın durduğu için
    kalabalık masada koltuk ve kablolarla iç içe.
11. **640×360'ta kenarlar sıkışık.** Alttaki "Sen / Cihad" koltuğu ekranın kenarına dayanıyor; "Elif" adı
    "Patlar" düğmesinin hemen üstünde.
12. **Dikeyde yalnız "Telefonunu yan çevir".** Konuşma oyunu; masada çoğu kişi telefonu dikey tutuyor. Bu karar
    bilinçli, ama oyunun ortasında telefonu çevirmek pas anını kaçırtabiliyor.
13. **TV ve izleyici için gerilim yok.** Süre (doğru olarak) gizli; ama yerine konan hiçbir şey yok: kimde, kaçıncı
    pas, kim ne kadar tuttu görünmüyor. TV'de telefon ekranı büyütülüyor.
14. **Renk ve hareket.** Taşıyıcı yalnız kırmızı halkayla, aciliyet yalnız renk ve hızlanan nabızla anlatılıyor.

---

## 3. Oyunu değiştiren öneriler (mekanik)

### BM-M1 · Fitil tutuşuyor: alınca 1,5 sn kilit, hemen geri pas yok — **önerim: EVET**
**Ne:** Bombayı alan **1,5 sn boyunca pas veremez** ("Fitil tutuşuyor…"). Ayrıca bombayı **sana az önce atana hemen
geri atamazsın** (3+ bağlı oyuncuda).
**Neden:** Sorun 1. Bomba eline geçince en az bir nefes tutmak zorundasın; o 1,5 sn masada "ver! verme!" çığlıklarının
anıdır. Geri pas yasağı iki kişinin top çevirmesini bitirir (Zaman Bombası'nda onayladığın "hemen geri atamaz"
kuralının aynısı).
**Ayrıntılar:**
- Kilit sunucuda: bombayı aldığın andan 1500 ms geçmeden gelen pas reddedilir (bomba sende kalır, hata titreşimi).
  Oyunun başındaki ilk taşıyıcı için de 1,5 sn kilit var.
- Geri pas yasağı yalnız **bir el** için: sana atan kişi, senden sonraki elde yine seçilebilir.
- Sana atan dışında bağlı kimse yoksa (diğerleri kopuk) geri pas serbest.
- 2 oyuncuda geri pas yasağı yok (tek seçenek); yalnız 1,5 sn kilit.
- Kilit süre değildir, fitil işlemeye devam eder; kilitteyken patlarsa bomba sende patlar.

### BM-M2 · Azalan ek süre ve kesin tavan — **önerim: EVET**
**Ne:** Pasın fitile eklediği süre pas sayısı arttıkça azalır; fitil hiçbir durumda oyunun başından **45 sn**'yi
geçemez.
**Neden:** Sorun 1. Oyunun bitmesi garanti olur; geç ellerde bomba gerçekten "kızar", pas vermek artık süre kazandırmaz.
**Ayrıntılar:**
- 1.–3. pas: rastgele **1–4 sn** (bugünkü gibi). 4.–6. pas: rastgele **0,5–2 sn**. 7. pas ve sonrası: **0 sn**.
- BM-M1 ile her el en az 1,5 sn sürdüğü için 4. pastan sonra fitil artık uzamaz, kısalır. En uzun olası oyun:
  20 + 3×4 + 3×2 = 38 sn; 45 sn tavanı yalnız güvenlik sınırıdır.
- Eklenen süre yine yalnız süreyi görenlerde kıvılcım olarak görünür ("+0,8"); 0 eklenince kıvılcım çıkmaz (süreyi
  görenler bunu anlar, taşıyıcı anlamaz).
- Taşıyıcı hiçbir şey görmez (bugünkü kural).

### BM-M3 · Tek kurşun: oyunda bir kez "PATLAR!" — **önerim: EVET**
**Ne:** "Patlar / Patlamaz" düğmeleri yerine her taşımayan oyuncunun oyun boyunca **tek bir "PATLAR!" hakkı** olur.
Basınca bahis **o anki taşıyıcının eline** bağlanır. Bomba o elde patlarsa **+1**; pas olursa bahis **yanar**, hak geri
gelmez. Ayrıca bahis **fitilde en az 3 sn varken** verilmelidir.
**Neden:** Sorun 2. Bahis bedava alışkanlık olmaktan çıkar, gerçek karar olur: erken bahis riskli (taşıyıcı pas
verebilir), geç bahis yasak. Bahis yapan da bombanın o elde kalmasını ister: "Tut, daha çok var!" yalanının yeni bir
nedeni olur. Blöf güçlenir.
**Ayrıntılar:**
- 3 sn kuralı sunucuda: bahsin sunucuya ulaştığı anda fitilde 3000 ms'den az kaldıysa bahis **kabul edilmez ve hak
  yanmaz**; oyuncunun ekranında "Çok geç — son 3 sn'de bahis yok" yazar. Bahis düğmesi zamana göre **görünüp
  kaybolmaz** (O9'daki "düğmeler süreye bağlı değil" kuralı ekranda korunur); bu sınırı yalnız zaten süreyi gören
  oyuncu bilir. Bu yüzden düğme hiçbir telefonda süre hakkında yeni bilgi vermez.
- Bahis gizli: kimin bahis yaptığı, hakkını kullanıp kullanmadığı patlamaya kadar kimseye açılmaz; taşıyıcı hiç
  görmez. Patlamada kazananların adları herkese açılır (bugünkü gibi), bahsi yananlar açılmaz.
- Bombayı taşırken bahis verilemez; hakkını kullanmadıysan pas verdikten sonra kullanabilirsin.
- Ödül aynı: doğru bahis +1, oyun başına en çok +1; yanlış bahis 0 (eksi yok). Taşıyıcı −1 aynen.
- 2 oyuncuda tek taşımayan oyuncu bahis yapabilir; kural aynı.
- Anlatım 3. adımı: "Pas ver, süreyi uzat; patlayan −1. Bir kez 'PATLAR!' de: o elde patlarsa +1."

### BM-M4 · Kılpayı: son anda kurtulana +1 — **önerim: İSTEĞE BAĞLI**
**Ne:** Fitilde **2 sn ya da daha az** kalmışken pas veren, bomba **bir sonraki elde** patlarsa **+1** alır; ekranda
"KILPAYI!".
**Neden:** "Son saniyede kurtuldum!" oyunun en çok konuşulan anı; bugün puan karşılığı yok. Taşıyıcıya da bir hedef
verir: yalnız kurtulmak değil, doğru anda kurtulmak. Taşıyıcı süreyi görmediği için bu, masadakilerin sözlerine ne
kadar güvendiğine bağlı kalır.
**Ayrıntılar:**
- "2 sn kaldı" ölçümü pas anında, eklenen süreden önceki kalan süreyle yapılır.
- Bir oyuncu bu oyunda en çok **+1** alabilir (bahis ve kılpayı toplamı +1'i geçmez).
- Kılpayı alanın adı patlamada herkese açılır ("Kaan kılpayı kurtuldu!").
- **Neden isteğe bağlı:** O9'da "+ puan yalnız tahmine" kararını verdin; bu ikinci bir artı kapı açar. BM-M1–M3 oyunu
  zaten düzeltiyor; bu tat katar, zorunlu değil.

### BM-M5 · Bombayı yokla: taşıyıcıya tek bakış — **önerim: İSTEĞE BAĞLI** · 🎨 Görsel
**Ne:** Her oyuncunun oyun boyunca **bir kez** "yoklama" hakkı vardır: bomba sendeyken bombaya **basılı tutarsın**,
1 sn boyunca bomba sana ısısını gösterir: **Soğuk** (8 sn'den fazla), **Ilık** (3–8 sn), **KIZGIN** (3 sn'den az).
Masadaki herkesin ekranında "Mert bombayı yokladı!" yazar (sonucu değil, yalnız yokladığını).
**Neden:** Taşıyıcının tek dayanağı başkalarının sözü; tek bir "kendim bakayım" hakkı yeni bir blöf katmanı açar:
"Yokladı, demek ki şüpheleniyor" / "Yoklamasına rağmen tuttu, ılıkmış". Kalabalık masada taşıyıcının da bir hamlesi
olur.
**Ayrıntılar:**
- Yoklama sırasında pas verilemez (1 sn); fitil işler.
- Sonuç yalnız taşıyıcının ekranında, büyük renk + **kelimeyle** (renk körü için); süre rakamı asla görünmez.
- Hakkı kullandığın herkese açıktır; "Soğuk/Ilık/Kızgın" kimseye açılmaz.
- Eşikler BM-M2'den bağımsız sabit (8 ve 3 sn).
- 🎨 Gereken: bombanın "kızgın" ısı katmanı (turuncu-kırmızı çatlak ışığı); soğuk/ılık CSS renk tonuyla yapılır.
- **Neden isteğe bağlı:** KURALLAR'daki "taşıyıcı süreyi göremez" kuralını kısmen esnetir. Oyunun en saf hâli
  "tamamen kör"; bunu sen seçmelisin.

### BM-M6 · Geri çevir — **önerim: HAYIR**
**Ne:** Herkesin bir kez, bomba kendisine gelince 1 sn içinde "GERİ ÇEVİR" ile bombayı atana geri yollama hakkı.
**Neden önermiyorum:** Refleks anı eğlenceli ama BM-M1'deki "hemen geri yok" kuralıyla çelişir ve sıcak patatesi geri
getirir. Bir de oyuna konuşmadan çözülen bir hamle ekler; bu oyunun gücü konuşmada.

### BM-M7 · Kopan taşıyıcıdan bomba kendiliğinden geçsin — **önerim: HAYIR**
**Ne:** Taşıyıcının bağlantısı 3 sn'den uzun koparsa bomba rastgele bağlı birine geçer.
**Neden önermiyorum:** Uygulamayı kapatmak bombadan kaçış yolu olur ("bağlantım koptu!"). Bugünkü kural (bomba
kopukta kalır, fitil işler, patlarsa −1) hile kapısı açmıyor ve masada herkes durumu görüyor. Bunun yerine kopma
durumunu açıkça göstermeyi öneriyorum (BM-U13).

### BM-M8 · Eksiyi kaldır, sıralamaya çevir — **önerim: HAYIR**
**Ne:** −1 yerine sıralama (+2 / +1 / 0) gibi diğer oyunlardaki düzen.
**Neden önermiyorum:** Bu oyunda "bomba sende patlarsa kaybedersin" cezası oyunun kendisi; kurallarda açıkça
"−1, bu oyunda + puan yok" dedin, sonra O9 ile yalnız tahmine +1 ekledin. Eksi kalmalı. Yazılı dursun diye ekledim.

---

## 4. Arayüz ve his önerileri

### 4a. Ana ekranlar ve akış

### BM-U1 · Gözetleme koruması: süre basılı tutunca görünür — **önerim: EVET**
- Süreyi gören oyuncunun ekranında bomba, **taşıyıcınınkiyle aynı görünür**: siyah çekirdek, sabit hızda kırmızı
  nabız, rakam yok (sorun 3). Uzaktan bakan, kimin telefonunun süre gösterdiğini bile ayırt edemez.
- Süreyi görmek için bombaya ya da sağ alttaki **"SÜREYE BAK"** alanına **basılı tutulur**; parmak durdukça rakam iri
  (bkz. BM-U7), bırakınca 0,15 sn'de söner. Son 5 sn kırmızılığı ve hızlı nabız da yalnız bakarken görünür.
- Eklenen süre kıvılcımı ("+2,5") da yalnız bakarken görünür; bakmıyorsan bir sonraki bakışta 1 sn gösterilir.
- Her elin ilk anında kendiliğinden açılmaz (komşu tam o an bakıyor olabilir).
- İzleyici ve TV'de süre zaten yok; değişmez.

### BM-U2 · Taşıyıcı ekranı — **önerim: EVET**
- Dev "PAS VER" yazısı masanın üstünden kalkar (sorun 6); yerine ekranın altında, kendi koltuğunun üstünde kalın bir
  bant: **"BOMBA SENDE — birine dokun"**.
- Pas verilebilen koltuklar nabız atan halka ve parmak simgesiyle; verilemeyenler soluk ve küçük simgeyle: kopuk
  (fiş), az önce atan (BM-M1, ↩ çarpı).
- Koltuk dokunma alanı en az 64 px (avatar 56 px + ad); 8 kişide de.
- BM-M1 kilidi: bombayı alınca bandın içinde 1,5 sn'de dolan fitil çizgisi ve **"Fitil tutuşuyor…"**; dolunca bant
  parlar, koltuklar açılır, kısa "çıt".
- Taşıyıcının bombası tüm oyun boyunca **aynı hızda** atar; hiçbir şey zamana göre değişmez.

### BM-U3 · El sayacı ve pas zinciri — **önerim: EVET**
- Masanın üstünde ortada küçük çip: **"4. el · Mert'te"**.
- Altında son 4 pas küçük avatar zinciri: Elif → Kaan → Elif → Mert. Herkese açık bilgi (bugün de herkes pasları
  görüyor, yalnız iz kalmıyor) (sorun 9).
- Pas anında zincire yeni avatar kayarak eklenir.

### BM-U4 · Bahis düğmesi — **önerim: EVET**
- BM-M3 ile: sol altta tek, büyük (en az 56 px) **"PATLAR!"** düğmesi; üstünde görünür soru **"Mert'in elinde
  patlar mı?"** ve küçük **"Tek hakkın"** (sorun 7).
- Basınca düğme kilitlenir, yerinde çip: **"Bahsin: Mert'in eli"**. Pas olursa çip sessizce "Bahsin yandı" olur.
- 3 sn kuralına takılırsa (BM-M3): düğme sallanır, "Çok geç" yazar, hak durur.
- BM-M3 onaylanmazsa: bugünkü iki düğme kalır ama soru görünür olur ("Mert'in elinde patlar mı?"), "Tahminin alındı"
  yerine seçilen düğme dolu kalır.

### 4b. Açılış/sonuç anı ve gerilim

### BM-U5 · Patlama anı — **önerim: EVET** · 🔊 Ses
- **Taşıyıcının telefonu:** beyaz flaş, en güçlü titreşim, tam ekran **"BOMBA SENDE PATLADI · −1"** damgası.
- **Diğerleri:** kamera patlayan koltuğa yakınlaşır (0,4 sn yavaş çekim), koltuğun üstünde **"ELİF'TE PATLADI! −1"**,
  şok dalgası masaya yayılır; kazanan bahisçiler ve kılpayı (BM-M4) aynı anda küçük rozetlerle koltuklarında belirir.
- Bildirimler (Bildin!/Bilemedin) üstteki koltuğa binmez; kendi koltuğunun hemen üstünde çıkar (sorun 8).
- "Bildi" yazısı bütün adları yazar (3+ ise "Elif, Mert ve Kaan bildi"; 5+ ise "5 kişi bildi" ve koltuklarda rozet).
- **Patlama anı tam vaktinde:** sunucu patlamayı 100 ms'lik adımı beklemeden fitilin bittiği anda işler ve yayınlar
  (sorun 4); süreyi görenlerde "0,0" ile patlama aynı kareye düşer. Puan ve pas kuralı değişmez.

### BM-U6 · Son açılış: bombanın yolculuğu — **önerim: EVET**
Patlamanın 2 sn'lik gösterisinden sonra açılan "Devam et"li ekranda:
- Soldan sağa **yolculuk şeridi**: her el bir kutu — taşıyanın avatarı, elinde kaç saniye tuttuğu ("3,4 sn"), kutular
  arasında ok. Son kutu patlama.
- Altında fitil hesabı ilk kez herkese açılır: **"Fitil 17,3 sn başladı · paslar +2,1 +3,4 +0,8 · toplam 23,6 sn"**.
- **"En uzun tutan: Kaan 6,2 sn"**, **"En hızlı kurtulan: Elif 1,6 sn"**.
- Bahis ve kılpayı sonuçları: "PATLAR! diyip bilenler: Elif, Mert (+1)".
- Gerekli veri: sunucu pas anlarını ve eklenen süreleri yalnız **patlamadan sonra** herkese açık sonuca ekler (öncesinde
  hiçbir yerde yok; gizlilik testleri buna göre genişler).

### BM-U7 · Son saniyeler (yalnız bakan oyuncuda) — **önerim: EVET**
- BM-U1 ile bakarken: rakam bugünkü ~22 px yerine bombanın tamamını kaplar (≥ 48 px), son 5 sn'de kırmızı, son 3 sn'de
  bomba titrer, son 1 sn'de ondalık iki haneye geçer ("0,47").
- **Ses ve titreşim yok:** süreyi görenlerin telefonu son saniyelerde ses ya da titreşim çıkarmaz (telefon sesi masada
  duyulur; taşıyıcıya ipucu olur).
- Taşıyıcının ekranı hiç değişmez.

### 4c. Telefon ergonomisi ve okunurluk

### BM-U8 · Yatay ve küçük ekran düzeni — **önerim: EVET**
- Masa elipsi oyuncu sayısına göre küçülür, koltuklar 8 kişide 48 px; alttaki kendi koltuğun kenardan en az 12 px
  içeride (640×360'ta bugün dayanıyor) (sorun 11).
- Bahis düğmesi ve "Devam et" köşelerde, koltukların yolunun dışında; köşe ile en yakın koltuk adı arasında en az
  8 px.
- Bomba, taşıyıcının koltuğu ile masa merkezi arasında kalır ama koltuğa binmez (8 kişide merkeze %10 daha yakın).
- Uzun adlar koltuk altında 8 harfte "…" ile kesilir.

### BM-U9 · Dikey ekranda oynanabilsin — **önerim: İSTEĞE BAĞLI**
- "Telefonunu yan çevir" örtüsü yerine dikeyde **dikey elips masa**: koltuklar üstten alta iki sütun, bomba ortada,
  bahis düğmesi altta.
- Yatay düzen aynen kalır; telefon hangi yöndeyse o düzen.
- **Neden isteğe bağlı:** oyunun yönü çerçevede sabit ("yatay oyun"); dikeyi açmak çerçeve işidir ve diğer yatay
  oyunları da ilgilendirir. Konuşma oyunu olduğu için faydası büyük, işi de büyük.

### 4d. İzleyici, kopan oyuncu ve TV

### BM-U10 · İzleyici: "Kimde patlar?" oyunu — **önerim: EVET**
- İzleyici masayı, BM-U3 zincirini görür (süre ve bahisler yok, bugünkü gibi).
- Ekranın altında soluk **"Kimde patlar? Bir koltuğa dokun"**: izleyici bir oyuncu seçer; seçimi yalnız kendi
  telefonunda durur, sunucuya gitmez, puana karışmaz. İstediği kadar değiştirir.
- Patlamada yalnız onun ekranında "Tahminin tuttu!" ya da "Bu sefer olmadı".
- Maç sırasında gelen izleyici oyunun içine çekilir; masadakilere hiçbir bilgi sızmaz.

### BM-U11 · TV ekranı — **önerim: EVET** · 🎨 Görsel
- TV'ye özel masa: büyük elips, koltuklar 120 px, adlar büyük; bomba koltuktan koltuğa kablo üzerinden uçar.
- Üstte BM-U3 çipi büyük: "4. el · Mert'te" ve pas zinciri.
- **Süre, bahis, kıvılcım yok** (TV'yi taşıyıcı da görür). Gerilim taşıyıcının koltuğundaki halkayla ve "KİM TUTACAK?"
  yazısıyla verilir; bu halka zamana göre değişmez.
- Patlama TV'de tam ekran (şok dalgası, ses), ardından BM-U6 yolculuk şeridi TV genişliğinde.
- 🎨 Gereken: TV oranında masa/sığınak zemini (mevcut arka plan kadrajlanabilirse gerekmez).

### BM-U12 · Kopan ve geri dönen oyuncu — **önerim: EVET**
- Taşıyıcı koparsa herkese bant: **"Mert koptu — bomba onda!"** (bugün yalnız avatar soluyor).
- Kopuk koltuk gri, fiş simgeli, pas verilemez.
- Taşıyıcı dönerse: güçlü titreşim, tam ekran 1 sn **"BOMBA HÂLÂ SENDE!"**; BM-M1 kilidi dönüşte yeniden başlamaz.
- Bahis yapmış oyuncu koparsa bahsi geçerli kalır.

### 4e. Ses, titreşim ve hareket

### BM-U13 · Bomba ses seti — **önerim: EVET** · 🔊 Ses
- **Kural: hiçbir telefonda süreye bağlı ses yok** (masada her telefon duyulur).
- Taşıyıcı: sabit tempoda alçak fitil cızırtısı döngüsü (zamanla hızlanmaz).
- Pas atma: "vuuş"; bombayı alma: tok "tak" + kıvılcım çıtırtısı; BM-M1 kilidi bitince kısa "çıt".
- Ek süre kıvılcımı: yalnız bakan oyuncuda ve sessiz (BM-U1).
- Patlama: derin bas gümbürtü + cam/metal döküntü kuyruğu (≤ 2 sn).
- Kazanan bahis: zil; KILPAYI (BM-M4): yükselen "vuuuş!"; "Bombayı yokladı" (BM-M5): kısa metal tıkırtı herkeste.
- Bahis basışı: yalnız kendi telefonunda çok kısık "çıt" (yanındaki duymasın).

### BM-U14 · Titreşim — **önerim: EVET**
- Bombayı alınca güçlü çift vuruş; taşıyıcı tutarken hiçbir titreşim (zamana bağlı olmasın).
- Patlamada taşıyıcıya uzun desen (bugünkü alarm deseni), diğerlerine tek kısa.
- Süreyi görenlere asla süreye bağlı titreşim yok (BM-U7).
- Titreşimsiz telefonda bombayı alma anında ekran kenarı kırmızı bir kez parlar.

### 4f. İlk kez oynayan için öğretme

### BM-U15 · Anlatım: iki ekran yan yana — **önerim: EVET** · 🎨 Görsel
- Anlatım görseli iki telefon yan yana: solda **"Taşıyan"** (siyah bomba, rakam yok), sağda **"Diğerleri"** (bomba
  üstünde süre, parmakla basılı). Altında tek satır: **"Süreni taşıyana gösterme!"**.
- Maddeler (paketle): 1. "Bomba rastgele birinde başlar; alınca 1,5 sn tutmak zorundasın" 2. "Taşıyan süreyi görmez;
  diğerleri basılı tutup bakar, kandırır ya da ikna eder" 3. "Patlayan −1. Bir kez 'PATLAR!' de: o elde patlarsa +1".
- Oyunun ilk 2 sn'sinde rolüne göre ipucu bandı: taşıyana "Süreyi göremezsin — sor, ama herkese inanma!", diğerlerine
  "Süreyi görmek için bombaya basılı tut".
- 🎨 Gereken: anlatım için iki telefon kompozisyonu (mevcut bomba görselleriyle hazırlanabilir; yeni karakter gerekmez).

### 4g. Erişilebilirlik

### BM-U16 · Renk körü dostu masa — **önerim: EVET**
- Taşıyıcının koltuğunda kırmızı halkanın yanında **bomba simgesi rozeti**.
- Pas kablosu yanınca yalnız renk değil kalınlık da artar (2 → 5 px) ve ok ucu belirir.
- Son saniyeler (bakan oyuncuda) yalnız kırmızı değil, rakam büyür ve "!" işareti çıkar.
- Bahis sonucu ✓ / ✕ işaretiyle; "Soğuk / Ilık / KIZGIN" (BM-M5) her zaman kelimeyle.

### BM-U17 · Hareket azaltma, yazı boyutu ve ekran okuyucu — **önerim: EVET**
- Hareket azaltma: pas kıvılcımı uçmaz, bomba yeni koltuğa 0,2 sn solarak geçer; patlamada sarsıntı ve yavaş çekim yok,
  tek kare patlama görseli; nabızlar durur (bugünkü ayar korunur, yeni öğeler de ona uyar).
- Yazı boyutu "büyük": koltuk adları ve BM-U3 çipi büyür; 8 kişide adlar 6 harfte kesilir.
- Ekran okuyucu: "Bomba sende. Pas vermek için bir oyuncu seç." / "Bomba Mert'e geçti." / patlamada "Bomba Elif'te
  patladı, Elif eksi 1." **Kalan süre hiçbir zaman kendiliğinden okunmaz** (ekran okuyucu sesli konuşur, taşıyıcı
  duyar); yalnız oyuncu "SÜREYE BAK" öğesine odaklanırsa okunur ve ayarlarda "kulaklık kullan" uyarısı çıkar.

---

## 5. Yapay zekâ (AI) ile yapılabilecekler

### BM-AI1 · Bomba spikeri — **önerim: İSTEĞE BAĞLI**
Son açılışta (BM-U6'nın altında) tek cümlelik esprili özet: "Oyuncu4 bombayı üç kez aldı, üçünde de iki saniyede
kurtuldu; dördüncüde masaya fazla güvendi." Ortak yapay zekâ yorum altyapısıyla (API bağlanınca açılır, hata olursa
görünmez, oyun beklemez, yasaklı kelime süzgeci). Modele yalnız "Oyuncu1…N" etiketleri, pas zinciri, tutma süreleri,
kimin bildiği ve kılpayı gider; gerçek adlar ve konuşmalar gitmez. Puana karışmaz.
**Neden isteğe bağlı:** Bu oyunda anlatılacak bir hikâye gerçekten var (yolculuk, son anda kurtulmalar); Kara Borsa ve
Sızma'da onayladığın spikerle aynı yapı. Ama BM-U6 hikâyenin çoğunu zaten kural tabanlı veriyor.

---

## 6. İçerik ve üretim ekibine düşen işler

- **Ses Efektleri yapay zekâsı (🔊):** BM-U13 seti — sabit fitil cızırtısı döngüsü (zamanla değişmeyen), "vuuş", "tak"
  + çıtırtı, kilit bitiş "çıt", patlama (bas + döküntü, ≤ 2 sn), bahis zili, kılpayı "vuuuş!", yoklama tıkırtısı, kısık
  bahis "çıt"; BM-U5 patlama anı. Ön koşul olarak not: süreye bağlı hiçbir ses istenmez.
- **Müzik yapay zekâsı:** isteğe bağlı, **temposu sabit** bir gerilim döngüsü (oyun boyunca aynı yoğunluk; son
  saniyelerde hızlanan katman kesinlikle yok — taşıyıcıya süre söyler).
- **Efekt Dokuları yapay zekâsı:** şok dalgası, duman, kablo üzerinde ışık akışı, "kızgın" bomba çatlak ışığı (BM-M5
  onaylanırsa). Hareket azaltmada sade sürüm.
- **Görsel (ChatGPT görev akışı, 🎨):** anlatım için iki telefon kompozisyonu (BM-U15); "kızgın" ısı katmanı (BM-M5
  onaylanırsa); gerekirse TV oranında masa zemini (BM-U11). Bomba, patlama ve beyaz silüet görselleri var.
- **İçerik Havuzu:** iş yok.
- **Wiki:** sıcak patates, bedava tahmin ve 100 ms patlama notları güncellenir; strateji ve özel durumlar yeniden yazılır.

---

## 7. Önerilen paket

**EVET:** BM-M1, BM-M2, BM-M3, BM-U1 … BM-U8, BM-U10 … BM-U17.
**İSTEĞE BAĞLI:** BM-M4 (kılpayı), BM-M5 (bombayı yokla), BM-U9 (dikey ekran), BM-AI1 (bomba spikeri).
**HAYIR:** BM-M6 (geri çevir), BM-M7 (kopan taşıyıcıdan otomatik pas), BM-M8 (eksiyi kaldır).

Bu paketle oyun şöyle akar: anlatımda "Süreni taşıyana gösterme!" → bomba Mert'te başlar, 1,5 sn "Fitil tutuşuyor…"
→ masa bağırır; diğerleri bombaya basılı tutup süreye bakar, bırakınca ekranları taşıyıcınınkinden farksız → Mert
Elif'e atar, Elif ona geri atamaz; zincirde "Mert → Elif" → Kaan "Elif'in elinde patlar" diye tek kurşununu sıkar ve
Elif'e "tut, daha 9 saniye var!" der → paslar artık fitili uzatmaz, bomba kızar → "ELİF'TE PATLADI! −1", Kaan'ın
koltuğunda +1 → son ekranda bombanın yolculuğu ve fitil hesabı ilk kez açılır.

**Değişen kurallar (paket onaylanırsa):** bombayı alan 1,5 sn pas veremez; 3+ bağlı oyuncuda bombayı az önce atana hemen
geri atamaz; pasın eklediği süre 1.–3. pasta 1–4 sn, 4.–6. pasta 0,5–2 sn, sonrasında 0 ve fitil oyun başından 45 sn'yi
geçmez; "Patlar/Patlamaz" el başı tahmini yerine oyun başına tek "PATLAR!" bahsi (o anki ele bağlı, pas olursa yanar,
fitilde 3 sn'den az kalmışken kabul edilmez, hak yanmaz); patlama fitilin bittiği anda işlenir. Anlatım maddeleri
BM-U15'teki gibi olur. `docs/KURALLAR.md` §10 (O9'un yanına yeni değişiklik), wiki ve testler (gizlilik testleri dahil:
pas zinciri ve fitil hesabı yalnız patlamadan sonra açık) buna göre güncellenir.

**Değişmeyenler:** 2–8 oyuncu; yatay ekran; bombanın rastgele bağlı oyuncuda başlaması; ilk fitil 15–20 sn; taşıyıcının
süreyi hiç görmemesi; diğer katılımcıların gerçek süreyi görmesi; kendine ve kopuk oyuncuya pas yok; patlama anında
gelen pasın reddi; patlayan −1, diğerleri 0; doğru bahis +1 ve oyun başına en çok +1; bahislerin gizliliği (taşıyıcı hiç
görmez, kazananlar patlamada açılır); izleyici ve TV'de süre ve bahis olmaması; kopuk taşıyıcıda bombanın kalması;
patlamadan sonraki 2 sn gösteri; oyunun sonuç ekranının "Devam et" ile geçmesi.

**🎨 Yeni görsel gerekenler (paket):** anlatım için iki telefon kompozisyonu (BM-U15); gerekirse TV masa zemini
(BM-U11). İsteğe bağlı: "kızgın" bomba katmanı (BM-M5).
**🔊 Ses işi (paket):** BM-U5, BM-U13.
