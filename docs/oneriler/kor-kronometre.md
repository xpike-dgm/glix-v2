# Kör Kronometre — geliştirme önerileri

Bu dosya onay içindir. Her maddenin bir kodu var (ör. **KR-M2**; **KR** = Kör **Kr**onometre). Cevabını tek satırda verebilirsin:

> KR-M1 evet, KR-M2 hayır, KR-U3 evet …

ya da yalnız **"önerilen paket evet"** dersen sondaki paket uygulanır. Her maddenin "ayrıntılar" bölümü onaylarsan
nasıl yapılacağını kesinleştirir; ek soru sormam gerekmez. Beğenmediğin ayrıntı varsa yalnız onu yaz.

Not: Oyunun kendi sonuç ekranı zaten herkes **"Devam et"** deyince geçiyor (en çok 60 sn); burada yeniden önerilmedi.
Yeni görsel gerektiren maddeler **🎨 Görsel**, ses alanına iş açan maddeler **🔊 Ses** diye işaretli.

---

## 1. Bugünkü oyun (özet)

- 2–8 oyuncu, tek el. Anlatım ve 3 sn'lik geri sayımdan sonra oyun ekranı açılır: üstte **"Hedef: 11 saniye"**
  (her oyunda 7–13 arası rastgele tam saniye), ortada rakamsız karanlık bir kronometre kadranı, altta **BAS** düğmesi.
- Gerçek sayaç gizli; oyuncu içinden sayar ve **yalnız bir kez** basar. Basınca kadran donar, düğme "BASTIN" olur,
  "Bastın! Diğerleri bekleniyor" yazar.
- Basış süresi **hedef + 8 sn** (15–21 sn). Herkes bastıysa son basıştan **1 sn sonra** sonuç açılır.
- Basış anı, eylemin **sunucuya ulaştığı an** ile ölçülür. Süre bitmeden kimin bastığı kimseye gösterilmez.
- Sonuç: herkesin basış anı bir çizgi üzerinde nokta olarak açılır (yakından uzağa). **En yakın +2, ikinci en yakın
  +1** doğrudan genel skora gider; eşit uzaklıkta aynı derece, sonraki derece atlanır. Basmayan sıralamaya girmez,
  puan almaz.

## 2. Gördüğüm sorunlar

**Oyun tasarımı**
1. **Ağ gecikmesi doğrudan uzaklığa ekleniyor.** Basış, sunucuya vardığı anda ölçülüyor. Mobil veride 150 ms
   gecikmesi olan oyuncunun tam isabeti bile "0,15 sn geç" sayılıyor (wiki bunu kendisi söylüyor). Bu oyunda
   kazananla ikinci arasındaki fark çoğu zaman 0,1 sn'nin altında; yani bazı ellerde sonucu bağlantı belirliyor.
   Kule Ustası'nda bu sorun çözülmüş durumda: istemci dokunma anını gönderiyor, sunucu en çok 400 ms eskiyse kabul
   ediyor.
2. **"Başla" anı ile hedefin görünmesi ayrı anlar.** Geri sayımın sonunda "başla" sesi çalıyor (sunucu saatine göre),
   ama geri sayım ekranında hedef yazmıyor. Hedef ancak oyun ekranı açılınca okunuyor. Oyuncu ya sesle saymaya başlayıp
   hedefi sonra okuyor ya da hedefi okuyunca saymaya başlıyor; ikisi arasında 0,3–1 sn fark oluyor ve bu fark oyunun
   kendisinden büyük.
3. **Kadranın nabzı istemeden bir metronom.** Kadrandaki nabız 2,4 sn'lik sabit bir döngü; iki halka 1,2 sn arayla
   yanıyor ve ekran açıldığı anda başlıyor. 11 saniye ≈ 9 vuruş; dikkatli oyuncu vuruş sayarak "tamamen gizli" kuralını
   deliyor. Wiki "nabız ipucu vermez" diyor ama ritmi sabit olduğu için saat gibi kullanılabiliyor.
4. **Tek el, ~20 sn, tek basış: şansa çok açık.** Bir maçta oyuncu kendi iç saatinin hızlı mı yavaş mı olduğunu
   öğrenme fırsatı bulamıyor (wiki stratejisi bunu "birkaç tur sonra" diye öneriyor ama tek el var). Oyun başlamadan
   bitiyor; tekrar oynanma isteği düşük.
5. **Puan doğrudan +2/+1.** Diğer oyunlarla aynı aralık ama 8 kişide 6 kişi her zaman 0; tek elde ödülsüz kalan için
   "bir dahakine" yok.
6. **Kural metni ile kod arasında küçük çelişki.** KURALLAR.md erken bitişte Kör Kronometre'yi kapsam dışı sayıyor,
   kodda "herkes basınca 1 sn sonra açıl" var (wiki bilinen sorunlar). Davranış doğru; metin güncellenmeli.

**Arayüz** (ekran görüntülerine bakarak: 390×844, 360×640, 844×390)
7. **Sayma ekranı boş ve dağınık.** 390×844'te kadranla "İçinden say…" yazısı arasında ~200 px boşluk var; arka
   plandaki dişli ve yörünge çizimleri kadranın etrafında kalabalık. "Hedef: 11 saniye" başlığı üstteki sayfa
   noktalarına neredeyse yapışık.
8. **BAS düğmesi oyuna ait değil.** Bütün uygulamadaki genel camgöbeği düğme; kronometrenin kendisinde başlatma
   düğmesi (taç) varken basış onunla ilişkilendirilmiyor.
9. **"BASTIN" hâlâ düğme gibi.** Basınca düğme koca bir yeşil düğmeye dönüşüyor; yeniden basılabilirmiş gibi duruyor.
   "Kilitlendi" hissi yok.
10. **Yatayda başlık bölünüyor.** 844×390'da sol şeritte "Kör / Kronomet / re" diye üç satıra bölünmüş; hedef yazısı da
    üstteki noktalara biniyor.
11. **Sonuç her şeyi bir anda gösteriyor.** 8 satır aynı anda yükseliyor; satırlarda **ad yok** (yalnız avatar),
    **hedeften fark yok** (yalnız "10,85"), derece yok. Kendi farkın yalnız başlığın altında küçük yazıyla.
12. **Renkler karışıyor.** Hedef çizgisi ince **sarı** bir çizgi, +1 alanın noktası da **sarı-turuncu**; +2 yeşil,
    diğerleri camgöbeği. Renk körü için tamamen renkle anlatılıyor; normal görüşte bile +1 noktası hedef çizgisinin
    üstüne gelince kayboluyor.
13. **İzleyicinin ve TV'nin yapacağı hiçbir şey yok.** 15–21 sn boyunca hedef yazısı ve kadran; TV'de telefon ekranı
    büyütülmüş. Açılışta bile satırlar küçük.
14. **Sesler genel.** Basış genel "tık", sonuç genel eşleşme/tek kalma sesi; oyunun en güzel anı (kimin ne kadar
    yaklaştığının açıldığı an) sessiz ve hızlı geçiyor.

---

## 3. Oyunu değiştiren öneriler (mekanik)

### KR-M1 · Gecikme düzeltmesi: parmağının değdiği an sayılır — **önerim: EVET**
**Ne:** İstemci basışla birlikte **dokunma anını** (sunucu saatine göre) gönderir. Sunucu bu anı **en çok 400 ms
eskiyse** kabul eder; değilse kendi aldığı anı kullanır. Kule Ustası'ndaki korumanın aynısı.
**Neden:** Sorun 1. Hedefe uzaklığı oyuncunun eli belirler, bağlantısı değil.
**Ayrıntılar:**
- Kabul aralığı: `[sayma başlangıcı, sunucunun aldığı an]` ve sunucunun aldığı andan en çok 400 ms önce. Gelecekten
  gelen an sunucunun aldığı ana çekilir; sayma başlangıcından önceki an reddedilir (düğme o anda zaten kapalı).
- **Süre sınırı değişmez:** basış sunucuya basış süresi (hedef + 8 sn) bitmeden ulaşmalı; bitişten sonra gelen basış
  eskisi gibi reddedilir (zamanlama oyunlarında geç eylem payı yok). Bu madde yalnız **ölçümü** düzeltir.
- Hile kazancı yok: süre dolana kadar hiçbir basış kimseye açılmadığı için, 400 ms "geriye tarihli" basış oyuncuya
  hiçbir bilgi kazandırmaz (beklediği 400 ms'de öğrenebileceği bir şey yok).
- Saat farkı istemcide bugünkü ping ölçümünden (ortanca) hesaplanır; ek ağ trafiği yok.
- Sonuçtaki "10,85" gibi anlar bundan sonra dokunma anıdır.

### KR-M2 · "Hazır ol – BAŞLA!" oyunun içinde — **önerim: EVET** · 🔊 Ses
**Ne:** Oyun ekranı açılınca önce **3 sn "Hazır ol"**: hedef dev rakamla görünür ("11"), BAS kapalıdır. Sonra
herkesin telefonunda **aynı anda** "BAŞLA!" flaşı, tek gong ve titreşim. Sayma bu andan başlar.
**Neden:** Sorun 2. Herkes hedefi okumuş, nefesini toplamış olarak aynı işaretle başlar; ekranın açılma hızı, oyun
dosyasının yüklenmesi ya da okuma süresi sonucu etkilemez.
**Ayrıntılar:**
- Basış anları "BAŞLA!" anından ölçülür (bugünkü "oyun başından" yerine). Basış süresi "BAŞLA!"dan itibaren
  hedef + 8 sn; oyunun toplam süresi 3 sn uzar.
- "BAŞLA!" anı sunucu saatine göre çizilir (her telefon kendi saat farkıyla); telefonlar arasında fark birkaç on ms'yi
  geçmez. Ses ve titreşim aynı karede.
- "Hazır ol" sırasında BAS'a dokunmak hiçbir şey yapmaz (düğme soluk, "Bekle…" yazar); erken basış hakkı yakmaz.
- KR-M3 ile her elin başında aynı akış (1. elde 3 sn, 2. ve 3. elde 2 sn).
- Geri sayım ekranının "Hazır ol" yazısı aynen kalır; bu ikinci, oyuna özel hazırlıktır.

### KR-M3 · Üç el, üç hedef — **önerim: EVET**
**Ne:** Oyun **3 el** olur. Her elde yeni bir hedef (7–13 arası, eller arasında tekrar etmeyen tam saniye), herkes bir
kez basar. Her elin sonunda kısa bir açılış; oyun sonunda **el puanları toplamına** göre genel skor.
**Neden:** Sorun 4 ve 5. Oyuncu ilk elde "0,6 sn geç kaldım" diye öğrenir, ikinci elde düzeltir: oyun şanstan
beceriye kayar. Kaybeden "bir dahaki elde" der; 8 kişide puansız kalma hissi azalır.
**Ayrıntılar:**
- **El puanı:** her elde bugünkü kural: en yakın 2, ikinci en yakın 1, diğerleri 0; eşit uzaklık aynı derece, sonraki
  derece atlanır; basmayan sıralanmaz.
- **Genel skor:** 3 elin toplamına göre **+2 / +1 / 0** (diğer oyunlardaki dönüşüm). Toplamı 0 olan ödül almaz.
- **Eşitlik:** toplam eşitse daha **çok elde basan** önde; o da eşitse **bastığı ellerdeki ortalama uzaklığı** küçük
  olan önde; o da eşitse aynı derece (birincide eşitlik: hepsi +2, sonraki +1; herkes eşit ve > 0 ise herkes +1).
- **El süresi:** "BAŞLA!"dan hedef + 8 sn; herkes basarsa son basıştan 1 sn sonra el kapanır (bugünkü erken bitiş, el
  başına).
- **El arası:** 3 sn kısa açılış (bkz. KR-U7), ardından bir sonraki elin "Hazır ol"u. Oyunun son açılışı
  "Devam et"li ortak sonuç ekranıdır.
- **Toplam süre:** en kötü durumda 3 + 21 + 3 + 2 + 21 + 3 + 2 + 21 ≈ 76 sn (hedefler 13 ve kimse erken
  bitirmezse); olağan elde herkes hedef civarında bastığı için ≈ 45–50 sn.
- **Gizlilik:** el bitmeden kimin bastığı yine kimseye açılmaz; el açılışında yalnız o elin anları açılır.
- **Kopan oyuncu:** koptuğu elde basmamışsa o elde sıralanmaz; döndüğünde sonraki elde oynar.
- **2 oyuncuda:** her elde ikisi de basarsa yakın 2, uzak 1; toplamda yüksek olan +2, diğeri (> 0 ise) +1.
- Kartlar: "birinci/sonuncu" toplam el puanına göre (eşitlik kuralıyla).

### KR-M4 · Nabız metronom olmasın — **önerim: EVET**
**Ne:** Kadrandaki nabız sabit 2,4 sn'lik döngü yerine **düzensiz** atar: her vuruş arası 0,6 ile 2,2 sn arasında,
her telefonda ayrı rastgele. İkinci halka kalkar; çekirdek yavaş ve düzensiz parıldar.
**Neden:** Sorun 3. Kuraldaki "gerçek sayaç tamamen gizli" sözü ekranda da doğru olur; kimse vuruş sayarak
kazanamaz. Kadran yine canlı görünür.
**Ayrıntılar:**
- Rastgelelik istemcide, oyunla ilgisiz (sunucuya, puana, kayda dokunmaz).
- Vuruşlar ses ve titreşim üretmez (yalnız görsel).
- Hareket azaltma açıkken nabız hiç yok, kadran durgun (bkz. KR-U17).
- Anlatım görselindeki kadranın nabzı da aynı şekilde düzensizleşir.
- Basınca nabız durur (bugünkü gibi).

### KR-M5 · Tam isabet bonusu — **önerim: İSTEĞE BAĞLI (KR-M3 ile)**
**Ne:** Hedefe **0,05 sn ya da daha yakın** basan, o elde derecesinden bağımsız **+1 ek el puanı** alır ve ekranında
"TAM İSABET!" damgası çıkar.
**Neden:** Herkesin konuştuğu "bir saniyenin yirmide biri!" anı ödüllenir. Kalabalık elde 3. olsa bile kusursuz basan
boş dönmez.
**Ayrıntılar:**
- Ölçüm KR-M1'le dokunma anı; eşik kesin: 50 ms dahil.
- Bir elde birden çok kişi tam isabet yapabilir; hepsi +1 alır.
- KR-M1 onaylanmazsa bu madde önerilmez (gecikme eşiği belirler).
- **Neden isteğe bağlı:** 0,05 sn çok nadir; bonusu görmek için oyunun birkaç kez oynanması gerekir. KR-M3 tek başına
  yeterli derinlik getiriyor.

### KR-M6 · Son elde yarım saniyelik hedef — **önerim: İSTEĞE BAĞLI (KR-M3 ile)**
**Ne:** 3. elin hedefi tam saniye değil **buçuklu** olur ("Hedef: 9,5 saniye"; 7,5–12,5 arası).
**Neden:** Son ele bir "zorluk" dokunuşu: ilk iki elde öğrenilen ritim tam işe yaramaz, içinden "dokuz… buçuk!" diye
saymak gerekir. Masada gülüşme çıkarır.
**Ayrıntılar:**
- Yalnız son el; ilk iki el tam saniye (O6 kuralı korunur).
- Ekranda "9,5" büyük, "buçuk" kelimesiyle: "Hedef: dokuz buçuk saniye".
- **Neden isteğe bağlı:** O6'da "tam saniye" kararını verdin; bu onu son elde esnetir. Beğenmezsen KR-M3 tam
  saniyelerle aynen işler.

### KR-M7 · Kaç kişinin bastığını göster — **önerim: HAYIR**
**Ne:** Sayarken ekranda "3/6 bastı" gibi bir sayaç.
**Neden önermiyorum:** Gerilim katar gibi görünür ama ilk basan herkese "şimdi civarı" diye ipucu verir; oyuncular
saymayı bırakıp birbirini kopyalar. Kuraldaki "süre dolmadan kimin bastığı yok" kararı oyunun özü. Gerilimi ses ve
sessizlikle (KR-U12) vermeyi öneriyorum. Sorulursa diye yazdım.

---

## 4. Arayüz ve his önerileri

### 4a. Ana ekranlar ve akış

### KR-U1 · Karanlık oda sayma ekranı — **önerim: EVET**
- Sayma başlayınca ("BAŞLA!") arka plan %60 kararır; dişli ve yörünge çizimleri neredeyse kaybolur, yalnız kadran ve
  hedef parlar (sorun 7). Odadaki herkes ekrana değil iç sesine odaklanır.
- Hedef üstte iki satır: büyük **"11"** ve altında küçük **"SANİYE"**. Sayfa noktalarıyla arasında 16 px boşluk.
- Kadran ekranın ortasına (dikeyde yüksekliğin %40'ı) iner; "İçinden say…" yazısı kadranın hemen altında. Boşluk
  kadranla düğme arasında eşit dağılır.

### KR-U2 · Kronometre düğmesi ve "kilitlendi" — **önerim: EVET** · 🎨 Görsel
- Alttaki genel camgöbeği düğme yerine **metal bir kronometre düğmesi**: gümüş kenar, ortada kalın "BAS" yazısı,
  en az 96 px yüksek, tam genişliğe yakın (sorun 8).
- Basınca aynı karede kadranın **tepesindeki taç gömülür**, cam üstüne buz/kırağı dokusu yayılır ve kadran donar.
- Düğme yeşil bir "BASTIN" düğmesine dönmez (sorun 9): yerinde gömülü, soluk bir plaka ve kilit simgesiyle
  **"KİLİTLENDİ"**; dokunulamaz görünür.
- 🎨 Gereken: kronometre görselinin taçı basılı + camı donmuş sürümü (mevcut `genel/kronometre` ile aynı kadraj),
  metal düğme yüzeyi (CSS ile de yapılabilir).

### KR-U3 · "Hazır ol – BAŞLA!" anı (KR-M2 ile) — **önerim: EVET (KR-M2 onaylanırsa)**
- "Hazır ol": hedef rakamı kadranın içinde dev, kadran sakin; BAS soluk "Bekle…".
- "BAŞLA!": tek beyaz flaş (yarım saniye), gong, 32 ms titreşim; rakam kadrandan kaybolur, kadran kararır ve nabız
  (KR-M4) başlar. Hedef üstte küçük kalır.
- 2. ve 3. elde "Hazır ol" 2 sn; hedef rakamı bir önceki elin hedefinden kayarak değişir ("11 → 8").

### KR-U4 · Bastıktan sonra bekleme — **önerim: EVET**
- "Bastın! Diğerleri bekleniyor" yerine: **"Basışın mühürlendi."** ve altında küçük **"Diğerleri hâlâ sayıyor —
  şaşırtmak serbest!"** (sesli yanlış sayma oyunun sosyal tarafı).
- Bu ekranda **zamana bağlı hiçbir hareket yok** (dönen ibre, dolan halka…): komşusu henüz basmamış oyuncu bu
  telefona bakıp zaman tahmin edemesin. Kadran donmuş kalır.
- Kendi basış anın yine gösterilmez (bugünkü gizlilik).

### 4b. Açılış/sonuç anı ve gerilim

### KR-U5 · İbre koşusu açılışı — **önerim: EVET** · 🔊 Ses
Bugün 8 satır aynı anda yükseliyor (sorun 11). Yerine:
- 0–0,6 sn: ekranın ortasında yatay bir zaman çizgisi; hedef noktasında parlayan dikey çizgi ve "11".
- 0,6–3,1 sn: bir **ibre** çizginin solundan sağına 2,5 sn'de koşar (gerçek zamanın hızlandırılmışı). İbre bir
  oyuncunun basış anından geçince o oyuncunun avatarı **çizgiye düşer**, küçük "tik".
- İbre hedeften geçerken "ding"; hedefe en yakın iki avatar parlar.
- 3,1–4,1 sn: avatarlar çizgiden kalkıp yakından uzağa sıralı listeye dizilir (KR-U6), puanlar uçar.
- Basmayanlar ibre çizginin sonuna varınca soluk olarak listenin sonuna eklenir.
- Toplam 4,1 sn; "Devam et" düğmesi bu sürede de basılabilir (ortak kural), animasyon kesilmez.

### KR-U6 · Okunur sonuç satırları — **önerim: EVET**
- Her satır: derece rozeti (🥇/🥈 ya da sayı), avatar, **ad**, çizgi üzerinde nokta, **fark** ("0,15 erken",
  "0,42 geç") ve puan. Anın kendisi ("10,85") farkın altında küçük.
- Kendi satırın çerçeveli ve listede görünür kalır (8 kişide ekran dışına taşarsa liste kendi satırına kayar).
- Hedefe 0,05 sn ve daha yakın basışta satırda **"TAM İSABET"** damgası (KR-M5 olmasa da gösterilir, puan vermez).
- Başlık: "+2 puan" / "+1 puan" / "Puan yok" yanında tek satır özet: **"0,15 sn erken · 1."**
- Basmayanlar "basmadı", gri, puan yerine "–" (bugünkü gibi).

### KR-U7 · El arası kısa açılış (KR-M3 ile) — **önerim: EVET (KR-M3 onaylanırsa)**
3 sn:
- Ortada büyük kendi sonucun: **"0,32 sn GEÇ"** (ya da "erken", "TAM İSABET").
- Altında elin kazananı: "Bu el: Elif · 0,04 sn".
- 2. el sonundan itibaren kendi eğilimin tek satır: **"İç saatin biraz yavaş: iki elde de geç bastın."** (yalnız kendi
  basışlarından hesaplanır, başkasına gösterilmez.)
- Şeritte toplam el puanları güncellenir; liste açılmaz (son açılışa saklanır).

### 4c. Telefon ergonomisi ve okunurluk

### KR-U8 · Yatay ve küçük ekran düzeni — **önerim: EVET**
- Yatayda (844×390): solda kadran, sağda hedef ve altında BAS; başlık sol şeritte "Kör Kronometre" tek satır
  (sığmazsa yazı küçülür, hece bölünmez) (sorun 10).
- 360×640'ta hedef ile sayfa noktaları arasında boşluk; kadran %10 küçülür, BAS 88 px'ten küçük olmaz.
- Açılışta 8 satır 360×640'a sığar: satır yüksekliği 52 → 46 px; "Devam et" şeridi son satırın üstüne binmez (liste
  şeridin üstünde biter).
- Basma alanı yalnız düğme: ekranın başka yerine dokunmak basış sayılmaz (yanlışlıkla tek hakkı yakmasın).

### 4d. İzleyici, kopan oyuncu ve TV

### KR-U9 · İzleyici de oynasın (puansız) — **önerim: EVET**
- İzleyici ekranında soluk bir **"Sen de dene"** düğmesi. Basınca kendi kadranı donar; basış yalnız onun telefonunda
  ölçülür, sunucuya gitmez, puana karışmaz.
- Açılışta izleyicinin kendi ekranında listenin altında soluk bir satır: **"Sen (izleyici) · 0,22 erken"**.
  Oyuncuların ekranında görünmez.
- Böylece maç sırasında gelen kişi 20 sn boş beklemez, sonraki oyuna ısınır.

### KR-U10 · TV ekranı — **önerim: EVET** · 🎨 Görsel
- Sayarken: ortada dev kadran ve hedef, altında bütün oyuncuların avatarları **"?"** rozetleriyle (kimin bastığı
  gösterilmez — TV'yi herkes görür). Arka plan kararmış; TV sessiz.
- Açılış: KR-U5'teki ibre koşusu TV genişliğinde; avatarlar 120 px, adlar büyük; ardından sıralı liste ve el puanları.
- KR-M3 ile el arası özet TV'de büyük: "Bu el: Elif · 0,04 sn".
- 🎨 Gereken: TV oranında karanlık saat kulesi zemini (mevcut arka plan kadrajlanabilirse gerekmez).

### KR-U11 · Kopan ve geri dönen oyuncu — **önerim: EVET**
- Basmadan kopup el bitmeden dönen oyuncu: "Geri döndün. Sayaç gizli; istersen yine bas." (sayma referansını
  kaybettiğini dürüstçe söyler; basış hakkı durur).
- Basıp kopan oyuncu dönünce: "Basışın kayıtlı ✓".
- KR-M3 ile: el bittikten sonra dönen, sonraki elin "Hazır ol"unu bekler; "Sıradaki elde oynarsın" yazar.
- Şeritte (KR-M3) kopan oyuncunun avatarı gri.

### 4e. Ses, titreşim ve hareket

### KR-U12 · Sessizlik ve kronometre ses seti — **önerim: EVET** · 🔊 Ses
- **Sayarken tam sessizlik:** müzik yok, ortam sesi yok, tik yok (bugün de müzik çalmıyor; bu kural olarak
  yazılsın ki ileride eklenmesin — her ritimli ses bir metronomdur).
- "BAŞLA!" (KR-M2): derin tek gong.
- Basış: mekanik kronometre "klik" (iki parçalı, tok).
- Açılış (KR-U5): ibre "vızz", her avatar düşüşünde "tik" (oyuncu başına hafif farklı perde), hedeften geçişte
  "ding", +2 için kısa zafer notası, TAM İSABET için cam çanı.
- Kendi sonucun: +puan yükselen, puan yok alçalan kısa ses (bugünkü genel sesler yerine bu sete ait).

### KR-U13 · Titreşim — **önerim: EVET**
- "BAŞLA!": 32 ms (bütün telefonlarda aynı anda).
- Basış: 10 ms.
- **Sayarken hiçbir titreşim yok** (komşunun telefonundaki vızıltı hem dikkat dağıtır hem ipucu olur).
- Açılış: +2 alana üçlü, +1 alana çift, puan alamayana tek kısa.
- Titreşimsiz telefonda "BAŞLA!" flaşı bir kademe güçlü (genel telafi ayarı).

### 4f. İlk kez oynayan için öğretme

### KR-U14 · Anlatımda iç saat denemesi — **önerim: EVET**
- Anlatım görselinin altında küçük bir deneme: **"3 saniye say, bas"**. "Başla"ya dokun, içinden say, bas; sonuç anında:
  "3,24 sn · 0,24 geç". İstediğin kadar tekrar; puan yok, sunucuya gitmez.
- Oyuncu "Hazırım" demeden önce kendi eğilimini görür; bekleyenler de eğlenir.
- Deneme, kendi kadranında da nabızsızdır (KR-M4).

### KR-U15 · Anlatım metni — **önerim: EVET**
Maddeler (paketle):
1. "Sayaç görünmez; hedef yazılı (7–13 sn)"
2. "'BAŞLA!' ile içinden say, tek kez bas"
3. "3 el: her elde en yakın 2, ikinci 1 puan"
Altında küçük ipucu: **"Sesli saymak serbest — yanlış sayıp arkadaşlarını şaşırtmak da."**
(KR-M3 onaylanmazsa 3. madde bugünkü gibi: "en yakın +2, ikinci +1".)

### 4g. Erişilebilirlik

### KR-U16 · Renk körü dostu çizgi — **önerim: EVET**
- Hedef çizgisi sarı yerine **beyaz kesik çizgi** ve üstünde küçük "11" etiketi (sorun 12).
- +2 noktası **★**, +1 noktası **●** büyük, diğerleri küçük **○**; renk körü modunda nokta üstünde derece sayısı.
- Puan sütunu yalnız renkle değil işaretle: "+2 ★", "+1".

### KR-U17 · Hareket azaltma, yazı boyutu ve ekran okuyucu — **önerim: EVET**
- Hareket azaltma: nabız yok (KR-M4), "BAŞLA!" flaşı yerine kadran çerçevesi bir kez renk değiştirir, ibre koşusu
  yerine satırlar 0,3 sn arayla sırayla belirir (yine yakından uzağa).
- Yazı boyutu "büyük": satırda ad ve fark büyür, an ("10,85") gizlenir (fark yeter).
- Ekran okuyucu: "Hazır ol, hedef 11 saniye" → "Başla" (bir kez) → sayarken hiçbir şey okunmaz → açılışta
  "Hedef 11. Sen 10,85'te bastın, 0,15 erken, birinci, 2 puan. Elif ikinci, 0,42 geç." Basış düğmesi etiketi
  "Bas"; basınca "Basışın kilitlendi".

---

## 5. Yapay zekâ (AI) ile yapılabilecekler

### KR-AI1 · İç saat yorumcusu — **önerim: HAYIR**
Oyun sonunda tek cümle: "Oyuncu3 üç elde de erken bastı — sabırsızlık mı, heyecan mı?" Modele yalnız "Oyuncu1…N" ve
farklar gider; puana karışmaz; hata olursa görünmez.
**Neden önermiyorum:** Cümlenin malzemesi (erken/geç eğilimi) KR-U7'de kural tabanlı ve kişiye özel olarak zaten
çıkıyor; yapay zekâ yalnız süsleme yapar. 20–50 sn'lik oyun için bütçe ve gecikme ayırmaya değmez.

---

## 6. İçerik ve üretim ekibine düşen işler

- **Ses Efektleri yapay zekâsı (🔊):** KR-U12 seti — gong, kronometre "klik" (2 varyasyon), ibre "vızz", avatar
  düşüşü "tik" (8 perde), hedef "ding", TAM İSABET cam çanı, +2 zafer notası, puan yok alçalan ses. Hepsi ≤ 0,4 sn
  (gong ≤ 1,5 sn).
- **Müzik yapay zekâsı:** bu oyunda **müzik istenmez**; sayma sırasında sessizlik kural olarak kayda geçsin
  (müzik kaydında "Kör Kronometre: yok").
- **Efekt Dokuları yapay zekâsı:** cam üstüne kırağı yayılması (KR-U2), ibre izi (KR-U5), TAM İSABET damgası
  parıltısı. Hareket azaltmada sade sürüm.
- **Görsel (ChatGPT görev akışı, 🎨):** kronometrenin "taç basılı + cam donmuş" sürümü (KR-U2); gerekirse TV oranında
  karanlık saat kulesi zemini (KR-U10).
- **İçerik Havuzu:** iş yok.
- **Wiki:** gecikme ve nabız "bilinen sorunları" kalkar; strateji maddeleri (iç saat, eller) güncellenir; KURALLAR'daki
  erken bitiş çelişkisi düzeltilir.

---

## 7. Önerilen paket

**EVET:** KR-M1, KR-M2, KR-M3, KR-M4, KR-U1 … KR-U17.
**İSTEĞE BAĞLI:** KR-M5 (tam isabet bonusu), KR-M6 (son elde buçuklu hedef).
**HAYIR:** KR-M7 (basan sayısı), KR-AI1.

Bu paketle oyun şöyle akar: anlatımda "3 saniye say" denemesiyle kendi iç saatini görürsün → oyun ekranı açılır, dev
"11" ve "Hazır ol" → bütün telefonlarda aynı anda gong ve "BAŞLA!", oda kararır, kadran düzensiz nabız atar → içinden
sayarsın, metal düğmeye basarsın; taç gömülür, cam donar, "KİLİTLENDİ" → el bitince ibre çizgiyi koşar, avatarlar
çizgiye düşer, hedefte "ding" → "0,32 sn GEÇ · Bu el: Elif" → iki el daha → son açılışta 3 elin toplamı ve +2 / +1 / 0.

**Değişen kurallar (paket onaylanırsa):** basış anı istemcinin dokunma anıdır (en çok 400 ms eski; süre sınırı
aynı); sayma oyun içindeki "BAŞLA!" anından ölçülür (önünde 3 sn / 2 sn "Hazır ol"); oyun 3 el, her elde ayrı hedef
(tekrarsız), el puanı en yakın 2 / ikinci 1, genel skor toplam el puanına göre +2 / +1 / 0 (toplamı 0 olan ödül almaz,
eşitlik kuralı KR-M3'teki gibi); kadranın nabzı düzensiz. Anlatım maddeleri KR-U15'teki gibi olur. `docs/KURALLAR.md`
§9 (O6'nın yanına yeni değişiklik), wiki ve testler buna göre güncellenir; §9'daki "erken bitiş kapsam dışı" çelişkisi
de giderilir.

**Değişmeyenler:** 2–8 oyuncu; hedef 7–13 arası tam saniye ve herkese açık; gerçek sayaç tamamen gizli; elde tek basış;
basış süresi hedef + 8 sn; herkes basınca 1 sn sonra açılış; basmayan sıralanmaz ve puan almaz; eşit uzaklıkta aynı
derece; süre dolmadan kimin bastığının kimseye (izleyici ve TV dahil) gösterilmemesi; bitişten sonra gelen basışın
reddi; eksi puan olmaması; oyunun sonuç ekranının "Devam et" ile geçmesi.

**🎨 Yeni görsel gerekenler (paket):** kronometrenin taç basılı + donmuş cam sürümü (KR-U2); gerekirse TV zemini
(KR-U10). Çizgi, ibre, rozetler CSS/SVG ile yapılır.
**🔊 Ses işi (paket):** KR-M2, KR-U5, KR-U12.
