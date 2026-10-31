# Ortalamaya En Yakın — geliştirme önerileri

Bu dosya onay içindir (oyun kimliği `ortalamanin-yarisi`). Her maddenin bir kodu var (ör. **OY-M2**). Madde öneki
**OY** (Ortalamanın Yarısı). Cevabını tek satırda verebilirsin:

> OY-M1 evet, OY-M2 hayır, OY-U3 evet …

ya da yalnız **"önerilen paket evet"** dersen sondaki paket uygulanır. Her maddenin "Ayrıntılar" bölümü onaylarsan
nasıl yapılacağını kesinleştirir; ek soru sormam gerekmez. Beğenmediğin ayrıntı varsa yalnız onu yaz.

Not: Sonuç ekranı herkes **"Devam et"** deyince geçer (en çok 60 sn); bu zaten var, burada yeniden önerilmiyor.
Yeni görsel gerektiren maddeler **🎨 Görsel**, ses alanına iş açan maddeler **🔊 Ses** diye işaretli (sesleri ses
yapay zekâsı üretir; dosya gelene kadar bugünkü sentez sesleri çalar).

---

## 1. Bugünkü oyun (özet)

Koddan doğrulandı (`packages/engine/src/games/ortalamanin-yarisi/`, `apps/client/src/games/ortalamanin-yarisi/`;
O5 değişikliği uygulanmış hâli).

- 3–8 oyuncu, **3 tur**. Her tur herkes gizlice 0–100 arası bir tam sayı seçer (**10 sn**).
- Hedef = o turun ortalaması × çarpan: 1. tur **½**, 2. tur **⅔**, 3. tur **¾**. Çarpan tur başında ekranda yazar;
  2. turdan itibaren "Önceki tur · ortalama X · hedef Y" satırı görünür.
- Sayı göndermeyene sunucu **0–100 arası rastgele** bir sayı atar; bu sayı sonuçta normal seçim gibi görünür ve
  ortalamaya girer.
- Tur puanı: hedefe en yakın **tek** kişiyse +2, sonraki derece +1; en yakınlar eşitse hepsi +1 ve başka ödül yok.
- Tur puanları toplanır; **genel skor yalnız sonda bir kez**: toplamı en yüksek +2, ikinci +1 (lider eşitse liderler
  +1). Eksi yok.
- Ara tur sonucu 5 sn, son tur sonucu 7 sn (sonra ortak "Devam et"). Herkes kilitlerse tur 1 sn sonra biter.
- Sonuç ekranı: üstte başlık (sayılar açılıyor → ortalama → hedef → puan), altında 0–100 çizgisi üstünde renkli
  noktalar, ortalama çizgisi ve altın hedef ışını, altında hedefe yakınlığa göre sıralı liste (sıra no, avatar, ad,
  sayı, ±uzaklık, puan). TV'de özel görünüm yok.

## 2. Gördüğüm sorunlar

**Oyun tasarımı**
1. **Bütün çarpanlar 1'den küçük: bilen masa 0'a kayar ve oyun eşitlikle biter.** ½, ⅔, ¾ hepsi hedefi ortalamanın
   altına çeker; her tur hedef düşer, oyuncular bir önceki turun hedefini görüp daha da aşağı iner. Oyunu bilen bir
   grupta herkes 0 yazar → herkes eşit en yakın → herkes her tur +1 → toplamlar eşit → herkes +1 genel. Testte de
   bu durum var ("herkes aynı sayıyı seçerse … liderlerin hepsi +1"). Ekran görüntüsündeki "herkes 40" örneği aynı
   tablonun 0'daki hâli.
2. **Hiçbir şey yapmayan kazanabiliyor.** Göndermeyene atanan rastgele sayı (ortalaması 50) hem ortalamayı yukarı
   çekiyor hem de **hedefe en yakın çıkarsa +2 alıyor**. Telefonu masada unutan oyuncu tur kazanabilir; sonuçta rastgele
   olduğu da belli değil ("Mert 87 mi seçti?!").
3. **8 kişide oyunun çoğu seyirci.** Her tur yalnız 1–2 kişi puan alıyor; 3 turda en çok 6 tur ödülü dağılıyor. 1. turda
   geride kalan altı kişinin 2. ve 3. turda "yetişme" hissi zayıf.
4. **Ad yanıltıcı.** Oyunun adı "Ortalamaya En Yakın" ama hedef hiçbir turda ortalama değil; ilk kez oynayan doğal
   olarak ortalamayı hedefliyor ve kaybediyor. (Kimlikteki "ortalamanın yarısı" ise yalnız 1. tur için doğru.)

**Arayüz (ekran görüntülerine bakarak: 390×844, 360×640, 844×390, izleyici, 5 ve 8 oyuncu, 3 tur)**
5. **Liste sonucu baştan ele veriyor.** Sonuç açılır açılmaz (ilk ~0,5 sn) liste **hedefe yakınlığa göre sıralı** ve sıra
   numaralı olarak geliyor; ortalama 1. saniyede, hedef 2,1. saniyede çıkıyor. Yani kimin kazandığı hedef görünmeden
   biliniyor; "hedef ışını" anı boşa gidiyor.
6. **6–8 oyuncuda ara turun puanı hiç görünmüyor.** Puan aşaması 3,1 sn + oyuncu başı 0,32 sn sonra başlıyor: 6 kişide
   5,2 sn, 8 kişide 5,8 sn. Ara tur sonucu ise 5 sn. Başlıktaki "Tur puanın" ve "Toplam" yazısı çıkmadan sonraki tur
   başlıyor (5 kişide yalnız 0,15 sn görünüyor).
7. **Son turda kimin kazandığı görünmüyor.** Son tur ekranı yalnız 3. turun listesini gösteriyor; başlıkta "GENEL SKOR
   · puan yok · 3 turun toplamı: 1 puan". Üç turun toplam tablosu, kimin +2 / +1 genel aldığı ekranda **yok**.
8. **Sıra numaraları kafa karıştırıyor.** Eşitlikte "1, 1, 2, 3…" diye gidiyor; 2. sıradaki "Sen" puan almıyor (çünkü
   en yakınlar eşit) ama "2" yazıyor. 8 kişilik ekranda iki tane "1" altın, sonra "2" puansız.
9. **Sayı çizgisi çok küçük, noktalar üst üste.** 0–100 çizgisi ~360 px genişlikte, 22 px'lik şeritler; 8 kişide
   noktalar iç içe geçiyor, kimin nerede olduğu ancak listeden okunuyor. Ekranın alt %30–40'ı boş.
10. **Seçim ekranında his yok.** Ortada büyük "?" kapsülü, altında isimsiz "?" kapsüller, altta kaydırma çubuğu. Önceki
    turun ortalaması ve hedefi yalnız bir yazı satırı; kendi önceki sayın ve ne kadar uzak kaldığın yok. Çubuk ilk
    dokunuşta 30'dan başlıyor (sayıya bir çapa koyuyor). 10 sn'de −1/+1 düğmeleriyle uğraşmak zor.
11. **Kesirler küçük ve soyut.** "Hedef: ½ · ortalamanın yarısı" 18 px'lik tek satır; ⅔ ve ¾ glifleri telefonda zor
    okunuyor. Kesir "ne kadar küçülüyor"u hissettirmiyor.
12. **Yatay ekranda kırılmalar:** oyun adı "Ortalama / ya En / Yakın" diye bölünüyor; "dörtte / üçü" ve "hedef / 28,7"
    alt satıra düşüyor.
13. **İzleyici ekranı boş:** ortada "?" kapsülü ve "Sonuç süre bitince açılır"; alt yarı boş. TV'de özel düzen yok.
14. **Anlatım örneksiz:** "Hedef sırayla ortalamanın ½'si, ⅔'si, ¾'ü olur" doğru ama oyuncu bir örnek hesap görmeden
    "yani kaç yazayım?" diye kalıyor.

---

## 3. Oyunu değiştiren öneriler (mekanik)

### OY-M1 · Kalabalık yanar: aynı sayıyı 3+ kişi seçerse puan yok — **önerim: EVET**
**Ne:** Bir turda **aynı sayıyı 3 ya da daha fazla oyuncu** seçmişse o sayı **"yanar"**: o oyuncular bu turdan puan
alamaz. Tur puanı yanmayanlar arasında bugünkü kuralla dağıtılır. Yanan sayılar ortalama ve hedef hesabına yine girer.
**Neden:** Sorun 1. "Herkes 0 yazar, herkes eşit" çıkışını kapatır: masa 0'a kayarsa 0 yanar ve 1–2 yazan kazanır.
Tek optimal sayı kalmaz; "herkes 0 diyecek, ben 2 diyeyim — ya herkes 2 derse?" düşüncesi oyunu geri getirir.
Matematik bilmeyen oyuncu için de basit bir kural: "kalabalığa uyma".
**Ayrıntılar:**
- Eşik her oyuncu sayısında **3**. 3 kişilik masada üçü de aynıysa üçü de yanar, o tur kimse puan almaz. İki kişinin aynı
  sayısı yanmaz (bugünkü gibi eşit en yakın +1 alabilir).
- Sunucunun atadığı rastgele sayılar (OY-M2) kalabalık sayımına **girmez** (rastgele bir sayı kimseyi yakmasın).
- Puan dağıtımı: yanmayanlar arasında en yakın tekse +2, sonraki derece +1; en yakınlar eşitse hepsi +1. Herkes yandıysa
  o tur kimse puan almaz.
- Sonuçta yanan noktalar ve satırlar "YANDI" etiketiyle sönük gösterilir (OY-U6).
- Anlatımın 3. maddesine eklenir: "Aynı sayıyı 3 kişi seçerse o sayı yanar."

### OY-M2 · Rastgele atanan sayı puan almaz — **önerim: EVET**
**Ne:** Sayı göndermeyene sunucu yine 0–100 arası rastgele bir sayı atar ve bu sayı ortalamaya girer (bugünkü kural),
ama **bu sayının sahibi o turdan puan alamaz**. Sonuçta sayının yanında 🎲 ve "rastgele" yazar.
**Neden:** Sorun 2. Oynamayan oyuncunun şansla +2 alması adaletsiz; "Mert 87 mi seçti?" karışıklığı da biter.
Ortalamaya girmeye devam ettiği için masaya bir belirsizlik bırakır (kural ruhu korunur).
**Ayrıntılar:**
- Puan dağıtımında rastgele sayının sahibi yokmuş gibi sıralama yapılır; ona en yakın "derece" bir sonrakine geçer.
- Göndermeyen = o turun süresi bitene kadar hiç `choose` göndermemiş oyuncu (seçip kilitlemeyen değil; seçen ama Tamam
  demeyenin seçimi geçerlidir, bugünkü gibi).
- `docs/KURALLAR.md` §13 madde 6 ve 13'teki "normal seçim gibi gösterilir" ifadesi "🎲 rastgele etiketiyle gösterilir,
  puan almaz" olur.

### OY-M3 · Son tur ters hedef: ortalamanın 1¼ katı — **önerim: İSTEĞE BAĞLI**
**Ne:** 3. turun çarpanı ¾ yerine **1¼** olur: hedef ortalamanın **üstüne** çıkar. 1. ve 2. tur bugünkü gibi ½ ve ⅔.
**Neden:** Sorun 1'e daha güçlü bir cevap: iki tur boyunca aşağı inen masa son turda ters yöne savrulur; "dur, şimdi
yukarı mı gidiyoruz?" anı. 0'da kalmayı ödüllendirmez.
**Neden isteğe bağlı:** Senin Ekim'de onayladığın ½ → ⅔ → ¾ dizisini değiştirir; OY-M1 tek başına 0'a kaymayı
zaten engelliyor. M1 ile oynandıktan sonra masa hâlâ "son tur sıkıcı" derse eklenir.
**Ayrıntılar (onaylanırsa):** hedef 125'e kadar çıkabilir (herkes 100 derse); sayı aralığı 0–100 kalır. Tur başında
büyük "TERS TUR · hedef ortalamanın ÜSTÜNDE" bandı. Tutorial 2. adım: "Hedef ½, ⅔, sonra ortalamanın 1¼ katı."

### OY-M4 · Final turu çift puan — **önerim: İSTEĞE BAĞLI**
**Ne:** 3. turun tur puanları iki kat sayılır: en yakın tek kişi **+4**, ikinci derece **+2**; eşit en yakınlar **+2**.
**Neden:** Sorun 3. İlk iki turda geride kalan da son turda birinciliği kapabilir; son tura kadar herkes oyunda kalır.
**Neden isteğe bağlı:** İlk iki turun ağırlığını azaltır; oyun zaten 47 sn ve genel ödül yalnız +2/+1. Bazı masalar
"ilk iki tur boşa mı gitti?" diyebilir.
**Ayrıntılar (onaylanırsa):** yalnız mini puan iki kat; genel skor yine en çok +2. Tur başında "FİNAL · PUANLAR ×2".

### OY-M5 · 6–8 oyuncuda üçüncü yakına da +1 — **önerim: İSTEĞE BAĞLI**
**Ne:** 6 ve daha fazla oyuncuda, en yakın **tek** kişiyse +2, ikinci derece +1, **üçüncü derece de +1**. En yakınlar
eşitse bugünkü gibi yalnız onlar +1.
**Neden:** Sorun 3. Kalabalık masada her tur 3 kişi ödül alır; ortadaki oyuncuların "bir puan kapabilirim" isteği artar.
**Neden isteğe bağlı:** Tur puanları sıklaşınca genel ödülde eşitlik ihtimali artar; 3–5 kişide gerek yok.
**Ayrıntılar (onaylanırsa):** dereceler eşit uzaklığı paylaşanlarla oluşur (bugünkü `ranks`); OY-M1 ile yananlar
derece almaz, derece sırası yanmayanlarla kurulur.

### OY-M6 · Tam isabet bonusu — **önerim: İSTEĞE BAĞLI**
**Ne:** Hedefe uzaklığı **1 ya da daha az** olan herkes, tur puanına ek **+1** alır ("TAM İSABET!").
**Neden:** "Az kalsın tutturuyordum" anını puana çevirir; hedefi gerçekten hesaplayana küçük ödül, ama ikinci yakın
da isabetliyse o da sevinir.
**Neden isteğe bağlı:** Hesap yapanı biraz daha ödüllendirir; matematik bilmeyen oyuncu için fark yaratmaz. Mini puan
toplamlarını büyütür (genel ödül yine +2/+1).
**Ayrıntılar (onaylanırsa):** uzaklık, gösterilen hedefe göre (ondalıklı) hesaplanır; yanan (OY-M1) ve rastgele
(OY-M2) sayılar almaz. Bir turda en çok N kişi alabilir.

### OY-M7 · Gizli çarpan (açılışta belli olur) — **önerim: HAYIR**
**Ne:** Her turun çarpanı gizli olur (½ ile 1¼ arasından çekilir), açılışta görünür.
**Neden önermiyorum:** Hedef tahmini "masayı okuma" oyunundan zar atma oyununa döner; hesap yapan da yapmayan da
eşitlenir ama kimse "bunu ben bildim" demez. Tek optimal stratejiyi kırmak için OY-M1 daha adil.

### OY-M8 · Oyunun adı: "Kesir Avı" ya da "Ortalamanın Gölgesi" — **önerim: İSTEĞE BAĞLI**
**Ne:** Görünen ad "Ortalamaya En Yakın" yerine hedefin ortalama **olmadığını** söyleyen bir ad olur. Öneriler:
**"Ortalamanın Gölgesi"** (hedef ortalamanın altında kalan gölgesi), **"Kesir Avı"**. Kimlik (`ortalamanin-yarisi`)
değişmez.
**Neden:** Sorun 4. İlk kez oynayanın ortalamayı hedefleme hatası adın kendisinden geliyor.
**Neden isteğe bağlı:** Ad senin tercihindir; wiki, maç kartları ve rozet metinleri de değişir. Ad kalırsa OY-U16
anlatımdaki örnek bu karışıklığı büyük ölçüde giderir.

---

## 4. Arayüz ve his önerileri

### 4a. Ana ekranlar ve akış

### OY-U1 · Seçim ekranında canlı sayı yolu — **önerim: EVET**
**Ne:** Büyük "?" kapsülü küçülür; yerine ekran genişliğinde bir **0–100 yolu** gelir. Yolun üstünde:
- 2. turdan itibaren önceki turun **ortalaması** (camgöbeği kesik çizgi) ve **hedefi** (altın çizgi), ikisinin arasında
  küçük ok: "hedef buraya kaydı";
- önceki turdaki **kendi sayın** (senin renginde içi boş halka) ve ona yazılı uzaklık ("geçen tur 22 · hedefe 3,8");
- şu anki seçimin: yolun üstünde senin renginde parlayan pin; sayı pin'in üstünde büyük.
Kaydırma çubuğu bu yolun kendisi olur: pin'i sürüklersin.
**Neden:** Sorun 10. Sayıyı soyut bir kutuda değil, geçen turun hedefinin yanında seçersin: "hedef 19'du, şimdi daha da
düşecek" hissi hesap yapmadan gelir.
**Ayrıntılar:**
- 1. turda yol boş (yalnız 0, 50, 100 işaretleri) ve üstünde "Herkes ne yazacak? Hedef ortalamanın yarısı."
- Sürüklerken her 5'te bir hafif titreşim, 0/50/100'de biraz daha güçlü. −1/+1/−10/+10 düğmeleri yolun altında kalır.
- **Başlangıç çapası kalkar:** pin ilk dokunduğun yere gelir (bugün ilk dokunuşta 30'dan başlıyor). Seçim yapılmamışken
  pin yok, yol üstünde "Dokun ve sürükle".
- İzleyici ve TV önceki turların çizgilerini görür, kimsenin bu turki pin'ini görmez.

### OY-U2 · Oyuncu kapsülleri: ad ve geçen turun sayısı — **önerim: EVET**
**Ne:** Seçim ekranındaki isimsiz "?" kapsüllerin altında kısa ad (en çok 6 harf) ve 2. turdan itibaren **o oyuncunun
geçen turdaki sayısı** küçük yazıyla ("Elif · 12"). Kilitleyenin kapsülü ✓ olur (bugünkü gibi).
**Neden:** Sorun 3 ve 10. Masa birbirini okur: "Elif hep düşük gidiyor, Mert hâlâ 60'larda" — konuşma ve strateji
insan üzerinden kurulur; matematik bilmeyen de "Elif'i taklit ederim" diyebilir.
**Ayrıntılar:** önceki tur sayıları zaten açıldıktan sonra herkese açık; yeni gizli bilgi yok. Rastgele atanan sayının
yanında 🎲. 8 kişide kapsüller 2 satır (4 + 4).

### OY-U3 · Tur kartı: kesri gözle gör — **önerim: EVET** · 🔊 Ses
**Ne:** Her turun başında 0,9 sn'lik tam ekran kart: büyük **"TUR 2 / 3"**, altında kesir yerine görsel: bir çubuğun
⅔'ü dolar ve yazı **"Hedef: ortalamanın üçte ikisi"**; altında örnek: "ortalama 30 olursa hedef 20". Sonra kart küçülerek
ekranın üstündeki şeride yerleşir (şerit sürekli "⅔ · üçte iki" gösterir, glifler 24 px).
**Neden:** Sorun 11. ½, ⅔, ¾ glifleri küçük ve soyut; dolan çubuk "ne kadar küçülüyor"u bir bakışta anlatır.
**Ayrıntılar:** kart seçim süresinden yemez: süre kart yerleşince başlar (tur başına +0,9 sn; toplam ~+2,7 sn). Örnek
sayı sabit: "ortalama 30 → hedef 15 / 20 / 22,5" (OY-M3 ile 3. tur "37,5"). Kart sesi kısa "vınn".

### OY-U4 · Son 3 saniye ve kilit — **önerim: EVET** · 🔊 Ses
**Ne:** 10 sn'lik turda son 3 saniyede yolun kenarları nabız gibi parlar, seçmemiş oyuncunun telefonu her saniye kısa
titrer ve üstte "Seçmezsen 🎲 rastgele!" yazar. Tamam'a basınca pin yolun içine "mühürlenir" (kilit simgesi) ve
kapsülün ✓ olur.
**Neden:** 10 sn kısa; seçmemiş oyuncunun rastgele sayıya düşmesini (sorun 2) önlemenin en ucuz yolu hatırlatmak.
**Ayrıntılar:** kilitlemiş oyuncuda titreşim yok. Hareket azaltmada nabız yok, yalnız yazı.

### 4b. Açılış/sonuç anı ve gerilim

### OY-U5 · Yeni açılış sırası: terazi → kesir → isabet — **önerim: EVET** · 🔊 Ses
**Ne:** Sonuç sırası değişir; liste **en son** gelir (sorun 5):
1. **0,0–1,2 sn** — Kapsüller tek tek açılır, sayılar yolun üstüne düşer (oyuncu başı 0,12 sn).
2. **1,2–2,2 sn** — Yol bir **terazi kolu** gibi hafifçe sallanır ve dengede durduğu noktada **ortalama** çizgisi çıkar
   ("denge noktası 36,4").
3. **2,2–3,0 sn** — Ortalama çizgisinden altın bir ışın çıkar ve **kesir kadar sola kayar** (½'de yarı yola), durduğu
   yer **hedef** ("× ½ → 18,2").
4. **3,0–4,0 sn** — Noktalardan hedefe ince ipler uzanır; **en uzaktan en yakına** doğru söner, en yakın(lar) altın
   parlar.
5. **4,0 sn+** — Liste aşağıdan yükselir (en yakın en üstte), puanlar ve başlıktaki tur puanı/toplam.
**Neden:** Sorun 5. Hedef görünmeden kimse kazananı bilmez; ortalamanın "denge noktası", hedefin "kesir kadar kayma"
olması matematik bilmeyene de sezgisel gelir.
**Ayrıntılar:**
- Süre oyuncu sayısından bağımsız tutulur (adım 1 en çok 1,2 sn; 8 kişide oyuncu başı 0,15 sn). Puan aşaması en geç
  **4,0 sn**'de başlar; ara tur 5 sn'ye sığar (sorun 6 çözülür).
- Geç açılan ekran kaldığı yerden devam eder (bugünkü `skew` mantığı).
- Hareket azaltmada terazi ve ışın kayması yok: ortalama, hedef, liste 0,4 sn arayla belirir.

### OY-U6 · Yanan ve rastgele sayılar sahnede — **önerim: EVET (OY-M1/M2 ile)** · 🔊 Ses
**Ne:** Açılışın 1. adımında aynı sayıya üç ya da daha fazla nokta düşerse noktalar üst üste yığılır, kıvılcımla
**"YANDI"** yazar ve sönük kalır; listede de sönük, "YANDI" etiketli. Rastgele atanan sayı 🎲 zar simgesiyle düşer,
listede "rastgele · puan yok".
**Neden:** Yeni kuralların neden puan değiştirdiğini sahnede gösterir; "neden ben değil de o +2 aldı?" sorusu çıkmaz.
**Ayrıntılar:** yanma sesi kısa "cız"; zar sesi küçük "tıkır". Yanan sayılar ortalamaya girdiği için terazide yine
ağırlık olarak durur.

### OY-U7 · "Ne olurdu?" satırı: kazandıracak sayı — **önerim: EVET**
**Ne:** Puan aşamasında başlığın altında **sana özel** tek satır:
- Kazanamadıysan: **"15 ile 19 arası yazsaydın +2 alırdın."** (ya da tek sayıysa "17 yazsaydın …")
- Kazandıysan: **"Kıl payı: Elif senden 0,4 uzaktaydı."**
- Hiçbir sayı seni kazandıramazdıysa (ör. biri tam hedefte): **"Bu turu kimse Zeynep'ten alamazdı."**
**Neden:** "Ne olurdu" anı bu oyunun en büyük eksiği. Kendi sayının ortalamayı da değiştirdiğini hesaba katan doğru
cevap, oyuncuya bir sonraki tur için sezgi verir ("daha düşük yazmalıydım").
**Ayrıntılar:**
- Hesap istemcide, açılmış verilerle: 0–100 arasındaki her X için, senin sayın X olsaydı (ortalama ve hedef yeniden
  hesaplanarak, OY-M1 yanma kuralı dahil) **tek en yakın** olup olmayacağına bakılır; sonuç kendi sayına en yakın
  kesintisiz aralık olarak yazılır. Böyle X yoksa +1 getiren aralık; o da yoksa üçüncü cümle.
- Senin sayın rastgele atandıysa: "Seçmedin, sana 🎲 74 düştü."
- İzleyici ve TV'de kişisel satır yerine: "Kazandıran aralık: 15–19".

### OY-U8 · Üç turun tablosu ve final — **önerim: EVET**
**Ne:** Son turun puan aşamasından sonra (4,0 sn + 1,5 sn) liste kısa bir geçişle **üç turun tablosuna** döner: her
satırda avatar, ad, üç küçük tur kutusu (●● = +2, ● = +1, boş = 0; yanan tur için küçük alev), toplam, ve en sağda
**genel skora eklenen** (+2 altın / +1 mavi). Başlık: "GENEL SKOR" ve kendi sonucun. Üstte üç turun hedefleri:
"18,2 → 12,8 → 9,6".
**Neden:** Sorun 7. Bugün son ekranda kimin +2 aldığı görünmüyor; oyuncu "puan yok" yazısını görüp nedenini anlamıyor.
**Ayrıntılar:**
- Tablo toplamı en yüksekten aşağı sıralı; eşit toplamlar aynı satır rengini alır.
- Lider eşitliğinde (herkese +1) başlıkta "Berabere! Liderler +1".
- 8 kişide satır yüksekliği 34 px; 360×640'a sığar (başlık küçülür).
- Son tur listesi kaybolmaz: tablonun üstünde "3. tur" düğmesine dokununca geri gelir.

### OY-U9 · Liste: sıra numarası yerine anlamlı rozet — **önerim: EVET**
**Ne:** Satır başındaki "1, 1, 2, 3" yerine yalnız ödül alanlarda rozet: **"EN YAKIN"** (altın), **"2. YAKIN"** (mavi),
eşit en yakınlarda **"EŞİT"**; diğer satırlarda numara yok, yalnız ±uzaklık. Kendi satırın sol kenarda senin renginde
şerit (bugünkü gibi) ve "Sen".
**Neden:** Sorun 8. "2" yazan ama puan almayan satır kafa karıştırıyor.
**Ayrıntılar:** OY-M5 ile "3. YAKIN". Yanan ve rastgele satırlar etiketleriyle (OY-U6).

### OY-U10 · Ara tur özeti ve "sonraki tur" köprüsü — **önerim: EVET**
**Ne:** Ara turun son 1 saniyesinde ekranın altında, sonraki tura geçerken kalacak kısa özet: "Bu turun hedefi **18,2**
· Sen **22** (+1) · Toplamın **1**" ve "Sonraki: **⅔**". Bu özet sonraki turun seçim ekranında OY-U1 yoluna akar.
**Neden:** Sorun 6. 5 sn'lik ara sonuçta okunacak tek şeyin ne olduğu net olur; bilgi bir sonraki tura taşınır.
**Ayrıntılar:** özet kutusu bugün boş kalan alt alanı kullanır (390×844'te alt %30 boş).

### 4c. Telefon ergonomisi ve okunurluk

### OY-U11 · Sayı yolu büyüsün, noktalar ayrışsın — **önerim: EVET**
**Ne:** Sonuçtaki 0–100 çizgisi ekranın üst yarısının tamamını kullanır (390×844'te ~260 px yükseklik); noktalar
24 px, içinde avatar başı (bugün düz renk nokta). Üst üste binen noktalar dikeyde istiflenir; istif 4'ü geçerse yol
**yakınlaşır** (hedef çevresindeki ±20'lik bölüm büyütülür, uçlar sıkıştırılır).
**Neden:** Sorun 9. 8 kişide noktalar iç içe; kimin nerede olduğu listeden okunuyor. Boş alt alan da kullanılır.
**Ayrıntılar:** yakınlaşma yalnız sonuç ekranında, adım 4'ten sonra; yolun altında "büyütüldü" küçük yazısı. 360×640'ta
yol ~180 px.

### OY-U12 · Yatay ekran düzeni — **önerim: EVET**
**Ne:** Yatayda (844×390) solda tur bilgisi + oyuncu kapsülleri, ortada sayı yolu, sağda büyük sayı + Tamam. Hedef
şeridi tek satır ("Tur 3/3 · ¾ · dörtte üç"); oyun adı kelime ortasından bölünmez (küçülür, en az 13 px).
**Neden:** Sorun 12.
**Ayrıntılar:** sonuç ekranında yatayda yol solda, liste sağda iki sütun.

### 4d. İzleyici, kopan oyuncu ve TV

### OY-U13 · İzleyici ve TV — **önerim: EVET**
**Ne:**
- **İzleyici:** "?" kapsülü yerine OY-U1 yolu (önceki turların çizgileri) ve OY-U2 kapsülleri; alt yarıda o ana kadarki
  üç tur tablosu (OY-U8'in ara hâli).
- **TV (`StageView`):** üstte büyük "TUR 2/3 · ⅔", ortada ekran genişliğinde 0–100 yolu (önceki turların hedef izleri),
  sağda oyuncu sütunu (avatar, ad, kilit, toplam). Açılış (OY-U5) TV'de tam ekran: terazi, kayan ışın, ipler; son turda
  üç tur tablosu büyük.
**Neden:** Sorun 13. Bu oyunun açılışı ortak bir "aaa!" anı; uzaktan okunur olmalı.
**Ayrıntılar:** açılıştan önce hiçbir sayı TV'de/izleyicide yok (bugünkü gizlilik aynen).

### OY-U14 · Kopan oyuncu — **önerim: EVET**
**Ne:** Seçim sırasında bağlantısı kopan oyuncunun kapsülü gri ve "kopuk"; açılışta sayısı varsa normal, yoksa 🎲
(OY-M2). Turlar arasında dönerse sonraki tura normal katılır.
**Neden:** Bugün kopan oyuncu ekranda ayırt edilmiyor; rastgele sayının nereden geldiği anlaşılmıyor.
**Ayrıntılar:** kopan oyuncu beklenmez (erken bitiş kuralı aynen).

### 4e. Ses, titreşim ve hareket

### OY-U15 · Sayı yolu ses ve titreşim seti — **önerim: EVET** · 🔊 Ses
**Ne:** Sürüklerken pin yükseldikçe tizleşen hafif "tik"ler (her 5'te bir), kilitte "klik-mühür", tur kartında kısa
"vınn", son 3 sn'de tik, açılışta kapsül "pop"ları (oyuncu başına bir), terazide ahşap "gıcırtı" ve denge "tak",
hedef ışınında lazer "fiuuu", iplerin sönüşünde yumuşak "fıs", en yakında zil; eşitlikte iki notalı akor; yanan sayıda
"cız"; finalde (OY-U8) +2 için kısa fanfar.
**Titreşim:** sürüklemede her 5'te 5 ms, kilitte 20 ms, en yakın sensen üç kısa, yandıysan uzun.
**Neden:** Bugün açılışta yalnız genel "tick / go / fanfare" sesleri var; terazi ve ışın metaforunu ses taşır.
**Ayrıntılar:** `ortalama.*` olay adlarıyla ses haritasına; dosya gelene kadar sentez.

### 4f. İlk kez oynayan için öğretme (anlatım ekranı dahil)

### OY-U16 · Anlatım: örnek hesaplı üç madde — **önerim: EVET**
**Ne:** Anlatım maddeleri:
1. "Her tur gizlice 0–100 arası bir sayı yaz. **Ortalamayı değil, onun bir kesrini** tahmin et."
2. "Örnek: sayılar 10, 20, 30, 40, 50 → ortalama 30 → **yarısı 15**. 10 ve 20 eşit yakın: ikisi de +1." (2. ve 3. tur ⅔ ve ¾.)
3. "En yakın +2, ikinci +1; üç turun toplamı kazanır. **Aynı sayıyı 3 kişi yazarsa o sayı yanar.**" (OY-M1 yoksa son
   cümle çıkar.)
**Neden:** Sorun 4 ve 14. Örnek, adın yarattığı "ortalamayı hedefle" yanılgısını ilk saniyede düzeltir.
**Ayrıntılar:** anlatım görseli (kapsüller + ortalama çizgisi + altın ışın) zaten bu örneğe uygun; ışının ortalamadan
yarı yola kayması 1,5 sn'lik döngü olarak oynatılabilir (CSS). Metin madde başına en çok iki satır.

### OY-U17 · İlk turda "herkes yazarsa" ipucu — **önerim: İSTEĞE BAĞLI**
**Ne:** Bu oyunu ilk kez oynayan (yerel kayıt) oyuncuya 1. turda yolun üstünde tek seferlik balon: "İpucu: herkes
yüksek yazarsa hedef de yükselir. Ne bekliyorsun?" 3 sn sonra kaybolur.
**Neden:** Matematik bilmeyen oyuncuya "başkalarını düşün" fikrini verir.
**Neden isteğe bağlı:** Strateji ipucu sayılabilir; bazı oyuncular keşfi kendisi yapmak ister.

### 4g. Erişilebilirlik

### OY-U18 · Renk körü, hareket azaltma, yazı, ekran okuyucu — **önerim: EVET**
**Ne:**
- **Renk körü:** noktalarda bugün `CbMarker` şekilleri var; liste satırlarında ödül yalnız altın/mavi kenarla
  gösteriliyor → OY-U9 rozet metinleri asıl bilgi olur. Ortalama (kesik çizgi) ve hedef (kalın düz çizgi) çizgi
  biçimiyle de ayrılır, yalnız renkle değil.
- **Hareket azaltma:** terazi sallanması, ışın kayması, ipler kapanır; adımlar 0,4 sn arayla metin olarak gelir.
- **Yazı boyutu:** kesir glifleri (½ ⅔ ¾) en az 24 px ve her zaman yanında yazıyla ("yarısı"); ±uzaklık en az 13 px.
- **Ekran okuyucu:** açılışta tek duyuru: "Ortalama 36,4. Hedef yarısı, 18,2. En yakın Zeynep, 18. Sen 22, ikinci,
  +1." Sayı yolu "kaydırıcı, değer 22" olarak okunur; OY-U7 satırı da okunur.
**Neden:** Bugün başlığın `aria-live` duyurusu var ama sahiplik ve ödül okunmuyor; kesirler küçük.

---

## 5. Yapay zekâ (AI) ile yapılabilecekler

### OY-AI1 · Masa psikoloğu yorumu — **önerim: HAYIR**
Oyun sonunda tek cümle: "Oyuncu2 üç turda da masanın bir adım altında kaldı; Oyuncu5 ise ısrarla 50'de." Ortak yorum
altyapısıyla, modele "Oyuncu1…N" ve tur sayıları gider, puanı belirlemez.
**Neden önermiyorum:** Oyun 47 sn ve sayısal; söylenecek şeyi OY-U7 ("15–19 yazsaydın") ve OY-U8 (üç tur tablosu) kurala
dayalı ve her zaman doğru biçimde söylüyor. Yapay zekâ cümlesi buraya ek bir şey katmıyor.

---

## 6. İçerik ve üretim ekibine düşen işler

- **Ses Efektleri yapay zekâsı (🔊):** `ortalama.*` seti — sürükleme tikleri (yükselen), kilit mührü, tur kartı "vınn",
  son 3 sn tiki, kapsül "pop" (8 varyasyon), terazi gıcırtısı + denge "tak", hedef ışını, ip sönüşü, en yakın zili,
  eşitlik akoru, yanma "cız", zar "tıkır", final fanfarı (OY-U3, U4, U5, U6, U15).
- **Efekt Dokuları yapay zekâsı:** yanma kıvılcımı, altın ışın parıltısı (CSS ile de yapılır).
- **Arayüz İkon ve Süsleri yapay zekâsı:** 🎲 rastgele rozeti, "YANDI" etiketi, "EN YAKIN / 2. YAKIN / EŞİT" rozetleri,
  tur kutusu simgeleri (OY-U8).
- **Görsel (🎨, ChatGPT akışı):** gerekmiyor. Terazi ve kesir çubuğu CSS/SVG.
- **Moderasyon ve Wiki yapay zekâsı:** wiki metni (kalabalık kuralı, rastgele sayının puan almaması, OY-M8 onaylanırsa
  yeni ad) ve oyun kartı.
- **Test, Hata ve Performans yapay zekâsı:** bot senaryoları: "herkes 0" (M1 ile herkes yanar, kimse puan almaz),
  "herkes aynı sayının bir fazlası", "bir oyuncu hiç göndermez" (M2 ile puan alamaz), 8 oyuncu ara turda açılışın 5 sn'ye
  sığması.
- **İçerik Havuzu:** iş yok.

---

## 7. Önerilen paket

**EVET:** OY-M1, OY-M2; OY-U1 … OY-U16, OY-U18.
**İSTEĞE BAĞLI:** OY-M3 (son tur 1¼), OY-M4 (final çift puan), OY-M5 (6–8 kişide üçüncüye +1), OY-M6 (tam isabet),
OY-M8 (ad değişikliği), OY-U17 (ilk tur ipucu).
**HAYIR:** OY-M7 (gizli çarpan), OY-AI1 (masa psikoloğu).

Bu paketle oyun şöyle akar: anlatım "ortalamayı değil kesrini tahmin et; 10-20-30-40-50 → 15" örneğini gösterir →
tur kartında çubuğun yarısı dolar "hedef: yarısı" → yolun üstünde pin'ini sürüklersin; 2. turda geçen turun ortalaması,
hedefi ve senin geçen sayın yolda durur, kapsüllerde "Elif · 12" → son 3 sn'de "Seçmezsen 🎲 rastgele!" → açılışta
sayılar düşer, terazi dengelenir (ortalama), ışın kesir kadar kayar (hedef), ipler uzaktan yakına söner, sonra liste;
üç kişinin yazdığı 0 "YANDI" → "15–19 yazsaydın +2 alırdın" → son turdan sonra üç turun tablosu ve +2 / +1.

**Değişen kurallar (paket onaylanırsa):** bir turda aynı sayıyı 3+ oyuncu seçerse o sayı yanar (o oyuncular o tur puan
almaz; rastgele sayılar sayılmaz; ortalamaya girer); göndermeyene atanan rastgele sayı ortalamaya girer ama sahibi puan
alamaz ve 🎲 ile gösterilir; tur kartı için tur başına +0,9 sn (seçim süresi 10 sn aynen). `docs/KURALLAR.md` §13, wiki ve
testler buna göre güncellenir.

**Değişmeyenler:** 3–8 oyuncu; 3 tur; 0–100 tam sayı; çarpanlar ½, ⅔, ¾ (OY-M3 onaylanmazsa); 10 sn seçim, 5 sn ara ve
7 sn son açılış; seçimlerin tur sonuna kadar gizli olması; tur puanı (tek en yakın +2, ikinci +1; eşit en yakınlar +1);
genel skorun yalnız sonda toplamdan +2 / +1 verilmesi; eksi puan olmaması; kilit ve tur başına erken bitiş; kopan
oyuncunun beklenmemesi.

**🎨 Yeni görsel gerekenler (paket):** yok. Terazi, kesir çubuğu, ipler, rozetler CSS/SVG ile çizilir.
