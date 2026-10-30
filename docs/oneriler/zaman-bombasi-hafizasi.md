# Zaman Bombası Hafızası — geliştirme önerileri

Bu dosya onay içindir. Her maddenin bir kodu var (ör. **ZB-M2**). Cevabını tek satırda verebilirsin:

> ZB-M1 evet, ZB-M2 hayır, ZB-U3 evet …

ya da yalnız **"önerilen paket evet"** dersen sondaki paket uygulanır. Her maddenin "ayrıntılar" bölümü onaylarsan
nasıl yapılacağını kesinleştirir; ek soru sormam gerekmez. Beğenmediğin ayrıntı varsa yalnız onu yaz.

Not: Sonuç ekranı herkes **"Devam et"** deyince geçer (en çok 60 sn). Yeni görsel gerektiren maddeler **🎨 Görsel**
diye işaretli.

---

## 1. Bugünkü oyun (özet)

- 2–8 oyuncu, sabit bir sırayla dönülür. 4 renkli tuş (kırmızı, mavi, yeşil, sarı).
- Her sırada dizi herkese oynatılır; sırası gelen oyuncu aynı diziyi hafızadan girer
  (süre: 1,5 sn + dizi uzunluğu × 1 sn).
- Doğru girerse dizi 1 renk uzar, sıra sonrakine geçer.
- Yanlış basan ya da geç kalan elenir: o **−1**, hâlâ oyunda olan herkes **+1**; dizi yeni 2 renge döner.
- 60. saniyeden sonra "ani ölüm": dizi her seferinde 2 renk uzar.
- Oyuncuların yarısı elenince ya da 90 sn dolunca biter.

## 2. Gördüğüm sorunlar

**Oyun tasarımı**
1. **Sıra sende değilken yapacak bir şey yok.** 8 kişide sıran 7 sıra sonra geliyor. O arada yalnız izliyorsun;
   telefon elde ama oyun yok.
2. **Puanlar pasif ve büyük.** Hayatta kalmak için bir şey yapman gerekmiyor; başkası elendikçe +1 topluyorsun.
   8 kişide hayatta kalan 4 kişi +4 alıyor. Bu, diğer oyunların çoğundan (en çok +2) çok fazla; bu oyun genel
   skoru tek başına belirleyebiliyor.
3. **Oyuncular arası etkileşim yok.** Sıra sabit, dizi rastgele. Kimse kimseye "dur sana bir oyun oynayayım"
   diyemiyor. Bomba teması var ama bombayı birine "atmak" yok.
4. **Tema zayıf.** Bomba yalnız ortadaki küçük sayaç halkası. Ekran, bilinen "Simon" tuş takımı gibi.

**Arayüz**
5. **Sıra değişimi fark edilmiyor.** Sıranın sana geldiği yalnız başlıktaki yazıyla anlaşılıyor; dalgın oyuncu
   süresini kaçırıp eleniyor.
6. **Dizi uzunluğu küçük noktalarla gösteriliyor;** "şu an 7'lik dizi" gerilimi hissedilmiyor.
7. **TV ekranında alan boşa gidiyor:** tuşlar küçük, oyuncu listesi dar, ekranın büyük kısmı boş.

---

## 3. Oyunu değiştiren öneriler (mekanik)

### ZB-M1 · Bombayı at: sırayı sen seçersin — **önerim: EVET**
**Ne:** Diziyi doğru giren oyuncu, **bombayı kime atacağını kendisi seçer** (sırası geçecek kişiyi). Sabit sıra
kalkar.
**Neden:** Sorun 1 ve 3. Oyun bir anda sosyal olur: zor bir diziyi hafızası zayıf arkadaşa atmak, intikam almak,
"bana atma!" yalvarışları. Kimse "sıram çok sonra" diye kopamaz, çünkü her an sana gelebilir.
**Ayrıntılar:**
- Doğru girişten sonra sırası bitenin ekranında 4 sn'lik "Kime atıyorsun?" seçimi çıkar (aktif oyuncuların
  avatarları). Seçmezse sistem rastgele seçer.
- **Kendine atamazsın.** Bombayı az önce sana atan kişiye **hemen geri atamazsın** (ping-pong engeli; 3 kişi ve
  üstünde). 2 kişide bu kural yok.
- Elenme olursa dizi 2 renge döner ve bombayı **elenenden sonraki** kişi değil, elenene bombayı atan kişi
  seçer ("seçimin işe yaradı, bir daha seç").
- Seçim süresi oyun saatinden düşer (90 sn sınırı aynı).

### ZB-M2 · Rengi sen eklersin — **önerim: EVET**
**Ne:** Diziyi doğru giren oyuncu, diziye eklenecek **yeni rengi kendisi seçer** (bugün rastgele).
**Neden:** Bombayı atarken bir de tuzak kurarsın: "kırmızı, kırmızı, kırmızı" gibi tekrarlar ya da karışık bir
geçiş. Masada "bak şimdi ne ekliyorum" anı doğar. ZB-M1 ile birlikte en eğlenceli hâlini alır.
**Ayrıntılar:**
- ZB-M1'deki 4 sn'lik ekranda önce renk seçilir (4 tuştan birine dokun), sonra kime atılacağı.
- Ani ölümde (+2 renk) birini oyuncu seçer, ikincisini sistem rastgele ekler.
- Elenme sonrası yeni 2 renk yine rastgeledir.
- Seçilmezse rastgele.

### ZB-M3 · Puanlama sadeleşsin ve dengelensin — **önerim: EVET**
**Ne:** Biriken "+1"ler kalkar. Oyun sonunda:
- **Hayatta kalanlar +2.**
- **İlk elenen −1.**
- Diğer elenenler **0**.
**Neden:** Sorun 2. Puan aralığı diğer oyunlarla aynı olur (−1…+2); hayatta kalmanın değeri korunur, "başkası
elendi diye puan toplama" biter. İlk elenenin cezası gerilimi sürdürür.
**Ayrıntılar:**
- 2 oyuncuda: hayatta kalan +2, elenen −1. Kimse elenmeden 90 sn dolarsa herkes +1 ("herkes dayandı").
- Süre dolduğunda giriş yapmakta olanın sırası bugünkü gibi cezasız iptal edilir.
- Maç kartlarında "birinci" = hayatta kalanlar, "sonuncu" = ilk elenen.

### ZB-M4 · Tahmin et: izleyen oyuncular bahse girer — **önerim: EVET**
**Ne:** Sırası gelen oyuncu diziyi girerken, aktif diğer oyuncular ekranlarında **"Başaracak ✓ / Patlayacak ✗"**
tahmini yapar. Oyun sonunda **en çok doğru tahmin eden(ler) ek +1** alır.
**Neden:** Sorun 1'in ikinci yarısı: sıran gelmese de her sırada bir karar verirsin. Elenenler de tahmin
yapmaya devam eder (oyundan kopmazlar).
**Ayrıntılar:**
- Tahmin, oynatma ve girişin ilk 1,5 saniyesi boyunca açıktır; sonra kilitlenir (sonucu görerek tahmin edilemez).
- Elenen oyuncular da tahmin yapar (ek +1'i onlar da kazanabilir; ilk elenen −1'ini kapatabilir).
- Kimin ne tahmin ettiği sıra bitene kadar gizli; sıra bitince "4 kişiden 3'ü başaracak dedi" gösterilir.
- Hiç tahmin yapmayan ek puan almaz. En çok doğru tahminde eşitlik varsa hepsi +1; en çok doğru 0 ise kimse almaz.

### ZB-M5 · Ters dizi (ani ölüm sürprizi) — **önerim: HAYIR (isteğe bağlı)**
**Ne:** Ani ölümde rastgele bazı sıralarda dizi **tersten** girilir ("TERS!" uyarısıyla).
**Neden önermiyorum:** M1 + M2 zaten zorluğu oyuncuların eline veriyor; üstüne sistem sürprizi eklemek karmaşa
yaratır. Oynandıktan sonra gerekirse eklenir.

---

## 4. Arayüz ve his önerileri

### ZB-U1 · Gerçek bomba — **önerim: EVET** · 🎨 Görsel
- Tuş takımının ortasında küçük halka yerine **fitilli bir bomba**: giriş süresi fitilin yanmasıyla gösterilir
  (fitil kısalır, kıvılcım ilerler, son 2 sn'de kıvılcım hızlanır ve tik sesi sıklaşır).
- Bomba, sırası gelenin avatarının yanında durur; **ZB-M1 ile** bomba seçilen kişiye doğru ekranın içinde
  **fırlatılır** (yay çizerek uçar).
- 🎨 Gereken: bomba gövdesi (fitilsiz), fitil ve kıvılcım (CSS ile de yapılabilir).

### ZB-U2 · Sıra sana geldiğinde kaçırma — **önerim: EVET**
- Sıra sana geçtiği an (ZB-M1 ile kime geleceği önceden belli olmadığı için asıl uyarı bu andır): ekran kenarları
  yanar, telefon **güçlü titrer**, büyük "SIRA SENDE!" bandı yukarıdan iner, avatarın büyür. Dizi oynatması bu
  uyarıdan sonra başlar, böylece kimse oynatmayı kaçırmaz.
- Uygulama arka plandaysa bugünkü "Sıra sende!" bildirimi aynen.

### ZB-U3 · Dizi oynatma ve uzunluk — **önerim: EVET**
- Her ışık yandığında tuş **büyür ve tüm panel o renkte kısa parlar**; nota sesi daha dolgun.
- Ekranın üstünde büyük **"DİZİ 7"** sayacı; dizi uzadıkça sayı büyüyerek değişir, 8 ve üstünde turuncu, 12 ve
  üstünde kırmızı.
- Noktalar daha büyük; doğru basılan nokta yeşil dolar.

### ZB-U4 · Doğru giriş anı — **önerim: EVET**
- Her doğru basışta tuş nabız atar ve nota çalar; dizi tamamlanınca yeşil şok dalgası, **"TEMİZ!"** ve diziye yeni
  noktanın eklenmesi animasyonu.
- (ZB-M1/M2 ile) ardından "Rengi seç → Kime atıyorsun?" ekranı.

### ZB-U5 · Elenme anı — **önerim: EVET**
- Bugünkü patlama ve çatlak korunur; ek olarak alt şeritte elenenin avatarı **patlamayla savrulur ve gri olur**,
  ekran kısa sarsılır.
- (ZB-M4 ile) "Tahmin tuttu!" diyenlerin avatarlarında kısa ✓ parıltısı.

### ZB-U6 · Ani ölüm girişi — **önerim: EVET**
60. saniyede ekran kırmızıya döner, büyük **"ANİ ÖLÜM"** bandı, arka planda hızlanan tik/nabız müziği; ani ölüm
boyunca kenarlarda kırmızı titreşim.

### ZB-U7 · Bekleyenler ve tahmin ekranı — **önerim: EVET**
- Sıran değilken tuşlar soluk durur ama ekran boş kalmaz: (ZB-M4 ile) altta büyük **✓ Başaracak / ✗ Patlayacak**
  düğmeleri, üstte sırası gelenin büyük avatarı ve fitilli bomba.
- Elenmişken aynı ekran "Elendin · Tahmin yapmaya devam et" başlığıyla.

### ZB-U8 · TV ekranı yeniden düzen — **önerim: EVET**
TV'de tuş takımı ekranın sol yarısını kaplar, sağda büyük oyuncu sütunu (avatar, isim, durum: aktif / elendi /
sırada); bomba sırası gelenin kartında; ani ölümde tüm ekran kırmızı kenar. Boş alan kalmaz.

### ZB-U9 · Ses ve titreşim seti — **önerim: EVET**
Tuş notaları (daha dolgun), fitil cızırtısı ve hızlanan tik, "TEMİZ!" zili, bomba fırlatma "vuuş", patlama,
ani ölüm alarmı, tahmin tuttu "ding".

---

## 5. Yapay zekâ (AI) ile yapılabilecekler

### ZB-AI1 · Bomba spikeri — **önerim: İSTEĞE BAĞLI**
Oyun sonunda tek cümlelik esprili özet: "Mert bombayı üç kez Elif'e attı; Elif sonunda dördüncüde patladı ve
hâlâ Mert'e bakıyor." Ortak yapay zekâ yorum altyapısıyla (API bağlanınca açılır, hata olursa görünmez, oyun
beklemez, yasaklı kelime süzgeci). Modele yalnız sıra geçmişi, kim kime attı ve elenmeler gider.

---

## 6. Önerilen paket

**ZB-M1, ZB-M2, ZB-M3, ZB-M4 ve ZB-U1 … ZB-U9 hepsi.** (ZB-M5 ve yapay zekâ pakete dahil değil.)

Bu paketle oyun şöyle akar: dizi oynatılır, herkes "başaracak mı?" tahminini yapar → sırası gelen fitil yanarken
girer → başarırsa rengi seçip bombayı birine fırlatır ("bana atma!") → biri patlarsa dizi sıfırlanır, bombayı
atan yeni kurbanı seçer → 60. saniyede ANİ ÖLÜM → sonda hayatta kalanlar +2, ilk elenen −1, en iyi tahminci +1.

**Değişen kurallar (paket onaylanırsa):** sabit sıra yerine bombayı doğru girenin seçtiği kişiye atma (kendine ve
hemen geri atma yok), eklenen rengi doğru giren seçer, puan: hayatta kalan +2 / ilk elenen −1 / diğer elenenler 0
(kimse elenmezse herkes +1), tahmin bonusu (+1). `docs/KURALLAR.md`, wiki ve testler buna göre güncellenir.

**Değişmeyenler:** 2–8 oyuncu, 4 renk, giriş süresi (1,5 sn + uzunluk × 1 sn), yanlış basış ya da geç kalma =
elenme, elenmede dizinin 2 renge dönmesi, ani ölüm (60 sn sonrası +2 renk), oyuncuların yarısı elenince ya da 90 sn'de
bitiş, renk körü modu.

**🎨 Yeni görsel gerekenler (paket):** fitilli bomba (gövde + fitil + kıvılcım).
