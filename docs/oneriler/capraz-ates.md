# Çapraz Ateş — geliştirme önerileri

Bu dosya onay içindir. Her maddenin bir kodu var (ör. **CA-M2**). Cevabını tek satırda verebilirsin:

> CA-M1 evet, CA-M2 hayır, CA-U3 evet …

ya da yalnız **"önerilen paket evet"** dersen sondaki paket uygulanır. Her maddenin "ayrıntılar" bölümü onaylarsan
nasıl yapılacağını kesinleştirir; ek soru sormam gerekmez. Beğenmediğin ayrıntı varsa yalnız onu yaz.

Not: Sonuç ekranı herkes **"Devam et"** deyince geçer (en çok 60 sn). Yeni görsel gerektiren maddeler **🎨 Görsel**
diye işaretli. Eksi puan konusunda oyun oyun karar verdin (Aşırı Yükleme'de var, Gizli Alışveriş'te yok); bu oyunda
eksi puan oyunun özü olduğu için koruyorum, eksisiz seçenek **CA-M4**'te.

---

## 1. Bugünkü oyun (özet)

- 3–8 oyuncu. Herkes kendisi dışında bir kişiyi **gizlice hedef alır**, 25 sn içinde değiştirebilir, "Tamam" ile
  kesinleştirir.
- Süre bitince hedefler birden açılır:
  - Kimse seni hedeflemediyse ve sen birine ateş ettiysen **+1**.
  - Seni biri hedeflediyse (karşılıklı değilse) **−1**.
  - Karşılıklı hedefleşen iki kişi **0**.
  - Ateş etmeyen ve hedeflenmeyen **0**.
- Açılış 7 sn: oyuncular halkada, ateş edenden hedefe neon iz, karşılıklı izler ortada çarpışır.

## 2. Gördüğüm sorunlar

**Oyun tasarımı**
1. **Tek atış, tek karar, bilgi yok.** Oyuncunun elinde hiçbir ipucu yok; hedef seçimi çoğu zaman rastgele ya da
   "en son kim bana bir şey yaptıysa". Sonuç büyük ölçüde şans.
2. **Ateş etmemek hiç mantıklı değil.** Ateş etmenin bir bedeli yok: ateş edersen ya +1 ya aynı cezayı alırsın;
   etmezsen en iyi ihtimalle 0. Yani herkes her zaman ateş ediyor; "savunma" diye bir seçenek yok.
3. **İntikam ve gerilim anı yok.** Kim kimi vurdu, açılınca bitiyor; "seni vuranı vur" duygusu oyuna geri
   dönmüyor.
4. **3 kişide döngü cezası.** A→B, B→C, C→A olursa herkes −1 alıyor; küçük grupta sık görülüyor ve "herkes kaybetti"
   hissi bırakıyor.

**Arayüz**
5. **Seçim anı düz.** Portreye dokununca halka kırmızı oluyor ve başlıkta isim yazıyor; nişan alma, kilitlenme
   hissi yok.
6. **"Tamam" anı sıradan;** silah kurma, hazır olma gerilimi yok.
7. **Açılış küçük ve hızlı.** Halka ekranın ortasında küçük; izler yarım saniyede çiziliyor; kimin kimi vurduğunu
   takip etmek zor. Asıl dram olan "beni kim vurdu?!" anı tek satırlık başlık.

---

## 3. Oyunu değiştiren öneriler (mekanik)

### CA-M1 · Siper al (savunma seçeneği) — **önerim: EVET**
**Ne:** Hedef seçmek yerine **"Siper al"** seçebilirsin. Siperdeyken seni hedefleyenler sana zarar veremez
(hedeflenme cezası almazsın), ama sen de ateş etmediğin için +1 alamazsın.
**Neden:** Sorun 2. Oyuna gerçek bir ikilem gelir: **saldır (+1 şansı, −1 riski)** mi, **savun (garanti 0)** mı?
Herkes siper alırsa kimse kazanmaz; herkes saldırırsa kan gölü. Masada "bu tur ben sipere giriyorum" blöfleri doğar.
**Ayrıntılar:**
- Siper de hedef gibi gizlidir, süre bitene kadar değiştirilebilir, "Tamam" ile kesinleşir.
- Siperdeki oyuncuyu hedefleyen kişinin atışı **boşa gider**: hedeflediği kişi siperde olduğu için ateş eden "ateş
  etti" sayılır (yani kendisi hedeflenmediyse +1 alır); siper yalnız hedefi korur.
- Puan tablosu: siperde + hedeflenmiş → 0; siperde + hedeflenmemiş → 0.
- Açılışta siperdeki oyuncunun önünde kalkan belirir; ona gelen mermiler kalkandan seker (🎨 CA-U4).

### CA-M2 · İki tur: intikam turu — **önerim: EVET**
**Ne:** Oyun **iki tur** oynanır (her biri 20 sn). Birinci turun hedefleri açıldıktan sonra **ikinci tur** başlar;
herkes kimin kimi vurduğunu bilerek yeniden seçer. Puanlar iki turun toplamıdır.
**Neden:** Sorun 1 ve 3. İkinci turda bilgi var: "Mert beni vurdu, şimdi ben onu vuracağım" — ama Mert de bunu
biliyor ve siper alabilir (CA-M1). İntikam, tahmin ve blöf katmanı oluşur.
**Ayrıntılar:**
- Tur 1: 20 sn seçim → 5 sn açılış (kısa, kim kimi vurdu + tur puanı).
- Tur 2: 20 sn seçim → büyük final açılışı (CA-U4).
- Tur 1'in hedefleri tur 2 boyunca ekranda küçük oklarla görünür (kim kimi vurdu), böylece hatırlamak gerekmez.
- Puan: iki turun toplamı (−2 ile +2 arası). Toplam genel skora eklenir.
- Erken bitiş ("herkes Tamam dedi") her turda ayrı çalışır.

### CA-M3 · Döngü kuralı yumuşasın — **önerim: EVET**
**Ne:** Herkesin hedeflendiği tam bir döngü olursa (A→B→C→A gibi, oyuncuların tamamını kapsayan tek halka) o turda
**herkes 0** alır ("Çember kapandı!").
**Neden:** Sorun 4. Küçük grupta sık çıkan "herkes −1" sonucu oyunun en sıkıcı sonu; çemberi özel bir an hâline
getirir.
**Ayrıntılar:** yalnız tüm katılımcıları kapsayan tek döngüde geçerli. Kısmi döngüler (A→B→C→A, D ve E dışarıda)
bugünkü kurala göre puanlanır.

### CA-M4 · Eksisiz puanlama (alternatif) — **önerim: HAYIR**
**Ne:** Puanlar bir basamak yukarı kaydırılır: hedeflenen 0, karşılıklı +1, hedeflenmeyen ve ateş eden +2,
ateş etmeyen ve hedeflenmeyen (ya da siperde) +1.
**Neden önermiyorum:** Çapraz Ateş'in gerilimi "vurulursam kaybederim" duygusundan geliyor; eksi kalkınca vurulmak
sadece "kazanamamak" olur. Ayrıca bu oyun diğerlerinden daha cömert puan dağıtır. Eksiyi istemezsen bunu seç.

### CA-M5 · Hedef sayacı ipucu — **önerim: HAYIR**
**Ne:** Seçim sırasında "Seni şu an X kişi hedefliyor" gösterilir.
**Neden önermiyorum:** Gizliliği bozar; oyun "herkes son saniyede değiştirir" yarışına döner.

---

## 4. Arayüz ve his önerileri

### CA-U1 · Nişan alma anı — **önerim: EVET**
- Portreye dokununca nişangâh portreye **kayarak kilitlenir** (zoom + "klik" sesi), portrenin etrafında kırmızı
  lazer noktası titrer, telefon kısa titrer.
- Ekranın altında **kendi avatarın** silahını kaldırmış şekilde durur; hedeflediğin kişiye doğru ince bir lazer çizgisi
  uzanır (yalnız senin ekranında).
- Hedef değiştirince nişangâh bir portreden diğerine kayar.
- (CA-M1 ile) "Siper al" düğmesi portrelerin altında ayrı durur; seçilince ekranın altı kalkanla örtülür, avatarın
  çömelir.

### CA-U2 · "Tamam" = Ateşe hazır — **önerim: EVET**
- "Tamam" düğmesinin adı **"ATEŞE HAZIR"** olur; basınca silah kurma sesi ve titreşim, nişangâh kilit simgesine döner.
- Alttaki hazır listesinde hazır olanların avatarlarının yanında küçük mermi simgesi.

### CA-U3 · Son 5 saniye: düello anı — **önerim: EVET**
- Son 5 saniyede ekran hafifçe kararır, rüzgâr/ıslık sesi (vahşi batı düellosu), büyük **"3 · 2 · 1 · ATEŞ!"**.
- "ATEŞ!" anında ekran flaşı ve tüm silah seslerinin birlikte patlaması (açılışa geçiş).

### CA-U4 · Açılış: ağır çekim mermiler — **önerim: EVET** · 🎨 Görsel
- Halka **tam ekran** büyür. Önce 1 sn sessizlik, sonra tüm namlular aynı anda alev alır (namlu ateşi).
- Mermiler **ağır çekimde** izlerini çizerek hedeflerine gider (bugünkü 0,5 sn yerine ~2 sn), takip edilebilir hızda.
- **Vurulan:** avatar geriye sarsılır, ekranında cam çatlağı efekti, "−1".
- **Karşılıklı:** iki mermi ortada çarpışır, kıvılcım patlaması, "ÇARPIŞTI · 0".
- **Siper (CA-M1):** mermi kalkandan seker, "Siperde · 0".
- **Kimse vurmadı + ateş etti:** avatar parlar, "SAĞ KALDI · +1".
- Sonra her oyuncuya **"Seni vuranlar: Elif, Kaan"** satırı (kendi ekranında büyük), ve bir özet satırı: "En çok
  hedeflenen: Mert (3 kişi)".
- 🎨 Gereken: namlu ateşi ve mermi parıltısı (sprite), kalkan, cam çatlağı katmanı. (CSS ile kabaca yapılabilir;
  görselle çok daha iyi olur.)

### CA-U5 · İkinci tur bilgisi (CA-M2 ile) — **önerim: EVET**
- Tur 2'de portrelerin üstünde küçük işaretler: seni tur 1'de vuranın portresinde kırmızı "seni vurdu" rozeti;
  senin vurduğunun portresinde "vurdun" rozeti; ekranın üstünde tur 1'in mini halkası (dokununca büyür).

### CA-U6 · Ses ve titreşim seti — **önerim: EVET**
Nişangâh kilit "klik", silah kurma, düello ıslığı, toplu ateş, ağır çekim mermi vınlaması, isabet, sekme (siper),
çarpışma kıvılcımı, cam kırılması; her biri için uygun titreşim.

### CA-U7 · İzleyici ve TV — **önerim: EVET**
İzleyici/TV ekranında halka büyük; seçim sırasında portrelerin üstünde dönen nişangâhlar (kimin kimi hedeflediği
yok), hazır olanlarda mermi simgesi; açılış ağır çekim aynı sahne.

---

## 5. Yapay zekâ (AI) ile yapılabilecekler

### CA-AI1 · Düello spikeri — **önerim: İSTEĞE BAĞLI**
Açılış sonunda tek cümlelik esprili özet: "Mert'i üç kişi birden vurdu; dostluk kavramı bu masada yeniden
tanımlandı." Bomba uzmanı yorumuyla aynı altyapı (API bağlanınca açılır, hata olursa görünmez, oyun beklemez,
yasaklı kelime süzgeci). Modele yalnız hedefler ve puanlar gider.

---

## 6. Önerilen paket

**CA-M1, CA-M2, CA-M3 ve CA-U1 … CA-U7 hepsi.** (CA-M4, CA-M5 ve yapay zekâ pakete dahil değil.)

Bu paketle oyun şöyle akar: tur 1'de herkes nişan alır ya da sipere girer → "3·2·1·ATEŞ!" → kısa açılış, kim kimi
vurdu → tur 2'de herkes bilerek seçer: intikam mı, siper mi, blöf mü → final ağır çekim açılış, "Seni vuranlar"
ve iki turun toplam puanı.

**Değişen kurallar (paket onaylanırsa):** "Siper al" seçeneği (siperde hedeflenme cezası yok, +1 de yok); iki tur
(20 sn + 20 sn), puanlar toplanır (−2…+2); tüm oyuncuları kapsayan tek döngüde herkes 0. `docs/KURALLAR.md`, wiki ve
testler buna göre güncellenir.

**Değişmeyenler:** 3–8 oyuncu, hedeflerin gizliliği, kendini hedefleyememe, bağlı hedef şartı, "Tamam" ile kilit ve
erken bitiş, karşılıklı çift 0, hedeflenme −1, hedeflenmeden ateş +1.

**🎨 Yeni görsel gerekenler (paket):** namlu ateşi, mermi parıltısı, kalkan, cam çatlağı katmanı; isteğe bağlı olarak
alttaki "silahını kaldırmış avatar" için silah/el görseli (mevcut avatar büstleriyle birleştirilecek).
