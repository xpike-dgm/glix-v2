# Son Kişi — geliştirme önerileri

Bu dosya onay içindir. Madde kodlarının öneki **SK** (Son Kişi). Her maddenin bir kodu var (ör. **SK-M2**).
Cevabını tek satırda verebilirsin:

> SK-M1 evet, SK-M2 hayır, SK-U3 evet …

ya da yalnız **"önerilen paket evet"** dersen sondaki paket uygulanır. Her maddenin "ayrıntılar" bölümü onaylarsan
nasıl yapılacağını kesinleştirir; ek soru sormam gerekmez. Beğenmediğin ayrıntı varsa yalnız onu yaz.

Not: Sonuç ekranı herkes **"Devam et"** deyince geçer (en çok 60 sn; zaten var). Yeni görsel gerektiren maddeler
**🎨 Görsel**, yeni ses gerektirenler **🔊 Ses** diye işaretli (ilgili yapay zekâ alanlarınca üretilir; dosya
gelene kadar bugünkü sentez ses / CSS çizimi kullanılır).

---

## 1. Bugünkü oyun (özet)

Koddan doğrulandı (`packages/engine/src/games/son-kisi/`).

- 2–8 oyuncu, tek tur. Sunucu oyun başında **gizli bir bitiş** seçer: başlangıçtan 10–20 sn sonra (ms
  çözünürlükte). Hiçbir ekranda sayaç yok.
- Herkesin ekranında tek büyük **KAÇ** düğmesi; bir kez basılır (parmak değer değmez). Bitiş anı ve sonrası gelen
  basış reddedilir.
- **Kim kaçtı herkese anında açık** (alt şeritte avatar söner); kaçış süreleri sonda açılır.
- **Gerilim:** bitişten 5–8 sn, 2,5–4,5 sn ve 0,8–2,2 sn önce (rastgele) üç gizli eşik; her eşikte koridor ışığı
  ve gölge nabzı hızlanır (2,8 → 1,7 → 1,0 → 0,52 sn), hâlâ içeride olanlara tek bir "kalp atışı" sesi ve titreşim.
- Herkes kaçtıysa oyun son kaçıştan 1 sn sonra biter (kopan oyuncu da beklenir; bilinçli karar).
- **Puan (doğrudan genel skora):** kaçanlar arasında en son kaçan(lar) **+1** (eşit ms: hepsi), diğer kaçanlar
  **0**, hiç kaçmayan **−1**; kimse kaçmazsa herkes −1.
- Gizli bitiş zamanı sonuçta da açılmaz (`docs/ERKEN-BITIS.md`: "sonuç ekranında bitiş yok").

## 2. Gördüğüm sorunlar

**Oyun tasarımı**

1. **Eksi puan var.** Genel kararın "eksi yok, +2 / +1 / 0"; burada kaçamayan −1, kimse kaçmazsa herkes −1. Bu
   oyunda eksi puan oyunun özü değil: risk zaten "kazanma şansını kaybetmek"le kurulabiliyor.
2. **Son kalan bedavaya kazanıyor.** Kaçışlar herkese anında açık olduğu için diğer herkes kaçtığında son kalan
   oyuncu düğmeye hemen basar ve +1 kesinleşir; oyun 1 sn sonra biter. "Son kişi" olmanın cesaret anı, tam o kişi
   için yok. Gerçek mücadele son ikiye kadar sürüyor, sonra sönüyor.
3. **Çok kısa ve tek atış.** Ortalama 15 sn'lik oyunun önünde 40 sn anlatım + 3 sn geri sayım, arkasında 60 sn'ye
   kadar sonuç var. Tek turda sonuç büyük ölçüde şans; masa "şimdi anladım" dediği anda oyun bitmiş oluyor.
4. **Gerilim ipucu bitişi ele veriyor.** Üçüncü kalp atışı bitişten 0,8–2,2 sn önce geliyor. Deneyimli masa
   "üçüncü atışı duyunca bir say, bas" stratejisini öğrenince oyun bekleme cesaretinden çıkıp tepki yarışına dönüyor.
5. **Kopan oyuncu.** Kaçamadığı için −1 alıyor; ekranda avatarı yalnız soluk, "hâlâ içeride" gibi duruyor ve
   diğerlerinin "kim kaldı" hesabını bozuyor.
6. **Alarm anı hiç açılmıyor.** Oyuncu "alarma ne kadar vardı?", "0,3 sn ile mi kaçırdım?" sorusunun cevabını hiç
   öğrenmiyor; kıl payı anlar ve öğrenme kayboluyor. Herkes erken kaçtığında ise alarm hiç çalmıyor.
7. **Kaçan oyuncunun yapacak işi yok.** Kaçtıktan sonra ekran boş bir koridor ve "Şimdi diğerlerini bekle";
   oyunun en gergin bölümünü (son iki kişi) seyirci bile değil, boş ekranla geçiriyor.

**Arayüz (ekran görüntülerine bakarak: 390x844, 360x640, 844x390)**

8. **Oyun içi sonuç ekranında alarm yok.** Gizli bitiş geldiğinde telefonda hiçbir şey olmuyor: ekran "Kaçtın! /
   Şimdi diğerlerini bekle" (ya da "Alarmı bekle") ve pasif düğmeyle kalıyor, altına yalnız "Devam et" geliyor.
   Siren, altın kart ve "+1" ancak herkes Devam deyince (ya da 60 sn sonra) genel sonuç ekranının üstünde çıkıyor.
   Oyunun tek büyük anı kayıp.
9. **"Alarmı bekle" başlığı yanlış yönlendiriyor.** Alarmı bekleyen −1 alıyor; başlık oyuncuya kaybettiren şeyi
   söylüyor. Alt başlık "Herkesten geç kaç, alarmdan önce" doğru ama küçük.
10. **Koridor kutu içinde kutu.** Sahne 350x515'lik çerçeveli bir panel (TASARIM: "sahne, kart değil"). Karakter
    yalnız portre dairesi; koşan/kaçan bir figür yok. Kaçış kolu koridorun sonunda küçük ve KAÇ düğmesiyle bağı yok.
11. **Gerilim durağan görüntüde görünmüyor, hareket azaltmada hiç yok.** Sakin ve gergin ekranlar aynı görünüyor;
    tek fark nabzın hızı. "Hareketi azalt" açıkken bütün animasyonlar 0,001 ms'ye indiği için nabız tamamen
    kayboluyor: bu oyuncular gerilim bilgisini hiç almıyor (diğerlerine göre dezavantaj).
12. **Alt şerit isimsiz ve küçük.** 44 px avatarlar (8 kişide 360 genişlikte ~36 px), ad yok; kaçanlar koyu gölgeye
    dönüyor, kimin içeride kaldığı bir bakışta okunmuyor. Yatay ekranda şerit ve alt başlık hiç yok.
13. **Genel sonuç başlığı küçük ve eksik.** Son kaçanın kartı 36 px, "Kaçmayan: −1" 22 px; kaçış sırası, zaman
    çizelgesi, alarm anı yok. "Kimse kaçmadı" durumunda podyumda herkes −1 ile altın/gümüş/bronz blokta duruyor ve
    adların yanında taç var ("taç yalnız kazanana" kararıyla çelişiyor).
14. **İzleyici ve TV için özel görünüm yok.** İzleyici boş koridoru ve isimsiz şeridi görüyor; TV'de telefon sütunu
    büyütülüyor.
15. **Anlatım:** 3. madde iki satıra kırılıyor ("−1 / alır"); gerilim ipucu (kalp atışı) hiç anlatılmıyor, ilk kez
    oynayan onu fark etmiyor.

---

## 3. Oyunu değiştiren öneriler (mekanik)

### SK-M1 · Eksisiz puan — **önerim: EVET**
**Ne:** Bir alarmda (turda): **son kaçan +2, sondan ikinci +1**, diğer kaçanlar 0, **alarma yakalanan 0**. Kimse
kaçmazsa kimse puan almaz. Eksi yok.
**Neden:** Sorun 1. Eksi kalkar ama risk kalır: yakalanırsan puan şansını kaybedersin, erken kaçarsan da.
"Sondan ikinci +1" son iki kişinin bekleyişine yeni bir hesap ekler ("ikinci olsam da +1").
**Ayrıntılar:**
- Eşit zaman damgası: aynı derecedeki herkes aynı puanı alır (iki kişi son ise ikisi +2, sondan ikinci sayılan bir
  sonraki farklı zamandır).
- **2 oyuncuda** sondan ikinci ödülü yoktur (yalnız son kaçan +2): yoksa kaçmak her durumda puan getirir.
- Tek kişi kaçtıysa yalnız o +2.
- SK-M2 onaylanmazsa bu puanlar doğrudan genel skora gider. SK-M2 onaylanırsa bunlar **tur puanıdır**, genel skora
  SK-M2'deki sıralamayla gider.
- Maç kartlarında "sonuncu" artık "−1 alan" değil, en düşük puanlılardır (bugünkü genel hesap).

### SK-M2 · Üç alarm — **önerim: EVET**
**Ne:** Oyun **3 tur**. Her turun gizli alarmı **8–16 sn** arası (bugün tek tur 10–20). Turlar arasında **4 sn**
kısa açılış (alarm anı, kim son kaçtı, tur puanı). Tur puanları (SK-M1, SK-M4) toplanır; genel skora **+2 / +1 / 0**
sıralamayla gider.
**Neden:** Sorun 3 ve 2. Oyun anlatıma değer bir uzunluğa çıkar (ortalama ~44 sn), tek turun şansı dengelenir,
masa ilk alarmdan öğrendiğini ikincide dener. Kalabalığın beklediği "rövanş" anı oyunun içine girer.
**Ayrıntılar:**
- Toplam süre: ortalama 3 × 12 + 2 × 4 = 44 sn; en uzun 3 × 16 + 8 = 56 sn.
- Her turda herkes bir kez basar; "herkes kaçtıysa 1 sn sonra biter" kuralı her tur için geçerli. Gerilim eşikleri
  her tur yeniden çekilir.
- Üçüncü tur başında "SON ALARM" bandı; kural farkı yok.
- Sıralama: en yüksek toplam +2 (eşitse hepsi +2), sonraki farklı toplam +1; **herkesin toplamı eşit ve 0'dan
  büyükse herkes +1**; toplamı 0 olan ödül almaz.
- 2 oyuncuda da 3 tur; tur puanı yalnız son kaçana (+2).
- Kopan oyuncu turlar arasında dönerse sonraki turlara katılır.
- Oyunun kendi son açılışı (Devam et ile geçilen) üçüncü turun sonudur.

### SK-M3 · Alarm anı sonuçta açılsın — **önerim: EVET**
**Ne:** Her turun sonunda gizli alarm anı açılır: "Alarm **14,3 sn**'de çaldı". Herkes erken kaçtıysa: "Alarm
**17,4 sn**'de çalacaktı". Alarmdan **1 sn**'den az önce kaçan herkese "KIL PAYI!" etiketi (SK-M4 ile aynı
pencere; SK-M4 onaylanırsa etiket "+1" de taşır).
**Neden:** Sorun 6. Oyuncu ne kadar kala kaçtığını öğrenir; en çok konuşulan an ("yarım saniye vardı!") ekrana gelir.
Açılış sonrası bu bilgi hiçbir avantaj vermez (her tur yeni alarm çekilir).
**Ayrıntılar:**
- `docs/ERKEN-BITIS.md`'deki "sonuç ekranında bitiş yok" satırı değişir. Bilgi **yalnız tur bittikten sonra**
  sonuç görünümüne girer; bitişten önce hiçbir görünümde yoktur (gizlilik testi aynen geçerli; sızıntı denetimi
  bitmiş, sahipsiz sırrı zaten kontrol dışı sayıyor).
- Herkes erken kaçtığında da gösterilen, **özgün** alarm anıdır (erken bitiş için öne çekilen an değil); sunucu
  özgün anı ayrıca saklar.
- Yakalananlar için: "Alarm seni 14,3 sn'de yakaladı".

### SK-M4 · Kıl payı bonusu — **önerim: EVET** (SK-M2 ile)
**Ne:** Alarmdan önceki **son 1 saniye** içinde kaçan herkes o turda **+1** tur puanı daha alır (son kaçan ya da
sondan ikinci olsun olmasın).
**Neden:** Sorun 2. Diğer herkes kaçtığında bile son kalan beklemeye devam etmek için bir sebebi olur: hemen basarsa
+2, cesaret edip alarma bir saniye kalana kadar beklerse +3 — ama yakalanırsa 0. "Son Kişi" anı en kalabalık ve en
gergin an olur. Ayrıca herkesi göreli sıradan çok alarmın kendisini kollamaya iter.
**Ayrıntılar:**
- Pencere özgün alarm anına göre ölçülür (SK-M3). Herkes kaçtığı için tur erken bittiyse de geçerlidir.
- Bir turda bir oyuncu en çok 2 + 1 = 3 tur puanı alır; eksi yok.
- Sonuçta "KIL PAYI +1" etiketiyle görünür.
- SK-M2 onaylanmazsa bu madde uygulanmaz (tek turda +3 tavanı diğer oyunlarla uyumsuz olur).

### SK-M5 · Gerilim eşiklerini daha belirsiz yap — **önerim: İSTEĞE BAĞLI**
**Ne:** Eşik pencereleri genişler: düzey 1 bitişten **6–9 sn** önce (bugün 5–8), düzey 2 **3–6 sn** (2,5–4,5),
düzey 3 **0,6–3,5 sn** (0,8–2,2). Sıralama ve "başlangıçtan en az 1 sn sonra" kuralı aynen.
**Neden:** Sorun 4. Üçüncü kalp atışı "bir say, bas" formülü olmaktan çıkar; ipucu yine "yaklaşıyor" der ama
saniyesini söylemez. SK-M4 ile birlikte "kıl payı" gerçekten cesaret ister.
**Neden isteğe bağlı:** Bazı masalar ipucunun öğretici, güvenilir hâlini sever; önce SK-M2/M4 ile oynanıp
"formül" görülürse açılabilir. Kısa turlarda (8 sn) düzey 1 başlangıca çok yakın düşebilir; o zaman 1. saniyeye
yapışır (bugünkü kural).

### SK-M6 · Korkutma hakkı — **önerim: İSTEĞE BAĞLI** · 🔊 Ses
**Ne:** Kaçan her oyuncunun her turda **1 korkutma hakkı** olur: alt şeritte içerideki birinin avatarına dokunur;
o oyuncunun ekranında 0,6 sn'lik **"BÖÖ! · Mert"** damgası, kısa sert titreşim ve ses çıkar.
**Neden:** Sorun 7. Kaçan oyuncu oyundan düşmez; son ikiye psikolojik baskı yapar, masa kahkahayla dolar.
**Neden isteğe bağlı:** Aşırı Yükleme'de "yanıltıcı uyarılar"ı onaylamadın. Bu madde yanıltıcı değil (kimin
korkuttuğu adıyla yazar, gerilim nabzına benzemez) ama yine de hedefin dikkatini dağıtır; zevk meselesi.
**Ayrıntılar (onaylanırsa):** KAÇ düğmesi korkutma sırasında yerinden oynamaz ve basılabilir kalır (damga düğmeye
binmez); aynı oyuncuya aynı anda en çok bir damga (üst üste binmez, sıraya girer); hareket azaltma açıkken sarsıntı
yok, yalnız damga; titreşimi kapalı olan yalnız damgayı görür. Hakkın kullanımı hiçbir puanı değiştirmez.

### SK-M7 · Sessiz kaçış (kim kaçtı gizli) — **önerim: HAYIR**
**Ne:** Oyun sırasında kimin kaçtığı değil, yalnız "3 kişi kaçtı" sayısı görünür; isimler sonda açılır.
**Neden önermiyorum:** Sorun 2'yi çözer ama oyunun en sevilen anını da götürür: "Elif hâlâ içeride!" diye bağıran
masa. Aynı odada parmaklar zaten görülüyor; gizlilik yarım kalır. Sorun 2'yi SK-M4 (kıl payı) daha eğlenceli çözüyor.

---

## 4. Arayüz ve his önerileri

### 4a. Ana ekranlar ve akış

### SK-U1 · Koridor sahnesi — **önerim: EVET** · 🎨 Görsel
- Çerçeveli panel kalkar; koridor ekranı baştan sona kaplayan sahne olur (sorun 10).
- Ortada oyuncunun **tam boy karakteri** (podyumdaki karakter sistemiyle aynı) koşmaya hazır, çömelmiş; gölgesi
  nabızla titrer. Koridorun sonunda büyük, kırmızı ışıklı bir **kaçış kapısı** ve kolu.
- KAÇ'a basınca karakter kapıya koşar, kol iner, kapı kapanır (0,5 sn); başlık "Kaçtın!".
- Başkası kaçınca koridorun uzağında bir kapı kapanma sesi ve ışığı (SK-U14): masada "biri kaçtı!" hissi.
- 🎨 kaçış kapısı + kol (kapalı/açık), koridor arka planı tam ekran.

### SK-U2 · Doğru başlıklar — **önerim: EVET**
- Bekleyen: **"Alarmdan önce kaç!"**, altında "En son kaçan kazanır" (sorun 9).
- Kaçınca: **"Kaçtın! · 12,4 sn'de"** (yalnız kendi sürenin, yalnız sende; başkalarının süresi sonda açılır).
- İçeride iki kişi kalınca başlık altı: "Son iki kişiden birisin!" (SK-U7).
- SK-M2 ile üstte küçük "ALARM 2/3" ve tur puanın.

### SK-U3 · İçeridekiler şeridi — **önerim: EVET**
- Alt şerit iki bölümlü olur: **"İçeride (3)"** ve **"Kaçtı (2)"**. Avatarlar 52 px, altında ad (8 harf + …).
- Biri kaçınca avatarı içeriden "Kaçtı" bölümüne kayar (0,3 sn), kaçış sırası numarasıyla (1., 2., …).
- Kendi avatarın "Sen" etiketli. 8 kişide şerit iki satır olur; avatar en az 40 px.
- Kopan oyuncu ayrı işaretlidir (SK-U13).

### SK-U4 · Gerilim lambaları — **önerim: EVET**
- Koridor tavanında **3 lamba**: düzey arttıkça bir lamba daha yanar (mavi → turuncu → kırmızı); ekran kenarı aynı
  renge döner. Bugünkü nabız hızlanması sürer ama tek ipucu olmaktan çıkar (sorun 11).
- Bilgi bugünküyle aynıdır (0–3 düzeyi zaten görünümde); yalnız durağan da okunur.
- Kaçmış oyuncu ve izleyici de lambaları görür (bugün de nabzı görüyor).

### 4b. Açılış / sonuç anı ve gerilim

### SK-U5 · Alarm anı — **önerim: EVET** · 🔊 Ses
Gizli bitiş geldiği an (oyun içi sonuç ekranında, genel sonuçtan önce; sorun 8):
- Bütün telefonlarda kırmızı flaş, **siren**, ekran sarsılır, koridorun kapısına **kepenk iner**.
- İçeride yakalananların ekranında karakter kepengin arkasında kalır: **"YAKALANDIN!"**; kaçanlarda kapının dışında
  **"Kurtuldun"**; son kaçan(lar)da altın ışık ve **"SON KİŞİ!"**.
- Sonra SK-U6'daki zaman çizelgesine geçilir. Genel sonuç ekranının üstündeki küçük siren başlığı (bugünkü `Reveal`)
  kısalır: "Son kaçan: Zeynep · alarm 14,3 sn" tek satır (bilgi zaten oyun içinde görüldü).

### SK-U6 · Zaman çizelgesi açılışı — **önerim: EVET**
Oyun içi açılışta (en az 5 sn; SK-M2 ile tur arası kısa sürümü 4 sn):
- Dikey bir zaman şeridi: altta 0, üstte alarm. Kaçışlar **sırayla, zamanlarına göre** şeride yerleşir (0,4 sn
  arayla, ilk kaçandan son kaçana): avatar + "6,2 sn".
- En son **alarm çizgisi** düşer (SK-M3): "ALARM 14,3 sn"; alarma en yakın kaçan altın, arasındaki boşluk
  büyük yazıyla: **"0,3 sn kala!"** ve gerekiyorsa "KIL PAYI" (SK-M4 ile "+1").
- Yakalananlar alarm çizgisinin üstünde, kepenk arkasında soluk.
- Puan çipleri (+2 / +1 / 0) avatarların yanında.

### SK-U7 · Son iki / son kişi anı — **önerim: EVET** · 🔊 Ses
- İçeride **iki kişi** kalınca herkesin ekranında (kaçanlar ve izleyici dahil) bant: **"SON İKİ: Elif – Mert"**;
  iki karakter koridorda yan yana; kalp atışı sesi herkesin telefonunda alçak düzeyde başlar.
- **Tek kişi** kalınca: **"SON KİŞİ: Elif"**; SK-M4 ile altında "Kıl payına oynuyor mu?". İçerideki oyuncunun
  kendi ekranında: "Herkes kaçtı. Şimdi kaçarsan +2 · son 1 saniyede +3".
- Bant 1 sn; KAÇ düğmesini kapatmaz.

### SK-U8 · Tur arası (SK-M2 ile) — **önerim: EVET**
4 sn: SK-U6'nın kısa sürümü (yalnız son kaçan, alarm anı, tur puanları), üstte toplam puan şeridi
("Zeynep 5 · Elif 3 · …"), sonra "2. ALARM" bandı ve 3 · 2 · 1 yerine tek "HAZIR" (0,6 sn). Turlar arası
"Devam et" yoktur; yalnız son turda.

### SK-U9 · Kendi sonuç kartı — **önerim: EVET**
Açılışın sonunda kendi satırın büyük: "**12,4 sn'de kaçtın** · Zeynep'ten 1,9 sn önce · alarma 2,3 sn vardı · 0".
Yakalandıysan: "**Alarm seni yakaladı** · son kaçan 14,0 sn'deydi". SK-M2 ile üç turun özeti tek satır
("+2 · 0 · +3 = 5"). Öğrenmeyi sağlayan şey bu satır (sorun 6).

### SK-U10 · "Kimse kaçmadı" ve genel sonuç başlığı — **önerim: EVET**
- SK-M1 ile kimse kaçmadığında kimse puan almaz; genel sonuç ekranında bu oyun için "Kimse kurtulamadı · alarm
  11,2 sn'de" yazar, kimsenin adının yanında taç olmaz (sorun 13).
- (Ortak sonuç ekranı işi) herkesin eşit ve 0 olduğu durumda podyum bloklarında madalya gösterilmez.

### 4c. Telefon ergonomisi ve okunurluk

### SK-U11 · Dokunma alanı ve yatay düzen — **önerim: EVET**
- KAÇ yalnız alt düğme değil: ekranın **alt yarısının tamamı** dokunma alanı olur (kenarlardan 24 px pay, şerit
  hariç). Oyuncu gözünü masadaki arkadaşlarından ayırmadan basabilir.
- Düğme metni basılınca "KAÇTIN" olur, alan kilitlenir (bugün de tek basış).
- Yatay ekranda koridor ortada, içeridekiler şeridi sağda dikey, alt başlık başlığın yanında; bugün yatayda
  kaybolan şerit ve alt başlık geri gelir (sorun 12).
- 360x640'ta karakter ve kapı küçülür ama başlık + lambalar + şerit + düğme kaydırmasız sığar.

### 4d. İzleyici, kopan oyuncu ve TV

### SK-U12 · Kaçanların ekranı ve tepkileri — **önerim: EVET**
- Kaçınca ekran "dışarıdan izliyorsun" kipine geçer: koridorda **içeride kalanların** karakterleri, lambalar,
  "İçeride: Elif, Mert" (sorun 7).
- Altta üç tepki düğmesi **😱 👀 🔥**: basınca senin avatarının üstünde 1 sn emoji belirir (herkesin şeridinde).
  Kimsenin ekranını sarsmaz, puana etkisi yok; 2 sn'de bir basılabilir.
- SK-M6 onaylanırsa korkutma hakkı da buradan kullanılır.

### SK-U13 · Kopan oyuncu — **önerim: EVET**
- Kopan oyuncunun avatarı şeritte **🔌 "bağlantı yok"** etiketiyle ayrı durur; "İçeride" sayısına "(1 bağlantısız)"
  notu eklenir (sorun 5).
- Geri dönerse güçlü titreşim ve "Döndün! Hâlâ içeridesin" bandı; turu sürüyorsa basabilir.
- Puan: SK-M1 ile yakalanan gibi 0 (bugünkü −1 kalkar).

### SK-U14 · İzleyici ve TV — **önerim: EVET** · 🎨 Görsel
- İzleyici: SK-U12'deki dışarıdan görünüm ve lambalar; "Koridoru izliyorsun · son kaçan kazanır".
- TV'ye özel yatay görünüm (`StageView`): geniş koridor, içeridekiler tam boy ve adlı, kaçanlar kapının dışında
  sırayla; tavanda üç büyük lamba; "SON İKİ" bandı, alarm flaşı ve zaman çizelgesi tam ekran. Alarm anı **hiçbir
  zaman** önceden gösterilmez. Solda oyuncu sütunu (genel skor, SK-M2 ile tur puanları).
- 🎨 koridorun 16:9 geniş hâli.

### 4e. Ses, titreşim ve hareket

### SK-U15 · Koridor ses ve titreşim seti — **önerim: EVET** · 🔊 Ses
- Sürekli alçak koridor uğultusu (müzik alanı: sözsüz drone; gerilim düzeyiyle bir katman eklenir).
- Kalp atışı bugün yalnız düzey değişince **tek** atış; öneri: içeridekilerde düzeye göre **sürekli** atış
  (düzey 1: 70/dk, 2: 100/dk, 3: 140/dk) ve aynı ritimde hafif titreşim. Kaçanda kesilir.
- Kendi kaçışın "vuş" + kapı çarpması; başkasının kaçışı uzaktan kapı sesi; "SON İKİ" gong; alarm sireni (anında,
  SK-U5); kepenk çarpması; kıl payı "çın"; son kişi altın fanfar.
- Hareket azaltma açıkken sarsıntı ve koşu animasyonu yok; lambalar ve sesler sürer.

### 4f. İlk kez oynayan için öğretme

### SK-U16 · Anlatım metni ve canlı örnek — **önerim: EVET** · 🎨 Görsel
- Adımlar (tek satırlık): 1 "Alarm gizli bir anda çalar" · 2 "KAÇ'a bir kez bas, alarmdan önce kurtul" ·
  3 "En son kaçan kazanır, yakalanan alamaz". SK-M2 ile amaç satırı: "Üç alarm: her birinde en son sen kaç!".
- Gerilim ipucu anlatılır: anlatım görselinde lambalar sırayla yanar, altında "Lambalar yanınca alarm yaklaşıyor".
- Anlatım görseli 4 sn döngü: üç figür; biri erken kaçar, biri son anda kaçar (altın), biri kepenk arkasında kalır.

### 4g. Erişilebilirlik

### SK-U17 · Hareket azaltma, renk körü, ekran okuyucu — **önerim: EVET**
- **Hareket azaltma adaleti:** gerilim bilgisi animasyona bağlı kalmaz: lambalar (SK-U4) ve kenar rengi durağan
  olarak değişir, böylece "Hareketi azalt" açık oyuncu aynı bilgiyi alır (sorun 11).
- Renk körü kipinde lambalar renk yerine **yanan lamba sayısıyla** okunur (1/2/3 dolu daire); "SON KİŞİ" altın
  vurgusuna ★ eklenir.
- Ses ve titreşim kapalı oyuncu için kalp atışının görsel eşdeğeri: kenar çizgisi aynı ritimde kalınlaşır
  (hareket azaltmada ritimsiz, yalnız renk).
- Ekran okuyucu: "Gerilim arttı (2/3)", "Elif kaçtı · içeride 2 kişi", "Alarm! Kurtuldun" `aria-live` ile.
- Büyük yazı: başlık iki satıra izinli; şerit adları kısaltılır.

---

## 5. Yapay zekâ (AI) ile yapılabilecekler

### SK-AI1 · Koridor spikeri — **önerim: HAYIR**
Tur sonunda tek cümlelik yorum ("Oyuncu3 alarma 0,2 sn kala çıktı, kapı arkasından çarptı"). Ortak yorum altyapısıyla
yapılabilir (Oyuncu1…N, kaçış süreleri, alarm anı; puana karışmaz). **Önermiyorum:** oyun birkaç saniyelik bir refleks
ve cesaret anı; SK-U6'daki zaman çizelgesi ve "0,3 sn kala!" yazısı aynı şeyi daha hızlı söylüyor (Kule Ustası'nda
KU-AI1 için verdiğin kararla aynı gerekçe).

---

## 6. İçerik ve üretim ekibine düşen işler

- **Görsel (🎨):** tam ekran koridor arka planı (telefon + 16:9 TV), kaçış kapısı ve kolu (kapalı/açık), kepenk,
  tavan lambaları (3 durum; CSS ile de olur), anlatım 4 karesi. Tam boy karakter mevcut karakter sisteminden gelir
  (yeni çizim gerekmez; "koşu" ve "çömelme" pozu yoksa karakter alanına iş açılır). Görev dosyası CLAUDE.md'deki
  akışla.
- **Ses efektleri (🔊):** kendi kaçış "vuş" + kapı çarpması, uzak kapı sesi, kalp atışı (3 tempo, döngülü), siren,
  kepenk çarpması, "SON İKİ" gong, kıl payı çınlaması, son kişi fanfarı, "BÖÖ!" (SK-M6 onaylanırsa). Ses olay
  haritasında `son-kisi.*` anları.
- **Müzik:** sözsüz koridor drone'u + 3 gerilim katmanı (düzeye bağlı tetik; müzik alanı için "kod isteği": müziğin
  oyun anına bağlı değişmesi).
- **Efekt dokuları:** alarm flaşı, kırmızı kenar ışığı, altın "son kişi" parıltısı.
- **İçerik havuzu:** yok.
- **Wiki/kurallar:** `docs/KURALLAR.md` §17, `docs/ERKEN-BITIS.md` (alarm anının sonuçta açılması),
  `docs/wiki/oyunlar/son-kisi.json` (süre, puan, tur).

---

## 7. Önerilen paket

**EVET:** SK-M1, SK-M2, SK-M3, SK-M4 · SK-U1 … SK-U17.
**İSTEĞE BAĞLI:** SK-M5 (daha belirsiz eşikler), SK-M6 (korkutma hakkı).
**HAYIR:** SK-M7 (sessiz kaçış), SK-AI1 (koridor spikeri).

Bu paketle oyun şöyle akar: anlatım lambaları ve "en son kaçan kazanır"ı öğretir → tam ekran koridorda karakterin
kapıya hazır, tavanda lambalar yanmaya başlar, kalp atışı hızlanır → biri kaçınca uzakta kapı çarpar, şeritte
"Kaçtı" bölümüne kayar → "SON İKİ: Elif – Mert" bandı, kaçanlar dışarıdan 😱 atar → son kalan kıl payına oynar →
siren, kepenk, "YAKALANDIN!" / "SON KİŞİ!" → zaman çizelgesinde kaçışlar ve alarm çizgisi: "0,3 sn kala!" → üç alarm
sonunda toplam puana göre +2 / +1 / 0.

**Değişen kurallar (paket onaylanırsa):**
- 3 tur; her turun gizli alarmı 8–16 sn; turlar arası 4 sn.
- Tur puanı: son kaçan +2, sondan ikinci +1 (yalnız 3+ oyuncuda), alarmdan önceki son 1 sn'de kaçan +1 ek;
  yakalanan ve diğer kaçanlar 0. **Eksi puan kalkar** (kaçmayan ve "kimse kaçmadı" artık 0).
- Genel skor: üç turun toplamına göre +2 / +1 / 0 (birincide eşitlik hepsi +2; herkes eşit ve >0 ise herkes +1;
  toplamı 0 olan ödülsüz).
- Her turun alarm anı tur bittikten sonra açılır ("çaldı" / "çalacaktı").
`docs/KURALLAR.md`, `docs/ERKEN-BITIS.md`, wiki ve testler buna göre güncellenir.

**Değişmeyenler:** 2–8 oyuncu; alarmın gizli olması ve hiçbir görünümde önceden bulunmaması; sayaç olmaması; tur
başına tek basış; bitişten sonraki basışın reddi; kaçanların herkese anında görünmesi; üç gizli gerilim düzeyi (0–3)
ve yalnız düzeyin görünmesi; herkes kaçınca 1 sn sonra bitiş (kopan oyuncunun beklenmesi dahil); ms çözünürlüklü
eşitlikte aynı puan.

**🎨 Yeni görsel gerekenler (paket):** koridor (telefon + 16:9), kaçış kapısı ve kolu, kepenk, tavan lambaları,
anlatım kareleri. Dosyalar gelene kadar CSS/SVG karşılıkları çizilir.
