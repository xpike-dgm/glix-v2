# Açgözlülük Limiti — geliştirme önerileri

Bu dosya onay içindir. Her maddenin bir kodu var (ör. **AL-M2**). Madde öneki **AL** (Açgözlülük Limiti).
Cevabını tek satırda verebilirsin:

> AL-M1 evet, AL-M2 hayır, AL-U3 evet …

ya da yalnız **"önerilen paket evet"** dersen sondaki paket uygulanır. Her maddenin "Ayrıntılar" bölümü onaylarsan
nasıl yapılacağını kesinleştirir; ek soru sormam gerekmez. Beğenmediğin ayrıntı varsa yalnız onu yaz.

Not: Sonuç ekranı herkes **"Devam et"** deyince geçer (en çok 60 sn); bu zaten var, burada yeniden önerilmiyor.
Yeni görsel gerektiren maddeler **🎨 Görsel**, ses alanına iş açan maddeler **🔊 Ses** diye işaretli (sesleri ses
yapay zekâsı üretir; dosya gelene kadar bugünkü sentez sesleri çalar).

---

## 1. Bugünkü oyun (özet)

Koddan doğrulandı (`packages/engine/src/games/acgozluluk-limiti/`, `apps/client/src/games/acgozluluk-limiti/`).

- 3–8 oyuncu, **tek tur**. Herkes gizlice **0 ile oyuncu sayısı arasında** bir tam sayı seçer (5 kişide 0–5).
- Ortak limit oyuncu sayısına göre sabittir ve herkese açıktır: 3→6, 4→11, 5→17, 6→24, 7→33, 8→43.
- Seçim **20 sn**. Süre bitene ya da "Tamam"a kadar seçim değiştirilebilir. Bağlı herkes Tamam derse 1 sn sonra biter.
  Seçmeyen 0 sayılır (bağlantısı kopanın önceki seçimi geçerli kalır).
- Seçimler aynı anda açılır, sonuç 5 sn hazne animasyonuyla gösterilir.
- Toplam ≤ limit ise herkes **seçtiği sayı kadar puan** alır; toplam > limit ise herkes 0. Eksi puan yok.
- **Bu puan doğrudan genel skora gidiyor** (`result()` içinde `awards = miniScores`): 8 kişilik masada taşmazsa
  herkes 5–8 genel puan alabiliyor.
- Ekran: üstte "LİMİT" ve "SEÇİMİN", ortada büyük cam hazne (limit çizgisi + her oyuncuya bir "?" jetonu, kilitleyenin
  jetonu ✓), altta 0…N sayı düğmeleri ve Tamam. Açılışta hazne renk renk dolar, "Altın!" ya da "Taştı!" yazar,
  altta avatar + sayı şeridi. Oyun başında 1,9 sn jeton yağmuru sahnesi var. TV'de özel görünüm yok.

## 2. Gördüğüm sorunlar

**Oyun tasarımı**
1. **Genel skor diğer bütün oyunları eziyor.** Taşmayan 8 kişilik masada herkes ~5 puan alıyor (toplam 40'a kadar);
   bir sonraki oyunun +2'si bunun yanında önemsiz. Senin kalıcı kararın olan "+2 / +1 / 0" düzenine uymuyor.
   Üstelik taşmayan turda **herkes** puan aldığı için oyun kimseyi ayırmıyor; 5–8 puanlık fark tek bir 20 sn'den
   geliyor.
2. **Tek atış, bilgi yok, konuşma yok.** 20 sn'lik tek seçimde masada konuşulacak bir şey çıkmıyor; "kim açgözlü"
   sorusu sonuç ekranında bir kez görülüp bitiyor. Bir sonraki adımda intikam ya da güven kurma şansı yok.
3. **Hesap bilen için tek doğru cevap var.** Adil pay (limit ÷ oyuncu) tablodan bellidir: 3 kişide 2, 6 kişide 4
   (tam limit), 5 kişide 3, 8 kişide 5. Masa bunu bir kez keşfedince herkes adil payı yazıyor; oyun "herkes 3, herkes
   +3" ile sıkıcı biçimde bitiyor. Matematik bilmeyen ise ne yazacağını kestiremiyor ve bunu ekran ona hissettirmiyor.
4. **0 seçmek de 1 seçmek de anlamsız bir şekilde güvenli.** Düşük sayı seçen hiç risk almıyor ama taşmazsa da çok az
   alıyor; seçimin "karakter" anlamı (kanaatkâr / açgözlü) sonuçta vurgulanmıyor.
5. **Taşmanın suçlusu görünmüyor.** "Taştı!" herkesi aynı griye boyuyor; en çok koyanların yarattığı taşma ile
   adil payı koyanın yaşadığı kayıp ekranda ayırt edilmiyor. Masadaki "Mert, yine sen!" anı ekranda yok.

**Arayüz (ekran görüntülerine bakarak: 390×844, 360×640, 844×390, izleyici, 8 oyuncu)**
6. **Hazne seçim sırasında boş bir cam.** Ekranın ortasını kaplayan hazne (390×844'te ~420 px) seçim boyunca tamamen
   boş; jetonlar dipte küçük daireler. Kendi seçtiğin sayının hazneyi ne kadar doldurduğu hiç görünmüyor; "2" seçmek ile
   "5" seçmek arasında ekranda yalnız bir rakam değişiyor.
7. **Seçimin "herkes böyle yaparsa" etkisi hissettirilmiyor.** Oyunun bütün kararı "herkes benim gibi düşünürse taşar
   mı?" sorusu; ekran buna hiçbir ipucu vermiyor. Limit 17 ve seçim 0–5 yan yana duruyor, bağlantıyı oyuncu kendi
   kurmak zorunda.
8. **Açılışta toplam baştan belli.** Sonuç açıldığı an üstteki "TOPLAM 59" kırmızı rakamla görünüyor; hazne daha
   dolmadan sonuç biliniyor. Dolum animasyonu (her jeton 300 ms) bu yüzden gerilim yaratmıyor.
9. **Dolum şeritleri isimsiz.** Haznede renkli şeritler var ama kimin hangi şerit olduğu, kaç koyduğu şeritte yazmıyor;
   altta ayrı bir avatar/sayı şeridi var ve göz ikisi arasında gidip geliyor. 8 kişide şeridin sayıları küçük, adlar yok.
10. **"Altın!" her başarıda aynı.** Toplam 8/17 (yarısı boş kalmış) ile 17/17 (ağzına kadar) aynı "Altın!" alıyor.
    Taşmada da 44/43 (bir jetonla) ile 59/43 aynı "Taştı!".
11. **Kilitledikten sonra ekran ölü.** Tamam'dan sonra 0…N düğmeleri sönük olarak yerinde kalıyor, "Seçimin
    kesinleşti" küçük yazı; 20 sn'nin kalanı için yapılacak ya da bakılacak bir şey yok.
12. **İzleyici ekranının alt yarısı boş** ("Herkes gizlice seçiyor…" ve 2/4 hazır); hazne yine boş cam.
13. **Yatay ekranda oyun adı kelime ortasından bölünüyor** ("Açgözlülü / k Limiti") ve hazne sol tarafta dar bir sütun
    kalıyor; sağdaki düğmelerle arada geniş boşluk var.
14. **Anlatım soyut:** "0 ile oyuncu sayısı arasında" ve "limit çizgisi" diyor ama masanın gerçek sayıları (5 kişi:
    0–5, limit 17) ve örnek bir hesap yok. Seçmeyenin 0 sayıldığı anlatımda geçmiyor.
15. **TV'de özel düzen yok:** izleyici telefon ekranı küçültülüp ortada gösteriliyor; dolum animasyonu uzaktan
    okunmuyor.

---

## 3. Oyunu değiştiren öneriler (mekanik)

### AL-M1 · Genel skor +2 / +1 / 0 olsun — **önerim: EVET**
**Ne:** Seçtiğin sayı artık doğrudan genel skora gitmez; **oyun içi puan** (mini puan) olur. Oyun sonunda mini puanı
en yüksek olan **+2**, ikinci **+1**, diğerleri **0** alır. Taşan turda herkesin o turdan mini puanı 0'dır (bugünkü
gibi). Eksi puan yok.
**Neden:** Sorun 1. 8 kişide tek oyunun herkese 5–8 puan dağıtması geceyi bozuyor; senin kalıcı kararın da bu.
Ayrıca oyun artık kimin "en açgözlü ama taşırmadan" oynadığını ayırır: taşmayan masada en çok koyan kazanır.
**Ayrıntılar:**
- Ödül hesabı ortak sıralama kuralıyla (`rankAwards`, yalnız mini puanı 0'dan büyük olanlar): tek lider +2, sonraki
  puanı paylaşanların hepsi +1; **lider eşitse liderlerin hepsi +1**, ikinci ödül verilmez (Ortalamaya En Yakın ve
  Kontrol Paneli'yle aynı kural).
- Mini puanı 0 olan (0 seçen, taşan turda kalan, hiç seçmeyen) ödül almaz. Herkes 0 ise kimse ödül almaz.
- Örnekler (5 kişi, limit 17): 3-3-3-3-5 = 17 → 5'i seçen +2, 3'ü seçen dördü +1. 4-4-3-3-3 = 17 → iki "4" eşit
  lider, ikisi +1, kalanlar 0. 3-3-3-3-3 = 15 → beşi eşit lider, hepsi +1.
- Bu kuralla "adil payın bir üstü" cazip olur ama iki kişi aynı anda bir üste çıkarsa ödül paylaşılır, üç kişi çıkarsa
  hazne taşar: oyunun özü (tavuk oyunu) güçlenir.
- AL-M2 onaylanırsa mini puan **üç turun toplamıdır**; sıralama oyun sonunda bir kez yapılır.
- Maç kartları ve "birinci/sonuncu" hesabı mini puana göre (bugün de mini puana göre; yalnız ölçek değişir).

### AL-M2 · Kasa üç kez açılır (3 kısa tur) — **önerim: EVET**
**Ne:** Oyun 3 turdur. Her tur aynı limit ve aynı 0…N aralığıyla oynanır, her turun sonunda hazne açılır ve herkesin
o turda ne koyduğu görünür. Mini puan üç turun toplamıdır (taşan turlar 0).
**Neden:** Sorun 2 ve 3. Birinci turdan sonra masada gerçek konuşma başlar: "Mert ilk turda 5 koydu, bu tur herkes
3 diyecek mi?", "taşırdıysan bu tur sen 0 koy". Güven, intikam ve blöf ancak tekrarla oluşur. Tek doğru cevap kalmaz,
çünkü doğru cevap masadakilerin bir önceki turdaki davranışına bağlıdır.
**Ayrıntılar:**
- Süreler: seçim **12 sn** (her tur), ara açılış **5 sn**, son açılış **7 sn** ve sonra ortak "Devam et" ekranı.
  Toplam en çok 3×12 + 2×5 + 7 = **53 sn** (bugün 25 sn). Erken bitiş her tur ayrı: bağlı herkes Tamam derse o turun
  seçimi 1 sn sonra kapanır ve sonraki turlar o kadar öne çekilir (Ortalamaya En Yakın'daki gibi).
- Seçim her turun başında boşalır (önceki turun sayısı taşınmaz). Seçmeyen o turda 0.
- Önceki turların seçimleri herkese açıktır (zaten açılışta açılıyor); seçim ekranında "kasa defteri" olarak görünür
  (AL-U3).
- 3 oyuncuda da 3 tur (limit 6, aralık 0–3).
- Kopan oyuncu turlar arasında geri gelirse kaldığı turdan devam eder; kopukken geçen turlarda 0 sayılır.

### AL-M3 · Gözcü: her tur bir kişi hazneye gizlice bakar — **önerim: EVET**
**Ne:** Her turda bir oyuncu **Gözcü** olur. Turun **7. saniyesinde** yalnız Gözcü'nün ekranında haznenin o anki
durumu tek kelimeyle belirir: **"RAHAT"**, **"SINIRDA"** ya da **"TAŞIYOR"**. Gözcü bunu masaya doğru da söyleyebilir,
yalan da.
**Neden:** Sorun 2 ve 3. Masaya konuşacak bir şey ve tek bir "bilgili" kişi verir: herkes Gözcü'ye döner, Gözcü
"rahat, rahat!" diye herkesi taşırmaya itebilir ya da kendi payını büyütmek için "taşıyor!" diye korkutabilir. Hesap
yerine insan okumaya döner; matematik bilmeyen de oynayabilir.
**Ayrıntılar:**
- Durum, 7. saniyedeki **gönderilmiş seçimlerin** toplamından hesaplanır (seçmeyen 0): toplam ≤ limitin %70'i →
  RAHAT; %70'ten büyük ve ≤ limit → SINIRDA; limitten büyük → TAŞIYOR. Kimin ne seçtiği ya da sayı gösterilmez.
- Durum Gözcü'nün ekranında 7. saniyeden tur sonuna kadar kalır ama **güncellenmez** (o anın fotoğrafıdır; sonra
  herkes değiştirebilir).
- Gözcü sırası: maç başında sunucu rastgeleliğiyle karıştırılan oyuncu listesinden tur başına bir kişi; 3 turda 3
  farklı kişi. Bağlantısı kopuk oyuncu Gözcü seçilmez (sıradaki bağlı oyuncuya geçer).
- Gözcü'nün kim olduğu **herkese açıktır** (avatarında 👁 rozeti) — masa kime soracağını bilir; ama gördüğü kelime
  yalnız onun `view`'ındadır. TV ve izleyici kelimeyi hiçbir zaman görmez.
- Erken bitişte 7. saniye gelmeden herkes kilitlerse Gözcü kilitleme anında bakar (bilgi yine yalnız ona gider).
- AL-M2 onaylanmazsa tek turda tek Gözcü, 20 sn'lik turda 12. saniyede bakar.

### AL-M4 · Sisli limit — **önerim: İSTEĞE BAĞLI**
**Ne:** Limit tam sayı olarak değil, **aralık** olarak gösterilir: hazne üstünde "15–19" yazan sisli bir bant. Gerçek
limit açılışta sisin içinden belirir.
**Neden:** Sorun 3. Tablodan "adil pay"ı hesaplayıp herkesin aynı sayıyı yazmasını kırar; açılışta "17'de taşmazdı,
limit 16 çıktı!" gibi gerçek bir "ne olurdu" anı yaratır.
**Neden isteğe bağlı:** Şans payı ekler; AL-M3 (Gözcü) ve AL-M2 (üç tur) zaten tek doğru cevabı kırıyor. Önce onlarla
oynanması, gerekirse eklenmesi daha temiz.
**Ayrıntılar (onaylanırsa):**
- Gerçek limit, tablodaki değerin çevresinde her tur ayrı çekilir: 3–4 oyuncuda ±1, 5–6 oyuncuda ±2, 7–8 oyuncuda ±3
  (ör. 5 kişide 15–19). Bant herkese aynı, gerçek değer kimsenin görünümünde yok (tur açılana kadar).
- Gerçek limit hiçbir zaman 0…N² dışına çıkmaz; 3 kişide en az 5 (bant 5–7).
- Açılışta bant yukarıdan aşağı daralarak çizgiye dönüşür (0,6 sn), ardından dolum başlar.

### AL-M5 · Çatlak kasa: taşan tur bir sonraki limiti küçültür — **önerim: İSTEĞE BAĞLI**
**Ne:** Bir tur taşarsa hazne çatlar: **sonraki turun limiti yaklaşık %10 düşer** (yeni limit = limit −
⌈limit × 0,1⌉).
Çatlak, sonraki turda hazne camında görünür kalır.
**Neden:** Sorun 2. Açgözlülüğün bedeli tek turda kalmaz; taşıran, masanın geri kalanına sonraki turlarda da yük
olur. "Kasayı kim çatlattı?" konuşması doğar.
**Neden isteğe bağlı:** AL-M2 olmadan anlamı yok; ayrıca üç turda üst üste taşma olursa son tur çok dar kalır (8 kişide
43 → 38 → 34). Yeni bir sayı daha öğrenmek gerekiyor.
**Ayrıntılar (onaylanırsa):** düşüş yalnız bir sonraki tura uygulanır ve birikir; taşmayan tur limiti geri
getirmez. 3 kişide 6 → 5 → 4. Limit herkes için aynı, tur başında "Kasa çatladı: limit 15" bandıyla duyurulur.

### AL-M6 · Açık jeton: istersen sayını masaya gösterirsin — **önerim: İSTEĞE BAĞLI**
**Ne:** Seçim ekranında küçük bir **"Göster"** düğmesi: basarsan seçimin kilitlenir ve sayın **herkesin ekranında**
jetonunun üstünde açılır ("Elif: 2").
**Neden:** Sorun 2. Masadaki "ben 2 koydum, yemin ederim" sözüne kanıt koyma imkânı verir; güven kuran oyuncu
diğerlerini düşük koymaya ikna edebilir, ama gösterdiği an kendi sayısını da değiştiremez. Sözlü blöf ile kanıtlı söz
arasında ilginç bir seçim.
**Neden isteğe bağlı:** Herkes gösterirse oyun açık oyuna döner; ilk turda tek kişi bile gösterse hesap kolaylaşır.
AL-M3 ile birlikte masa konuşmasını zaten canlandırıyoruz.
**Ayrıntılar (onaylanırsa):** "Göster" = kilit + açıklama; geri alınamaz. Gösterilen sayı publicView'da yalnız o
oyuncu için açılır (oyuncunun kendi isteğiyle; gizlilik kuralı gereği başka hiçbir yol açmaz). Seçimsiz "Göster"
pasif. Gözcü de gösterebilir (kelimesini değil, sayısını).

### AL-M7 · Taşırana eksi puan — **önerim: HAYIR**
**Ne:** Taşan turda en yüksek sayıyı seçen(ler) −1 alır.
**Neden önermiyorum:** `docs/KURALLAR.md` §12 bu eski taslak kuralı açıkça kaldırdı; senin kalıcı kararın da "eksi
yok". Suçlu gösterimini AL-U6 ("TAŞIRAN" damgası) ceza olmadan yapıyor; masanın kahkahası için yeterli.

### AL-M8 · Son tur "Altın tur": puanlar iki kat — **önerim: İSTEĞE BAĞLI**
**Ne:** AL-M2 ile 3. tur "ALTIN TUR" olur: taşmazsa herkesin o turdaki sayısı **iki kat** mini puan sayılır.
**Neden:** Geride kalanın son turda öne geçme şansı; "son turda herkes kendini kaybeder" anı.
**Neden isteğe bağlı:** AL-M1 sıralama ödülü verdiği için iki kat yalnız sıralamayı değiştirir; son tura fazla ağırlık
verip ilk iki turu önemsizleştirebilir. Önce M1+M2 ile oynanıp tur başına gerilim yeterli mi bakılmalı.
**Ayrıntılar (onaylanırsa):** limit ve aralık değişmez; tur başında "ALTIN TUR · PUANLAR ×2" bandı; açılışta dolum
altın renkte. Taşarsa herkese yine 0.

---

## 4. Arayüz ve his önerileri

### 4a. Ana ekranlar ve akış

### AL-U1 · "Herkes senin kadar koyarsa" çizgisi — **önerim: EVET**
**Ne:** Seçim yaptığında haznede iki şey belirir: (1) dipte **kendi payın** kadar yükselen yarı saydam, senin renginde
bir dolgu; (2) hazne boyunca kesik, senin renginde ikinci bir çizgi: **"Herkes 4 derse → 20"**. Bu çizgi limit
çizgisinin altındaysa yeşilimsi "sığar", üstündeyse kırmızımsı "taşar" yazar.
**Neden:** Sorun 6 ve 7. Oyunun bütün sorusu "herkes benim gibi düşünürse ne olur?"; çizgi bunu hesap yapmadan,
haznenin içinde gösterir. Matematik bilmeyen oyuncu da sayı düğmelerine dokunarak çizginin limit çizgisini geçtiği
anı görür.
**Ayrıntılar:**
- Çizginin değeri = seçimin × oyuncu sayısı; hazne ölçeği bugünkü gibi limitin 1,5 katı (8 kişide 8×8 = 64 de sığar).
- Yalnız seçim yapan oyuncunun ekranında; izleyici ve TV görmez (kendi seçimin zaten yalnız sende).
- Çizgi seçim değişince 200 ms'de kayar. 0 seçince çizgi gizlenir ("Pas").
- Bu bilgi kural değil, varsayımdır: altında küçük yazı "varsayım: herkes aynı sayıyı seçerse".

### AL-U2 · Açgözlülük düğmeleri — **önerim: EVET**
**Ne:** 0…N düğmeleri aynı lacivert değil, soldan sağa **sakin yeşilden ateş kırmızısına** renk alır; her düğmenin
altında küçük jeton yığını simgesi büyür (0'da boş el). Seçtiğin düğmenin üstünde kısa bir etiket: 0 = "Pas",
adil payın altı = "Kanaatkâr", adil pay = "Dengeli", adil payın üstü = "Açgözlü", N = "Hepsi benim!".
**Neden:** Sorun 4 ve 6. Seçimin karakterini (ve masaya söyleyeceğin cümleyi) tek bakışta verir; rakamların arasındaki
"duygu farkını" hissettirir.
**Ayrıntılar:**
- Adil pay = ⌊limit ÷ N⌋ (3→2, 4→2, 5→3, 6→4, 7→4, 8→5). AL-M4 onaylanırsa bandın orta değerine göre.
- Renk yalnız süs; renk körü için etiket metni asıl bilgidir (AL-U19).
- Düğme dizilişi bugünkü ızgara (5'e kadar tek satır, 6'da 3+3, 7–8'de 4'lük, 9'da 5'lik) korunur.

### AL-U3 · Haznenin yanında kasa defteri — **önerim: EVET (AL-M2 ile)**
**Ne:** Seçim ekranında haznenin üstünde üç küçük kasa simgesi: oynanmış turlar **toplam/limit** ve ✓/✗ ile ("15/17 ✓",
"21/17 ✗"), oynanan tur yanıp söner. Bir kasaya dokununca o turda kimin kaç koyduğu küçük bir kartta açılır.
Avatarların altında o ana kadarki **mini puan** yazar.
**Neden:** Sorun 2. Masanın "kim güvenilir" konuşmasını besleyen bilgi elinin altında olur; ekranın boş üst kısmı
dolar.
**Ayrıntılar:** kart dokununca açılır, dokununca ya da 3 sn sonra kapanır; seçimini engellemez. İlk turda defter
yerine "Tur 1/3" yazar. 360×640'ta kasa simgeleri 28 px.

### AL-U4 · Kilitledikten sonra: mühürlü jeton ve "masayı ikna et" — **önerim: EVET**
**Ne:** Tamam'a basınca sayı düğmeleri aşağı kayarak kaybolur; yerine büyük, mühürlü bir jeton gelir (üstünde kendi
sayın ve "Mühürlendi"), altında tek satır: **"Şimdi masayı ikna et: kim ne koydu?"** (Gözcü sensen: "Gördüğünü söyle
ya da sakla."). Hazne içinde jetonun ✓ olur.
**Neden:** Sorun 11. Kilitten sonraki ölü süreyi konuşmaya çevirir; sönük düğmeler kalkar.
**Ayrıntılar:** mühür CSS ile (mevcut jeton görseli `genel/rusvet-jetonu` üstüne kırmızı mühür halkası). Kilit geri
alınamadığı için düğmelerin gizlenmesi bilgi kaybı değildir.

### AL-U5 · Gözcü ekranı — **önerim: EVET (AL-M3 ile)** · 🔊 Ses
**Ne:** Gözcü olduğunda turun başında avatarında 👁 ve üstte "Bu tur Gözcü sensin" bandı. 7. saniyede ekranın
ortasında haznenin camı buğulanır, bir anahtar deliğinden bakılıyormuş gibi daire açılır ve tek kelime belirir:
**RAHAT** (yeşil, dalgasız), **SINIRDA** (amber, dalgalı), **TAŞIYOR** (kırmızı, kaynayan). 1,2 sn sonra küçülüp
haznenin köşesine "7. sn: SINIRDA" etiketi olarak yerleşir.
**Neden:** AL-M3'ü hissettirir; diğerlerine de "Gözcü baktı" anını gösterir.
**Ayrıntılar:** diğer oyuncular yalnız Gözcü'nün avatarında kısa bir 👁 parıltısı görür (baktığı an), kelimeyi
görmez. Gözcü'ye kısa çift titreşim; ses yalnız Gözcü'de (anahtar deliği "çıt"). Kelimeler ekran okuyucuya da okunur.

### 4b. Açılış/sonuç anı ve gerilim

### AL-U6 · Sıralı dolum, gizli toplam ve "TAŞIRAN" — **önerim: EVET** · 🔊 Ses
**Ne:** Açılış sırası:
1. **0,0 sn** — Hazne kapağı açılır, toplam yerinde "?" (bugün toplam baştan yazıyor, sorun 8).
2. **0,4 sn'den** — Jetonlar **küçükten büyüğe** tek tek düşer; her şerit düşerken üstünde avatar + sayı, sayaç
   yanında yükselir ("TOPLAM 9… 12… 15…"). Şerit başına 300 ms; limit çizgisine 3 ya da daha az kala sıradaki şeritler
   yavaşlar (450 ms) ve kalp atışı başlar.
3. **Taşmazsa** son şerit oturunca altın ışık, ardından karar yazısı (AL-U8).
4. **Taşarsa** çizgiyi geçen şerit(ler) çatlar ve titrer; o şeritlerin sahiplerinin avatarına **"TAŞIRAN"** damgası
   vurulur. Damga yalnız gösteridir, ceza değildir (AL-M7 yok).
**Neden:** Sorun 5, 8, 9. Sonucu ilk saniyede öldürmeden "taşacak mı, taşmayacak mı?" diye herkesin ekranına
kilitlenmesini sağlar.
**Ayrıntılar:**
- "Taşıran" tanımı: küçükten büyüğe dizilişte toplamı limitin üstüne çıkaran ilk şerit **ve** ondan sonraki bütün
  şeritler (yani en çok koyanlar). Eşit sayılarda sıra katılım sırasıdır ama aynı sayıdakilerin hepsi damgayı alır
  (biri alıp eşiti almazsa haksız olur).
- 0 seçenler şerit oluşturmaz; dolum bittikten sonra hazne dibinde "Pas: Elif, Kaan" yazar.
- Süre: 8 kişide en kötü durum ~3,2 sn dolum + 0,8 sn karar; ara açılış 5 sn'ye sığar. AL-M2 yoksa bugünkü 5 sn
  sonuç süresi yeter.
- Hareket azaltma açıksa: dolum anlık, toplam ve karar 0,5 sn arayla metin olarak gelir.

### AL-U7 · "Ne olurdu?" satırı — **önerim: EVET**
**Ne:** Karar yazısının altında, **sana özel** tek satır:
- Taştıysa ve senin sayın taşmayı tek başına önleyebilirdiyse: **"Sen 2 deseydin sığardı."**
- Taştıysa ve sen önleyemezdin: **"3 jeton fazla. Taşıran: Mert (8), Defne (8)."**
- Taşmadıysa: **"Kasada 2 boşluk kaldı: 5 deseydin de sığardı (ve birinci olurdun)."**
- Tam limitse: **"Ağzına kadar! Bir jeton daha taşırırdı."**
**Neden:** Sorun 5 ve 10. Tek atışlık sayı oyununun en tatlı anı "az kalsın"dır; bunu herkese kendi sayısıyla söyler.
Masada "bir koysan yeterdi!" konuşmasını başlatır.
**Ayrıntılar:**
- Hesap istemcide, açılmış verilerden: fazla = toplam − limit; boşluk = limit − toplam. "Sen X deseydin" yalnız X ≥ 0
  ve X kendi aralığındaysa yazılır. "Birinci olurdun" yalnız AL-M1 varken ve bu değişiklikle tek lider olacaksan.
- Hiç seçim yapmamışsan: "Seçmedin, 0 sayıldın."
- İzleyici ve TV'de kişisel satır yerine ortak satır: "3 jeton fazla" / "2 boşluk kaldı".
- Satır karar yazısından 0,6 sn sonra gelir.

### AL-U8 · Dört farklı karar — **önerim: EVET** · 🔊 Ses
**Ne:** "Altın!" / "Taştı!" yerine sonuca göre dört karar:
- **"AĞZINA KADAR!"** (toplam = limit): altın yağmuru, en güçlü kutlama.
- **"Kıl payı!"** (limitin 1–2 altı): altın ışık.
- **"Bol bol yer var"** (toplamın limite oranı %70'in altında): sönük altın, hafif hayal kırıklığı sesi.
- **"Bir jetonla taştı!"** (1 fazla) / **"PATLADI!"** (limitin %25'inden fazla taşma): çatlak ve sarsıntı; "patladı"da
  daha güçlü.
**Neden:** Sorun 10. Aynı sonuç kelimesi her seferinde aynı hissi verir; bu dört karar masanın tepkisini sonuca göre
ayarlar.
**Ayrıntılar:** aradaki durumlar (limitin %70'i ile 3 altı arası) "Altın!" kalır; taşmada 2 fazla ile %25 arası
"Taştı!". Eşikler sabit. 🔊 her karar için ayrı ses (bkz. AL-U14).

### AL-U9 · Sonuç şeridi: isimli ve sıralı — **önerim: EVET**
**Ne:** Alttaki avatar/sayı şeridi oyuncu sırasıyla değil **sayıya göre** (büyükten küçüğe) dizilir, avatarın altında
kısa ad (en çok 8 harf), sayının yanında küçük jeton simgesi. "Sen" kalın. AL-M2 ile her satırın sağında küçük
toplam ("Σ 7"). Son turda şeridin üstünde kim +2, kim +1 aldı rozetle yazar.
**Neden:** Sorun 9. "Kim açgözlüydü?" sorusunun cevabı tek bakışta okunur.
**Ayrıntılar:** 8 kişide iki satıra bölünür (4 + 4), sayılar küçülmez (en az 18 px). Kopan oyuncu gri, "kopuk".

### 4c. Telefon ergonomisi ve okunurluk

### AL-U10 · Hazne boyu ve boş alanın kullanımı — **önerim: EVET**
**Ne:** Seçim ekranında hazne yüksekliği **%25 kısalır** (390×844'te ~420 px → ~315 px); kazanılan yer kasa defteri
(AL-U3) ve "herkes senin kadar" yazısına gider. Jetonlar dipte değil, **limit çizgisinin hemen altında** bir rafta
durur (göz hep çizgide olsun).
**Neden:** Sorun 6 ve 12. Boş cam en değerli alanı kaplıyor.
**Ayrıntılar:** 360×640'ta hazne en az 200 px; sayı düğmeleri en az 56 px yüksek kalır. Açılışta hazne yeniden tam
boya büyür (0,3 sn), çünkü sonuç anında sahnenin yıldızı odur.

### AL-U11 · Yatay ekran düzeni — **önerim: EVET**
**Ne:** Yatayda (844×390) üç sütun: solda kasa defteri ve oyuncular, ortada hazne (yüksekliğin tamamı), sağda sayı
düğmeleri + Tamam. Oyun adı sol üstte tek satıra sığmazsa küçülür; kelime ortasından bölünmez.
**Neden:** Sorun 13.
**Ayrıntılar:** "Açgözlülük Limiti" en az 13 px'e kadar küçülür, yine sığmazsa "Açgözlülük" tek kelimesi kalır.
(Kelime bölünmesi kabuktaki ortak başlıktan geliyor; düzeltme diğer oyunlara da yarar.)

### 4d. İzleyici, kopan oyuncu ve TV

### AL-U12 · İzleyici ve TV: büyük kasa — **önerim: EVET**
**Ne:**
- **İzleyici (telefon):** boş alt yarıda kasa defteri büyük, kimin kilitlediği avatarlarla; Gözcü'nün kim olduğu
  (kelimesi değil). Başlık "Kasa doluyor…".
- **TV (`StageView`):** ortada ekran boyu hazne, solda oyuncu sütunu (avatar, ad, kilit durumu, mini puan, 👁 Gözcü),
  sağda büyük LİMİT, tur ve kasa defteri. Açılışta dolum TV'de tam ekran ve yavaş; "TAŞIRAN" damgaları büyük.
**Neden:** Sorun 12 ve 15. Bu oyunun en iyi anı ortak hazne; TV'de herkesin aynı anda bakacağı tek yer olmalı.
**Ayrıntılar:** TV ve izleyici hiçbir zaman Gözcü kelimesini, kimsenin seçimini (açılıştan önce) ya da AL-U1 çizgisini
görmez. AL-M6 ile gösterilen sayılar TV'de de görünür (herkese açık oldukları için).

### AL-U13 · Kopan ve seçmeyen oyuncu — **önerim: EVET**
**Ne:** Seçim sırasında bağlantısı kopan oyuncunun jetonu gri ve "kopuk" yazılı; açılışta seçimi yoksa şerit
oluşturmaz, şeritte "0 · seçmedi" yazar. Seçmeyen bağlı oyuncunun da şeridinde "0 · seçmedi".
**Neden:** Bugün seçmeyen sessizce 0 oluyor, anlatımda da geçmiyor; "neden 0 aldım?" sorusu çıkar.
**Ayrıntılar:** kopan oyuncu beklenmez (bugünkü erken bitiş kuralı aynen).

### 4e. Ses, titreşim ve hareket

### AL-U14 · Kasa ses ve titreşim seti — **önerim: EVET** · 🔊 Ses
**Ne:** Sayı düğmesine dokununca **jeton şıngırtısı**; sayı büyüdükçe daha çok jeton ve daha tiz (0'da yumuşak "tık").
Kilitte ağır **kasa mührü** "klonk". Son 5 sn'de kasa kapısının dişlileri tıkırdar (hızlanan tik). Gözcü bakışında
anahtar deliği "çıt". Açılışta her şerit düşerken metalik "tın" (yükselen notalar), limite 3 kala kalp atışı, taşmada
cam çatlaması + derin gümbürtü, "Ağzına kadar"da altın yağmuru, "Bol bol yer var"da sönük "hıh".
**Titreşim:** dokunuşta 10 ms; kilitte 30 ms; taşmada uzun-kısa-uzun; ağzına kadarda üç kısa.
**Neden:** Kasa/jeton teması bugün yalnız genel "match/solo" sesleriyle; oyunun kendine ait sesi yok.
**Ayrıntılar:** ses olay haritasında `acgozluluk.*` adlarıyla (ör. `acgozluluk.jeton`, `acgozluluk.catlama`); dosya
gelene kadar mevcut sentez sesleri.

### AL-U15 · Son 5 saniye: kasa kapısı kapanıyor — **önerim: EVET**
**Ne:** Son 5 sn'de haznenin üstünden kalın bir kasa kapısı yavaşça aşağı inmeye başlar (süs; dokunmayı engellemez),
hâlâ seçmemiş ya da kilitlememiş oyuncunun telefonu her saniye kısa titrer ve üstte "Kasa kapanıyor!" yazar.
**Neden:** 12–20 sn'lik turda son anı hissettirmek; seçmeyenin 0 sayılacağını hatırlatmak.
**Ayrıntılar:** kapı haznenin en çok üst %20'sini örter (limit çizgisini hiç kapatmaz). Kilitlemiş oyuncuda titreşim
yok. Hareket azaltmada kapı inmez, yalnız yazı.

### 4f. İlk kez oynayan için öğretme (anlatım ekranı dahil)

### AL-U16 · Anlatım: masanın kendi sayılarıyla örnek — **önerim: EVET**
**Ne:** Anlatımın üç maddesi gerçek sayılarla:
1. "Gizlice **0 ile 5** arasında bir sayı seç. Seçmezsen 0 sayılır."
2. "Hepinizin toplamı **17**'yi geçmesin. Örnek: herkes 3 derse 15 — sığar."
3. "Taşarsa o tur kimse puan almaz; taşmazsa en çok koyan kazanır." (AL-M1 onaylanmazsa bugünkü metin.)
AL-M2 ile ilk maddenin önüne "3 tur" ve AL-M3 ile ikinci maddenin sonuna "Gözcü hazneye bir kez bakar."
**Neden:** Sorun 14. "Oyuncu sayısı" ve "limit çizgisi" soyut; masanın gerçek rakamları akılda kalır.
**Ayrıntılar:** sayılar oyuncu sayısından üretilir (limit tablosu + ⌊limit ÷ N⌋ örneği). Anlatım görseli şu an genel
bir hazine sandığı; altına küçük, canlı bir mini hazne çizilebilir (bkz. AL-U18). Metin en çok iki satır/madde.

### AL-U17 · İlk turda tek seferlik yönlendirme — **önerim: İSTEĞE BAĞLI**
**Ne:** Bu oyunu ilk kez oynayan (yerel kayıt) oyuncuya ilk turda AL-U1 çizgisinin yanında küçük bir balon:
"Bu çizgi: herkes senin kadar koyarsa." 3 sn sonra ya da dokununca kaybolur.
**Neden:** AL-U1'in anlamını ilk bakışta öğretir.
**Neden isteğe bağlı:** Anlatım ekranı (AL-U16) çoğu oyuncuya yetebilir; balon kalabalık ekranda dikkat dağıtabilir.
**Ayrıntılar:** yalnız tarayıcının yerel belleğinde "gördü" işareti; yoksa (gizli sekme) her seferinde bir kez.

### AL-U18 · Anlatıma canlı mini hazne — **önerim: İSTEĞE BAĞLI** · 🎨 Görsel (isteğe bağlı)
**Ne:** Anlatım görselinin ikinci karesi olarak küçük bir canlı hazne: üç jeton düşer, sığar (altın); dördüncüsü
taşırır (çatlak). Döngü 4 sn.
**Neden:** Kural metnini okumayan oyuncu da bir bakışta anlar.
**Neden isteğe bağlı:** Mevcut anlatım görseli güzel ve okunuyor; bu ek bir kare. CSS ile çizilebilir, ayrı görsel
gerekmez.

### 4g. Erişilebilirlik

### AL-U19 · Renk körü, hareket azaltma, ekran okuyucu — **önerim: EVET**
**Ne:**
- **Renk körü:** dolum şeritlerinde bugün desen (`cbpat`) var; ek olarak her şeridin üstünde avatar ve sayı yazar
  (AL-U6). Karar yalnız renkle değil simge + kelimeyle: ✓ "Sığdı" / ✗ "Taştı". AL-U1 çizgisi "sığar/taşar" kelimesiyle.
  Açgözlülük düğmeleri (AL-U2) renk yanında etiket taşır.
- **Hareket azaltma:** jeton yağmuru sahnesi, kasa kapısı ve sarsıntı kapanır; dolum anlık, sonuçlar 0,5 sn arayla
  metin olarak gelir.
- **Yazı boyutu:** sonuç şeridindeki sayılar en az 18 px, adlar 13 px; sistem yazı boyutu büyütülünce düğmeler
  taşmaz, ızgara bir sütun azalır.
- **Ekran okuyucu:** açılışta tek duyuru: "Toplam 15, limit 17. Sığdı. Sen 3 koydun. En çok koyan Mert." Gözcü
  kelimesi Gözcü'ye okunur. Sayı düğmeleri "3, dengeli" gibi etiketli.
**Neden:** Bugün renk dışı tek ipucu şerit deseni; karar ve sahiplik okunmuyor.

---

## 5. Yapay zekâ (AI) ile yapılabilecekler

### AL-AI1 · Kasa bekçisi yorumu — **önerim: İSTEĞE BAĞLI**
Oyun sonunda tek cümlelik esprili özet: "Oyuncu3 üç turda da adil payın bir üstünü koydu; kasayı iki kez çatlattı,
yine de birinci oldu." Ortak yapay zekâ yorum altyapısıyla (API bağlanınca açılır, hata olursa hiç görünmez, oyun
beklemez, yasaklı kelime süzgeci). Modele gerçek adlar değil **"Oyuncu1…N"**, her turun limit/toplam/taştı bilgisi,
herkesin tur sayıları ve Gözcü'nün kim olduğu gider; **Gözcü'nün gördüğü kelime gitmez** (gizli bilgi). Puanı yapay
zekâ belirlemez. Yorum sonuç ekranında, "Devam et"in üstünde küçük yazı.
**Neden isteğe bağlı:** Üç turla (AL-M2) anlatılacak bir hikâye oluşur; tek turda (M2 yoksa) önerim **HAYIR**, çünkü
"herkes 3 koydu, sığdı" dışında söylenecek şey yok.

---

## 6. İçerik ve üretim ekibine düşen işler

- **Ses Efektleri yapay zekâsı (🔊):** `acgozluluk.*` olay seti — jeton şıngırtısı (6 kademe, sayıya göre), kasa
  mührü, dişli tiki (son 5 sn), anahtar deliği (Gözcü), şerit düşüşü "tın" (8 nota), kalp atışı, cam çatlaması,
  gümbürtü, altın yağmuru, sönük "hıh" (AL-U5, U6, U8, U14, U15).
- **Müzik yapay zekâsı:** oyuna özel kısa gerilim döngüsü (12 sn, son 5 sn'de hızlanan katman); isteğe bağlı.
- **Efekt Dokuları yapay zekâsı:** cam çatlağı katmanı (bugünkü SVG çizgisinin yerine), altın yağmuru parçacığı,
  buğulu cam / anahtar deliği maskesi (AL-U5). Hepsi CSS/SVG ile de yapılabilir; doku gelirse daha zengin.
- **Arayüz İkon ve Süsleri yapay zekâsı:** 👁 Gözcü rozeti, "TAŞIRAN" damgası, kasa defteri simgesi.
- **Görsel (🎨, ChatGPT akışı):** gerekmiyor; isteğe bağlı AL-U18 mini hazne CSS ile çizilir. Kasa kapısı (AL-U15)
  istenirse mevcut arka plandaki kasa kapısının ön plan kesiti olarak üretilebilir.
- **Moderasyon ve Wiki yapay zekâsı:** onaylanan kurallara göre `docs/wiki/oyunlar/acgozluluk-limiti.json`
  (3 tur, Gözcü, +2/+1/0) güncellemesi.
- **Test, Hata ve Performans yapay zekâsı:** yeni bot senaryoları: "herkes adil pay", "bir kişi hep N", "Gözcü yalan
  söyler" (sesli olduğu için yalnız seçim örüntüsü); 3 turda erken bitiş zinciri.
- **İçerik Havuzu:** iş yok (oyunda içerik havuzu yok; karar ve "ne olurdu" metinleri kuralla üretilir).

---

## 7. Önerilen paket

**EVET:** AL-M1, AL-M2, AL-M3; AL-U1 … AL-U16, AL-U19.
**İSTEĞE BAĞLI:** AL-M4 (sisli limit), AL-M5 (çatlak kasa), AL-M6 (açık jeton), AL-M8 (altın tur), AL-U17 (ilk tur
balonu), AL-U18 (anlatıma mini hazne), AL-AI1 (kasa bekçisi; yalnız M2 ile).
**HAYIR:** AL-M7 (taşırana eksi puan).

Bu paketle oyun şöyle akar: anlatım masanın gerçek sayılarıyla "0–5, toplam 17'yi geçmesin, en çok koyan kazanır"
der → 1. tur: düğmeye dokundukça jeton şıngırdar, "herkes 4 derse → 20, taşar" çizgisi kırmızılaşır → Gözcü 7. saniyede
anahtar deliğinden bakar, "rahat, rahat!" der → kasa kapısı iner, seçimler mühürlenir → jetonlar küçükten büyüğe düşer,
sayaç yükselir, son ikide kalp atışı → "Kıl payı!" ya da "Bir jetonla taştı!", Mert'in avatarında "TAŞIRAN", sende
"Sen 2 deseydin sığardı" → 2. ve 3. tur, kasa defterinde kimin ne yaptığı görünürken → sonda üç turun toplamına göre
+2 / +1 / 0.

**Değişen kurallar (paket onaylanırsa):** genel skor mini puan sıralamasıyla +2 / +1 / 0 (`rankAwards`, yalnız 0'dan
büyükler; lider eşitse liderler +1); oyun 3 tur (12 sn seçim, 5 sn ara açılış, 7 sn son açılış; erken bitiş tur
başına); mini puan = taşmayan turlarda seçilen sayıların toplamı; her tur bir Gözcü (7. saniyede yalnız kendisine
RAHAT / SINIRDA / TAŞIYOR; kim olduğu açık, gördüğü gizli). `docs/KURALLAR.md` §12, wiki ve testler buna göre
güncellenir.

**Değişmeyenler:** 3–8 oyuncu; 0…N aralığı; limit tablosu (6, 11, 17, 24, 33, 43) ve herkesin aynı limiti görmesi;
seçimin gizli olması ve tur sonunda aynı anda açılması; seçmeyenin 0 sayılması; taşmada herkesin o turdan 0 alması;
eksi puan olmaması; kilit ve erken bitiş kuralı (son kilitten 1 sn sonra); kopan oyuncunun beklenmemesi; oyun başı
jeton yağmuru sahnesi; renk körü desenleri.

**🎨 Yeni görsel gerekenler (paket):** yok. Mühür, kasa defteri, Gözcü maskesi, "TAŞIRAN" damgası ve kasa kapısı CSS/SVG
ile çizilir. (İsteğe bağlı: daha zengin cam çatlağı ve altın yağmuru dokusu Efekt Dokuları alanından.)
