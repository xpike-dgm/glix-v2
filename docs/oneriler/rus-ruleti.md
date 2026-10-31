# Rus Ruleti — geliştirme önerileri

Bu dosya onay içindir. Her maddenin bir kodu var (ör. **RR-M2**). Madde kodlarının öneki **RR** (Rus Ruleti).
Cevabını tek satırda verebilirsin:

> RR-M1 evet, RR-M2 hayır, RR-U3 evet …

ya da yalnız **"önerilen paket evet"** dersen sondaki paket uygulanır. Her maddenin "ayrıntılar" bölümü onaylarsan
nasıl yapılacağını kesinleştirir; ek soru sormam gerekmez. Beğenmediğin ayrıntı varsa yalnız onu yaz.

Not: Sonuç ekranı herkes **"Devam et"** deyince geçer (en çok 60 sn); bu zaten var, burada yeniden önerilmiyor.
Yeni görsel gerektiren maddeler **🎨 Görsel**, ses alanına iş açan maddeler **🔊 Ses** diye işaretli.

---

## 1. Bugünkü oyun (özet)

- 2–8 oyuncu. Silah, bağlı oyuncular arasından rastgele birine verilir. Herkes hayattadır, risk **%16**.
- Yalnız silahı tutan karar verir: bir portreye dokunur (hedef), sonra **ATEŞ ET**. Kendini ya da hayatta ve
  **bağlı** başka birini hedefleyebilir. Karar süresi **18 sn**; dolarsa sunucu, sahip dışındaki rastgele bir hayatta
  oyuncuya (bağlı olup olmadığına bakmadan) kendiliğinden ateş eder.
- Patlama zarı atış anında çıkar (önceden gizli bir "dolu yuva" yoktur). Boş geçerse silah **hedefe** geçer (kendine
  sıktıysan sende kalır), risk **+10** artar (16 → 26 → … → en çok 76). Patlarsa hedef elenir, risk %16'ya döner,
  silah hayatta kalanlardan rastgele birine gider.
- Her atıştan sonra **2,5 sn** sonuç gösterilir ("Klik!" / "BAM!"); bu sürede atış kabul edilmez.
- Hayatta kalan sayısı başlangıcın **yarısına ya da altına** inince biter (2 kişide 1, 8 kişide 4 elenme).
  Hayatta kalan **+1**, elenen **0** (genel skora doğrudan). Erken bitiş yoktur.
- Elenenler (O9) her atıştan önce gizlice **"Patlar mı?" Evet/Hayır** tahmini verir; puan yok, en az bir "Evet"i
  tutan ve "Evet"lerinin en az yarısı doğru çıkan elenen sonuç ekranında **"Kâhin"** rozeti alır.
- Ekran: üstte süre çubuğu ve başlık ("Silah sende!" / "Silah başkasında"), ortada risk halkası ("%36 patlama
  riski"), altında oyuncu ızgarası (2–4 kişi tek sıra, 5–8 kişi 4 sütun), en altta ATEŞ ET ya da tahmin satırı.
  Oyunun kendine ait bir son açılışı yok; sonuç, genel puan ekranının üstünde küçük bir şeritle gösteriliyor.

## 2. Gördüğüm sorunlar

**Oyun tasarımı**
1. **Tek karar "kimi vuracağım" ve bu karar intikam döngüsüne dönüyor.** Boş geçen atışta silah hedefe geçtiği için
   vurulan kişi hemen, riski 10 artmış silahla seni vurabiliyor. Masada "o beni vurdu, ben de onu" ping-pong'u
   oluşuyor; 5+ kişide diğerleri dakikalarca seyirci kalıyor.
2. **"Kendine sık" seçeneğinin anlamı hiç anlatılmıyor ve ödülü yok.** Kendine sıkmak aslında bir hamle: şimdi düşük
   riski sen alırsın, karşılığında bir sonraki (daha riskli) atışın kontrolü sende kalır. Ama ekran bunu söylemiyor,
   puan da bunu ödüllendirmiyor; oyuncular "kendine kim sıkar ki" deyip seçeneği yok sayıyor. Anlatımdaki ilk madde
   ("Kendini ya da birini seç") boş bir seçim gibi okunuyor.
3. **Puan pasif.** Hiç silah tutmadan, hiç karar vermeden hayatta kalan da +1 alıyor; cesur oynayanla saklanan aynı
   puanı alıyor. Diğer oyunlarda onayladığın +2 / +1 / 0 düzeni burada yok.
4. **Elenmek tamamen sessiz.** Patlama sonrası silah rastgele birine gidiyor; elenen kişinin oyuna son bir etkisi,
   masaya söyleyecek bir "son sözü" yok. Tahmin satırı (O9) var ama kararın dramasına katılmıyor.
5. **Bağlantısı kopan oyuncu yarı dokunulmaz.** Elle hedeflenemiyor (`target_offline`), ama süre dolunca otomatik
   atışta hedef olabiliyor. Kopan biri silahı tutarsa herkes 18 sn bekliyor. Kural tutarsız (wiki "bilinen sorunlar").
6. **2 oyuncuda neredeyse yazı tura.** Tek patlama oyunu bitiriyor; hesapla ilk silah sahibinin kazanma şansı
   ~%53. Karar etkisi çok az.
7. **Oyunun ne zaman biteceği hiç görünmüyor.** "Yarısı elenince biter" kuralı ekranda yok; 8 kişide "daha kaç kişi
   gidecek?" sorusu cevapsız.
8. **Süre uzayabiliyor.** 18 sn karar + 2,5 sn sonuç; 8 kişide ortalama ~13 atış. Herkes süreyi doldurursa 4–5 dk.

**Arayüz (ekran görüntülerine bakarak: 390×844, 360×640, 844×390; mock `rus-*`)**
9. **"BAM!" anında halka "%16" gösteriyor.** Risk patlamayla anında sıfırlandığı için patlama ekranında kocaman
   "%16 patlama riski" duruyor; "Klik!" ekranında da atışın yapıldığı %36 değil yeni %46 görünüyor. En dramatik anda
   ekran yanlış hikâye anlatıyor ("%16'da mı patladı?").
10. **Atış anında gerilim yok.** ATEŞ ET'e basınca sonuç anında çıkıyor; tambur dönmüyor, bekleme yok, kalp atışı yok.
    Oyunun bütün heyecanı tek karede bitiyor.
11. **Kim kimi vurdu belli değil.** "BAM! Elendi: Elif" yazıyor ama ateş edenin adı yok; silah ve namlu hiç görünmüyor
    (yalnız portrede küçük bir tabanca rozeti). Elenen kendi ekranında yalnız "Elendin" görüyor, kimin vurduğunu değil.
12. **Ekranın ortası boş, son sıra sola yaslı.** Halka ile oyuncu ızgarası arasında ~150 px boşluk var. 5 kişide Kaan,
    7 kişide son üç kişi alt satırda sola yaslı duruyor. Arka plandaki masa resmi boş; oyuncular masada oturmuyor.
13. **Kendini hedeflemek sıradan bir kart.** "Sen" kartı diğer portrelerle aynı ızgarada, aynı boyda; yanlışlıkla
    kendine nişan almak kolay, bilerek yapmanın ise bir vurgusu yok.
14. **Oyun bitince yazılar yanlış.** Son atıştan sonra oyun ekranında hayatta kalan "Silah sahibini bekle", elenen
    "Oyun bitene kadar izle" görüyor (kod: `footerNote`), tabanca rozeti hâlâ portrede, halka hâlâ risk gösteriyor;
    altında "Devam et" çıkıyor. Kimin kaldığı ve elenme sırası bu ekranda yok.
15. **Genel sonuç şeridinde isim yok.** "Hayatta kalanlar" altında yalnız avatarlar ve "+1"; elenenler isimsiz küçük
    gri çarpılar. Elenme sırası, kimin kimi vurduğu, en riskli atış hiçbir yerde yok.
16. **Elenenin tahmin satırı bağlamsız.** "Patlar mı? Evet / Hayır" yazıyor ama silahın kimde olduğu ve riskin kaç
    olduğu bu satırda yok; kendi tahmin karnesi ("3'te 1 bildin") de görünmüyor.
17. **Yatay ekranda (844×390) halka başlığın altına sıkışıyor,** "patlama riski" yazısı portre kartlarının üstüne
    biniyor; 360×640'ta 8 kişide ızgara ATEŞ ET'e değecek kadar yakın.
18. **TV'de özel düzen yok:** telefon ekranı büyütülüyor (wiki); büyük ekranda masa, risk ve geçmiş için yer boşa gidiyor.
19. **Anlatımda bitiş ve risk merdiveni yok.** "Yarısı elenince biter" ve "%16'dan %76'ya" bilgisi anlatımda geçmiyor;
    ilk oynayan ilk BAM'e kadar riskin nasıl değiştiğini anlamıyor.

---

## 3. Oyunu değiştiren öneriler (mekanik)

### RR-M1 · Hemen geri ateş yok — **önerim: EVET**
**Ne:** Seni vurup boş geçen kişiyi, silah sana geçtiği **ilk kararında** hedefleyemezsin. Onun portresi üzerinde
küçük bir kilit ve "Az önce sana sıktı" yazısı görünür.
**Neden:** Sorun 1. İntikam ping-pong'u kırılır; silah masada dolaşır, herkes karar anına girer. Zaman Bombası'nda
onayladığın "az önce kendisine atana hemen geri atamaz" kuralının aynısı.
**Ayrıntılar:**
- Yalnız **en az 3 kişi hayattayken** geçerlidir (2 kişide başka hedef yoktur).
- Yasak yalnız bir sonraki kararını kapsar; sonra yine hedefleyebilirsin. Kendine sıkmak her zaman serbest.
- Patlamadan sonra (silah yeni birine geçtiğinde) yasak yoktur; kendine sıkıp boş geçen sahip de yasak doğurmaz.
- Süre dolunca otomatik atış da yasaklı kişiyi seçmez (başka hayatta biri varsa).
- Sunucu ret kodu `no_return_fire`; ekranda kilitli portreye dokunulamaz, gerekçe metni "Az önce sana sıktı".

### RR-M2 · Cesaret yıldızı ve +2 / +1 / 0 — **önerim: EVET**
**Ne:** **Kendine sıkıp boş geçen** oyuncu bir **⭐ cesaret yıldızı** kazanır (herkese açık, portrenin altında).
Oyun sonunda: **en çok yıldızı olan hayatta kalan(lar) +2**, diğer hayatta kalanlar **+1**, elenenler **0**.
**Neden:** Sorun 2 ve 3. "Kendine sık" gerçek bir kumar olur: riski sen alırsın, yıldızı sen toplarsın; silah sende
kaldığı için bir sonraki daha riskli atışın kontrolü de sende kalır. Saklanan +1'de kalır, cesur oynayan +2'ye
çıkar. Eksi puan yok; genel düzen +2 / +1 / 0 ile aynı.
**Ayrıntılar:**
- +2 için **en az 1 yıldız** şarttır. Hiç kimsede yıldız yoksa bütün hayatta kalanlar +1 (bugünkü gibi).
- En çok yıldızda eşitlik varsa eşitlerin hepsi +2. Elenenin yıldızları silinmez (sonuçta görünür) ama puan getirmez.
- Üst üste kendine sıkmak serbesttir (her boş atış +1 yıldız, risk her seferinde +10); "itme şansı" anı budur.
- Otomatik atış hiçbir zaman kendine değildir; yıldız yalnız elle verilen kararla kazanılır.
- 2 oyuncuda: kalan oyuncu yıldızı varsa +2, yoksa +1; elenen 0.
- Kart etkisi: "birinci" = +2 alanlar (yıldız yoksa bütün hayatta kalanlar), "sonuncu" = elenenler. Bugünkü genel
  kart hesabı aynen işler.
- Kâhin rozeti aynen kalır; yıldızla karışmaz.

### RR-M3 · Son söz: elenen silahı kime vereceğini seçer — **önerim: EVET**
**Ne:** Patlamayla elenen oyuncunun ekranında 4 sn'lik "**Son sözün: silahı kime veriyorsun?**" seçimi çıkar;
seçtiği hayatta oyuncu silahı alır. Diğerleri "Elif son sözünü söylüyor…" görür.
**Neden:** Sorun 4. Elenmek bir an olarak yaşanır; masada "silahı sana veriyorum Mert, görelim seni!" gibi sözlü
oyun doğar. Rastgele dağıtım kalkar.
**Ayrıntılar:**
- Seçim yalnız oyun bitmiyorsa yapılır (yarı eşiği gelmişse son söz yok, açılışa geçilir).
- Herhangi bir hayatta oyuncu seçilebilir (onu vuran dahil). 4 sn içinde seçmezse ya da bağlantısı kopuksa **rastgele**
  (bugünkü kural). Kendini vurup elenen de son sözünü söyler.
- Patlamadan sonraki bekleme: 2,5 sn sonuç + 4 sn son söz = **6,5 sn** (seçim yapılınca 0,5 sn sonra biter).
  Boş atışlarda bekleme değişmez.
- Elenenin "Patlar mı?" tahmini (O9) son sözden sonra başlar; son söz ekranında tahmin satırı yoktur.
- Gizlilik: seçim seçilene kadar yalnız elenenin ekranındadır; seçilince herkese "Elif silahı Mert'e verdi".

### RR-M4 · Kopan oyuncu da hedef olur; kopan sahip kısa bekletir — **önerim: EVET**
**Ne:** Bağlantısı kopan hayattaki oyuncu **elle de hedeflenebilir** (otomatik atışta zaten hedef olabiliyor).
Silah kopan birindeyse karar süresi **18 sn yerine 6 sn** olur, sonra bugünkü gibi otomatik atış.
**Neden:** Sorun 5. Kural tutarlı olur (Sızma'da "kopan oyuncuya oy" ile çözdüğün sorunun aynısı); kimse kopup
"dokunulmaz" kalamaz, masa da 18 sn boş beklemez.
**Ayrıntılar:**
- Portrede gri halka ve küçük "bağlantı yok" simgesi; dokununca hedeflenebilir.
- Dönen oyuncu kendi yerine döner; 6 sn'lik pencere başlamışsa kalan süreyle karar verebilir.
- İlk silah sahibi yine yalnız bağlı oyuncular arasından seçilir (bugünkü gibi).

### RR-M5 · Açık nişan — **önerim: İSTEĞE BAĞLI**
**Ne:** Silah sahibi bir portreye dokunduğunda bu **herkesin ekranında** görünür: namlu o kişiye döner, hedefin
telefonu kısa titrer ve "Mert sana nişan aldı!" yazar. Sahip ATEŞ ET'e basana kadar nişanı değiştirebilir.
**Neden:** Sözlü etkileşim: hedef yalvarır, pazarlık eder, başkasını gösterir ("beni değil onu vur!"). Bugün hedef
seçimi yalnız sahibin ekranında, masa ancak atıştan sonra öğreniyor.
**Neden isteğe bağlı:** Sahibe baskı kurar; çekingen oyuncu nişan almaktan kaçınıp süreyi doldurabilir. Gizli hedef
de ayrı bir his ("kimi vuracak?"). İkisinden birini seçmen gerekir.
**Ayrıntılar (onaylanırsa):** nişan yalnız ortak görünüme "aim" alanı olarak girer (gizli değer yok); en çok saniyede
3 değişiklik yayınlanır (titreme önlemi); son 3 sn'de nişan değiştirilemez (son anda hile sayılmasın diye değil,
masa son hedefi duysun diye). Otomatik atışta nişan varsa o kişiye ateş edilir; yoksa bugünkü rastgele kural.

### RR-M6 · Karar süresi 18 → 14 sn — **önerim: İSTEĞE BAĞLI**
**Ne:** Her karar penceresi 14 sn olur.
**Neden:** Sorun 8. Karar tek dokunuş; 18 sn çoğu zaman bekleme. 8 kişide en kötü durum ~4,5 dk'dan ~3,7 dk'ya iner.
**Neden isteğe bağlı:** RR-M5 (açık nişan) ya da RR-M3 (son söz) onaylanırsa masadaki pazarlık süreyi doldurur; o
durumda 18 sn kalabilir. Önce M1–M4 ile denenip karar verilmesi daha doğru.
**Ayrıntılar:** son 5 sn uyarısı (RR-U16) yeni süreye göre çalışır; kopan sahibin 6 sn'si (RR-M4) değişmez.

### RR-M7 · Tamburu çevir hakkı — **önerim: HAYIR**
**Ne:** Her oyuncu oyunda bir kez, silah kendindeyken "Tamburu çevir" diyebilir: risk %16'ya iner ama o atış kendine olur.
**Neden önermiyorum:** RR-M2 ile birleşince herkes bir kez %16'da ucuz yıldız toplar; yıldız anlamını kaybeder ve
risk merdiveni (oyunun omurgası) kırılır. M2 olmadan da kendine sıkmanın yeni bir anlamını vermez.

### RR-M8 · Seyirci uğultusu (elenenlerin tahmin sayısı açık) — **önerim: HAYIR**
**Ne:** Ateşten önce herkes "Elenenlerden 2'si patlar diyor" sayısını görür.
**Neden önermiyorum:** O9'da tahminlerin gizli kalmasını kararlaştırdın; açık sayı tahminleri sürü davranışına
çevirir ve silah sahibini rastgele bir sese göre yönlendirir. Elenenlerin etkisini RR-M3 (son söz) daha temiz verir.

---

## 4. Arayüz ve his önerileri

### 4a. Ana ekranlar ve akış

### RR-U1 · Masa sahnesi: oyuncular masanın etrafında, silah ortada — **önerim: EVET** · 🎨 Görsel
**Ne:** Izgara yerine oyuncular arka plandaki oval masanın çevresine oturur (2–8 kişi için sabit yerleşimler); masanın
ortasında **üstten görünen tabanca** döner ve namlusu sahibine, nişan alınca hedefe döner. Risk halkası tabancanın
altında daha küçük (tambur + "%36").
**Neden:** Sorun 11 ve 12. Boşluk dolar, son sıra sola yaslanma sorunu kalmaz, "silah kimde, kime dönük" tek
bakışta görülür.
**Ayrıntılar:**
- Yerleşim: oturma sırası maç başındaki oyuncu sırası; "Sen" her zaman en altta, ortada (başparmak bölgesi).
- 2 kişide karşılıklı, 3–4 kişide üçgen/kare, 5–8 kişide oval. Portre ≥ 56 px, ad en çok 8 harf ("…").
- 360×640'ta masa ovali basıklaşır; portreler 48 px'e iner, ad altta tek satır.
- 🎨 Gereken: üstten görünen neon tabanca (mevcut `rus-ruleti/tabanca` görselinin üstten hâli; şeffaf PNG).
  Gelmezse mevcut yandan tabanca 90° döndürülerek kullanılır.

### RR-U2 · Bitiş sayacı: "2 elenme daha" — **önerim: EVET**
**Ne:** Başlığın altında küçük kurukafa göstergesi: dolu kurukafalar elenenler, boşlar kalan elenme hakkı;
yanında "**2 elenme daha → oyun biter**".
**Neden:** Sorun 7. Herkes oyunun ne kadar süreceğini ve "son elenme" anının yaklaştığını görür.
**Ayrıntılar:** gereken elenme sayısı kuraldan hesaplanır (2→1, 3/4→2, 5/6→3, 7/8→4). Son elenmeye 1 kalınca
yazı kırmızı "**Son kurşun!**" olur. CSS/SVG ile çizilir.

### RR-U3 · Atış geçmişi şeridi — **önerim: EVET**
**Ne:** Masanın altında son 4 atışın küçük kayıtları: "Mert → Elif · %26 · klik", "Elif → Elif ⭐ · %36 · klik",
"Kaan → Defne · %46 · BAM". Dokununca bütün geçmiş açılır.
**Neden:** Sorun 1, 11 ve 15. Kim kimi hedefliyor, kimin kin tuttuğu görünür; masa konuşmasının malzemesi olur.
**Ayrıntılar:** ortak görünüme herkese açık bir `shots` listesi eklenir (atış sırası, ateşleyen, hedef, risk,
sonuç, otomatik mi). Gizli bilgi değildir; zar tohumu yine hiçbir yerde yok. Otomatik atış "⏱" ile işaretlenir.

### RR-U4 · Sonraki risk önizlemesi — **önerim: EVET**
**Ne:** Halkanın altında küçük satır: "Boş geçerse sıradaki: **%46**". Silah sendeyse ayrıca "Kendine sıkarsan
sıradaki atış senin elinde" (RR-M2 onaylanırsa "+ ⭐").
**Neden:** Sorun 2. Kendine sıkmanın neden bir hamle olduğu ekranda yazar; risk merdiveni kendiliğinden öğrenilir.
**Ayrıntılar:** %76 tavanında "Risk tavanda: %76" yazar.

### 4b. Açılış/sonuç anı ve gerilim

### RR-U5 · Tambur dönüşü: atıştan önce 1,2 sn gerilim — **önerim: EVET** · 🔊 Ses
**Ne:** ATEŞ ET'e basınca herkesin ekranında tambur **1,2 sn döner** (giderek yavaşlar), ekran hafifçe kararır,
kalp atışı sesi; sonra "Klik!" ya da "BAM!". Halka bu sürede **atışın riskini** gösterir; sonuçtan sonra yeni riske
sayarak yükselir (ya da patlamada boşalıp %16'ya iner).
**Neden:** Sorun 9 ve 10. En önemli an tek karede bitmez; halka doğru hikâyeyi anlatır.
**Ayrıntılar:**
- Atış sonrası pencere **2,5 → 3,5 sn** olur (1,2 sn dönüş + 2,3 sn sonuç). RR-M3 ile patlamada 3,5 + 4 = 7,5 sn.
- Sonuç atış anında sunucuda belirlenir (bugünkü gibi); istemci yalnız gösterimi 1,2 sn geciktirir. Bu sürede
  yapılabilecek hiçbir eylem yok (tahminler bir sonraki atışa sayılır), yani erken öğrenmek avantaj sağlamaz.
- Halka değerleri: dönüş sırasında `last.risk`, sonra `risk`.
- Hareket azaltmada dönüş yok; 1,2 sn yalnız "…" ve kalp atışı.

### RR-U6 · BAM sahnesi — **önerim: EVET** · 🎨 Görsel · 🔊 Ses
**Ne:** Patlamada kırmızı flaş, namlu ateşi, hedef portrede **cam çatlağı** ve "ELENDİ" damgası; başlık
"**BAM!**", alt satır "**Mert, Elif'i vurdu**" (kendine sıktıysa "Elif kendine sıktı"). Elenenin kendi ekranı tam
kırmızıya döner: "Seni Mert vurdu · %36".
**Neden:** Sorun 11. Kim kimi vurdu masada tartışmasız görünür; "intikam" hikâyesi doğar.
**Ayrıntılar:** sarsıntı bugünkü `--shake-gain` ile; elenen portre sonra sönükleşip X alır (bugünkü gibi).
🎨 namlu ateşi ve cam çatlağı katmanı (Çapraz Ateş için istenen namlu ateşi / cam çatlağı varsa onlar kullanılır;
yeni üretim gerekmez).

### RR-U7 · Klik anı: silah el değiştirir — **önerim: EVET**
**Ne:** Boş atışta "Klik!" ve hedefin portresi kısa yeşil nefes alır; tabanca masanın ortasından hedefe **kayarak**
geçer (0,4 sn); risk halkası +10 sayar. Kendine sıktıysa portrenin altına ⭐ düşer (RR-M2).
**Neden:** Sorun 10. "Rahatladım ama silah bana geldi" duygusu görünür olur.

### RR-U8 · Oyun içi son açılış: "Hayatta kalanlar" sahnesi — **önerim: EVET**
**Ne:** Son atıştan sonra oyun ekranı kendi açılışını oynar (Devam et'ten önce): masa kararır, elenenler **elenme
sırasıyla** tek tek gelir ("1. Elif — Mert vurdu, %36"), sonra hayatta kalanlar altın halkayla ve **adlarıyla**
yükselir (+1 / +2 ⭐), en son Kâhin rozetleri. Altında bugünkü "Devam et".
**Neden:** Sorun 14 ve 15. Bugün oyun bitince ekranda "Silah sahibini bekle" kalıyor; sonuç ancak genel tabloda
küçük bir şeritle, isimsiz görünüyor.
**Ayrıntılar:**
- Süre: her elenen 0,5 sn, hayatta kalanlar 1 sn, Kâhin 0,5 sn; en çok ~5 sn. Oyunun "en az gösterim" süresi
  (bugün 2,5 sn) buna göre 6 sn olur; Devam et kuralı (60 sn tavan) değişmez.
- Genel sonuç şeridine (Reveal) de adlar eklenir; elenenler adıyla ve sırasıyla.
- Bitişte yanlış yazılar (sorun 14) kalkar: hayatta kalan "Hayattasın!", elenen "Bu sefer olmadı", izleyici
  "Oyun bitti". Tabanca rozeti ve risk halkası gizlenir.

### RR-U9 · Son 5 saniye ve silah sana geçtiğinde — **önerim: EVET** · 🔊 Ses
**Ne:** Silah sana geçince güçlü titreşim, kenar ışığı ve 0,8 sn'lik "**SİLAH SENDE!**" bandı. Kararın son 5
saniyesinde halka kenarı titrer, tik sesi hızlanır; sahibin telefonu her saniye kısa titrer.
**Neden:** Sorun 8 ve 10. Sıra kaçmaz, süre dolmadan karar verilir, masa "hadi!" baskısını duyar.
**Ayrıntılar:** bant karar süresinden yemez: atıştan sonraki 3,5 sn'lik beklemenin son 0,8 sn'sinde oynar. Oyunun
ilk kararında bekleme olmadığı için ilk pencere 0,8 sn uzun (18,8 sn) açılır. Son 5 sn'de diğerlerinde yalnız tik
sesi, titreşim yok.

### 4c. Telefon ergonomisi ve okunurluk

### RR-U10 · "Kendine sık" ayrı düğme — **önerim: EVET**
**Ne:** Kendini hedeflemek ızgaradaki "Sen" kartı yerine ATEŞ ET'in üstünde ayrı, küçük ve belirgin bir düğme olur:
"**Kendine sık**" (RR-M2 onaylanırsa "Kendine sık ⭐"). Basınca ATEŞ ET'in metni "KENDİNE ATEŞ ET" olur.
**Neden:** Sorun 13. Yanlışlıkla kendine nişan alma biter, bilerek yapmak bir karar gibi hissettirir.
**Ayrıntılar:** iki adımlı akış (seç + ATEŞ ET) kalır. ATEŞ ET devre dışıyken bugünkü lacivert yerine sönük
kırmızı; hedef seçilince tam kırmızı ve hafif nabız.

### RR-U11 · Yatay ve küçük ekran düzeni — **önerim: EVET**
**Ne:** 844×390'da masa solda, halka/geçmiş/ATEŞ ET sağda iki sütun; 360×640'ta 8 kişide portreler 48 px, ad tek
satır, ATEŞ ET ile en alt portre arasında en az 12 px.
**Neden:** Sorun 17 (halka başlığa biniyor, alt sıra düğmeye değiyor).

### RR-U12 · Kim kimin hedefi: tek satırlık durum — **önerim: EVET**
**Ne:** Bekleyenlerin başlığı "Silah başkasında" yerine kişiyi büyük söyler: "**Mert'in elinde · %36**"; altında
"Seni de seçebilir". Silah sahibinin portresi masada büyür (1,15×) ve altın halka alır.
**Neden:** Sorun 11. Uzaktan bakan bile kimin karar verdiğini görür.

### 4d. İzleyici, kopan oyuncu ve TV

### RR-U13 · Elenenin ekranı: bağlamlı tahmin ve karne — **önerim: EVET**
**Ne:** Tahmin satırı "**Mert'in atışı · %46 · Patlar mı?**" olur; altında yalnız sana görünen küçük karne:
"Tahminlerin: 3 · bildiğin 1". Son söz (RR-M3) varsa önce o, sonra tahmin.
**Neden:** Sorun 16. Elenen ne için tahmin verdiğini görür; Kâhin hedefi somutlaşır.
**Ayrıntılar:** karne yalnız sahibinin `view`ına girer (O9 gizliliği aynen); "Evet"lerinin kaçı tuttu ayrı yazılır
("Evet: 2'de 1"), çünkü rozet yalnız Evet'lere bakar.

### RR-U14 · TV ve izleyici: masa görünümü — **önerim: EVET**
**Ne:** TV'de büyük masa (RR-U1) ortada, sol sütunda risk halkası ve bitiş sayacı, sağ sütunda atış geçmişi (RR-U3)
ve yıldızlar. Tambur dönüşü ve BAM tam ekran. Maça katılmayan izleyici telefonda aynı masayı görür (tahmin yok).
**Neden:** Sorun 18.
**Ayrıntılar:** TV'de hiçbir gizli bilgi yok (hedef seçimi RR-M5 yoksa gösterilmez, tahminler hiç gösterilmez).

### RR-U15 · Kopan oyuncu görünümü — **önerim: EVET**
**Ne:** Kopan oyuncunun portresi gri halka + "bağlantı yok" simgesi; silah ondaysa "Elif bağlı değil · 6 sn"
(RR-M4). Dönen oyuncuya 1,5 sn'lik "Döndün! Silah Mert'te · %46" bandı.
**Neden:** Sorun 5; masada "neden bekliyoruz?" sorusu biter.

### 4e. Ses, titreşim ve hareket

### RR-U16 · Ses ve titreşim seti — **önerim: EVET** · 🔊 Ses
**Ne:** Oyuna özel set: horoz çekme (silah sana geçince), tambur dönüşü (1,2 sn, yavaşlayan tıkırtı), kalp atışı
(risk ≥ %56'da hızlanır), kuru klik, derin BAM + cam çatlağı, el değiştirme "şak", ⭐ yıldız çınlaması, son 5 sn tik,
son söz (RR-M3) için kısa alçak nota, açılışta hayatta kalanlar için tok "bitti" vuruşu.
**Ayrıntılar:** titreşim: silah sana geçince uzun-kısa-uzun; seni vurduklarında 400 ms; kendi BAM'in sonrası susar;
klikte 10 ms. Ses alanı dosyaları gelene kadar bugünkü sentez sesleri (`click`, `bang`, `cock`, `lock`) kullanılır.

### RR-U17 · Risk arttıkça oda ısınır — **önerim: İSTEĞE BAĞLI**
**Ne:** Risk %56 ve üstündeyken arka plandaki masa lambası titrer, kenarlar hafif kırmızı nabız atar; %76'da sürekli.
**Neden:** Gerilim görünür olur; risk zaten herkese açık olduğu için bilgi sızdırmaz.
**Neden isteğe bağlı:** Aşırı Yükleme'de tehlike anı efektlerini (siren, kalp atışı) kabul etmemiştin; burada
bilgi vermediği için sorun değil ama tat tercihi sana kalır. RR-U5'teki kalp atışıyla birlikte fazla gelebilir.

### 4f. İlk kez oynayan için öğretme (anlatım ekranı dahil)

### RR-U18 · Anlatım: bitiş, risk merdiveni ve kendine sıkmanın anlamı — **önerim: EVET** · 🎨 Görsel (isteğe bağlı)
**Ne:** Amaç: "Silah patlamadan hayatta kal!". Üç madde:
1. "Silah sendeyse birini ya da **kendini** seç; boş geçerse silah ona geçer." (M2 ile: "Kendine sıkıp kurtulursan ⭐")
2. "Risk **%16'dan başlar**, her boş atışta 10 artar; patlayınca sıfırlanır."
3. "**Yarınız elenince** biter: hayatta kalanlar +1 (en çok ⭐ +2)." (M2 olmadan: "hayatta kalanlar +1")
Anlatım görselinde bugünkü halka yerine kısa döngü: %16 → %26 → %36 → BAM → %16.
**Neden:** Sorun 2, 7, 19.
**Ayrıntılar:** RR-M1 onaylanırsa 1. maddeye kısa ek yer yoksa koça (RR-U19) bırakılır. 🎨 isteğe bağlı: mevcut
anlatım illüstrasyonu yeterli; döngü CSS ile çizilir.

### RR-U19 · İlk karar koçu — **önerim: EVET**
**Ne:** Oyuncunun ilk kez silahı tuttuğu anda (cihazda bir kez) iki küçük ipucu balonu: portrenin üstünde "1. Hedefe
dokun", ATEŞ ET'in üstünde "2. Ateş et". İkincisinde gösterilmez.
**Ayrıntılar:** süreyi durdurmaz; dokununca kaybolur; tercih yerel olarak hatırlanır (okunamazsa yine gösterilir).

### 4g. Erişilebilirlik

### RR-U20 · Ekran okuyucu, renk körü, hareket azaltma, yazı boyutu — **önerim: EVET**
**Ne:**
- **Ekran okuyucu:** halka "Patlama riski yüzde 36" diye okunur; her atış canlı bölgeden duyurulur ("Mert, Elif'e
  ateş etti: boş. Silah Elif'te, risk yüzde 46"); portre etiketi "Elif, hayatta, hedef al" / "Kaan, elendi".
- **Renk körü modu:** klik/BAM yalnız renkle değil simgeyle (✓ boş / ✕ elendi); kilitli portre (RR-M1) kilit
  simgesiyle; risk ≥ %56'da halkaya çizgili desen.
- **Hareket azaltma:** tambur dönüşü, sarsıntı ve kayan tabanca yerine anlık geçiş ve çerçeve parlaması.
- **Yazı boyutu:** büyük yazı ayarında adlar iki satıra kırılmaz, kısaltılır; yüzde rakamı ≥ 48 px kalır.

---

## 5. Yapay zekâ (AI) ile yapılabilecekler

### RR-AI1 · Ruletçi yorumu — **önerim: İSTEĞE BAĞLI**
Oyun içi açılışın (RR-U8) altında tek cümlelik esprili özet: "Oyuncu3 üç kez kendine sıkıp yıldız topladı,
Oyuncu1 ise intikam peşinde koşarken ilk giden oldu." Ortak yorum altyapısıyla (`aiCommentGames.ts`): modele
yalnız atış geçmişi (Oyuncu1…N, hedef, risk, sonuç, yıldız) gider; puanı yapay zekâ belirlemez; hata olursa ya da
anahtar yoksa yorum hiç görünmez, oyun beklemez. RR-U3'teki atış geçmişi listesi gerektirir.

Not: Hedef seçimini, otomatik atışı ya da patlama zarını yapay zekâya bırakmayı **önermiyorum**: adalet ve
`replay` için zar tohumlu kalmalı.

---

## 6. İçerik ve üretim ekibine düşen işler

- **Ses Efektleri (🔊):** RR-U16 seti (horoz, tambur dönüşü, kalp atışı, klik, BAM + cam, el değiştirme, yıldız,
  son 5 sn tik, son söz notası, bitiş vuruşu); RR-U5, RR-U6, RR-U9 bu sesleri kullanır. Ses olay haritası adları
  `rus-ruleti.<an>`.
- **Müzik:** isteğe bağlı gerilim katmanı (risk ≥ %56'da kalp atışıyla uyumlu alçak drone); son kurşunda (RR-U2) tempo.
- **Görsel (🎨, CLAUDE.md akışıyla: görev dosyası + ChatGPT):** üstten görünen neon tabanca (RR-U1). Namlu ateşi ve
  cam çatlağı Çapraz Ateş'ten yeniden kullanılır (RR-U6).
- **Efekt Dokuları:** kırmızı flaş, namlu ateşi parçacıkları, yıldız tozu (⭐ düşüşü), hareket azaltma sürümleri.
- **Rozet:** "Cesaret" rozeti önerisi (tek oyunda 3 ⭐) — RR-M2 onaylanırsa Rozet alanına istek kartı.
- **Moderasyon ve Wiki:** onaylanan kurallara göre `docs/wiki/oyunlar/rus-ruleti.json` ve KURALLAR §7 güncellemesi.
- **İçerik Havuzu:** bu oyunda havuz yok; iş düşmez.

## 7. Önerilen paket

**EVET:** RR-M1, RR-M2, RR-M3, RR-M4 · RR-U1 … RR-U16, RR-U18, RR-U19, RR-U20.
**İSTEĞE BAĞLI:** RR-M5 (açık nişan), RR-M6 (14 sn), RR-U17 (oda ısınır), RR-AI1 (ruletçi yorumu).
**HAYIR:** RR-M7 (tamburu çevir), RR-M8 (seyirci uğultusu).

Bu paketle oyun şöyle akar: anlatım risk merdivenini ve "yarınız elenince biter"i söyler → silah masanın ortasında
döner, namlu sahibine bakar ("SİLAH SENDE!") → sahip birine dokunur ya da "Kendine sık ⭐" der; az önce kendisine
sıkanı hemen vuramaz → ATEŞ ET: tambur 1,2 sn döner, kalp atar → "Klik!" silah hedefe kayar, risk +10 sayar; ya da
"BAM! Mert, Elif'i vurdu", cam çatlar → Elif son sözünü söyler: "Silahı Kaan'a veriyorum" → elenenler bağlamlı
tahmin verir → kurukafa sayacı "Son kurşun!" der → son elenmeden sonra oyun içi açılış: elenme sırası, hayatta
kalanlar adıyla, en çok yıldızlı +2, diğerleri +1, Kâhin rozetleri → Devam et.

**Değişen kurallar (paket onaylanırsa):** hemen geri ateş yasağı (3+ hayattayken, tek karar); kendine sıkıp boş
geçene ⭐; puan: en çok ⭐'lı hayatta kalan(lar) +2 (en az 1 ⭐), diğer hayatta kalanlar +1, elenen 0; elenen 4 sn
içinde silahın yeni sahibini seçer (seçmezse rastgele); kopan oyuncu elle hedeflenebilir, kopan sahibin süresi 6 sn;
atış sonrası bekleme 2,5 → 3,5 sn (patlamada son sözle 7,5 sn); oyun sonu en az gösterim 6 sn. `docs/KURALLAR.md`,
wiki ve testler buna göre güncellenir.

**Değişmeyenler:** 2–8 oyuncu; risk %16 başlangıç, +10 artış, %76 tavan, patlamada %16; zarın atış anında tohumdan
çıkması; yalnız sahibin ateş etmesi; 18 sn karar süresi (M6 onaylanmazsa); süre dolunca sahip dışındaki rastgele
birine otomatik atış; yarı eşiğinde bitiş; erken bitiş olmaması; O9 tahmin kuralları ve Kâhin eşiği; eksi puan yok.

**🎨 Yeni görsel gerekenler (paket):** üstten görünen neon tabanca (RR-U1). Diğer her şey mevcut görseller, CSS/SVG
ya da Çapraz Ateş için istenen namlu ateşi/cam çatlağı ile yapılır.
