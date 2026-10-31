# Yazı Yaz — geliştirme önerileri

Bu dosya onay içindir. Her maddenin bir kodu var (ör. **YY-M2**). Cevabını tek satırda verebilirsin:

> YY-M1 evet, YY-M2 hayır, YY-U3 evet …

ya da yalnız **"önerilen paket evet"** dersen sondaki paket uygulanır. Her maddenin "ayrıntılar" bölümü onaylarsan
nasıl yapılacağını kesinleştirir; ek soru sormam gerekmez. Beğenmediğin ayrıntı varsa yalnız onu yaz.

Not: Sonuç ekranı herkes **"Devam et"** deyince geçer (en çok 60 sn). Yeni görsel gerektiren maddeler **🎨 Görsel**
diye işaretli.

---

## 1. Bugünkü oyun (özet)

- 3–8 oyuncu. Sistem gizlice **iki yazan** seçer; diğerleri masumdur. Rol yalnız "Rolüm · basılı tut" düğmesine
  basılı tutulunca görünür.
- Yazma (30 sn): yazanlar istedikleri bir kelimeyi yazar, masumlar yalnız **MASUM** yazabilir.
- Sözlü tartışma (60 sn): uygulama dışında konuşulur; portrelere yalnız kendine görünen "?" şüphe işareti konabilir.
- Tahmin (30 sn): herkes bir kişiyi seçer ve onun kelimesini tahmin eder. Doğru kişi **+1**, doğru kelime **+1**
  (kelime yalnız kişi doğruysa sayılır). Yazanlar da diğer yazanı bulmaya çalışır. Eksi puan yok.
- Sonuç (en az 8 sn): iki yazan ve kelimeleri, herkesin tahmini ve puanı.

## 2. Gördüğüm sorunlar

**Oyun tasarımı**
1. **Kelimeyi tahmin etmek neredeyse şans.** Yazan dünyadaki herhangi bir kelimeyi yazabiliyor; tartışmada kelimeye
   dair hiçbir ipucu yok. Ekran görüntüsündeki örnekte bile iki kişi "KÖPEK" yazmış, kelimeler "IŞIK" ve "KEDİ".
   Puanın yarısı (kelime +1) fiilen piyango.
2. **Yazanın saklanmak için hiçbir sebebi yok.** Yazan bulunursa hiçbir şey kaybetmiyor, bulunmazsa hiçbir şey
   kazanmıyor. Gizli rol oyununun asıl gerilimi ("beni bulmasınlar") eksik; tartışmada yazanın blöf yapması
   gerekmiyor.
3. **Tartışmanın konusu yok.** 60 sn "yazanlar kim?" diye konuşuluyor ama konuşacak malzeme yalnız "kim Tamam'a geç
   bastı" gözlemi. Çoğu masada tartışma 15–20 sn'de tükenir.
4. **Rolünü öğrenmeyi unutan yazan.** Ekranda herkese "Kelimeni yaz" yazıyor; rol yalnız düğme basılı tutulunca
   görünüyor. Düğmeyi fark etmeyen yazan MASUM yazıp geçebiliyor (sistem buna izin veriyor) ve tur boşa gidiyor.
5. **Küçük kural boşlukları.** Hiç yazmayan masum "Tamam" diyemiyor ve herkesin erken bitirmesini engelliyor;
   son eksik oyuncu bağlantıyı yitirirse aşama kendiliğinden erken bitmiyor.

**Arayüz**
6. **Yazılan kelime ekranda kocaman duruyor.** Rol özenle gizlenmiş ama pano "MASUM"u ya da yazanın kelimesini dev
   neon harflerle gösteriyor (kilitli ekran görüntüsü). Yanındaki oyuncu ekrana bir göz atınca kimin yazan
   olduğunu ve kelimesini görüyor.
7. **Yazma ekranının yarısı boş.** Pano ile alttaki avatarlar arasında ekranın ~%35'i bomboş; avatarların altında
   isim yok; kalan süre yalnız en üstteki ince çubukta (sayı yok).
8. **Tartışmada sahte "yazıyor…" balonları.** Portrelerin yanında süs olarak sırayla "•••" balonu beliriyor
   (ekran görüntüsünde Elif'te). Oyuncu bunu "Elif bir şey yazıyor" diye okuyup yanlış ipucu sanabilir.
9. **Tahminde seçili kişi ile hazır olan karışıyor.** Seçtiğin kişinin köşesine de, Tamam diyenlerin köşesine de
   aynı yeşil ✓ geliyor (kilitli tahmin ekranında Cihad, Elif, Mert). "Sen" etiketi ismin üstüne biniyor. 5 ve 7
   kişide ızgarada tek boş hücre kalıyor; alt yarı yine boş.
10. **Sonuç düz bir tablo.** Her şey aynı anda beliriyor; "yazanlar…" anı, "kaç kişi beni buldu" bilgisi yok. Kime
    oy verildiğini gösteren avatarlar çok küçük (24 px); ekranın alt %40'ı boş.
11. **TV'ye özel düzen yok:** telefon ekranı büyütülüp gösteriliyor, yan alanlar boşa gidiyor.

---

## 3. Oyunu değiştiren öneriler (mekanik)

### YY-M1 · Konu kartı — **önerim: EVET**
**Ne:** Her oyunda herkese açık bir **konu** çıkar (ör. "MEYVE", "MESLEK", "MUTFAKTA BULUNUR"). Yazanlar kelimelerini
bu konudan seçer; masumlar yine MASUM yazar.
**Neden:** Sorun 1 ve 3. Kelime tahmini şanstan çıkar, akıl yürütmeye döner ("meyveyse 5 harfli… kiraz mı
armut mu?"). Tartışmanın da konusu olur: herkes konuyla ilgili konuşur, yazan bildiği kelimeyi ele vermemeye
çalışır.
**Ayrıntılar:**
- Konu listesini **sen yazarsın** (yönetici panelindeki içerik havuzlarında, Laf Sokma soruları gibi; yaklaşık 40
  konu yeterli). Yapay zekâyla üretilmez. Liste boşsa oyun bugünkü gibi konusuz oynanır.
- Konu maç tohumuyla rastgele seçilir; aynı odada son 10 oyunda çıkan konu tekrar gelmez.
- İki yazan **aynı konuyu** alır. Konuya uyma zorunlu değildir (sistem denetleyemez); ekranda yazana "Konuya uygun
  tek kelime yaz" hatırlatması çıkar. Konu dışı kelime yazan yalnız kendi gizlenme şansını artırır, kural ihlali
  sayılmaz.
- Konu, yazma aşamasının başından sonuca kadar her ekranın üstünde ve TV'de görünür.

### YY-M2 · Harf sayısı ipucu — **önerim: EVET**
**Ne:** Tartışma başlarken ortada **"Yazılan kelimeler: 5 harf · 7 harf"** gösterilir; hangisinin kime ait olduğu
söylenmez.
**Neden:** Sorun 1 ve 3. Konuyla birlikte kelimeyi bulmak mümkün hâle gelir; masada "5 harfli meyve!" yarışı
başlar. Yazanlar için de yeni bir blöf doğar: MASUM da 5 harfli olduğu için 5 harfli kelime yazan, yazma hızıyla
masumlardan ayırt edilemez.
**Ayrıntılar:**
- Yalnız harf ve rakamlar sayılır; boşluklar sayılmaz ("BUZ DOLABI" = 9 harf).
- Sayılar küçükten büyüğe yazılır (sıra kimin olduğunu ele vermez). İkisi eşitse "5 harf · 5 harf".
- Kelime yazmayan yazan için "— yazılmadı" görünür (ör. "6 harf · yazılmadı").
- İpucu tartışma ve tahmin aşamaları boyunca ekranda kalır.
- İlk harf gibi daha fazla ipucu verilmez.

### YY-M3 · Yazanlar saklanınca kazanır — **önerim: EVET**
**Ne:** Yazan, **hiçbir masum onu seçmediyse** oyun içi **+1 "İz bırakmadın"** alır.
**Neden:** Sorun 2. Yazan artık tartışmada masum rolü oynamak zorunda; "ben MASUM yazdım, yemin ederim!" blöfü
oyunun merkezine gelir. Masumlar ile yazanların amacı ilk kez çatışır.
**Ayrıntılar:**
- Yalnız masumların seçimi sayılır; diğer yazanın seni seçmesi bu ödülü bozmaz.
- Hiç kelime yazmayan yazan bu ödülü alamaz (yazmadan saklanmak ödüllenmez).
- Hiçbir masum tahmin göndermediyse (ya da masumların hepsi koptuysa), kelime yazmış her iki yazan da +1 alır.
- 3 oyuncuda tek masum birini seçer; seçilmeyen yazan +1 alır. Bu, 3 kişide masumun kişi puanını garanti almasını
  dengeler.
- Yazanın oyun içi en yüksek puanı 3 olur (diğer yazanı bul +1, kelimesini bil +1, iz bırakma +1); masumun 2.
  Bu fark YY-M4 ile sıralamaya çevrildiği için genel skoru bozmaz.

### YY-M4 · Puanı sıralamaya çevir — **önerim: EVET (YY-M3 onaylanırsa; yoksa HAYIR)**
**Ne:** Kişi, kelime ve "İz bırakmadın" puanları oyun içinde toplanır (**"dedektif puanı"**). Oyun sonunda mini puan:
**en yüksek +2, ikinci +1, diğerleri 0.** Eksi yok.
**Neden:** YY-M3 ile oyun içi puan 0–3 olur; sıralamaya çevirmek diğer oyunlarla aynı aralığı (0…+2) korur. YY-M3
onaylanmazsa bugünkü 0–2 puan zaten dengeli; o zaman bu madde gerekmez.
**Ayrıntılar:**
- Birincide eşitlik varsa hepsi +2; sonraki farklı toplam +1.
- Toplamı 0 olan ödül almaz.
- Herkesin toplamı aynı ve 0'dan büyükse herkes +1; herkes 0 ise kimse puan almaz.
- Dedektif puanı sonuç ekranında herkesin satırında görünür, mini puan yanında ayrı rozet olarak.
- Maç kartlarında "birinci" = en yüksek dedektif puanı, "sonuncu" = en düşük (herkes eşitse kimse sonuncu değil).

### YY-M5 · Küçük kural düzeltmeleri — **önerim: EVET**
**Ne:** Üç boşluk kapatılır:
1. **Yazan MASUM yazamaz.** Yazan MASUM yazarsa kendi ekranında "Yazansın, MASUM yazamazsın" uyarısı çıkar ve kilitlenmez
   (uyarı yalnız ona görünür, kimse fark etmez). Böylece rolünü kaçıran yazan turu boşa harcamaz.
2. **Unutkan masum:** hiç yazmayan masumun girişi süre dolunca otomatik MASUM sayılır; "Tamam"a boş basarsa pano
   kendiliğinden MASUM ile dolar ve kilitlenir.
3. **Kopan son oyuncu:** biri bağlantıyı yitirdiğinde "herkes hazır mı" yeniden kontrol edilir; kalan herkes
   hazırsa aşama 1 sn sonra biter.
**Neden:** Sorun 4 ve 5.

### YY-M6 · Hazır işaretlerini yazma aşamasında gizle — **önerim: HAYIR (isteğe bağlı)**
**Ne:** Yazma aşamasında kimin "Tamam" dediği gösterilmez, yalnız "3/6 hazır" sayısı görünür.
**Neden önermiyorum:** "Kim geç bitirdi?" gözlemi masada en çok konuşulan ipucu ve oyunun ruhuna ait. YY-M1 ve
YY-M2 tartışmaya yeni malzeme kattığı için yine de gizlemek istersen tek ayarla yapılır.

### YY-M7 · Yazım hatası toleransı — **önerim: İSTEĞE BAĞLI**
**Ne:** 6 harf ve üstü kelimelerde **tek harf farkı** doğru sayılır ("KARPUZ" yerine "KARPIZ").
**Neden:** Telefonda hızlı yazarken yapılan yazım hataları puanı kaçırmasın.
**Ayrıntılar:** yalnız harf sayısı aynıysa ve tam bir harf farklıysa; eksik/fazla harf kabul edilmez ("ELMA" ile
"ELMAS" farklı kelimedir). 5 harf ve altında tam eşleşme gerekir. Bugünkü klavye toleransı (ç/c, ı/i …) aynen kalır.

### YY-M8 · İki tur, roller değişir — **önerim: HAYIR**
**Ne:** Oyun iki tur oynanır, ikinci turda başka iki yazan çıkar.
**Neden önermiyorum:** Oyun ~4 dakikaya çıkar; maçtaki diğer oyunlar 1–2 dakika. Tek tur YY-M1…M3 ile yeterince dolu.

---

## 4. Arayüz ve his önerileri

### YY-U1 · Gizli pano: yazılan kelime gözden saklansın — **önerim: EVET**
- Yazarken her harf **0,6 sn** görünür, sonra **●** olur (telefon şifresi gibi). Tamam'dan sonra panoda yalnız
  "●●●●●" kalır.
- Panoya **basılı tutunca** kelimenin tamamı görünür (Rolüm düğmesi gibi); bırakınca kapanır.
- MASUM da 5 nokta görünür; YY-M2 ile 5 harfli kelime yazan yazanın panosu masumunkinden ayırt edilemez.
- Tahmin aşamasındaki "Kelimesi ne?" alanı da aynı şekilde çalışır (yan bakan tahminini kopyalayamaz).
**Neden:** Sorun 6; bugün yan bakan biri rolü de kelimeyi de okuyabiliyor.

### YY-U2 · Rol kartı ve yazma ekranı düzeni — **önerim: EVET** · 🎨 Görsel
- Yazma aşaması **ters duran bir rol kartıyla** açılır: "Rolünü görmek için basılı tut". Kart çevrilene kadar pano
  kapalıdır; bir kez basılı tutunca pano açılır. Kart sonra küçülüp bugünkü "Rolüm" düğmesine dönüşür. (Sorun 4.)
- Kartın iki yüzü: **YAZAN** (daktilo ve kalem, "Konudan bir kelime yaz") / **MASUM** (boş kâğıt, "MASUM yaz").
  Basılı tutmayan biri için iki kart birebir aynıdır.
- Boş alana (YY-M1 ile) **konu kartı**: daktiloya takılı kâğıt üstünde büyük harflerle "KONU: MEYVE".
- Kalan süre büyük sayıyla panonun üstünde; son 5 sn'de kırmızı ve tik sesi.
- Alttaki avatarların altına kısa isim; avatarlar 40 px yerine 48 px.
- 🎨 Gereken: rol kartı arkası ve iki ön yüzü (yazan / masum), daktilo kâğıdı (konu kartı için; CSS ile de olur).

### YY-U3 · Tartışma ekranı — **önerim: EVET**
- Ortadaki büyük saatin altında **konu** ve **harf sayısı ipucu** (YY-M2): "MEYVE · 5 harf · 7 harf", büyük ve okunur.
- Sahte "•••" balonları kaldırılır (Sorun 8). Yerine, herkeste **aynı anda** hafifçe nabız atan çerçeve (kimseyi öne
  çıkarmaz).
- Şüphe işareti üç durumlu olur: bir dokunuş **?** (şüpheli), iki dokunuş **✓** (temiz bence), üçüncü kapalı. Yine
  yalnız bu cihazda.
- Son 10 sn'de saat kırmızıya döner, nabız atar, telefon her saniye hafif titrer.
- İpucu satırı ("Şüphelendiğine dokun") 14 px'ten 16 px'e.

### YY-U4 · Tahmin ekranı — **önerim: EVET**
- **Seçili kişi** ile **hazır olan** ayrılır: seçtiğin kişi büyür, pembe halka ve altında **"YAZAN?"** rozeti alır;
  hazır olanlar yalnız köşede küçük yeşil nokta. Aynı ✓ işareti iki anlamda kullanılmaz (Sorun 9).
- "Sen" etiketi ismin üstüne binmez; avatarın tepesine taşınır. Kendi kartın soluk ve seçilemez.
- Izgara oyuncu sayısına göre ortalanır (5 kişi: 3 + 2 ortalı, 7 kişi: 4 + 3 ortalı); boş hücre kalmaz.
- "Kelimesi ne?" alanının üstünde konu ve harf ipucu; alana yazarken altta harf kutucukları dolar
  ("_ _ _ _ _" → "K İ R _ _"), sayıyı tutturmak kolaylaşır.
- Klavye açılınca portreler küçülür, alan ve Tamam klavyenin hemen üstünde kalır.

### YY-U5 · Sonuç açılışı: "Yazanlar…" — **önerim: EVET**
Sırayla, toplam ~8 sn (sonra "Devam et"):
1. **"Yazanlar…"** davul sesi (1,5 sn).
2. Yazan kartları tek tek döner; kelime **daktilo gibi harf harf** yazılır (her harfte tuş sesi, sonunda zil).
3. Her yazan kartına onu seçenlerin avatarları **uçar**; kartın altında "**4 kişi buldu**" ya da (YY-M3 ile)
   **"İZ BIRAKMADI"** damgası.
4. Ardından oyuncu satırları; seçilen kişinin avatarı 24 px yerine 36 px; kelime tahmini doğruysa yeşil, yanlışsa
   kısa kırmızı titreme.
5. Kendi satırın parlar, puanın üstteki büyük puana uçar.
- Kelime yazmamış yazan için kartta "—" yerine **"Kelime yazmadı"**.
- (YY-M4 ile) satırlarda dedektif puanı ve yanında +2 / +1 / 0 rozeti.
- Boş alt yarı: satırlar daha ferah (yükseklik artar) ve altta "Devam et" bloğu; 8 kişide ekranı tam doldurur.

### YY-U6 · Ses ve titreşim seti — **önerim: EVET**
Tamam'da daktilo satır sonu zili ("ding"), rol kartı çevirme sesi, tartışmanın son 10 sn'sinde saat tiki, sonuçta
davul + harf harf daktilo + "İz bırakmadı" damga sesi. **Yazarken tuş sesi yok** (tuş sesi yazılan harf sayısını
yandakilere duyurur).

### YY-U7 · TV ekranı — **önerim: EVET**
TV'ye özel düzen: solda büyük konu kartı, saat ve (tartışmada) harf ipucu; sağda oyuncu halkası ve hazır işaretleri.
Rol ve kelime sonuca kadar TV'de hiç görünmez. Sonuç açılışı (YY-U5) TV'de tam ekran; avatarların yazan kartlarına
uçuşu büyük ekranda oynar.

### YY-U8 · Anlatım güncellemesi — **önerim: EVET**
Anlatım adımları yeni kurallara göre: (1) "Rol kartına basılı tut; yazansan konudan bir kelime yaz, masumsan MASUM",
(2) "60 sn konuş: harf ipucuyla kelimeyi, davranışlarla yazanı bul; yazansan saklan", (3) "Kişi +1, kelime +1, hiç
bulunmayan yazan +1".

---

## 5. Yapay zekâ (AI) ile yapılabilecekler

### YY-AI1 · Anlam hakemi — **önerim: HAYIR**
**Ne:** Kelime tahmini birebir tutmasa da yapay zekâ "aynı şey mi?" diye karar verir ("TELEFON" ile "CEP TELEFONU").
**Neden önermiyorum:** ⚠️ **Puanı yapay zekâ belirler.** Tartışmalı kararlar masada kavga çıkarır, cevap gecikirse
sonuç bekler. YY-M7 (tek harf toleransı) bu ihtiyacı kuralla, tutarlı biçimde karşılar.

### YY-AI2 · Spiker yorumu — **önerim: İSTEĞE BAĞLI**
Sonuçta tek cümlelik esprili özet: "Mert 'KEDİ' yazdı, MASUM'dan bile masum göründü; dört kişiden hiçbiri onu
bulamadı." Ortak yapay zekâ yorum altyapısıyla (API bağlanınca açılır, hata olursa görünmez, oyun beklemez, yasaklı
kelime süzgeci). Modele yalnız konu, iki kelime, kimin kimi seçtiği ve puanlar gider; anlık üretilir, saklanmaz.

---

## 6. Önerilen paket

**YY-M1, YY-M2, YY-M3, YY-M4, YY-M5 ve YY-U1 … YY-U8 hepsi.** (YY-M6, YY-M7, YY-M8 ve yapay zekâ maddeleri pakete dahil
değil.)

Bu paketle oyun şöyle akar: ters rol kartına basılı tutarsın → konu "MEYVE"; yazansan bir meyve yazarsın, masumsan
MASUM; panoda yalnız noktalar görünür → tartışma "5 harf · 7 harf" ipucuyla başlar, herkes meyve sayar, yazanlar
masum rolü oynar → tahminde bir kişi ve kelimesi seçilir, harf kutucukları dolar → "Yazanlar…": kelimeler daktiloyla
yazılır, bulanların avatarları kartlara uçar, saklanmayı başaran "İZ BIRAKMADI" damgası alır → dedektif puanına göre
+2 / +1 / 0.

**Değişen kurallar (paket onaylanırsa):** her oyunda herkese açık bir konu (elle yazılmış listeden); tartışmada iki
kelimenin harf sayısı (sahibi belirtilmeden) gösterilir; hiçbir masumun seçmediği, kelime yazmış yazan +1; puanlar
dedektif puanı olarak toplanıp +2 / +1 / 0'a çevrilir (eksi yok); yazan MASUM yazamaz; yazmayan masum MASUM sayılır;
kopan son oyuncu erken bitişi engellemez. `docs/KURALLAR.md`, wiki ve testler buna göre güncellenir.

**Değişmeyenler:** 3–8 oyuncu, iki yazan, masumun yalnız MASUM yazması, süreler (30 sn yazma, 60 sn tartışma, 30 sn
tahmin), sözlü tartışma (uygulamada sohbet yok), bir kişi + bir kelime tahmini, kelime puanının yalnız kişi doğruysa
sayılması, klavyeden bağımsız eşleşme, 24 karakter sınırı, iki yazanın aynı kelimeyi yazabilmesi, şüphe işaretinin
yalnız bu cihazda kalması, kimin Tamam dediğinin görünmesi, 250 ms geç eylem payı.

**🎨 Yeni görsel gerekenler (paket):** rol kartı arkası + iki ön yüz (YAZAN / MASUM) (YY-U2); daktilo kâğıdı konu
kartı (YY-U2; CSS ile de çizilebilir).
