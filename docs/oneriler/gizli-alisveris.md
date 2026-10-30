# Gizli Alışveriş — geliştirme önerileri

Bu dosya onay içindir. Her maddenin bir kodu var (ör. **GA-M2**). Cevabını tek satırda verebilirsin:

> GA-M1 evet, GA-M2 hayır, GA-U3 evet …

ya da yalnız **"önerilen paket evet"** dersen sondaki paket uygulanır. Her maddede "ayrıntılar" bölümü, onaylarsan
nasıl yapılacağını kesinleştirir; sana ek soru sormam gerekmesin diye tüm kararlar orada önceden verilmiştir.
Beğenmediğin bir ayrıntı olursa yalnız onu yaz.

---

## 1. Bugünkü oyun (özet)

- 3–8 oyuncu, herkese gizli **60 kredi**, herkes aynı **12 ürünlük** raftan alır (fiyatlar 8–36, sabit).
- Her üründen bir tane; bütçe aşılamaz (en çok 4 ürün sığar). **30 sn** alışveriş, "Tamam" ile erken bitiş.
- Ürünün değeri = **fiyat ÷ o ürünü alan kişi sayısı**. Sepet değeri en yüksek olan **+1**, diğerleri 0.
- Sonuç (8 sn): raf kepengi açılır → ürün başına "N kişi" ve bölünmüş değer → sepet sıralaması.

## 2. Gördüğüm sorunlar

**Oyun tasarımı**
1. **Oyun "çözülüyor".** Fiyatlar her maçta aynı. Birkaç maç sonra herkes aynı mantığa varıyor ("36 + 24 al",
   "ucuzlardan kaç"). Raf sırası karışıyor ama değerler aynı, yani karar her maç aynı.
2. **30 saniye boyunca etkileşim yok.** Herkes kendi rafına bakıyor, kimse kimseyi okuyamıyor. Blöf ya da
   "acaba o ne aldı" anı yok. Gerilim yalnız sonuçta.
3. **Puan çok düz.** Yalnız birinci +1, gerisi 0. İkinci olmanın ya da çok kötü bir sepetin hiçbir anlamı yok.
   Sonuncu olsan bile 0 aldığın için risk almanın bedeli yok.
4. **Hep 3–4 ürün.** Bütçe 60, ürünler 8–36: seçenek dar. Tek pahalı ürünle 2 ucuz ürün arasında gerçek bir
   ikilem nadiren oluşuyor.

**Arayüz**
5. **Seçilmemiş ürünler gri ve cansız.** Raf, "satın alınamaz" gibi görünüyor; renk yalnız seçince geliyor.
   Mağaza hissi yok.
6. **Ürün görselleri küçük.** Kartın çoğu boşluk; isim ve fiyat görselden büyük.
7. **Sepet hissi yok.** Ürün eklemek yalnız kartta bir tik ve sayıda değişiklik. Bir şeyin "sepete girdiği"
   görünmüyor.
8. **Sonuç düz bir liste.** Kepenk açılışı iyi bir fikir ama sıralama ekranı statik; "kim neyi aldı", "kim kimle
   çakıştı" dramatik değil.
9. **Bekleme ekranı boş.** Tamam deyince oyuncu 20 saniye boyunca soluk bir rafa bakıyor.

---

## 3. Oyunu değiştiren öneriler (mekanik)

### GA-M1 · Her maç farklı raf — **önerim: EVET**
**Ne:** Ürün havuzu 12'den **20 ürüne** çıkar. Her maçta bunlardan **12'si** rafa gelir ve **fiyatları her maçta
±%30 oynar** (ör. Mini Drone bir maçta 26, bir maçta 38).
**Neden:** Oyunun çözülmesini (sorun 1) engeller. Her maç yeni bir hesap.
**Ayrıntılar:**
- 8 yeni ürün eklenir (oyunun neon/arcade temasına uygun, ör. Lazer Kalem, Mini Robot, Neon Kaykay, Hologram Saat,
  Ses Kartı, Retro Joystick, VR Gözlük, Plazma Lamba). Görselleri mevcut 12 ürünle aynı tarzda üretilir.
- Fiyatlar her zaman tam sayı, 6–40 arası. **Sahip kararı (uygulamada):** ürün sayısı sınırı yok; tek sınır bütçe
  (60 kredi) ve her üründen bir tane. Önerideki "en ucuz 5 ürünün toplamı 60'ı geçer" şartı kaldırıldı.
- Raf herkes için aynıdır (adalet bozulmaz).

### GA-M2 · Gizli kupon — **önerim: EVET**
**Ne:** Alışveriş başında herkese **gizli bir kupon** verilir: rastgele bir üründe **%50 indirim**. Kuponu
yalnız sen görürsün; o ürün kartında "Kuponun var: 14 yerine 7" yazar.
**Neden:** Herkesin aynı mantığa varmasını kırar, sepetler çeşitlenir. "Herkes ucuz diye bunu alacak, ben kuponlu
pahalıyı alayım" ikilemi doğar. Sonuçta "ha, onun kuponu Drone'daymış" anı eğlenceli.
**Ayrıntılar:**
- Kupon yalnız **ödenen fiyatı** düşürür (bütçeye daha çok sığar); ürünün **değeri** yine tam fiyat ÷ alıcı
  sayısıdır.
- İki oyuncuya aynı ürünün kuponu düşmez (8 oyuncuya 8 farklı ürün).
- Kuponu kullanmak zorunlu değil.
- Sonuç ekranında herkesin kuponu açıklanır (kart üstünde küçük kupon etiketi).

### GA-M3 · Vitrin fısıltısı (yarı yolda ipucu) — **önerim: EVET**
**Ne:** Alışverişin **15. saniyesinde** raftaki her ürünün üstünde **anlık talep ateşi** belirir: 🔥 (çok kişinin
sepetinde), 🔥🔥, 🔥🔥🔥 gibi. Kimin aldığı ve tam sayı gösterilmez.
**Neden:** 30 saniyelik sessizliği (sorun 2) kırar. Oyun ikiye bölünür: önce tahmin, sonra tepki. İpucu
gelince herkes sepetini yeniden düşünür, birbirini okumaya başlar. Blöf de doğar: başta bilerek popüler ürünü
alıp sonra bırakmak.
**Ayrıntılar:**
- Ateş, o andaki sepetlere göre 3 seviyedir: o ürünü sepetinde tutan oyuncu oranı (0: hiç ateş yok, ≤%25: 🔥,
  ≤%50: 🔥🔥, >%50: 🔥🔥🔥). Bir kez gösterilir, 15. saniyedeki duruma göre donar (sürekli güncellenmez).
- 15. saniyede ekranda kısa bir "Vitrin fısıldıyor…" geçişi ve ses olur.
- Kendi seçimin de bu sayıma dahildir.
- Bu, bugünkü "sepetler süre bitene kadar gizli" kuralını yumuşatır; tam sepetler yine gizlidir.

### GA-M4 · Daha anlamlı puanlama — **önerim: EVET**
**Ne:** En değerli sepet **+2**, ikinci **+1**, **en değersiz sepet −1**.
**Neden:** Sorun 3. İkinci olmak anlam kazanır; hiç düşünmeden boş geçmenin ya da herkesle aynı şeyi almanın bir
bedeli olur.
**Ayrıntılar:**
- Eşitlikler: birincide eşitlik varsa hepsi +2, o zaman ikinci sıra yine +1 alır (sıralamada sonraki farklı değer).
  En değersizde eşitlik varsa hepsi −1.
- Sepet boşsa değer 0; en değersiz sayılır ve −1 alır (boş geçmek artık bedava değil).
- Herkesin değeri aynıysa (ör. herkes aynı sepeti aldı) kimse puan almaz.
- 3 oyuncuda: +2 / +1 / −1. Bir oyuncu hem ödül sırasında hem en değersizse (ör. 3 kişide iki kişi birinci
  olursa üçüncü kişi hem "ikinci" hem "en değersiz" olur) ceza uygulanmaz, +1 alır: ödül cezadan önce gelir.
- Maç kartları yeni puanlarla çalışır (Çift Puan +2'yi +4 yapar vb.).

### GA-M5 · Tekel bonusu — **önerim: HAYIR (isteğe bağlı)**
**Ne:** Kimsenin almadığı bir ürünü **tek başına** alırsan o ürünün değeri **%50 artar** (fiyat × 1,5).
**Neden:** Cesur, farklı seçimi ödüllendirir.
**Neden önermiyorum:** M1 + M2 zaten çeşitliliği getiriyor. Üst üste binince hesap oyuncuya karışık gelir
("÷ alıcı" + "×1,5" + kupon). M1–M4 oynandıktan sonra gerekirse eklenir.

### GA-M6 · Sabotaj etiketi — **önerim: HAYIR (isteğe bağlı)**
**Ne:** Herkesin elinde tek kullanımlık bir "ZAM" etiketi olur; gizlice bir ürüne yapıştırırsın, o ürünün
sonuçtaki değeri yarıya iner (onu alan herkes için).
**Neden:** Doğrudan etkileşim ve "beni kim batırdı" anı.
**Neden önermiyorum:** 30 saniyeye çok şey sığdırır; oyuncu hem alışveriş hem sabotaj düşünmek zorunda kalır.
Gizli Alışveriş'in güzelliği sade olması. Kara Borsa gibi başka bir oyunda daha iyi oturur.

---

## 4. Arayüz ve his önerileri

### GA-U1 · Gerçek mağaza rafı — **önerim: EVET**
- Seçilmemiş ürünler **renkli** gösterilir (bugün gri). Soluk yalnız bütçe yetmeyen ürünler olur; böylece "alınamaz"
  ile "seçilmedi" karışmaz.
- Ürün görselleri **%40 daha büyük**; isim küçülür, fiyat görselin altında etiket gibi durur.
- Raf, gerçek bir mağaza rafı gibi çizilir: her sıranın altında neon raf tahtası, ürünler hafif yukarı aşağı
  "nefes alır" (sırayla, yorucu olmayacak kadar yavaş).
- Fiyat etiketi gerçek etiket gibi (köşesi delikli, iple asılı).

### GA-U2 · Ürün sepete uçsun — **önerim: EVET**
- Ürüne dokununca görselin küçük bir kopyası **ekranın üstündeki sepete uçar** (yay çizerek), sepet hafifçe sallanır,
  "kasa" sesi (tık + yazar kasa çıngırağı) ve hafif titreşim.
- Çıkarırken ürün sepetten rafa geri süzülür.
- Üstte bugünkü "3 ürün" sayısı yerine **küçük bir sepet şeridi**: aldığın ürünlerin minik görselleri yan yana.
- Kalan bütçe sayısı değişirken sayılar hızla döner (60 → 36 gibi), düşük bütçede sayı turuncuya döner ve hafifçe
  titrer.

### GA-U3 · Son 10 saniye gerilimi — **önerim: EVET**
- Son 10 saniyede süre çubuğu kırmızılaşır ve nabız atar, her saniye hafif bir tik sesi.
- Son 3 saniyede "Kasa kapanıyor!" yazısı ve kepengin ekranın üstünden biraz inmesi (raf hâlâ kullanılabilir).
- Tamam dememiş oyuncunun avatarı alttaki hazır listesinde hafifçe sallanır (herkes kimin beklettiğini görür).

### GA-U4 · Bekleme ekranı (Tamam sonrası) — **önerim: EVET**
- Tamam deyince raf kararır, ortaya **paketlenmiş sepetin** büyük görseli gelir (ürünlerin üst üste dizildiği bir
  alışveriş poşeti) ve üstüne "Sepetin kesinleşti" damgası basılır.
- Altta diğer oyuncuların avatarları; Tamam diyenin avatarı üstüne küçük bir poşet düşer.

### GA-U5 · Sonuç: sahne sahne açılış — **önerim: EVET**
Sonuç süresi **8 sn'den 12 sn'ye** çıkar (açılış sahneleri sığsın diye). Akış:
1. **Kepenk (0–1 sn):** gürültülü metal kepenk sesiyle yukarı kalkar (bugünkü fikrin büyütülmüşü).
2. **Ürün ürün çakışma (1–5 sn):** her ürünün üstünde onu alanların **avatarları** belirir. Çok kişinin aldığı
   üründe fiyat etiketi "÷3" diye **parçalara bölünür** (kırılma efekti ve sesi). Tek kişinin aldığı üründe etiket
   **altın parlar**: "TEK BAŞINA!". Kimsenin almadığı ürün tozlu kalır.
3. **Sepetler (5–10 sn):** oyuncular **en değersizden en değerliye** doğru tek tek açılır; her satırda ürünler
   sırayla sepete düşer, değer sayacı yükselir. Son açılan birinci olur: konfeti, "EN DEĞERLİ SEPET" damgası.
4. **Puanlar (10–12 sn):** puanlar (+2/+1/−1) satırlardan ekranın üstündeki puan yazısına uçar. Kendi satırın
   parlar.
- (GA-M2 onaylanırsa) her oyuncunun kuponu satırında küçük etiketle görünür.

### GA-U6 · Ses ve titreşim seti — **önerim: EVET**
Mağaza temasına özel sesler: sepete ekleme (kasa tıkı), çıkarma (geri tıkı), bütçe yetmedi (boğuk "bip"), son 10 sn
tik, kepenk, değer bölünmesi (cam kırılması), tek başına (altın çınlama), kazanma (kasa çekmecesi açılması + konfeti).

### GA-U7 · İzleyici ve TV — **önerim: EVET**
- İzleyici/TV ekranında raf "vitrin" olarak büyük gösterilir; ürünler nefes alır, Tamam diyenlerin avatarlarının
  üstüne poşet düşer.
- (GA-M3 onaylanırsa) 15. saniyedeki talep ateşi TV'de de görünür (yine kimin aldığı yok).

---

## 5. Yapay zekâ (AI) ile yapılabilecekler

Bu bölüm isteğe bağlıdır; önerilen pakete dahil değildir. Hepsi sunucuda, maç sırasında çağrılan hızlı bir Claude
modeliyle (Haiku sınıfı) çalışır. Ortak kurallar:
- Yapay zekâ **puanı ve kuralı asla belirlemez**; yalnız metin üretir. Puanlar bugünkü gibi kesin hesapla verilir.
- Yanıt 2 sn içinde gelmezse ya da hata olursa hazır şablon metin gösterilir; oyun hiç beklemez.
- Modele yalnız oyun bilgisi gider (takma adlar, ürünler, değerler); e-posta ya da hesap bilgisi gitmez.
- Üretilen metin, mevcut yasaklı kelime süzgecinden geçer; uygunsuzsa şablon metin kullanılır.
- Gereken: sunucuya bir Claude API anahtarı (yalnız sunucudaki gizli ayar dosyasında durur). Maliyet maç başına
  kuruşlar düzeyindedir.

### GA-AI1 · Esnaf yorumcu — **önerim: EVET (AI açılırsa)**
**Ne:** Sonuçta, sepetler açılırken her oyuncunun satırına mağazanın esnafından **tek cümlelik esprili yorum**
gelir. Örnekler: "Kaan yine Gizli Sandık'a çöktü, üç kişiyle paylaştı, sandık boş çıktı." · "Elif tek başına Drone
aldı, cesaretin bedeli 32 kredi." · "Mert'in sepeti boş: vitrine bakıp çıktı."
**Neden:** Sonuç ekranını kişiselleştirir, her maç farklı konuşulacak bir an yaratır. Grup içi şakaya dönüşür.
**Ayrıntılar:** sonuç hesaplanır hesaplanmaz tek istekte tüm oyuncuların yorumu istenir (sepetler açılmadan önceki
1–2 sn içinde hazır olur). Ton: şakacı, kırıcı değil; küfür ve kişisel hakaret yok. Yorum en çok 90 karakter.
Gelmezse satırda yorum alanı hiç görünmez.

### GA-AI2 · Fısıldayan vitrin (GA-M3'ün sözlü hâli) — **önerim: İSTEĞE BAĞLI**
**Ne:** GA-M3'teki 15. saniye ipucu, ateş simgelerine ek olarak esnafın **muğlak bir cümlesiyle** gelir: "Bugün
herkes elektronik peşinde…" · "Pahalı raf pek ilgi görmüyor, ucuzlar kapış kapış."
**Neden:** İpucunu oyunun içine yerleştirir; aynı veri her maç farklı söylenir.
**Ayrıntılar:** modele yalnız ürün başına ateş seviyesi gider (kim ne aldı gitmez), yani bilgi sızıntısı GA-M3'ten
fazla olmaz. Cümle gelmezse yalnız ateş simgeleri görünür.

### Yapay zekâ gerektirmeyenler (bilgi)
- **Boş koltuğa bot:** oyun 3 kişiyle başlıyor; 2 kişi kaldığında bir bot alışveriş yapsa oyun oynanabilir.
  Bunun için yapay zekâ gerekmez, basit kurallı bir bot yeterli ve daha güvenilir. İstersen ayrıca önerilir.
- **Ürün adı/görsel üretimi:** GA-M1'deki yeni ürünler bir kez tasarlanıp oyuna eklenir; maç sırasında üretmeye
  gerek yok.

## 6. Önerilen paket

**GA-M1, GA-M2, GA-M3, GA-M4 ve GA-U1 … GA-U7 hepsi.** Yapay zekâ maddeleri (GA-AI1, GA-AI2) pakete dahil değildir;
istersen ayrıca onaylarsın.

Bu paketle oyun şöyle akar: her maç farklı bir raf ve herkesin kendi gizli kuponu → ilk 15 saniye tahmin →
"vitrin fısıldıyor" ile hangi ürünün kalabalık olduğu kabaca belli olur → son 15 saniye blöf ve sepeti değiştirme
→ kepenk açılır, ürün ürün çakışmalar, sepetler sondan başa açılır → +2 / +1 / −1.

**Değişen kurallar (paket onaylanırsa):** ürün havuzu ve fiyatlar maç başına değişir; gizli kupon; 15. saniyede
talep ateşi; puanlama +2/+1/−1 (boş sepet de −1 alabilir); sonuç süresi 12 sn. Bunlar uygulanırken
`docs/KURALLAR.md`, wiki ve testler de güncellenir.

**Değişmeyenler:** 3–8 oyuncu, 60 kredi, her üründen bir tane, değer = fiyat ÷ alıcı sayısı, 30 sn alışveriş,
Tamam ile erken bitiş, tam sepetlerin sonuca kadar gizli kalması.
