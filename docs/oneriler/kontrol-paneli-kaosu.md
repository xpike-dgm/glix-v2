# Kontrol Paneli Kaosu — geliştirme önerileri

Bu dosya onay içindir. Her maddenin bir kodu var (ör. **KP-M2**). Cevabını tek satırda verebilirsin:

> KP-M1 evet, KP-M2 hayır, KP-U3 evet …

ya da yalnız **"önerilen paket evet"** dersen sondaki paket uygulanır. Her maddenin "ayrıntılar" bölümü onaylarsan
nasıl yapılacağını kesinleştirir; ek soru sormam gerekmez. Beğenmediğin ayrıntı varsa yalnız onu yaz.

Önceki kararlarına uyum: **eksi puan yok** (en düşük 0), sonuç ekranı herkes **"Devam et"** deyince geçer (en çok
60 sn). Yeni görsel gerektiren maddeler **🎨 Görsel** diye işaretli.

---

## 1. Bugünkü oyun (özet)

- 2–8 oyuncu. Herkesin telefonunda 4 renkli kablo (mavi, yeşil, kırmızı, sarı), herkeste farklı sırada.
- Herkes, **başka birinin** panelini tarif eden gizli bir ipucu notu taşır: "1. kablo yeşil ve 3. kablo mavi ise
  kırmızıyı kes". Not kimin paneli olduğunu söylemez; oyuncular notları sesli okuyup kendilerine uyanı bulur.
- Herkes **tek kablo** keser, geri alınamaz. **60 sn**.
- Doğru kesen +1, o panelin ipucunu taşıyan da +1 (en çok 2). Ceza yok.
- Sonuç 8 sn: kendi panelin, herkesin kesimi ✓/✗ ve ipucu taşıyıcısının portresi.

## 2. Gördüğüm sorunlar

**Oyun tasarımı**
1. **Bulmaca çok kolay, gerilim yok.** Herkes notunu bir kez okuyunca iş biter: her not yalnız bir panele uyuyor ve
   kontrol etmek iki kabloya bakmak kadar basit. Birkaç maçtan sonra masada herkes +2 alıyor; oyun bir "okuma
   sırası" bekleme oyununa dönüyor.
2. **60 saniye çok uzun, tek bir karar çok az.** İlk 15 saniyede herkes doğru kabloyu biliyor; kalan 45 saniye boş.
   Oyunun tamamı tek bir dokunuş.
3. **"Kaos" yok.** Adı Kontrol Paneli Kaosu ama zaman baskısı, panik, yanlış anlama, birbirine bağırma anı yok.
   Bomba temasına rağmen bomba yok; yanlış kesmenin bir patlaması bile yok.
4. **Kurallarda yazan "kablo nabız atar" mekaniği hiç yok** (sistem konuşmayı duyamıyor). Kural metni kodla çelişiyor.

**Arayüz**
5. **Tehlike hissi yok.** Ekranda saat yok (yalnız ince süre çubuğu), tik sesi yok, bomba yok.
6. **Kesmek bir düğme.** Kabloya dokun → "KES" düğmesine bas. Pense, kıvılcım, kopma hissi yok.
7. **İpucu notu sıradan bir kutu.** "Sesli oku" deniyor ama not, okunacak bir kâğıt gibi değil.
8. **Sonuç tek bir liste.** Oyunun asıl güzelliği olan "kimin notu kimin panelini anlatıyordu" zinciri görünmüyor;
   küçük portre ve açıklama notuyla anlatılmaya çalışılıyor.
9. **İzleyici ekranı boş.** "Paneller sessizce çalışıyor" yazısından başka bir şey yok.

---

## 3. Oyunu değiştiren öneriler (mekanik)

### KP-M1 · Üç dalga, artan zorluk — **önerim: EVET**
**Ne:** Tek kesim yerine **3 dalga**. Her dalgada yeni paneller, yeni ipucu zinciri ve tek kesim hakkı. Dalgalar
giderek zorlaşır ve kısalır.
**Neden:** Sorun 1 ve 2. Oyun tek dokunuştan, üç kez artan baskıya dönüşür; 60 saniyenin boş geçen kısmı kalkar.
**Ayrıntılar:**
- **Dalga 1 — Isınma (25 sn):** bugünkü gibi 4 kablo, 2 koşullu ipucu.
- **Dalga 2 — Karmaşa (25 sn):** 4 kablo, ipuçları KP-M2'deki yeni türlerden gelir ("değilse", "yan yana" vb.).
- **Dalga 3 — Kaos (20 sn):** **5 kablo** (5. renk: **mor**), 3 koşullu ya da karma ipucu.
- Her dalga arasında 4 sn'lik ara: o dalganın kısa sonucu (kim doğru kesti, ✓/✗), sonra yeni paneller.
- Her dalgada ipucu zinciri yeniden karıştırılır (aynı kişi her dalgada aynı kişinin notunu taşımaz).
- Herkes kestiyse dalga 1 sn sonra biter (bugünkü erken bitiş, dalga başına).
- Toplam süre bugünkü gibi ~80 sn civarında kalır (25+25+20 + aralar).

### KP-M2 · Daha çeşitli ipucu türleri — **önerim: EVET**
**Ne:** Bugün ipucu hep "N. kablo R ise" biçiminde. Yeni türler eklenir; doğru kablo yine sistemce kesin hesaplanır.
**Neden:** Sesli okumayı ve dinlemeyi zorlaştırır, yanlış anlama ve "dur bir daha oku!" anlarını doğurur. Sorun 1.
**Ayrıntılar (dalga 2 ve 3'te kullanılır):**
- **Olumsuz:** "2. kablo kırmızı **değilse** ve 4. kablo sarıysa maviyi kes."
- **Komşuluk:** "Mavi ile sarı **yan yanaysa** yeşili kes."
- **Konum hedefi:** "1. kablo yeşilse **en alttaki** kabloyu kes" (renk değil konum söylenir).
- **Sıra:** "Kırmızı, maviden **yukarıdaysa** sarıyı kes."
- Her ipucu, oyuncuların panelleri arasında **yalnız hedef paneli** tanımlamaya devam eder (bugünkü güvence aynen
  korunur; sistem ipucunu üretirken başka panele uymadığını denetler).
- İpucu cümlesi oyuncu adı içermez (bugünkü gibi).

### KP-M3 · Ortak bomba saati — **önerim: EVET**
**Ne:** Her dalganın süresi, ekranın ortasındaki **ortak bir bomba saatidir**. **Yanlış kesim saatten 5 saniye
düşer**, herkes için.
**Neden:** "Kaos"u getirir (sorun 3). Kimse yanlış kesmek istemez çünkü henüz kesmemiş arkadaşlarının süresini
yer. Masada "bekle, emin misin?" baskısı doğar. Ceza puan değil süre olduğu için eksi puan kuralına uyar.
**Ayrıntılar:**
- Yanlış kesimin hangi kablo olduğu söylenmez; yalnız saat kırmızı yanıp söner ve 5 sn atlar, herkes "biri
  yanlış kesti!" görür. Kimin kestiği zaten açık (hazır listesi), yani masada "kim kesti?" sorusu doğar.
- Saat sıfıra inerse dalga biter; kesmeyenler kesmemiş sayılır.
- Saat 3 sn'nin altına düşmez (bir yanlış kesim dalgayı anında bitirmez); 3 sn'deyken gelen yanlış kesim süreyi
  düşürmez.

### KP-M4 · Puanlama (dalgalarla uyumlu) — **önerim: EVET**
**Ne:** Her dalgada bugünkü gibi **imha puanı** toplanır: doğru kesen 1, o panelin ipucunu taşıyan 1. Oyunun sonunda
mini oyun puanı bu toplamla verilir: **en çok imha puanı +2, ikinci +1, diğerleri 0.**
**Neden:** 3 dalga ile ham puan 6'ya çıkar; bu, diğer oyunlara göre (çoğu en çok +2) genel skoru bozar. Sıralamaya
çevirmek oyunu diğerleriyle dengeli tutar. Eksi puan yok.
**Ayrıntılar:**
- Eşitlik: birincide eşitlik varsa hepsi +2, sonraki farklı toplam +1 (Gizli Alışveriş'teki kararla aynı).
- Toplamı 0 olan ödül almaz. Herkesin toplamı aynıysa (ör. herkes her dalgayı doğru kesti) **herkes +1** alır
  (ekip başarısı ödüllendirilir, "herkes eşit, kimse almaz" olmaz).
- Sonuç ekranında imha puanları dalga dalga gösterilir.

### KP-M5 · Kurallardaki "nabız" maddesi kaldırılsın — **önerim: EVET**
**Ne:** KURALLAR'daki "doğru koşul sesli söylenince kablo nabız atar" maddesi kaldırılır (uygulanamaz: sistem konuşmayı
duymaz). Yerine KP-M3'ün saat tepkisi geçer.
**Neden:** Kural metni ile oyunun bire bir aynı olması.

### KP-M6 · Gizli sabotajcı — **önerim: HAYIR (isteğe bağlı)**
**Ne:** 5+ oyuncuda bir oyuncu gizlice sabotajcıdır: taşıdığı ipucu yanlış rengi söyler. Hedefi yanlış keserse
sabotajcı puan alır; maç sonunda herkes sabotajcıyı tahmin eder.
**Neden:** Sosyal çıkarım ve "notuna güvenebilir miyim?" gerilimi.
**Neden önermiyorum:** Oyunun özü "birbirine güvenip konuşarak çözmek". Sabotajcı bunu tersine çevirir ve Sızma,
Gizli Hırsız gibi oyunlarla aynı türe kayar; oyun kimliğini kaybeder. M1–M3 kaosu zaten getiriyor.

---

## 4. Arayüz ve his önerileri

### KP-U1 · Gerçek bomba — **önerim: EVET** · 🎨 Görsel
- Ekranın üstünde **bomba gövdesi**: kırmızı dijital saat (7 segmentli rakamlar, saniye ve salise), yanıp sönen LED,
  vidalar, kablolar bombaya bağlı.
- Saat her saniye **tik** sesi çalar; son 10 sn'de tik hızlanır, saat kırmızı nabız atar, telefon her saniye hafif
  titrer.
- Yanlış kesimde (KP-M3) saat 5 sn atlarken "bzzzt" sesi, ekran kısa kırmızı flaş.
- 🎨 Gereken: bomba gövdesi görseli (saat alanı CSS ile çizilir).

### KP-U2 · Basılı tutarak kes (pense) — **önerim: EVET** · 🎨 Görsel
- "Seç + KES düğmesi" yerine **kabloya basılı tut**: parmağın altında pense açılır, **0,6 sn** boyunca kapanır
  (dolum halkası), bitince kablo **kopar**: kıvılcım, kopma sesi, güçlü titreşim, kablonun iki ucu sarkar.
- Parmağını erken çekersen iptal (yanlışlıkla kesme önlenir). Bugünkü "geri alınamaz" kuralı aynen.
- Doğru/yanlış kesimde hemen bir şey gösterilmez (sonuca kadar gizli, bugünkü gibi); yalnız yanlışsa KP-M3'teki
  saat atlaması herkes için olur.
- 🎨 Gereken: pense görseli (açık/kapalı), kopuk kablo uçları.

### KP-U3 · İpucu notu gerçek bir kâğıt — **önerim: EVET** · 🎨 Görsel
- Not, buruşuk bir **kâğıt parçası** gibi; el yazısına yakın bir yazı tipi, kenarında bant.
- Başlıkta yanıp sönen **🎤 "Sesli oku"** rozeti; nota dokununca kâğıt büyür (masada okunacak kadar büyük yazı).
- Mini panel çizimi korunur (renk körlüğü modu dahil).
- 🎨 Gereken: kâğıt dokusu ve bant (tek görsel).

### KP-U4 · Sonuç: zincir açılışı — **önerim: EVET**
Dalga sonu ve oyun sonu sonuçları "kim kimin panelini anlatıyordu" zincirini gösterir:
- Oyuncular **çember şeklinde** dizilir. Sırayla: taşıyıcıdan hedefe bir **ışık kablosu** uzanır, hedefin kesimi
  açılır: doğruysa yeşil "İMHA EDİLDİ" ve iki uçta +1 parlar; yanlışsa küçük duman ve kırmızı ✗.
- Zincir tamamlanınca herkes doğruysa ekran yeşile döner: **"BOMBA İMHA EDİLDİ"**.
- Oyun sonunda üç dalganın imha puanları sütun sütun dolar, ardından +2/+1 dağıtılır (KP-M4).
- Kendi satırın parlar, puanın üstteki puan yazısına uçar.

### KP-U5 · İzleyici ve TV — **önerim: EVET**
- İzleyici/TV ekranında büyük **bomba saati**, dalga numarası ve kimin kestiği (makas simgesi) görünür.
- Yanlış kesimde saat atlaması TV'de de görünür (izleyenler de "biri yanlış kesti!" der).
- Paneller ve ipuçları yine gösterilmez (oyunu bozmasın diye).

### KP-U6 · Ses ve titreşim seti — **önerim: EVET**
Tik (hızlanan), kablo kopma, kıvılcım, saat atlaması "bzzzt", dalga geçişi alarmı, imha edildi zili, sonda tüm bomba
imha edilirse kısa zafer müziği.

---

## 5. Yapay zekâ (AI) ile yapılabilecekler

### KP-AI1 · İpucunu doğal dille söylesin — **önerim: HAYIR**
**Ne:** İpuçları yapay zekâyla "Eğer en tepedeki kablo çimen yeşiliyse…" gibi her maç farklı cümlelerle yazılır.
**Neden önermiyorum:** Bu oyunda ipucunun **kesin doğru** olması şart. Yapay zekânın yazdığı cümlenin anlamı ile
sistemin hesapladığı koşulun bire bir aynı olduğunu her seferinde güvenle denetleyemeyiz; tek bir yanlış cümle oyunu
bozar. KP-M2'deki ipucu türleri çeşitliliği yapay zekâsız ve kesin doğru sağlar.

### KP-AI2 · Bomba uzmanı yorumu — **önerim: İSTEĞE BAĞLI**
**Ne:** Oyun sonunda "bomba uzmanından" tek cümlelik esprili özet: "Mert üç dalgada üç kez maviyi kesti, mavi onun
için bir yaşam tarzı." Gizli Alışveriş'teki esnaf yorumcuyla aynı altyapı (hata olursa yorum görünmez, oyun
beklemez, yasaklı kelime süzgeci).

---

## 6. Önerilen paket

**KP-M1, KP-M2, KP-M3, KP-M4, KP-M5 ve KP-U1 … KP-U6 hepsi.** Yapay zekâ maddeleri pakete dahil değildir.

Bu paketle oyun şöyle akar: bomba saati 25'ten geri sayar → herkes buruşuk notunu sesli okur, masada bağırış başlar →
biri aceleyle yanlış keser, saat 5 sn atlar, "kim kesti?!" → dalga sonu zincir açılır → dalga 2'de "değilse",
"yan yanaysa" ipuçları kafa karıştırır → dalga 3'te mor kablo ve 20 saniye → final zinciri ve +2/+1.

**Değişen kurallar (paket onaylanırsa):** 3 dalga (25/25/20 sn), dalga 3'te 5 kablo (mor), yeni ipucu türleri,
yanlış kesim ortak saatten 5 sn düşer (en az 3 sn kalır), puan: toplam imha puanına göre +2/+1/0 (herkes eşitse
herkes +1), "nabız" maddesi kalkar. `docs/KURALLAR.md`, wiki ve testler buna göre güncellenir.

**Değişmeyenler:** 2–8 oyuncu, ipucu zinciri (kimse kendi panelinin notunu taşımaz), her ipucunun yalnız hedef panele
uyması, dalga başına tek ve geri alınamaz kesim, doğru kesimde hem kesen hem taşıyıcı kazanır, renk körlüğü modu.

**🎨 Yeni görsel gerekenler (paket):** bomba gövdesi, pense (açık/kapalı) ve kopuk kablo uçları, kâğıt not dokusu,
mor kablo (mevcut kablo görselinin renk varyantı).
