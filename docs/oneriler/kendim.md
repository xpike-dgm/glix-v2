# Kendim — geliştirme önerileri

Bu dosya onay içindir. Her maddenin bir kodu var (ör. **KN-M2**). Cevabını tek satırda verebilirsin:

> KN-M1 evet, KN-M2 hayır, KN-U3 evet …

ya da yalnız **"önerilen paket evet"** dersen sondaki paket uygulanır. Her maddenin "ayrıntılar" bölümü onaylarsan
nasıl yapılacağını kesinleştirir; ek soru sormam gerekmez. Beğenmediğin ayrıntı varsa yalnız onu yaz.

Kodlar: **KN-M…** oyunu değiştiren (mekanik), **KN-U…** arayüz ve his, **KN-AI…** yapay zekâ.

Not: Sonuç ekranı herkes **"Devam et"** deyince geçer (en çok 60 sn). Yeni görsel gerektiren maddeler **🎨 Görsel**
diye işaretli.

---

## 1. Bugünkü oyun (özet)

- 3–8 oyuncu. Herkes 30 sn içinde **kendini anlatan tek kelime** yazar ("Ben…").
- Kelimeler isimsiz, karışık kartlara dönüşür. Herkes kendi kartı dışındakileri 30 sn içinde oyunculara eşler
  (kartı avatara sürükleyerek ya da karta dokunup kişiyi seçerek). Boş bırakmak serbest.
- Doğru eşleme **+1**, yanlış **−1**, boş **0**. Kelimeni **tam olarak bir kişi** bulduysa sen **+1** bonus alırsın
  (hiç eşleme yapmadıysan bonus yok).
- Sonuç 9 sn: bütün kartlar ve sahipleri bir anda açılır, puan listesi.
- Genel skora yalnız en yüksek (0'dan büyük) puanlı oyuncu(lar) **+1** alır.

## 2. Gördüğüm sorunlar

**Oyun tasarımı**
1. **Eksi puan oyuncuyu pasif yapıyor.** En güvenli hamle "boş bırak". Kartlar bir bulmaca gibi birbirine bağlı
   olduğu için tek bir yanlış zincirleme ikinci bir yanlışı getiriyor; ekran görüntüsünde **−5** ("0 doğru,
   5 yanlış") var. Arkadaşını tanımaya çalıştığın için ceza yemek bu oyunun ruhuna ters.
2. **Genel skor diğer oyunlarla dengesiz.** Yalnız birinci +1 alıyor; onaylanan oyunların çoğu +2 / +1 / 0 veriyor.
   Kendim'de iyi oynamak genel sıralamada neredeyse hiç fark yaratmıyor.
3. **Her maç aynı soru.** Hep "kendini anlat". Aynı grup ikinci kez oynadığında herkes yine aynı kelimeyi yazıyor
   (ÇAY, KEDİ…); oyun çabuk tükeniyor.
4. **"Tek kelime" yazıyor ama ifade kabul ediliyor.** "ÇOK NEŞELİ" gibi boşluklu yazı geçiyor; kural ile ekran
   çelişiyor, kartlar da uzayıp taşabiliyor.
5. **Oyunun en eğlenceli anı kaçıyor.** "Bunu kim yazdı ya!" tartışması, kartlar **tek tek** açılınca olur. Bugün
   her şey 9 sn içinde bir anda beliriyor; kimin kimi tahmin ettiği hiç görünmüyor.
6. **8 kişide süre yetmiyor.** 7 kartı 30 sn'de okuyup sürüklemek zor; 3 kişide (2 kart) aynı süre çok uzun.
7. **Bonus kuralı görünmez.** "Tam bir kişi bulursa +1, hiç eşleme yapmadıysan yok" kimsenin aklında kalmıyor;
   ekranda yalnız küçük bir "+1".

**Arayüz**
8. **Yazma ekranının yarısı boş.** Yazı panosu ortada havada duruyor, altında büyük karanlık boşluk; portre şeridinde
   isim yok. Arka plandaki aynalı salon güzel ama oyunla ilişkisi kurulmamış (ayna = "kendim" fikri hazır duruyor).
9. **Eşleştirme kartları içi boş ve çok uzun.** Kartın üstte bir kelimesi, altta koca boşluğu var. 5 kişide satırlar
   arasında büyük boşluk, tek kalan kart solda havada. Eşlenmiş kartta yalnız köşede küçük bir avatar var, **isim
   yok**.
10. **8 kişide avatar tepsisinde isimler kayboluyor.** 7 yuvarlak yüzden kimin kim olduğu anlaşılmıyor; yanlış
    kişiye sürükleme kolaylaşıyor. "Kartı avatara sürükle ya da karta dokun" ipucu küçük.
11. **"Tamam" sonrası kilit belli değil.** Eşleştirmede "HAZIRSIN" denince kartlar aynen duruyor; kilitli olduğu
    anlaşılmıyor.
12. **Sonuç ekranı karışık.**
    - Yanlış kartta **kimi seçtiğin** görünmüyor (yalnız kırmızı çerçeve).
    - Kendi kartın gri ama "senin kelimen" yazmıyor; **seni kimin bulduğu** yok.
    - Listede "+1" rozeti ile "+1" puan yan yana: hangisi genel skor, hangisi bu oyunun puanı belli değil.
    - Üstteki büyük "0" neyin puanı, belli değil; ekranın alt üçte biri boş.
13. **İzleyici ve TV boş.** Eşleştirme sırasında izleyici hiç kart görmüyor; TV'de odanın konuşacağı bir şey yok.

---

## 3. Oyunu değiştiren öneriler (mekanik)

### KN-M1 · Eksi kalksın, puan sıralamaya dönsün — **önerim: EVET**
**Ne:** Oyun içinde **"tanıma puanı"** toplanır: doğru eşleme **+1**, yanlış eşleme **0**, boş **0**, kelimeni
tek kişi bulduysa **+1** bonus. Oyun sonunda mini puan: **en yüksek +2, ikinci +1, diğerleri 0.**
**Neden:** Sorun 1 ve 2. Eksi yok; herkes cesurca eşler, tartışma artar. Puan aralığı onaylanan oyunlarla aynı.
**Ayrıntılar:**
- Birincide eşitlik varsa hepsi +2; sonraki farklı toplam +1 (iki kişi +2 aldıysa üçüncü toplam +1 alır).
- Tanıma puanı 0 olan ödül almaz. Herkesin toplamı aynı ve 0'dan büyükse herkes +1; hepsi 0 ise kimse almaz.
- **Sessiz oyuncu kuralı kalkar:** eksi olmadığı için gereksiz; hiç eşleme yapmasan da kelimeni tek kişi bulursa
  bonusu alırsın.
- Kelime yazmayan oyuncu yine eşleyebilir ve puan toplayabilir; kartı olmadığı için bonus alamaz.
- Maç kartlarında "birinci" = en yüksek tanıma puanı, "sonuncu" = en düşük (herkes eşitse kimse sonuncu değil).
- Anlatımdaki 3. adım: "Doğru eşleme +1, yanlış ceza yok".

### KN-M2 · Her maç farklı konu — **önerim: EVET**
**Ne:** "Kendini anlat" yerine her oyunda bir **konu kartı** çekilir; herkes kendini o konuyla tek kelimeyle
anlatır. Örnek biçim: *"Hayvan olsaydın?"*, *"Sabah ilk ne yaparsın?"*. Eşleştirme aynı kalır: "Kim yazdı?".
**Neden:** Sorun 3. Aynı grup tekrar oynadığında kelimeler değişir; "Mert kesin TEMBEL HAYVAN der" anları doğar.
**Ayrıntılar:**
- Konu listesini **sen yazarsın** (yönetici panelindeki içerik havuzu, diğer elle yazılan havuzlar gibi); her satır
  "konu | yazı kutusundaki ipucu" (ör. `Hayvan olsaydın? | Ben bir…`). Yapay zekâyla havuz üretilmez.
- Başlangıçta listede yalnız bugünkü konu vardır ("Kendini anlat | Ben…"); liste boşsa da bu kullanılır.
- Konu rastgele seçilir; aynı odada son 5 oyunda çıkmış konu tekrar seçilmez (liste 5'ten kısaysa yalnız bir
  önceki tekrar edilmez).
- Konu anlatımda (Hazırım ekranında) ve yazma ekranının başlığında büyük görünür; eşleştirme ve sonuçta üstte küçük.

### KN-M3 · Gerçekten tek kelime — **önerim: EVET**
**Ne:** Yazıda **boşluk kabul edilmez**. Boşluk tuşu çalışmaz; basılırsa pano kısa sallanır, altta "Tek kelime!"
yazar. Yapıştırılan boşluklu yazı bitişik hâle getirilir.
**Neden:** Sorun 4. Kural ile ekran aynı şeyi söyler; kartlar taşmaz.
**Ayrıntılar:** sınır bugünkü gibi 24 harf; tire (-) serbest ("TATLI-SERT"). Sunucu da boşluklu yazıyı reddeder.
Aynı kelimeyi yazanlar bugünkü gibi birbirinin yerine geçer.

### KN-M4 · Eşleştirme süresi kart sayısına göre — **önerim: EVET**
**Ne:** 3–5 oyuncuda eşleştirme **30 sn**, 6–8 oyuncuda **40 sn**. Yazma 30 sn kalır.
**Neden:** Sorun 6. 7 kartı okumaya ve sürüklemeye zaman kalır. Herkes Tamam derse 1 sn sonra bitiş aynen.

### KN-M5 · Ayna turu: başkasını anlat — **önerim: İSTEĞE BAĞLI**
**Ne:** Oyun iki tur olur. 1. tur bugünkü gibi (kendini anlat). 2. turda herkese gizlice **bir arkadaşı** düşer ve
onu tek kelimeyle anlatır. Kartlarda soru "Bu kelime **kimi** anlatıyor?" olur.
**Neden:** Masada en çok kahkahayı "bana KEÇİ mi demişler?!" anı çıkarır. Ama oyun süresi iki katına çıkar
(~70 sn → ~140 sn) ve kural anlatımı uzar; bu yüzden pakette değil.
**Ayrıntılar (onaylanırsa):** kimse kendini çekmez ve herkes tam bir kez çekilir; 2. turda kendini anlatan kartı
görmezsin (kendi yazdığın kart da görünmez); doğru bulma +1, bonus yok; iki turun tanıma puanı toplanır ve KN-M1
sıralaması uygulanır. Kartın yazarı sonuçta açılır.

### KN-M6 · "Eminim" yıldızı — **önerim: HAYIR**
**Ne:** Bir karta ⭐ koyarsın; doğruysa +1 ek puan.
**Neden önermiyorum:** Eksi olmadığı için risksiz bir hediye olur; herkes en emin kartına koyar, karar yaratmaz.

---

## 4. Arayüz ve his önerileri

### KN-U1 · Aynaya yaz — **önerim: EVET** · 🎨 Görsel
- Yazma ekranında pano, arka plandaki salonla uyumlu **büyük, hafif buğulu bir aynanın içinde** durur; yazdıkça
  harfler aynada parlayarak belirir. Konu (KN-M2) aynanın üstünde büyük.
- Ekranın ortası ve altı boş kalmaz: ayna ekranın ortasını kaplar; **klavye açılınca** ayna küçülüp yukarı çıkar,
  yazı ve Tamam klavyenin hemen üstünde kalır.
- Portre şeridinde avatarların altında isimler; yazmayı bitiren avatar ✓ ile yanar (bugünkü gibi).
- Tamam'da ayna kısa bir ışık çakar, kelime **kilit simgesiyle** aynaya "kazınır", titreşim.
- 🎨 Gereken: ayna çerçevesi (gotik, mor-altın; ortası saydam).

### KN-U2 · Eşleştirme ekranı düzeni — **önerim: EVET**
- **Kartlar içeriğe göre kısalır** (bugünkü yarı boş kartlar yerine kelime + altında eş satırı). 8 kişide 7 kart
  kaydırmadan tek ekrana sığar; satır araları eşit; tek kalan kart **ortalanır**.
- Eşlenmiş kartın altında **avatar + isim** ("→ Elif") yazar; boş kartta "Kim?" yazar (kesik çizgili daire yerine).
- Avatar tepsisinde **her sayıda isim** görünür (8 kişide iki sıra halinde, 4 + 4). Bir karta verilmiş kişinin
  avatarı soluklaşır ve köşesinde küçük ✓ olur.
- Sürüklerken karttan avatara **neon bir ip** uzanır (KURALLAR'daki "portrelere bağlanan neon ipler"); bırakınca
  ip kısa titreyip kartın altına yerleşir.
- İpucu yazısı ("Kartı avatara sürükle ya da karta dokun") daha büyük ve yalnız ilk eşlemeye kadar görünür.

### KN-U3 · Tamam ve son saniyeler — **önerim: EVET**
- Eşleştirmede Tamam'dan sonra kartlar **soluklaşır, üstlerine küçük kilit** gelir; "HAZIRSIN" altında "Kartların
  kilitlendi".
- Son 5 saniyede üst çubuk kırmızı nabız atar, saat tıklar, telefon her saniye hafif titrer (yalnız Tamam
  dememiş olana).

### KN-U4 · Kart kart açılış — **önerim: EVET** · 🎨 Görsel
- Sonuç bir anda değil **kart kart** açılır. Her kart için:
  1. Kart ortada büyür, kelime okunur.
  2. **Kimin kimi tahmin ettiği** görünür: tahmin edilen her oyuncunun avatarının yanında, onu seçenlerin küçük
     avatarları ("3 kişi Mert dedi, 1 kişi Elif dedi").
  3. Kart döner, **sahibi** açılır; doğru bilenlerin avatarları yeşil ✓ ile zıplar, yanlışlar griye döner.
  4. Tek kişi bulduysa ortada **"TEK BULAN: Elif · Mert +1"** şeridi (bonus artık görünür).
- Sıra: kartlar karışık sırayla, **senin kartın en son**: "Seni kim tanıdı?" başlığıyla (izleyicide en son kart
  rastgele).
- Her kart **3 sn**; açılış süresi = kart sayısı × 3 sn + 3 sn (3 kişide 9 sn, 8 kişide 27 sn). Ardından özet
  ekranı ve "Devam et" (genel kural; en çok 60 sn, açılış kesilmez).
- Aynı kelimeyi yazan iki kişi varsa o kartlarda **"İkiz kelime!"** etiketi.
- 🎨 Gereken: kart arka yüzü (anlatım görselindeki mor-altın kart sırtı tarzında; CSS ile de yapılabilir).

### KN-U5 · Özet ekranı netleşsin — **önerim: EVET**
- Üstte büyük sayının altında **"tanıma puanı"** yazar; yanında genel skora giden ödül ayrı ve farklı biçimde:
  **"+2 genel"** rozeti.
- Her kartta senin seçimin yazar: doğruysa "Sen: Mert ✓", yanlışsa "Sen: Zeynep ✗ · Sahibi: Mert".
- Kendi kartında **"Senin kelimen"** etiketi ve "Seni bulan: Elif, Kaan" (kimse bulmadıysa "Kimse bulamadı").
- Sıralı listede her satırda: tanıma puanı (sağda, sayı) ve genel ödül (adın yanında **+2 / +1** madalya). Bugünkü
  iki "+1"in yan yana karışması biter.
- Kartlar ve liste ekranı dolduracak şekilde aralanır; altta boş alan kalmaz, 8 kişide kaydırma gerekmez.

### KN-U6 · Ses ve titreşim seti — **önerim: EVET**
Yazarken aynada hafif çınlama, Tamam'da cam "tın", sürüklemede ip gerilme sesi, eşlemede "tık", kart dönerken
"vuuş", doğru tahminde "ding", tek bulan bonusunda kısa fanfar, "Seni kim tanıdı?" anında davul.

### KN-U7 · İzleyici ve TV — **önerim: EVET**
- **Yazma:** TV'de konu büyük, ortada ayna, avatarlar yazdıkça ✓ ile yanar.
- **Eşleştirme:** TV'de **kelime kartları** (sahipsiz) büyük görünür; oda "KEDİ kim ya?" diye konuşabilsin. Kimin
  kimi seçtiği gösterilmez, yalnız kimin Tamam dediği. (Bugün izleyici kart görmüyor; kelimeler sahipsiz olduğu
  için gizli bilgi açılmaz.)
- **Açılış:** KN-U4 kart kart açılış TV'de tam ekran; sağda oyuncular ve tanıma puanları canlı artar.

---

## 5. Yapay zekâ (AI) ile yapılabilecekler

### KN-AI1 · Ayna yorumu — **önerim: İSTEĞE BAĞLI**
Açılıştan sonra tek cümlelik esprili özet: "Mert kendine FIRTINA dedi, masadan yalnız Kaan inandı." Ortak yapay
zekâ yorum altyapısıyla (API bağlanınca açılır, hata olursa görünmez, oyun beklemez, yasaklı kelime süzgeci).
Modele yalnız konu, kelimeler, sahipleri ve kimin kimi bulduğu gider. **Puanı etkilemez.** Havuz değildir; anlık
üretilir, saklanmaz.

Not: "Anlamca yakın kelimeyi yapay zekâ doğru saysın" gibi bir öneri **yapmıyorum**: bu oyunda doğruluk kişiye
bakar, kelimeye değil; puanı yapay zekâya bırakmak tartışma ve hata getirir.

---

## 6. Önerilen paket

**KN-M1, KN-M2, KN-M3, KN-M4 ve KN-U1 … KN-U7 hepsi.** (KN-M5, KN-M6 ve yapay zekâ pakete dahil değil.)

Bu paketle oyun şöyle akar: konu kartı çekilir ("Hayvan olsaydın?") → herkes aynaya tek kelime yazar, Tamam'da
kelime aynaya kazınır → kartlar çıkar, neon iple avatarlara bağlanır (eksi yok, cesurca eşle) → kartlar tek tek
açılır: önce kimin kimi tahmin ettiği, sonra sahibi; "TEK BULAN" bonusu herkesin gözü önünde → en son "Seni kim
tanıdı?" → tanıma puanına göre +2 / +1 / 0.

**Değişen kurallar (paket onaylanırsa):** yanlış eşleme cezası kalkar (0); mini puan tanıma puanına göre
+2 / +1 / 0 (eşitlikler KN-M1'deki gibi); sessiz oyuncu kuralı kalkar; her oyunda elle yazılmış listeden bir konu;
yazıda boşluk yasak; eşleştirme 6–8 oyuncuda 40 sn; açılış kart sayısı × 3 sn + 3 sn; izleyici ve TV eşleştirmede
sahipsiz kelime kartlarını görür. `docs/KURALLAR.md`, wiki ve testler buna göre güncellenir.

**Değişmeyenler:** 3–8 oyuncu, 30 sn yazma, tek kelime 24 harf, isimsiz karışık kartlar, kendi kartını görmeme ve
kendine eşleyememe, bir kart bir kişi / bir kişi bir kart, aynı kelimeyi yazanların birbirinin yerine geçmesi,
"tam bir kişi bulursa sahibine +1" bonusu, sürükle-bırak ve dokun-seç birlikte, herkes Tamam derse 1 sn sonra
bitiş, renk körü modu.

**🎨 Yeni görsel gerekenler (paket):** ayna çerçevesi (KN-U1; gotik, mor-altın, ortası saydam), kart arka yüzü
(KN-U4; anlatım görselindeki kart sırtı tarzında, CSS ile de yapılabilir).
