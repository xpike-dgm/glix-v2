# Rüşvet ve Darbe — geliştirme önerileri

Bu dosya onay içindir. Madde kodlarının öneki **RD** (Rüşvet–Darbe). Her maddenin bir kodu var (ör. **RD-M2**).
Cevabını tek satırda verebilirsin:

> RD-M1 evet, RD-M2 hayır, RD-U3 evet …

ya da yalnız **"önerilen paket evet"** dersen sondaki paket uygulanır. Her maddenin "ayrıntılar" bölümü onaylarsan
nasıl yapılacağını kesinleştirir; ek soru sormam gerekmez. Beğenmediğin ayrıntı varsa yalnız onu yaz.

Not: Sonuç ekranı herkes **"Devam et"** deyince geçer (en çok 60 sn; zaten var). Yeni görsel gerektiren maddeler
**🎨 Görsel**, yeni ses gerektirenler **🔊 Ses** diye işaretli (ses ve görsel, ilgili yapay zekâ alanlarınca üretilir;
dosya gelene kadar bugünkü sentez ses / CSS çizimi kullanılır).

---

## 1. Bugünkü oyun (özet)

Koddan doğrulandı (`packages/engine/src/games/rusvet-darbe/`).

- 3–8 oyuncu. **Başkanlık seçimi (20 sn):** herkes kendisi dışında, bağlı bir oyuncuya gizli oy verir; "Tamam"a
  basana kadar değiştirebilir. Oy vermeyenin oyu kendisi dışındaki rastgele birine gider. Bağlı herkes Tamam derse
  1 sn sonra biter.
- En çok oyu alan başkan olur; **dağıtacağı jeton = aldığı oy sayısı** (bütçe).
- **Eşitlik → darbe düellosu:** eşit adaylar gizli taş-kâğıt-makas yapar (işaret 8 sn, tek seferlik; açılış 2,5 sn).
  Elde tam iki farklı işaret varsa kazanan işareti verenler devam eder; tek ya da üç farklı işaret çıkarsa el
  tekrarlanır. En çok 6 el; sonra kalanlar arasından rastgele başkan.
- **Dağıtım (25 sn):** başkan jetonları kendisi dışındakilere verir, kişi başı en çok 2; "Bitti" ile kesinleşir.
  Süre dolunca dağıtılmayan jetonlar sınıra uyularak rastgele gider.
- **Darbe oylaması (10 sn):** başkan dışında **hiç jeton almamış** herkes gizlice "Darbe" / "Darbe yok" der (tek
  seferlik, vermeyen "Darbe yok"). Kesin çoğunluk Darbe derse başkanın +1'i iptal olur. Hak sahibi yoksa aşama atlanır.
  Oylar hiç açılmaz, yalnız sayı ("Darbe: 3/4").
- **Açılış (8 sn):** halkada oy ipleri → oy sayıları → jetonlar başkandan uçar → puan çipleri; sonra "Devam et".
- **Puan:** başkan +1 (darbe tutmazsa), aldığın her jeton +1. Puanlar **doğrudan** genel skora gider (+2/+1/0'a
  çevrilmez); her oyuncu 0…2 arası alır. Eksi yok. Dağılan toplam puan = bütçe + 1.

## 2. Gördüğüm sorunlar

**Oyun tasarımı**

1. **Başkanlık en kârlı rol değil.** Başkan en çok **+1** alır (kendine jeton veremez), başkanın gözdesi 2 jetonla
   **+2** alır; darbe olursa başkan **0**'a iner. Anlatım "Başkan ol!" diyor ama akıllı oyuncu başkan değil,
   "başkanın iki jetonluk dostu" olmaya çalışır. Oyunun merkezindeki koltuk ödülsüz.
2. **Rüşvet doğrulanamıyor.** Dağıtım sırasında başkan kendisine kimin oy verdiğini bilmiyor (oylar ancak sonda
   açılıyor). "Bana oy ver, sana 2 jeton" pazarlığı kör: başkan sadık seçmeni ödüllendiremiyor, "ben sana verdim"
   diye yalan söyleyeni ayıramıyor. Oyunun adındaki "rüşvet" mekaniğe bağlı değil, yalnız şansa.
3. **Pazarlığın yeri ve zamanı yok.** Tek pazarlık penceresi 20 sn'lik gizli oylama. Kimin aday olduğu, kimin ne
   vaat ettiği ekranda hiçbir yerde yok; 6–8 kişide 20 sn "kime oy vereyim" konuşmasına bile yetmiyor.
4. **Kalabalık eşitlik piyangoya dönüyor.** Bir elin sonuç verme olasılığı aday sayısıyla düşüyor: 2–3 aday %67,
   4 aday %52, 5 aday %37, 6 aday %26, 8 aday %12. 6–8 kişide oylar dağılınca (ör. 2-2-2-1-1 ya da herkes 1)
   düello 6 ele kadar sürüyor (6 × 10,5 sn = 63 sn) ve çoğu zaman **rastgele başkanla** bitiyor.
5. **Darbe oyu bedava.** Hak sahibinin "Darbe yok" demesi için oyunda hiçbir sebep yok (kendi puanı değişmez);
   çoğu masada darbe otomatik. 3 kişide hak sahibi tek kişi olabiliyor ve tek başına karar veriyor (1/1).
6. **Rastgele tamamlamalar görünmüyor.** Oy vermeyenin oyu ve dağıtılmayan jetonlar rastgele gidiyor ama açılışta
   hiçbir işaret yok. "Mert bana oy verdi" sanılan oy zar; başkan da hiç vermediği jeton için suçlanıyor.
7. **3 kişide oyun ikiye iniyor:** başkan 2 jetonu 1-1 verirse herkes +1 alır (oyun etkisiz), 2-0 verirse tek hak
   sahibi başkanı sıfırlar. 3 kişide oylar %25 olasılıkla 1-1-1 kalır ve üç adaylı düelloya gider.
8. **Kopan başkan:** başkanın bağlantısı dağıtımda koparsa bütün jetonlar rastgele gider; seçmenlerin pazarlığı
   tamamen boşa çıkar.

**Arayüz (ekran görüntülerine bakarak: 390x844, 360x640, 844x390)**

9. **Seçim ekranı İttifak'ın oylama ekranıyla birebir aynı.** Sandık, mühür, saray hissi yok. Son satır sola yaslı
   (5 kişide Zeynep–Kaan, 8 kişide Burak–Ayşe). Seçtiğin kişinin ✓'i ile "Tamam" diyenlerin ✓'i aynı yeşil
   (kilitli ekranda Cihad ve Elif'te aynı işaret). Seçimin sonucu ("aldığı oy kadar jeton dağıtacak") yazmıyor.
   Seçtiğin kişinin adı başlıkta dev pembe harflerle yazıyor: yandaki oyuncu bir bakışta gizli oyunu görüyor.
10. **Düello ekranı boş ve okunmuyor.** Adaylar ~70 px, altlarında 40 px'lik "?" kartları; ekranın ortasında
    ~350 px boşluk. Açılınca işaretler kartın içinde ~25 px'lik koyu mor simgeler: taş, kâğıt ve makas birbirinden
    ayırt edilmiyor (üçü de mor bir yumruk gibi). "Sonuç yok, yeniden" nedenini söylemiyor (üç işaret de mi çıktı,
    herkes aynısını mı yaptı?). 8 aday 4+4 dizildiğinde kartlar 30 px.
11. **Başkanın dağıtım ekranı jetonu göstermiyor.** Verilen jeton portrenin köşesinde küçük bir sayı rozeti;
    jeton kesesi, yığın yok. Bir kişiye 2'den sonra dokununca 0'a dönüyor (geri alma döngüsü, yazmıyor). "Bitti"nin
    altında anlamsız "0/1 hazır" sayacı. Ekranın alt yarısı boş.
12. **Bekleyenler 25 sn pasif.** Başkan olmayanlar taht, "3 jeton" ve üç küçük jeton görüyor; masanın en gürültülü
    anı ("bana ver!") ekranda karşılıksız. Kime oy verdiğin bu ekranda hatırlatılmıyor ("sana oy verdim" derken).
13. **Darbe ekranında başkan işaretsiz.** Ekranda başkanın tahtı/tacı yok (Elif sıradan bir portre); hak sahipleri
    öne çıkmıyor; "Darbe" ve "Darbe yok" aynı görünümde iki koyu düğme; darbenin neyi iptal ettiği ekranda yazmıyor.
14. **Açılış küçük ve dağınık.** Taht simgesi ~16 px; uçan jetonlar sonunda alıcıların **yüzünün üstünde** kalıyor
    (Cihad, Zeynep, Mert); oy sayısı rozetleri 4,5. sn'de kayboluyor; darbe sonucu en altta tek küçük kırmızı satır;
    oy ipleri yönsüz (kim kime?); düello geçmişi açılışta hiç yok. Yatay ekranda halka sıkışıyor: Ayşe–Burak
    çipleri adlara biniyor, Kaan'ın adı alttan kesiliyor.
15. **İzleyici ve TV için özel görünüm yok.** İzleyici oyuncu ekranının soluk hâlini görüyor; TV'de telefon sütunu
    büyütülüyor, kenarlar boş.
16. **Anlatım eksik:** "aldığın oy = dağıtacağın jeton", "kişi başı en çok 2" ve "darbe başkanın puanını siler"
    bilgisi yok; ilk kez oynayan dağıtım ekranına gelince ne olduğunu anlıyor.

---

## 3. Oyunu değiştiren öneriler (mekanik)

### RD-M1 · Başkanın defteri: sana kim oy verdi? — **önerim: EVET**
**Ne:** Dağıtım başlarken **yalnız başkan** kendi ekranında "Sana oy verenler" listesini görür; portrelerinde
küçük bir mühür işareti olur. Rastgele düşen oylar ayrı yazılır: "Zeynep oy vermedi, oyu sana düştü 🎲".
**Neden:** Sorun 2. Rüşvet gerçek olur: başkan sözünü tutup seçmenini ödüllendirebilir ya da tutmayabilir;
"ben sana verdim!" yalanı başkana karşı işlemez, ama masaya karşı işler (başkan defteri yüksek sesle okuyabilir
ya da yalan söyleyebilir).
**Ayrıntılar:**
- Gizli bilgi yalnız `view(state, başkan)` ile gider; diğer oyuncular ve izleyici görmez. Sonuç açılışında oylar
  bugünkü gibi herkese açılır.
- Düelloyla seçilen başkan da ilk tur oylarını görür (bütçe ilk tur oy sayısıdır). RD-M4 ikinci oylaması yapıldıysa
  defter yine **ilk tur** oylarını gösterir (bütçe oradan gelir); ikinci oylamadaki oylar sonda açılır.
- Başkan ekranında satır: "3 oy · Elif, Mert · 🎲 Zeynep". Başkan dışındaki ekranlarda değişiklik yok.
- Kural metni ve anlatım: "Başkan, kendisine kimin oy verdiğini görür."

### RD-M2 · Koltuk değerli olsun: başkan +2 — **önerim: EVET**
**Ne:** Başkan, darbe tutmazsa **+2** alır (bugün +1). Darbe tutarsa başkanın ödülünün **tamamı** silinir (0).
**Neden:** Sorun 1. "Başkan ol" hedefi gerçek olur: koltuk en az gözde kadar kazandırır ama darbe riskiyle.
Darbe de bu sayede önem kazanır (sorun 5): başkan 2 puanı korumak için jetonu yaymak zorunda kalır.
**Ayrıntılar:**
- Kimse +2'den fazla almaz (başkan 2, jeton alan en çok 2): eksisiz ve diğer oyunlarla aynı tavan.
- Puanlar bugünkü gibi doğrudan genel skora gider (sıralamaya çevrilmez; zaten 0…2 aralığında).
- 3 kişide: başkan 2 jetonu 1-1 verirse sonuç 2/1/1 olur (bugün 1/1/1, oyun etkisiz kalıyordu — sorun 7).
- Dağılan toplam puan = bütçe + 2. Maç kartlarında "birinci" = en yüksek puanlılar, "sonuncu" = en düşükler
  (bugünkü genel hesap).
- Anlatım 3. adımı: "Başkan +2 alır; jeton alamayanlar darbe yaparsa bu puan gider".

### RD-M3 · Seçim vaadi — **önerim: EVET** (RD-M1 ile; M1 yoksa yalnız "Herkese jeton" kalır)
**Ne:** Seçim sırasında her oyuncu kendi portresine isterse **tek bir hazır vaat** asabilir; herkes görür:
- **"Oy verene jeton"** (bana gerçekten oy veren herkese en az 1 jeton),
- **"Herkese jeton"** (jetonu olabildiğince çok kişiye yayarım),
- vaat yok (varsayılan).
Sonuç açılışında yalnız **seçilen başkanın** vaadi gerçek dağılımla karşılaştırılır: **TUTTU ✓** ya da
**BOZDU ✗** damgası. Puanı ya da cezası yoktur.
**Neden:** Sorun 3 ve 5. Pazarlığa bir konu ve "aday" görünürlüğü gelir; ihanet anı (BOZDU damgası) açılışın en
çok gülünen sahnesi olur. Serbest metin yok: moderasyon ve yazma zahmeti gerekmez.
**Ayrıntılar:**
- Vaat yalnız seçim süresince asılır/değiştirilir; seçim bitince kilitlenir. Bir dokunuşla seçilir (portrenin
  altındaki küçük "Vaadim" düğmesi, iki seçenekli alt sayfa).
- "Oy verene jeton" denetimi: başkana **kendi eliyle** oy veren (rastgele düşmeyen) herkes ≥1 jeton aldıysa ✓.
  Bütçe = aldığı oy sayısı olduğundan bu vaat her zaman tutulabilir (her seçmene 1 jeton tam bütçeye eşit).
- "Herkese jeton" denetimi: jeton alan farklı kişi sayısı = en küçük(bütçe, oyuncu − 1) ise ✓.
- Denetim **son dağılıma** bakar (süre dolup rastgele tamamlanan jetonlar dahil); bu durumda damganın yanında
  "süre doldu" notu çıkar (başkan Bitti demediyse).
- Vaat diğer kurallara dokunmaz; başkan seçilmeyenlerin vaadi açılışta görünmez.

### RD-M4 · Kalabalık eşitlikte ikinci oylama — **önerim: EVET**
**Ne:** **4 ya da daha çok aday** eşit kalırsa önce **12 sn'lik ikinci oylama** yapılır: herkes yalnız eşit
adaylar arasından birine oy verir (aday kendine veremez). En çok oy alan başkan olur. Yine eşitlik varsa kalan
adaylar arasında bugünkü taş-kâğıt-makas düellosu yapılır. 2–3 aday eşitse doğrudan düello (bugünkü gibi).
**Neden:** Sorun 4. 4+ adaylı taş-kâğıt-makas çoğunlukla sonuçsuz kalıp kurayla bitiyor; ikinci oylama ise masaya
yeni bir pazarlık turu açar ("Elif mi Mert mi?").
**Ayrıntılar:**
- Bütçe değişmez: eşit adayların ilk tur oy sayısı zaten aynıdır.
- İkinci oylamada oy vermeyenin oyu **sayılmaz** (rastgele atanmaz; kurayı artırmasın). Bağlı herkes Tamam derse
  1 sn sonra biter. Kimse oy vermezse tüm adaylarla düelloya geçilir.
- Ekranda "EŞİTLİK! 4 aday" ve yalnız adayların büyük portreleri; ilk tur oy sayıları gösterilmez.
- En uzun süre: 20 + 13 + düello (6 × 10,5) + 25 + 10 + açılış; wiki ve sınır sabiti buna göre güncellenir.

### RD-M5 · Zar işaretleri: rastgele olan her şey görünsün — **önerim: EVET**
**Ne:** Açılışta oy vermediği için rastgele atanan oyların ipi **kesikli** çizilir ve ucunda 🎲 olur; süre dolduğu
için rastgele dağılan jetonlar **gümüş** (başkanın verdikleri altın) uçar ve "rastgele" etiketi taşır.
**Neden:** Sorun 6. Kimse zarın attığı oy ya da jeton için suçlanmaz; "neden bana 1 verdin?" kavgası doğru kişiye
yönelir. Kural değişmez, yalnız bilgi açılır.
**Ayrıntılar:** sonuç görünümüne iki liste eklenir: rastgele oy verenler ve rastgele giden jetonlar (kime, kaç).
Bilgi yalnız açılışta herkese açıktır (bugün de oylar ve jetonlar açılışta açık).

### RD-M6 · Kopan başkanın jetonları seçmenlerine gider — **önerim: EVET**
**Ne:** Başkan dağıtım sırasında kopuksa ve Bitti dememişse, süre dolunca kalan jetonlar önce **ona gerçekten oy
verenlere** birer birer, sonra (artarsa) diğerlerine rastgele gider.
**Neden:** Sorun 8. Seçmen pazarlığı boşa çıkmaz; bağlantısı kopan başkan "kimseyi kayırmadı" sayılır.
**Ayrıntılar:** başkan bağlıysa ve süre dolduysa bugünkü kural (tamamen rastgele) aynen kalır — başkan kasten
beklediyse avantaj yok. Kişi başı 2 sınırı korunur. Gidenler RD-M5 ile gümüş ve "rastgele" etiketli.

### RD-M7 · Seçim süresi oyuncu sayısına göre — **önerim: EVET**
**Ne:** Seçim süresi **3–5 oyuncuda 20 sn, 6–8 oyuncuda 30 sn**.
**Neden:** Sorun 3. Kalabalık masada vaat ve pazarlık için 20 sn yetmiyor; az kişide uzatmaya gerek yok.
**Ayrıntılar:** herkes Tamam derse yine 1 sn sonra biter (erken bitiş kuralı aynen). Dağıtım (25 sn), darbe (10 sn)
değişmez.

### RD-M8 · Darbe ganimeti — **önerim: HAYIR**
**Ne:** Darbe tutarsa başkanın kaybettiği puan, "Darbe" diyen hak sahiplerine dağıtılır.
**Neden önermiyorum:** Sorun 5'i çözmez, büyütür: hak sahipleri için Darbe zaten bedava; ganimet onu her zaman
"evet"e çevirir ve toplam puanı şişirir. RD-M2 (koltuk +2) ve RD-M3 (vaat) darbeye anlam vermek için yeterli:
başkan jetonu yaymak zorunda kalır, hak sahipleri de "vaadi tuttu mu?" diye karar verir.

---

## 4. Arayüz ve his önerileri

### 4a. Ana ekranlar ve akış

### RD-U1 · Seçim ekranı: sandık ve mühür — **önerim: EVET** · 🎨 Görsel · 🔊 Ses
- Üstte küçük oy sandığı; bir portreye dokununca o portreye altın **mühür** basılır ("tok" sesi, kısa titreşim).
  Seçim değiştirilince eski mühür silinir. Seçim işareti ✓ değil mühürdür; "Tamam" diyenler portre dışındaki alt
  şeritte (avatar + ✓) görünür — iki bilgi karışmaz (sorun 9).
- Izgaranın son satırı **ortalanır** (5 kişide 3+2, 8 kişide 3+3+2). Seçili portre %8 büyür, diğerleri hafif söner.
- Başlıkta seçtiğin kişinin adı dev harflerle yazmaz: "Oyun mühürlendi" + küçük ad (göz atma koruması, sorun 9).
- Başlık altında tek satır: "En çok oy alan başkan olur ve **aldığı oy kadar** jeton dağıtır".
- (RD-M3 ile) her portrenin altında asılı vaat bandı ("Oy verene jeton" / "Herkese jeton"); kendi portrende
  "Vaadim" düğmesi.
- 🎨 sandık ve mühür (balmumu, altın amblem).

### RD-U2 · Düello sahnesi — **önerim: EVET** · 🎨 Görsel
- Adaylar karşılıklı ve büyük: 2 aday 120 px, 3–4 aday 96 px, 5–8 aday iki satırda 72 px. Her adayın kartı
  portresiyle aynı genişlikte ve 1,4 kat yükseklikte (bugün 40 px), portrenin hemen altında.
- İşaret düğmeleri büyük ve **ayırt edilebilir**: taş (gri yuvarlak, kalın), kâğıt (beyaz, düz yaprak), makas
  (kırmızı, V); her birinin altında adı. Seçilen düğme kilit simgesiyle kalır, diğer ikisi söner.
- Kartların üstünde el şeridi: "1. el · sonuç yok (üç işaret) · 2. el · Elif ve Mert devam".
- "Sonuç yok" nedeni yazılır: **"Üç işaret de çıktı"** ya da **"Herkes TAŞ dedi"**.
- Aday olmayanlar adayların altında "Kim kazanır?" yazısını ve hazır sayısını görür.
- 🎨 üç el işaretinin okunur, büyük, renkli seti (bugünkü `el-tas/kagit/makas` görselleri küçükte okunmuyor).

### RD-U3 · Başkanın dağıtım ekranı: jeton kesesi — **önerim: EVET** · 🎨 Görsel · 🔊 Ses
- Üstte keseden dökülmüş jeton dizisi (bütçe kadar, kalanlar parlak, verilenler sönük); "4 jeton kaldı".
- Portreye dokununca bir jeton keseden portreye uçar ve portrenin **altında** altın yığın olarak durur (1 ya da 2
  jeton görseli, yüzü kapatmaz). Her yığının yanında küçük **"−"** düğmesi: geri alma döngüsü (2 → 0) kalkar.
- (RD-M1 ile) sana oy verenlerin portresinde mühür; 🎲 ile düşenlerde zar.
- "Bitti" altındaki "0/1 hazır" kaldırılır; Bitti pasifken altında "En az 1 jeton ver".
- Son 5 sn: kalan jeton varsa kırmızı uyarı "Dağıtmadığın 2 jeton rastgele gidecek!".
- 🎨 jeton kesesi ve 1/2 jetonluk yığın.

### RD-U4 · Bekleyenlerin ekranı: tahtın önü — **önerim: EVET**
- Taht büyük, başkan tahtta; bütçe kadar jeton tahtın önünde dizili. Kime gittiği gizli kalır (bugünkü kural).
- Altta **"Senin oyun: Elif"** satırı (yalnız sana; pazarlıkta "sana oy verdim!" derken bakarsın) ve (RD-M3 ile)
  başkanın vaadi: "Elif'in vaadi: Oy verene jeton".
- Başkan Bitti deyince tahtın önündeki jetonlar keseye girer: "Dağıtım bitti · sonuç darbeden sonra".

### RD-U5 · "Bana!" tepkisi — **önerim: İSTEĞE BAĞLI** · 🔊 Ses
- Dağıtım sırasında başkan olmayanların ekranında küçük **"🙏 Bana!"** düğmesi (en çok 3 kez). Basınca başkanın
  ekranında o kişinin portresinde 1 sn'lik balon "Bana!" çıkar; başkan dışındakiler bir şey görmez.
- Kurala etkisi yok; yalvarma masada sesli zaten yapılıyor, bu yalnız başkanın ekranına da düşmesini sağlar.
- İsteğe bağlı: bazı masalarda başkanı rahatsız edebilir; RD-U4 tek başına da yeterli.

### RD-U6 · Darbe ekranı — **önerim: EVET** · 🎨 Görsel
- Üstte **başkan tahtta, tacıyla** (bugün işaretsiz, sorun 13); jeton alanlar portrelerinin altında altın yığınla.
- Hak sahipleri ayrı bir sırada, kırmızı çerçevede: "Karar onlarda". Hak sahibi sen isen başlık **"Karar senin"**.
- Düğmeler ayrışır: **DARBE** kırmızı, yumruk simgeli; **DARBE YOK** gri, sakin. Basınca seçilen kalır, diğeri
  kaybolur; "Oyun gizli · 2/3 karar verdi".
- Kural satırı: "Çoğunluk Darbe derse Elif'in +2'si (RD-M2 yoksa +1'i) gider".
- Tek hak sahibi varsa: "Tek karar veren sensin" (3 kişide sık).
- 🎨 kırmızı yumruk simgesi (CSS/SVG ile de çizilebilir).

### 4b. Açılış / sonuç anı ve gerilim

### RD-U7 · "Başkan seçildi" anı — **önerim: EVET** · 🔊 Ses
- Seçim (ya da düello) biter bitmez 1,5 sn: seçilenin ekranına yukarıdan taç iner, uzun çift titreşim, fanfar;
  herkeste bant **"BAŞKAN: ELİF · 3 JETON"**. Dağıtım süresi bu bandın arkasında işlemeye başlar (bant süreden yemez:
  25 sn bandın bitiminden sayılır).

### RD-U8 · Düello açılışı — **önerim: EVET** · 🔊 Ses
- İşaret süresinin son 3 sn'sinde ekranda "TAŞ · KÂĞIT · MAKAS!" ritmi (üç vuruş).
- Kartlar aynı anda döner; kazanan işaret kaybedeni ezer (taş makası kırar, kâğıt taşı sarar, makas kâğıdı keser:
  0,6 sn'lik küçük animasyon); kaybeden aday söner ve "ELENDİ" damgası alır. Sonuçsuz elde kartlar sallanır,
  "Yeniden!".
- 6. elden sonra kura: "Kura ile: Mert" ve dönen zar (bugün sessizce seçiliyor).

### RD-U9 · Sahne sahne açılış — **önerim: EVET** · 🎨 Görsel · 🔊 Ses
Süre 8 sn'den **11 sn**'ye çıkar (en az gösterim; "Devam et" kuralı aynen):
1. (0–2,5 sn) Oylar sandıktan tek tek çıkar; **oklu** ip seçmenden adaya akar (yön görünür); 🎲 oylar kesikli
   (RD-M5). Oy sayısı rozetleri açılış sonuna kadar kalır.
2. (2,5–3,5 sn) Başkan tahta yükselir; taht büyük (bugün 16 px).
3. (3,5–6 sn) Jetonlar tahttan alıcılara uçar ve **portrenin altına** yığılır (yüze binmez); rastgele olanlar gümüş.
4. (6–8,5 sn) Darbe (varsa): hak sahibi sayısı kadar boş kutu, "DARBE" kutuları tek tek dolar. Tutarsa taht
   sallanır, taç düşüp yuvarlanır, **"DARBE!"** damgası; tutmazsa kalkan parlar, **"Darbe bastırıldı"**.
5. (8,5–9,5 sn) (RD-M3 ile) vaat damgası: **TUTTU ✓** / **BOZDU ✗**.
6. (9,5–11 sn) Puan çipleri.
- 🎨 devrilen taht / düşen taç, damgalar (CSS ile de yapılabilir).

### RD-U10 · Kendi hikâyen satırı — **önerim: EVET**
Başlıktaki "+1 · 1 jeton aldın" yerine durumuna göre tek cümle:
- Seçmen: "**+2** · Elif'e oy verdin, sana 2 jeton verdi" / "Elif'e oy verdin, **eli boş** döndün".
- Başkana oy vermeyen: "Mert'e oy verdin · Elif yine de 1 jeton verdi".
- Başkan: "**3 oyla başkan** · 4 kişiden 1'i darbe dedi · +2".
- Darbe yapılan başkan: "Tahtın devrildi · +0".
Portrelerin altında açılışın sonunda iki etiket: **"Karşılığını aldı"** (başkana oy verip jeton alan) ve
**"Nankörlük!"** (başkana oy verip hiç jeton alamayan). Puan değişmez; ihanet görünür olur.

### 4c. Telefon ergonomisi ve okunurluk

### RD-U11 · Küçük ekran ve yatay düzen — **önerim: EVET**
- 360x640'ta 8 kişilik ızgara 3 sütun, portre en az 72 px; alt ipuçları tek satıra kısaltılır
  ("Dokun: +1 jeton · kişi başı en çok 2"; bugün iki satıra taşıyor).
- 8 adaylı düelloda iki satır (4+4) ve kartlar en az 48 px; işaret düğmeleri en az 72 px yükseklik.
- Yatay ekranda açılış halkası solda, başlık + kendi hikâyen sağda; çipler ada binmez, alttaki ad kesilmez
  (bugün Kaan kesiliyor, Ayşe–Burak çakışıyor).
- Bütün dokunma hedefleri ≥ 48 px; "−" düğmesi 44 px görünür, 48 px dokunma alanlı.

### 4d. İzleyici, kopan oyuncu ve TV

### RD-U12 · İzleyici ve kopan oyuncu — **önerim: EVET**
- İzleyici her aşamada oyuncu ekranının soluk kopyası yerine kendi başlığını görür: seçimde "Mühürleyenler: 3/5",
  düelloda büyük adaylar, dağıtımda tahtın önü, darbede "Karar verenler: Cihad, Kaan".
- Kopan oyuncunun portresi her ekranda "bağlantı yok" etiketiyle; seçimde "oyu rastgele gidecek" notu.
- Kopan başkan için dağıtım ekranında herkes "Başkanın bağlantısı koptu · jetonlar seçmenlerine gidecek"
  (RD-M6) görür.

### RD-U13 · TV ekranı — **önerim: EVET** · 🎨 Görsel
TV'ye özel yatay görünüm (`StageView`): saray salonu, ortada büyük taht. Solda oyuncu sütunu (ad, genel skor,
durum: mühürledi / aday / jeton aldı / hak sahibi). Seçimde ortada sandık ve mühürleyenlerin avatarları; düelloda
adaylar ve kartlar dev boyda; dağıtımda tahtın önündeki jetonlar (kime gittiği gizli); darbe ve açılış tam ekran.
Gizli bilgi (oylar, işaretler, dağılım, defter) sonuca kadar TV'de yok.
- 🎨 saray salonu geniş arka planı (mevcut arka planın 16:9 hâli).

### 4e. Ses, titreşim ve hareket

### RD-U14 · Saray ses ve titreşim seti — **önerim: EVET** · 🔊 Ses
Mühür "tok", sandığa düşen oy "kâğıt hışırtısı", taş-kâğıt-makas üç vuruş, kart dönüşü, jeton "şıngır" (başkan her
dokunuşta; alıcı açılışta her jetonda), taç inişi fanfar, darbe davul + taht devrilme gürültüsü, "bastırıldı" boru,
vaat damgası (✓ çan / ✗ cam çatlaması). Titreşim: başkan seçilince uzun çift, aldığın her jetonda kısa,
"ELENDİ"de uzun tek. Hareket azaltma açıkken uçuşlar yerine sayılar belirir.

### 4f. İlk kez oynayan için öğretme

### RD-U15 · Anlatım metni ve canlı örnek — **önerim: EVET** · 🎨 Görsel
Üç adım (her biri tek satıra sığacak kadar kısa):
1. "Gizli oy ver: en çok oy alan başkan olur"
2. "Başkan, aldığı oy kadar jeton dağıtır (kişiye en çok 2)"
3. "Jeton alamayanlar darbe yaparsa başkanın puanı gider"
Anlatım görseli 4 karelik döngü: mühürler sandığa → taht yükselir → jetonlar uçar → taç düşer (4 sn).
(RD-M1 ile ek satır yok; dağıtım ekranındaki defter kendini anlatır.)

### RD-U16 · Aşama geçiş bantları — **önerim: EVET**
Her aşamanın başında 1,2 sn'lik tam genişlik bant (süreden yemez, sayaç bandın ardından başlar):
"SEÇİM · en çok oy alan başkan" → "DÜELLO · Elif mi Mert mi?" → "DAĞITIM · Elif 3 jeton dağıtıyor" →
"DARBE · jeton alamayanlar karar veriyor". İlk kez oynayanlar akışı bu bantlarla öğrenir; kalabalıkta "şimdi ne
oluyor?" sorusu biter. Dağıtımın başında bu bant yerine RD-U7'nin "BAŞKAN: ELİF" anı oynar (iki bant üst üste
gelmez). Aşama süreleri bandın bitiminden sayılır (oyun en çok ~5 sn uzar); bu yalnız zamanlamadır, kural değişmez.

### 4g. Erişilebilirlik

### RD-U17 · Renk körü, hareket, yazı, ekran okuyucu — **önerim: EVET**
- Taş-kâğıt-makas renk + şekil + yazıyla ayırt edilir (RD-U2); renk körü kipinde DARBE düğmesinde yumruk, DARBE
  YOK'ta çizgi simgesi; TUTTU/BOZDU damgalarında ✓/✗ ve yazı.
- Hareket azaltma: jeton uçuşu, taç düşüşü ve kart dönüşü yerine anlık durum; açılış sırası korunur (bilgi sırayla
  belirir).
- Büyük yazı ayarında başlıklar iki satıra izinli; portre adları kesilmez, 8 kişide kısaltılır (en çok 8 harf + …).
- Ekran okuyucu: başkan seçimi, düello sonucu, aldığın jetonlar ve darbe sonucu `aria-live` ile duyurulur
  ("Elif 3 oyla başkan oldu", "Sana 2 jeton geldi", "Darbe tuttu: 3'te 2").

---

## 5. Yapay zekâ (AI) ile yapılabilecekler

### RD-AI1 · Saray muhabiri — **önerim: İSTEĞE BAĞLI**
Açılışın sonunda tek cümlelik esprili yorum: "Oyuncu2 üç oyla tahta çıktı, iki jetonu en yakın dostuna verdi;
saray kapısında bekleyen üç kişi tahtı devirdi." Ortak yapay zekâ yorum altyapısıyla (`aiCommentGames.ts`; API
anahtarı bağlıyken açılır, hata olursa hiç görünmez, oyun beklemez, yasaklı kelime süzgeci). Modele gerçek ad değil
**Oyuncu1…N**, kim kime oy verdi (🎲 olanlar işaretli), dağılım, darbe sayısı, (RD-M3 ile) vaat sonucu gider.
Puanı yapay zekâ belirlemez. İsteğe bağlı: açılış zaten kalabalık; yorum ancak RD-U9'un sonunda yer bulur.

(Başka yapay zekâ önerisi yok: pazarlık sesli, uygulama duymuyor; vaatler hazır seçenekli olduğu için metin
denetimi gerekmiyor.)

---

## 6. İçerik ve üretim ekibine düşen işler

- **Görsel (🎨):** oy sandığı + mühür (RD-U1); büyük, okunur taş-kâğıt-makas el seti (RD-U2); jeton kesesi ve
  1/2 jetonluk yığın (RD-U3); kırmızı darbe yumruğu (RD-U6, SVG olabilir); devrilen taht + düşen taç (RD-U9);
  saray salonu 16:9 TV arka planı (RD-U13); anlatım 4 karesi (RD-U15). Görev dosyası CLAUDE.md'deki akışla
  (`/srv/glix/gorsel/<GOREV>.md`) yazılır.
- **Ses efektleri (🔊):** mühür, kâğıt hışırtısı, TKM üç vuruş, kart dönüşü, jeton şıngırtısı (2–3 varyasyon),
  taç fanfarı, darbe davulu, taht devrilmesi, "bastırıldı" borusu, vaat çanı / cam çatlaması, "Bana!" pıtırtısı
  (RD-U5 onaylanırsa). Ses olay haritasında `rusvet-darbe.*` anları.
- **Müzik:** saray teması (ağır, yaylı) + darbe oylaması için 10 sn'lik gerilim katmanı.
- **Efekt dokuları:** jeton parıltısı, mühür damgası, darbe tozu, taç yuvarlanma izi.
- **İçerik havuzu:** yok (vaat metinleri iki sabit seçenek; değişirse sahip yazar).
- **Wiki/kurallar:** `docs/KURALLAR.md` §11, `docs/wiki/oyunlar/rusvet-darbe.json` (süre notu, akış, puan).

---

## 7. Önerilen paket

**EVET:** RD-M1, RD-M2, RD-M3, RD-M4, RD-M5, RD-M6, RD-M7 · RD-U1, RD-U2, RD-U3, RD-U4, RD-U6, RD-U7, RD-U8,
RD-U9, RD-U10, RD-U11, RD-U12, RD-U13, RD-U14, RD-U15, RD-U16, RD-U17.
**İSTEĞE BAĞLI:** RD-U5 ("Bana!" tepkisi), RD-AI1 (saray muhabiri).
**HAYIR:** RD-M8 (darbe ganimeti).

Bu paketle oyun şöyle akar: anlatım "aldığın oy = dağıtacağın jeton" der → seçimde portrelere vaatler asılır,
oyunu sandığa mühürlersin (6–8 kişide 30 sn) → "BAŞKAN: ELİF · 3 JETON" bandı; 4+ aday eşitse önce ikinci oylama,
sonra büyük kartlı düello → başkan defterinde kimin oy verdiğini görür, jetonları keseden portrelere dağıtır;
diğerleri "Senin oyun: Elif" satırıyla tahtın önünde bekler → jeton alamayanlar "Karar senin" ekranında darbeye
karar verir → 11 sn'lik açılış: oklu oylar (🎲'ler kesikli), taht, jeton yığınları, darbe kutuları, TUTTU/BOZDU
damgası, "Nankörlük!" etiketleri, puanlar.

**Değişen kurallar (paket onaylanırsa):**
- Başkan darbe tutmazsa **+2** (bugün +1); darbe tutarsa 0. Jeton başına +1 aynen; doğrudan genel skora.
- Başkan dağıtımda kendisine kimin oy verdiğini (yalnız kendisi) görür.
- Seçimde isteğe bağlı, herkese açık, puansız hazır vaat (2 seçenek); başkanın vaadi açılışta ✓/✗.
- 4+ aday eşitse 12 sn'lik ikinci oylama (vermeyen sayılmaz), sonra gerekirse düello; 2–3 aday doğrudan düello.
- Seçim süresi 6–8 oyuncuda 30 sn.
- Kopan başkanın kalan jetonları önce ona oy verenlere birer birer.
- Açılış en az 11 sn; rastgele oy ve jetonlar açılışta işaretli.
- Her aşamanın başında 1,2 sn'lik bant (başkan seçilince 1,5 sn'lik taç anı); aşama süresi bandın ardından işler.
`docs/KURALLAR.md`, wiki ve testler buna göre güncellenir.

**Değişmeyenler:** 3–8 oyuncu, kendine oy yok, bağlı oyuncuya oy, vermeyenin oyu rastgele, bütçe = alınan oy,
kişi başı en çok 2 jeton ve kendine yok, dağıtım 25 sn ve Bitti, dağıtılmayanın rastgele gitmesi (bağlı başkanda),
taş-kâğıt-makas kuralı (iki işaret / tek-üç işarette tekrar, en çok 6 el, sonra kura), darbe oylaması (yalnız 0
jetonlular, 10 sn, gizli, tek seferlik, kesin çoğunluk, oylar hiç açılmaz), erken bitişler, eksi puan olmaması.

**🎨 Yeni görsel gerekenler (paket):** sandık + mühür, TKM el seti, jeton kesesi + yığın, darbe yumruğu, devrilen
taht + düşen taç, 16:9 saray arka planı, anlatım kareleri. Dosyalar gelene kadar CSS/SVG karşılıkları çizilir.
