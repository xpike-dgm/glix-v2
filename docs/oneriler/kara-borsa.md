# Kara Borsa — geliştirme önerileri

Bu dosya onay içindir. Her maddenin bir kodu var (ör. **KB-M2**). Cevabını tek satırda verebilirsin:

> KB-M1 evet, KB-M2 hayır, KB-U3 evet …

ya da yalnız **"önerilen paket evet"** dersen sondaki paket uygulanır. Her maddenin "ayrıntılar" bölümü onaylarsan
nasıl yapılacağını kesinleştirir; ek soru sormam gerekmez. Beğenmediğin ayrıntı varsa yalnız onu yaz.

Not: Sonuç ekranı herkes **"Devam et"** deyince geçer (en çok 60 sn). Yeni görsel gerektiren maddeler **🎨 Görsel**
diye işaretli.

---

## 1. Bugünkü oyun (özet)

- 3–8 oyuncu, 5 tur. Herkes 100 jetonla başlar.
- Her tur gizemli bir kutu gelir: değeri 0–60 arası ya da %15 ihtimalle **lanetli (−20)**.
- Her oyuncu yalnız kendine özel, her zaman doğru bir ipucu görür ("Değeri 30'dan büyük", "Değeri tek sayı",
  "Kutu lanetli!" …). Sözlü blöf serbest.
- 20 sn içinde gizli, tek seferlik teklif verilir (0 = geç). En yüksek teklif kutuyu alır ve teklifini öder;
  eşitlikte önce veren kazanır. Açılış 5 sn.
- Oyun içi puan = kalan jeton + alınan kutuların değeri. Genel skor: 1. **+2**, 2. ve 3. **+1**, kalanlar 0.

## 2. Gördüğüm sorunlar

**Oyun tasarımı**
1. **Hiç teklif vermemek en güvenli yol, üstelik ödül getiriyor.** Geçen oyuncu 100'de kalır; kutu alanların çoğu
   (kazanan genelde fazla ödeyen olduğu için) 100'ün altına düşer. Sıralama ödülü eşitliği paylaştırdığı için
   **herkes beş tur da geçerse herkes +2 alıyor.** Wiki'deki örnekte bile hiçbir şey yapmayan iki oyuncu +1 alıyor.
2. **Ödül dağılımı diğer oyunlardan farklı ve cömert.** +2/+1/+1 ile 3 kişilik oyunda herkes puan alıyor; diğer
   oyunlarda onayladığın düzen +2/+1/0.
3. **İpuçlarının gücü çok eşitsiz.** Biri "Değeri 20 ile 38 arasında" ya da "Kutu lanetli!" görürken öteki
   "Değeri tek sayı" ya da "3'ün katı değil" görüyor; ikinciler pratikte hiçbir şey söylemiyor. Tur, ipucu
   şansıyla belirleniyor.
4. **Beş tur birbirinin aynısı.** Sona doğru tırmanan bir an, "büyük final" yok; geride kalanın toparlanma şansı az.

**Arayüz** (ekran görüntülerine bakarak)
5. **"Kutu açıldı" diyor ama kutu açılmıyor.** Açılışta teklif ekranındaki kapalı kutu aynen duruyor; değer yalnız
   altında bir sayı olarak çıkıyor. Lanetli kutuda da kapalı bir sandık (mor duman) görünüyor. Oyunun en heyecanlı
   anı olan "içinden ne çıktı" hissi yok.
6. **Alttaki avatar şeridi isimsiz ve anlamı değişiyor.** Teklif sırasında altındaki sayı jeton, açılışta servet
   (jeton + kutu). Hiçbir etiket yok; "133 kimin?" sorusu ancak avatar rengini hatırlayarak çözülüyor.
7. **Kazananın kâr mı zarar mı ettiği görünmüyor.** Mert 37'lik kutuya 44 jeton verip 7 zarar etmiş ama satırı
   altın çerçeveyle "birinci" gibi parlıyor. Lanetli kutuyu 44'e alan da aynı altın çerçeveyi alıyor. Masadaki
   "kazık yedin!" kahkahası ekranda yok.
8. **Teklif ekranında boşluk ve kayma.** Teklif verilince ipucu kartı ile cüzdan arasında ekranın üçte biri boş
   kalıyor; tek "Teklifin gizli: 35 · 3/5 hazır" satırı küçük ve yeşil bir yazı, mühürlenme hissi vermiyor. İpucu
   kartının genişliği ekrandan ekrana değişiyor (teklif ekranında dar, sonrakinde tam genişlik). Hiç seçim
   yapılmamışken büyük "0" yazıyor, sanki 0 seçilmiş gibi.
9. **İzleyici ekranında başlık "Teklifini ver"** yazıyor (izleyici teklif veremez); ekranın yarısı boş, ipucu ya da
   geçmiş yok. **Jetonu biten oyuncunun** ekranı da yarı boş, yalnız "bu turu izle" yazıyor.
10. **Anlatımda lanetli kutu hiç geçmiyor.** Oyunun en önemli tuzağı (−20) ilk kez açılışta öğreniliyor.
11. **Açılış 5 sn ve her şey bir anda beliriyor:** değer, kazanan, 5 satır teklif ve servet şeridi aynı anda;
    okumaya yetmiyor, "kim ne vermiş" sırayla açılmadığı için gerilim yok.
12. **Geçmiş görünmüyor.** Teklif verirken önceki turlarda kimin ne aldığı, kimin önde olduğu ekranda yok.
13. **TV'de özel düzen yok;** telefon ekranı büyütülüyor, kenarlar boş.

---

## 3. Oyunu değiştiren öneriler (mekanik)

### KB-M1 · Puan "kâr" üzerinden, ödül +2 / +1 / 0 — **önerim: EVET**
**Ne:** Oyun içi puan **kâr** olur: (kalan jeton + kutu değerleri) − 100. Ekranda "Kâr +12" / "Zarar −7" diye
görünür. Oyun sonunda kârı **0'dan büyük** olanlar sıralanır: en yüksek **+2**, ikinci **+1**, diğerleri **0**.
Eksi genel puan yok.
**Neden:** Sorun 1 ve 2. Beş tur geçen oyuncu artık ödül alamaz; puan için kârlı bir kutu almak zorundasın.
Ödül düzeni diğer oyunlarla aynı olur.
**Ayrıntılar:**
- Birincide eşitlik varsa hepsi +2, sonraki farklı kâr +1 (Gizli Alışveriş'teki gibi).
- Kârı 0 ya da eksi olan ödül almaz. Kârı 0'dan büyük tek kişi varsa yalnız o +2 alır. Hiç kimse kâr etmediyse
  kimse ödül almaz ("Kimse kâr edemedi" yazısı).
- Kâr oyun içinde eksi olabilir (lanetli kutu); bu yalnız oyun içi göstergedir, genel skora eksi gitmez.
- Maç kartlarında "birinci" ve "sonuncu" kâra göre belirlenir (bugün de mini puana göre; değeri yalnız 100 kayar).
- 3 oyuncuda artık herkes ödül almaz; 8 oyuncuda en çok 2 farklı derece ödül alır (eşitlikler hariç).

### KB-M2 · Son tur "Büyük Kutu" — **önerim: EVET** · 🎨 Görsel (isteğe bağlı)
**Ne:** 5. turdaki kutu iki kat büyüktür: değeri **0–120** arası ya da %15 ihtimalle lanetli **−40**.
**Neden:** Sorun 4. Final turu gerçek bir final olur; geride kalan büyük bir kutuyla öne geçebilir, önde olan
"jetonumu koruyayım mı?" diye düşünür.
**Ayrıntılar:**
- Teklif üst sınırı aynı (o anki jetonun). Süre aynı (20 sn).
- İpucu eşikleri ölçeğe göre iki katına çıkar (ör. "Değeri 70'ten büyük", "Değeri 40 ile 90 arasında").
- Tur başında ekranda "BÜYÜK KUTU · DEĞERİ İKİ KAT" bandı, sayaç rozeti "TUR 5/5 · FİNAL".
- Görsel: mevcut kutulardan biri (antika kutu) altın parıltı ve büyük boyla gösterilir; ayrı görsel istersen
  🎨 "büyük altın sandık".

### KB-M3 · İki satırlı ipucu: ana + ek — **önerim: EVET**
**Ne:** Her oyuncu her tur **iki** ipucu görür: işe yarayan bir **ana ipucu** ve küçük bir **ek ipucu**.
**Neden:** Sorun 3. Kimse "Değeri tek sayı" ile tek başına kalmaz; herkesin elinde değeri daraltan bir bilgi olur
ama yine de herkesin bilgisi farklıdır, blöf ve karşılaştırma devam eder.
**Ayrıntılar:**
- **Ana ipucu (lanetli olmayan kutu):** "n'den büyük", "n'den küçük" ya da "a ile b arasında" (eşikler bugünkü gibi
  gerçek değere yakın rastgele; "arasında" aralığı en çok 30 genişlikte).
- **Ana ipucu (lanetli kutu):** oyuncuların **en az 1, en çok yarısı** (yukarı yuvarlanır) "Kutu lanetli!" görür;
  diğerleri doğru ama yanıltıcı "Değeri n'den küçük" görür (n 1–40, bugünkü gibi).
- **Ek ipucu:** çift/tek, 3/5/10'un katı ya da katı değil, "Kutu lanetli değil" (yalnız lanetsiz kutuda).
- İpuçları her zaman doğrudur. Farklı oyunculara mümkün olduğunca farklı ana ipucu verilir (bugünkü 6 deneme kuralı).
- Kartta ana ipucu büyük, ek ipucu altında küçük yazılır.

### KB-M4 · Tezgâh söylentisi — **önerim: İSTEĞE BAĞLI**
**Ne:** Teklifin **10. saniyesinde** herkesin ekranında aynı, doğru bir ek bilgi belirir: "Söylenti: değeri
çift sayı" gibi.
**Neden:** Masada "söylentiyle benim ipucum çelişmiyor, demek ki…" konuşmasını başlatır; geç teklif verene küçük
bir ödül olur.
**Neden isteğe bağlı:** KB-M3 zaten bilgiyi artırıyor; ikisi birlikte kutuyu fazla belli edebilir. Önce M3 ile
oynanır, gerekirse eklenir.
**Ayrıntılar (onaylanırsa):** söylenti ek ipucu havuzundan seçilir, kimsenin ek ipucuyla aynı olmaz; o ana kadar
teklif vermiş olanlar da görür. Lanetli kutuda söylenti hiçbir zaman "lanetli" demez.

### KB-M5 · İkinci fiyat (kazanan ikinci en yüksek teklifi öder) — **önerim: HAYIR**
**Ne:** En yüksek teklif kutuyu alır ama ikinci en yüksek teklif kadar öder.
**Neden önermiyorum:** Daha cesur teklif getirir ama parti ortamında "ben 44 dedim, neden 18 ödedim?" kafa
karıştırır; KB-M1 zaten geçmeyi cezalandırarak teklif vermeyi teşvik ediyor.

---

## 4. Arayüz ve his önerileri

### KB-U1 · Gerçek açılış: "SATILDI!" ve kutunun açılması — **önerim: EVET** · 🎨 Görsel
- Teklif süresi bitince ekranın ortasına **tokmak iner**, "SATILDI!" damgası ve tok tokmak sesi (kimse almadıysa
  "SATILMADI").
- Teklifler **düşükten yükseğe tek tek** açılır (her satır yarım saniye, son satır davulla); kazanan satır en son
  gelir.
- Ardından **kutunun kapağı açılır**, içinden ışık çıkar, değer 0'dan sayarak yükselir. Lanetli kutuda kapak
  açılınca mor duman ekrana yayılır, ekran kısa sarsılır, değer kırmızı "−20".
- Bu sahneye yer açmak için açılış süresi **5 sn → 8 sn** (5 turda toplam 15 sn uzar; oyun ~2 dk 20 sn).
- 🎨 Gereken: dört kutunun **açık hâli** (ahşap, çelik, hediye, antika) ve lanetli kutunun açık hâli; tokmak.

### KB-U2 · Kâr/zarar damgası — **önerim: EVET**
- Kazanan satırında teklifin yanında sonuç yazar: **"Kelepir! +15"** (yeşil), **"Başa baş"** (gri, kâr 0),
  **"Kazık! −7"** (turuncu), lanetli kutuda **"LANETLENDİ −64"** (kırmızı, satır titrer). Altın çerçeve yalnız
  kâr edene verilir; zarar edenin satırı turuncu, lanetliyi alan kırmızı çerçeve.
- Eşit tekliflerde kazanan satırda küçük "önce verdi" etiketi.
- Kâr 20 ve üstüyse kasa "ka-ching" sesi; zararda "ıh" sesi; lanette gök gürültüsü.

### KB-U3 · Teklif ekranı düzeni ve mühürlü zarf — **önerim: EVET**
- İpucu kartı her ekranda **aynı genişlikte** (ekran genişliğinin tamamı, kenar boşluğu korunarak).
- Seçim yapılmamışken büyük sayı yerine **"—"** ve "Teklifini seç" yazısı.
- "Bu turu geç" küçük yazı olarak kalmaz, "Teklif ver"in altında belirgin ikincil düğme olur.
- Teklif verilince seçici küçülerek **mühürlü bir zarfa** dönüşür (zarfın üstünde teklifin, mum mühür); zarf
  ekranın ortasındaki boşluğu doldurur. Altında "3/5 teklif verdi". Geçenlerde zarfın üstünde "GEÇTİM".
- Son 5 saniyede zarf/seçici hafif titrer, tik sesi hızlanır (teklif vermemişsen telefon kısa titrer).
- (CSS ile çizilir, yeni görsel gerekmez.)

### KB-U4 · İsimli ve sıralı oyuncu şeridi — **önerim: EVET**
- Alttaki şeritte avatarın altında **kısa ad** (en çok 8 harf, taşarsa "…") ve tek anlamlı sayı: teklif sırasında
  **jeton** (jeton simgesiyle), açılışta **kâr** ("+12" yeşil / "−7" kırmızı). Şeridin başında küçük başlık:
  "Jetonlar" ya da "Kâr".
- Kârda en öndekinin avatarında küçük taç; eşitlikte hepsinde.
- 8 oyuncuda şerit iki satıra bölünür (4 + 4), sayılar küçülmez.
- Kısa ekranlarda (bugün şeridin gizlendiği yükseklik) şerit gizlenmez, avatarlar küçülür.

### KB-U5 · Pazar defteri (geçmiş) — **önerim: EVET**
- Teklif ekranında başlığın altında 5 küçük kutucuktan oluşan bir şerit: açılmış turlar kutunun değeri ve alanın
  avatarıyla (lanetliler kırmızı), sıradaki tur yanıp söner, gelecek turlar boş.
- Kutucuğa dokununca o turun tekliflerinin kısa dökümü açılır (ekranı kaplamayan küçük kart; dokununca kapanır).

### KB-U6 · İzleyici, jetonu biten ve TV — **önerim: EVET**
- **İzleyici:** başlık "Teklifler veriliyor" olur. Boş alana pazar defteri (KB-U5) büyük gösterilir, altta kimin
  teklif verdiği zarflarla. İpucu yine gösterilmez.
- **Jetonu biten:** ipucunu görmeye devam eder (blöf yapabilsin diye) ve yazı "Jetonun bitti · ipucunla masayı
  kandırabilirsin" olur; boş alanda pazar defteri.
- **TV:** sol yarıda büyük kutu ve tur bandı, sağ yarıda oyuncu sütunu (avatar, ad, jeton, kâr, zarf durumu).
  Açılışta tokmak, sıralı teklifler ve kutunun açılması tam ekran. İpucu TV'de hiçbir zaman yok.

### KB-U7 · Anlatım lanetli kutuyu ve kârı söylesin — **önerim: EVET**
Anlatımdaki üç madde şöyle olur:
1. "Her tur bir kutu gelir: 0–60 değerinde ya da **lanetli (−20)**. Değerini yalnız sana özel ipucu anlatır."
2. "Gizli bir teklif ver: en yükseği kutuyu alır ve teklifini öder."
3. "Kutunun değeri ödediğinden fazlaysa kâr edersin; en çok kâr eden kazanır." (KB-M1 onaylanmazsa bugünkü metin.)
(KB-M2 onaylanırsa ilk maddeye "Son kutu iki kat!" eklenir.)

### KB-U8 · Ses ve titreşim seti — **önerim: EVET**
Teklif mühürlenince mum mühür "tık", son 5 sn tik sesi, tokmak "SATILDI!", tekliflerin açılışında davul, kutu
kapağı gıcırtısı, kelepirde kasa sesi, kazıkta "ıh", lanetli kutuda gök gürültüsü ve uzun titreşim, büyük kutu
bandında boru sesi.

---

## 5. Yapay zekâ (AI) ile yapılabilecekler

### KB-AI1 · Mezatçı yorumu — **önerim: İSTEĞE BAĞLI**
Oyun sonunda tek cümlelik esprili özet: "Mert lanetli kutuya 44 jeton bayıldı, Elif ise beş turu da izleyip
cebini korudu ama kâr edemedi." Ortak yapay zekâ yorum altyapısıyla (API bağlanınca açılır, hata olursa görünmez,
oyun beklemez, yasaklı kelime süzgeci). Modele yalnız tur sonuçları (değer, kim kaça aldı, kim geçti) gider;
ipuçları gitmez. Puanı yapay zekâ belirlemez.

Not: İpuçlarını ya da kutu değerlerini yapay zekâya ürettirmeyi **önermiyorum**: ipucunun her zaman doğru olması
oyunun temeli; bunu kurallı hesap garanti ediyor, yapay zekâ garanti edemez.

---

## 6. Önerilen paket

**KB-M1, KB-M2, KB-M3 ve KB-U1 … KB-U8 hepsi.** (KB-M4, KB-M5 ve yapay zekâ pakete dahil değil.)

Bu paketle oyun şöyle akar: anlatım lanetli kutuyu ve kârı baştan söyler → her tur kutu gelir, herkes ana + ek
ipucunu görür, pazar defterinden kimin önde olduğunu izler, masada blöf yapar → teklif mühürlü zarfa girer →
süre bitince tokmak iner "SATILDI!", teklifler sırayla açılır, kutunun kapağı kalkar → "Kelepir! +15" ya da
"Kazık! −7" ya da "LANETLENDİ" → 5. tur iki kat değerli Büyük Kutu → kâra göre +2 / +1 / 0 (kâr etmeyen ödül
almaz).

**Değişen kurallar (paket onaylanırsa):** oyun içi puan kâr (servet − 100); genel skor kârı 0'dan büyük olanlar
arasında +2 / +1 / 0 (birincide eşitlik hepsine +2, sonraki farklı kâr +1; kimse kâr etmezse kimse almaz);
5. tur kutusu 0–120 ya da lanetli −40; her oyuncuya ana + ek ipucu (lanetli kutuda en az 1, en çok yarı oyuncu
"Kutu lanetli!" görür); açılış 8 sn. `docs/KURALLAR.md`, wiki ve testler buna göre güncellenir.

**Değişmeyenler:** 3–8 oyuncu, 5 tur, 100 başlangıç jetonu, 1–4. turda 0–60 / lanetli −20 (%15), ipuçlarının her
zaman doğru ve kişiye özel olması, sözlü blöf serbestliği, 20 sn gizli tek seferlik teklif, en yüksek teklifin
kutuyu alıp kendi teklifini ödemesi, eşitlikte önce verenin kazanması, kimse teklif vermezse kutunun kimseye
gitmemesi, herkes teklif verince 1 sn sonra erken bitiş, kopan oyuncunun beklenmemesi, renk körü modu.

**🎨 Yeni görsel gerekenler (paket):** dört kutunun açık hâli (ahşap, çelik, hediye, antika) ve lanetli kutunun
açık hâli (KB-U1); tokmak (KB-U1; CSS ile de çizilebilir); isteğe bağlı "büyük altın sandık" (KB-M2; istenmezse
antika kutu parıltıyla kullanılır). Zarf ve mum mühür CSS ile yapılır.
