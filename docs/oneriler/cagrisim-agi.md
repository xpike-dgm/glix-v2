# Çağrışım Ağı — geliştirme önerileri

Bu dosya onay içindir. Her maddenin bir kodu var (ör. **CG-M2**). Cevabını tek satırda verebilirsin:

> CG-M1 evet, CG-M2 hayır, CG-U3 evet …

ya da yalnız **"önerilen paket evet"** dersen sondaki paket uygulanır. Her maddenin "ayrıntılar" bölümü onaylarsan
nasıl yapılacağını kesinleştirir; ek soru sormam gerekmez. Beğenmediğin ayrıntı varsa yalnız onu yaz.

Kodlar: **CG-M…** oyunu değiştiren (mekanik), **CG-U…** arayüz ve his, **CG-AI…** yapay zekâ. ("CA" Çapraz Ateş'in
öneki olduğu için bu oyunda **CG** kullanıldı.)

Not: Sonuç ekranı herkes **"Devam et"** deyince geçer (en çok 60 sn; zaten var, yeniden önerilmiyor). Yeni görsel
gerektiren maddeler **🎨 Görsel**, ses alanına iş açanlar **🔊 Ses** diye işaretli. Kelime havuzuna düşen işler bölüm
6'da **İçerik alanı** başlığında toplanır (listeleri sen ya da İçerik Havuzu yapay zekâsı yazar; oyundaki yapay zekâ
üretmez).

---

## 1. Bugünkü oyun (özet)

- 2–8 oyuncu, tek kelime, tek tur. Havuzdan (yerleşik **321** kelime, aile dostu, tek sözcük) bir ana kelime çekilir,
  elektrikli bir kürenin ortasında gösterilir.
- **Cevap (30 sn):** herkes tek bir çağrışım yazar (teknik sınır 60 karakter). Gönder = Tamam, değiştirilemez. Bağlı
  herkes gönderince 1 sn sonra açılır.
- **Gruplama:** büyük/küçük harf, Türkçe harf (ç/c, ş/s …), noktalama ve fazla boşluk farkı yok sayılır. En az iki kişinin
  aynı cevabı bir **ağ** kurar; gruptaki yazılışlardan Türkçe harf içeren gösterilir.
- **Puan:** ağdaki her üye ağın kişi sayısı kadar mini puan alır (3 kişilik ağ: herkese 3). Tek kalan ve yazmayan 0.
- **Genel skora aktarım:** sıralama ödülü (`rankAwards`, yalnız 0'dan büyükler): tek lider +2, ikinciler +1; **lider eşitse
  liderlerin hepsi yalnız +1**, ikinciye bir şey yok.
- **Açılış (en az 6 sn):** üstte küçük kelime ve kendi mini puanın ("+3 Ağ kurdun!"), altında ağlar küçükten büyüğe
  sırayla (kutu içinde cevap, +n ve bağlı avatarlar), en altta tek kalanlar ve "Yazmadı".
- Aynı oda içinde kelime tekrarını önleyen bir şey yok (oyun `contentUsed` bildirmiyor).

## 2. Gördüğüm sorunlar

**Oyun tasarımı**

1. **Bu oyunda kimse genel skordan +2 alamıyor.** Ağ en az iki kişidir; en çok puanı alanlar her zaman en az iki kişi
   olduğu için lider **her zaman eşit** çıkar ve bugünkü sıralama kuralında eşit liderler yalnız +1 alır, ikinci ağ hiçbir
   şey almaz. Yani gerçekte kural "en büyük ağ +1, geri kalan herkes 0". Ekranda ise "+3", "+2" yazıyor: ikinci ağdaki
   oyuncu "+2" görüp genel skorda 0 alıyor.
2. **Tek atış, 30 saniye.** Bütün oyun tek kelimeye bağlı; bir kelimede herkes "mavi" der (herkes eşit, sıralama boşa
   gider), bir başkasında kimse eşleşmez (kimse puan almaz). Oyun maçın en kısası (36 sn) ama şans payı en yüksek olanı.
3. **Eşleşme fazla katı.** "dalga" ile "dalgalar", "deniz kenarı" ile "denizkenarı", "kumsal" ile "kumsall" ayrı
   cevap sayılıyor. Telefonda hızlı yazarken yapılan tek harf hatası ağı kaçırtıyor. Yazı Yaz'da onayladığın tek harf
   toleransı (YY-M7) burada yok.
4. **Tekrar önleme hiç çalışmıyor.** Oyun çektiği kelimeyi bildirmiyor; sunucunun tekrar süzgeci de yalnız yönetici
   panelinde değiştirilmiş havuzlara uygulanıyor. Aynı odada "DENİZ" ikinci kez gelince herkes geçen seferki kazanan
   cevabı yazar; oyun hafıza yarışına döner.
5. **Kelimelerin zorluğu çok farklı ve bilinmiyor.** KAR, ARI, BAL, TUZ, MUM gibi tek baskın çağrışımı olan kelimeler
   ("beyaz", "bal", "arı") herkesi tek ağda toplar; GÜZ, VADİ, PİKSEL, MODEM gibi kelimeler dağılır. Havuzda zorluk
   etiketi yok, hangi kelimenin nasıl oynandığını ölçen bir veri de yok. Kelime listesindeki 10 tema (Doğa, Hayvanlar,
   Yiyecek, Mekanlar, Nesneler, Etkinlikler, Meslekler, Duygular, Sporlar, Teknoloji) yalnız kod yorumunda duruyor,
   oyunda kullanılmıyor.
6. **Gösterilen yazılış oyuncunun yazdığı değil.** Cevaplar küçük harfe çevrilip gösteriliyor ("İzmir" → "izmir");
   genel kural "ekranda her zaman oyuncunun yazdığı biçim gösterilir" diyor.

**Arayüz** (390×844, 360×640, yatay 844×390 ekran görüntülerine bakarak)

7. **Cevap ekranı oyunun amacını söylemiyor.** Ekranda yalnız küre, kelime ve "Aklına ne geliyor?" yer tutucusu var.
   Bu metin oyuncuyu **kendi** çağrışımını yazmaya itiyor; oyunun amacı ise "çoğunluk ne yazar?" diye düşünmek. Yeni
   oyuncu ilk turda en yaratıcı cevabı yazıp tek kalıyor.
8. **Küre ile alan arasında boşluk, süre görünmüyor.** 390×844'te küre ekranın ortasında, avatar şeridi ile küre
   arasında ~%20 boşluk; kalan süre yalnız en üstteki ince çubukta (sayı son 5 sn'de). Küre bir sayaç gibi
   kullanılmıyor.
9. **Kilit ekranı bekleyene bir şey vermiyor.** "Cevabın kilitlendi · mavi · 4/5 hazır" ve boşluk.
10. **Açılışta isim yok.** Ağların içinde yalnız avatarlar var (8 kişide 40 px, renkleri yakın yüzler); tek kalanlarda
    da yalnız avatar ve cevap. "Kim benimle aynı şeyi yazmış?" sorusunun cevabı ekranda okunmuyor.
11. **Açılış bir "ağ" gibi görünmüyor.** Briefing'de ve kuralda "ana kelimeden yayılan merkez, portreleri bağlayan neon
    düğümler" var; açılışta ise alt alta kutular. Küre açılışta küçük bir çipe dönüşüyor ve ağlarla hiç bağı yok.
    390×844'te başlık ile ilk ağ arasında ~%25, son satırdan sonra ~%35 boşluk.
12. **Puan dili yanıltıyor.** Büyük "+3 Ağ kurdun!" ve kutularda "+3 / +2" genel skora gidecek puan gibi okunuyor
    (sorun 1).
13. **Açılış 6 sn ve sırayla açılma fark edilmiyor.** Tek kalanlar önce, ağlar sonra açılıyor ama 6 sn'de hepsi neredeyse
    aynı anda beliriyor; "aynı şeyi yazan var mı?" gerilimi yok.
14. **TV'de özel görünüm yok:** telefon ekranı ortada dar bir sütunda gösteriliyor; büyük ekranda ağ kurulması anı yok.

---

## 3. Oyunu değiştiren öneriler (mekanik)

### CG-M1 · Genel skor düzeltmesi: eşit liderler de +2 — **önerim: EVET**
**Ne:** Oyun içi **ağ puanı** bugünkü gibi hesaplanır. Genel skora: **en yüksek ağ puanı(ları) +2, sonraki farklı puan +1,
diğerleri 0**. Eşit liderlerin hepsi +2 alır.
**Neden:** Sorun 1. Bugün ağ ne kadar büyük olursa olsun en çok +1 gidiyor ve ikinci ağ hiç ödüllenmiyor. Gizli
Alışveriş (GA-M4), Kendim (KN-M1) ve Yazı Yaz'da (YY-M4) onayladığın eşitlik kuralı zaten bu.
**Ayrıntılar (tek kelimeyle):**
- En büyük ağdakiler **+2**, ondan küçük en büyük ağdakiler **+1**, tek kalan ve yazmayan 0.
- Aynı büyüklükte iki ağ varsa ikisinin üyeleri de +2 (ör. "mavi" 3 kişi, "dalga" 3 kişi: altısı +2).
- **Herkes tek bir ağdaysa** (herkes aynı cevabı yazdı) herkes **+1** (herkesin toplamı aynı kuralı).
- Hiç ağ yoksa kimse puan almaz.
- Ağ kurmuş herkesin puanı eşitse ve ağ dışında kalan varsa (ör. 8 kişide 3 + 3 ve iki tek kalan) ağdakilerin hepsi +2;
  ağ dışında kimse yoksa (ör. 4 + 4) herkes eşit sayılır ve herkes +1.
- 2 oyuncuda: eşleşirseniz ikiniz de +1 (herkes aynı kuralı), eşleşmezseniz 0.
- CG-M2 onaylanırsa aynı kural üç kelimenin **toplam** ağ puanına uygulanır.

### CG-M2 · Üç kelimelik seri — **önerim: EVET**
**Ne:** Oyun tek kelime yerine **üç kelime** üst üste oynanır. Her kelimede 20 sn cevap, ardından 4 sn'lik kısa açılış;
üçüncünün ardından büyük açılış. Ağ puanları toplanır.
**Neden:** Sorun 2. Tek atışın şansı dağılır, "grubu okuma" becerisi öne çıkar: ilk kelimede kimin nasıl düşündüğünü
gören ikincide ona göre yazar. Bu oyun bugün maçın en kısası (36 sn); seri ile ~80 sn olur, Sözlük Blöfü (92 sn) ve
Karalama Defteri'nin (95 sn) altında kalır.
**Ayrıntılar:**
- Akış: kelime 1 (20 sn) → mini açılış 4 sn → kelime 2 (20 sn) → mini açılış 4 sn → kelime 3 (20 sn) → büyük açılış (en
  az 8 sn, "Devam et" ile geçilir). En uzun hâli 76 sn + bekleme.
- Erken bitiş her kelimede ayrı çalışır: bağlı herkes gönderince 1 sn sonra mini açılış başlar.
- Mini açılış yalnız o kelimenin ağlarını kısa gösterir (kutular, isimler, puan); dokunarak geçilmez, 4 sn sabittir.
- Büyük açılış: üç kelimenin en büyük ağları özetlenir, oyuncu başına toplam ağ puanı ve CG-M1 ödülü.
- Üç kelime aynı oyunda birbirinin aynısı olamaz ve (CG-M5 ile) kolaydan zora sıralanır.
- Yazmayan kelimede o kelime için 0; bağlantısı kopan sonraki kelimede dönerse oynamaya devam eder.
- Anlatım tek kez (oyun başında) gösterilir.

### CG-M3 · Daha adil eşleşme: ek, boşluk ve tek harf — **önerim: EVET**
**Ne:** Bugünkü klavye toleransına üç kural eklenir:
1. **Boşluk ve tire yok sayılır:** "deniz kenarı" = "denizkenarı" = "deniz-kenarı".
2. **Çoğul eki yok sayılır:** sondaki "-lar / -ler" atılır, kalan kök en az 3 harfse ("dalgalar" = "dalga",
   "balıklar" = "balık"; "dolar" ve "kiler" dokunulmaz, çünkü kök 2 harf kalır).
3. **Tek harf yazım hatası:** 6 harf ve üstü cevaplarda harf sayısı aynı ve yalnız bir harf farklıysa aynı sayılır
   ("kumsal" = "kumsak"). 5 harf ve altında tam eşleşme gerekir. (Yazı Yaz'daki YY-M7 ile aynı kural.)
**Neden:** Sorun 3. Ağ, yazım kazasıyla değil düşünceyle kurulsun.
**Ayrıntılar:**
- Gruplama iki adımlıdır: önce bugünkü anahtar + kural 1–2 ile kesin gruplar kurulur; sonra tek kalan bir cevap (ya da
  daha küçük grup) kural 3'le **en büyük** gruba bir harf uzaktaysa ona katılır. Zincirleme yoktur (A, B'ye; B, C'ye
  yakın diye A ile C birleşmez).
- İki eşit büyüklükte grup birbirine bir harf uzaksa birleşir; gösterilen yazılış ilk cevap verenin grubununki.
- Açılışta birleşen farklı yazılışlar ağ kutusunun altında küçük yazıyla görünür: "(dalgalar, dalga)". Masada itiraz
  olursa herkes neyin neden birleştiğini görür.
- Anlamca eş cevaplar ("araba" / "otomobil") birleşmez; bunu yalnız kural yapabilir, yapay zekâ karar vermez (bkz. CG-AI1).
- Gösterilen yazılış küçük harfe çevrilmez: oyuncunun yazdığı biçim gösterilir (sorun 6); grupta birden çok yazılış
  varsa bugünkü "Türkçe harf içeren" kuralı sürer.

### CG-M4 · Aynı odada kelime tekrar etmesin — **önerim: EVET**
**Ne:** Bir odada son **60** kelime (CG-M2 ile yaklaşık son 20 oyun) tekrar gelmez.
**Neden:** Sorun 4.
**Ayrıntılar:**
- Oyun çektiği kelime(leri) sunucuya bildirir (`contentUsed`, Yazı Yaz ve Kendim'deki gibi).
- **Sunucu düzeltmesi (bütün oyunlara yarar):** tekrar süzgeci yerleşik havuza da uygulanır (bugün yalnız yönetici
  panelinde değiştirilmiş havuzlara uygulanıyor).
- Süzülünce kalan girdi havuz alt sınırının altına düşerse süzgeç uygulanmaz. 321 kelimede bu hiç olmaz.
- Hafıza oda bellekte durduğu sürece; oda kapanınca sıfırlanır.

### CG-M5 · Kelime zorluğu: kolay, orta, zor — **önerim: EVET**
**Ne:** Havuzdaki her kelime bir zorluk etiketi taşır:
- **kolay:** bir baskın çağrışımı olan (KAR → kış/beyaz, ARI → bal);
- **orta:** iki-üç güçlü çağrışımı olan (DENİZ → mavi/dalga/tatil);
- **zor:** dağınık (VADİ, PİKSEL, GÜZ).
CG-M2 ile seri **kolay → orta → zor** sırasıyla çekilir; tek kelimeyle oynanırsa yalnız **orta** kelimeler çekilir.
**Neden:** Sorun 5. Seri ısınarak başlar ve sonda gerilim artar; tek kelimede "herkes aynı" ve "kimse eşleşmez" uçları
azalır.
**Ayrıntılar:**
- Etiket havuz formunda yeni alan (açılır liste). Etiketsiz kelime "orta" sayılır.
- Bir zorlukta hiç kelime kalmazsa (tekrar süzgecinden sonra) komşu zorluktan çekilir.
- İlk etiketleri İçerik alanı verir; CG-M6 verisi geldikçe düzeltir.

### CG-M6 · Kelime karnesi: oyun içinden havuz istatistiği — **önerim: EVET**
**Ne:** Her oyunda her kelime için iki sayı havuz istatistiğine eklenir: **en büyük ağın oranı** (en büyük ağdaki kişi /
cevap veren) ve **tek kalan oranı**. Yönetici panelinde (İçerik) kelime başına "kaç oyunda çıktı · ortalama en büyük
ağ % · tek kalan %" sütunları.
**Neden:** Sorun 5. "Bu kelime iyi oynanıyor mu?" sorusunun cevabı tahmin değil veri olur. İçerik alanı zorluk
etiketini buna göre düzeltir, hiç ağ kurdurmayan kelimeleri kapatma önerisine koyar.
**Ayrıntılar:**
- Yalnız sayılar saklanır; **cevap metni, oyuncu adı, oda kodu saklanmaz** (maç verisi saklanmaz kuralı korunur).
- Otomatik öneri eşikleri (en az 8 oyundan sonra): ortalama en büyük ağ ≥ %80 → "kolay" önerisi; ≤ %30 ve tek kalan
  ≥ %60 → "zor" önerisi; 8 oyunda bir kez bile ağ kurulmadıysa → kapatma önerisi. Öneriler sahip onayına gider,
  kendiliğinden uygulanmaz.
- Üretim belgesindeki ALT-10 "istatistik" maddesinin bu oyuna düşen parçası.

### CG-M7 · Tema serisi — **önerim: İSTEĞE BAĞLI**
**Ne:** CG-M2'deki üç kelime aynı temadan gelir ve ekranda başlıkta görünür: "Tema: **Mutfak**" → ÇAYDANLIK, TUZ,
KEPÇE.
**Neden:** Seriye bir hikâye verir, oyuncular tema içinde birbirini daha iyi okur. Havuz zaten 10 temaya ayrılmış
(yalnız kod yorumunda).
**Ayrıntılar:**
- Havuza yeni alan: **Tema** (sabit liste; yeni tema eklemek kod işi değil, liste veridir).
- Tema rastgele, aynı odada üst üste aynı tema gelmez. Temada üç uygun kelime yoksa temasız seri çekilir.
- Neden İSTEĞE BAĞLI: tema, çeşitliliği azaltır ve bazı temalar (Duygular) çok zorlaşır; önce CG-M2 + CG-M5 ile
  serinin nasıl oynandığını görmek isteyebilirsin.

### CG-M8 · Gönderdikten sonra 3 sn "Düzelt" — **önerim: HAYIR**
**Ne:** Gönder'den sonra 3 sn boyunca yazım hatası düzeltilebilir.
**Neden önermiyorum:** CG-M3'ün tek harf toleransı aynı ihtiyacı kuralla karşılıyor; "Düzelt" penceresi erken bitişi
3 sn geciktirir ve "son gönderen başkasının cevabına göre değiştirdi" şüphesi doğurur (cevaplar zaten gizli olsa da).

---

## 4. Arayüz ve his önerileri

### 4a. Ana ekranlar ve akış

### CG-U1 · Cevap ekranı amacını söylesin — **önerim: EVET**
**Ne:** Kürenin altında tek satır: **"Çoğunluk ne yazar? Aynısını yazanlarla ağ kur."** Yazı alanının yer tutucusu
"Aklına ne geliyor?" yerine **"Herkesin aklına ilk ne gelir?"**.
**Neden:** Sorun 7. Oyunun amacı "kendi çağrışımın" değil "ortak çağrışım".
**Ayrıntılar:** Satır 16 px, klavye açıkken (sıkışık kip) gizlenir; CG-M7 açıksa satırın üstünde tema adı.

### CG-U2 · Küre sayaç olsun — **önerim: EVET**
**Ne:** Kürenin neon halkası kalan süreyi gösterir: süre azaldıkça halka saat yönünde söner; son 5 sn'de halka kırmızıya
döner, kelimenin altında büyük saniye sayısı belirir. Şimşekler son 5 sn'de hızlanır.
**Neden:** Sorun 8. Göz zaten kürede; ayrı bir çubuğa bakmaya gerek kalmaz.
**Ayrıntılar:** Üstteki ince çubuk kalır (diğer oyunlarla tutarlılık). Hareketi azaltmada halka söner ama şimşek
hızlanmaz.

### CG-U3 · Gönderince düğüm kürenin çevresine — **önerim: EVET**
**Ne:** Gönderince cevabın küçük bir **ışık düğümü** olarak kürenin çevresindeki yörüngeye fırlar; diğer gönderenlerin
düğümleri de (içerikleri görünmeden, sahibinin renginde) yörüngeye eklenir. Kilit kartı küreyi örtmeyecek kadar küçülür.
**Neden:** Sorun 9. Bekleyen biri ağın "dolmakta olduğunu" görür; avatar şeridindeki tikle aynı bilgi, ama kürede.
**Ayrıntılar:** Düğümler yalnız "gönderdi" bilgisini taşır (bugün herkese açık olan `answeredIds`). Cevap metni ve
benzerlik ipucu yoktur; düğümler eşleşmeye göre kümelenmez (açılışa kadar).

### CG-U4 · Seri ilerlemesi (CG-M2 ile) — **önerim: EVET (CG-M2 onaylanırsa)**
**Ne:** Üstte üç nokta "● ○ ○" ve "Kelime 1/3"; sağda toplam ağ puanın küçük rozetle. Mini açılış (4 sn) üstte şerit
olarak iner: "DENİZ: mavi (4) · dalga (2)" ve senin sonucun "+4".
**Neden:** Üç kelimenin aynı ekranda akması, geçişin karışmaması.
**Ayrıntılar:** Mini açılışta isim çipleri en çok 2 satır; sığmazsa "+3 kişi". Kelime geçişinde küre bir an söner, yeni
kelimeyle yeniden yanar.

### 4b. Açılış/sonuç anı ve gerilim

### CG-U5 · Gerçek bir ağ açılışı — **önerim: EVET** · 🎨 Görsel · 🔊 Ses
**Ne:** Açılışta küre ortada büyük kalır, oyuncular kürenin çevresinde halka olur. Sırayla:
1. Herkesin cevabı avatarının yanında **ters kart** olarak belirir (0,5 sn).
2. Tek kalanlar tek tek açılır ve sönük gri düğüme döner.
3. Ağlar küçükten büyüğe açılır: aynı cevabı yazanlardan küreye **neon çizgiler** uzanır ve çizgiler cevabın düğümünde
   birleşir; düğümde cevap ve kişi sayısı.
4. En büyük ağ en son, "**EN BÜYÜK AĞ**" yazısı ve kısa elektrik patlaması.
Ardından görünüm bugünkü listeye kayar (okumak ve "Devam et" için).
**Neden:** Sorun 11 ve 13. Kuralın kendi tarif ettiği görsel ("portreleri bağlayan neon düğümler") gerçekten görülür.
**Ayrıntılar:**
- Süre (tek kelime): 1 + 0,4 sn × tek kalan + 1 sn × ağ + 1,5 sn final; 8 kişide en çok ~8 sn. Açılış en az süresi 6
  sn'den 8 sn'ye çıkar (yalnız animasyon payı; "Devam et" kuralı aynen).
- 390 px genişlikte 8 avatar halkası: avatar 40 px, halka çapı 300 px; 360 px'te 36 px.
- Hareketi azaltmada çizgiler animasyonsuz çizilir, aşamalar 0,5 sn arayla belirir.
- 🎨 Gereken: neon düğüm parıltısı ve kısa elektrik patlaması dokusu (sprite ya da CSS).
- 🔊 Gereken: kart çevirme tıkı, ağ bağlanma "vınnn" (ağ büyüdükçe daha yüksek perde), tek kalan sönme "fzz", en büyük ağda
  çıtırtılı patlama.

### CG-U6 · Puan dili: ağ puanı ve madalya ayrı — **önerim: EVET**
**Ne:** Üstteki büyük sayı "**4 kişilik ağ**" olur (ağ puanı), yanında genel skora gidecek rozet: **"🥇 +2"**, **"🥈 +1"**
ya da hiç rozet yok. Ağ kutularındaki "+3" yerine "**3 kişi**".
**Neden:** Sorun 1 ve 12. Oyuncu ekranda gördüğü sayıyı genel skorda görür.
**Ayrıntılar:** Rozet açılış dizisi bitince belirir. Tek kalan için "Bu sefer tek kaldın", yazmayan için "Yazmadın".
CG-M2 ile büyük açılışta "Toplam ağ puanın 7".

### CG-U7 · "Kara koyun" ve "Tek yürek" anları — **önerim: EVET**
**Ne:** İki özel damga (puan etkisi yok):
- **"TEK YÜREK"**: herkes aynı ağdaysa, küre altın renge döner ve bütün çizgiler tek düğümde birleşir.
- **"KARA KOYUN"**: biri hariç herkes aynı ağdaysa, dışarıda kalanın kartı küçük bir koyun simgesiyle işaretlenir.
**Neden:** Bu iki an masada en çok gülünen anlar; bugün ekranda karşılığı yok.
**Ayrıntılar:** Kara koyun yalnız 4+ oyuncuda (3 kişide 2'ye 1 fazla sık olur). Damga kişiyi alaya almaz, simge ve
"bu sefer farklı düşündü" yazısı yeterli. 🎨 Küçük koyun simgesi (SVG ile çizilebilir).

### 4c. Telefon ergonomisi ve okunurluk

### CG-U8 · Açılışta isimler — **önerim: EVET**
**Ne:** Ağ kutularında her avatarın altında kısa isim (en çok 7 harf, uzunsa kesilir); tek kalanlarda "Elif · ördek".
Kendi adın yerine "Sen" ve kendi avatarın beyaz halkalı.
**Neden:** Sorun 10.
**Ayrıntılar:** 8 kişilik tek ağda isimler iki satıra iner (4 + 4). Tek kalanlar iki sütunlu düzende, cevap 16 px.

### CG-U9 · Uzun cevap uyarısı — **önerim: EVET**
**Ne:** Yazdığın cevap üç kelimeyi geçerse ya da 20 karakteri aşarsa alanın altında sakin bir not: **"Kısa cevaplar daha
kolay eşleşir."** Gönderme engellenmez.
**Neden:** "denizde yüzen beyaz yelkenli" gibi cümleler hemen hiç eşleşmez; yeni oyuncu bunu ancak tek kalınca
öğreniyor.

### CG-U10 · Boş alanın kullanımı ve yatay düzen — **önerim: EVET**
**Ne:** Cevap ekranında küre, avatar şeridi ve alan arasındaki boşluk eşit dağıtılır (küre biraz büyür, şerit alana
yaklaşır). **Yatayda** küre solda, alan ve şerit sağda; açılışta ağlar sağda iki sütun.
**Neden:** Sorun 8 ve 11; yatayda bugün açılış listesi ekranın üçte birini kullanıyor.

### 4d. İzleyici, kopan oyuncu ve TV

### CG-U11 · TV ekranı: büyük küre — **önerim: EVET**
**Ne:** TV'ye özel görünüm. Cevap aşamasında ortada dev küre ve kelime (CG-U2 halkalı sayacıyla), çevresinde oyuncu
halkası; gönderenin avatarı yanar ve düğümü yörüngeye fırlar (CG-U3). Açılışta CG-U5 tam ekran, sağda genel skor.
**Neden:** Sorun 14. Ağın kurulması büyük ekranda oyunun en güzel anı olur.
**Ayrıntılar:** TV açılıştan önce hiçbir cevap metni göstermez. CG-M2 ile mini açılışlar TV'de de 4 sn.

### CG-U12 · Kopan oyuncu ve izleyici — **önerim: EVET**
**Ne:**
- Açılışta yazmayanlar ikiye ayrılır: **"Yazmadı"** ve (bağlantısı kopuk olan) **"Bağlantı koptu"**.
- İzleyici cevap aşamasında "Sen de dene (sayılmaz)" alanı görür; yazdığı yalnız kendi ekranında kalır, açılışta hangi
  ağa düştüğü kendisine gösterilir ("Sen de 'mavi' ağındaydın").
**Neden:** Kopanla umursamayanı ayırmak; izleyicinin ekranı bugün yalnız küre ve sayaç.
**Ayrıntılar:** İzleyici cevabı sunucuya gitmez, hazır sayısına girmez. İzleyici kısmını istemezsen yalnız ilk alt
madde uygulanır.

### 4e. Ses, titreşim ve hareket

### CG-U13 · Elektrik ses seti — **önerim: EVET** · 🔊 Ses
**Ne:** Ses kimliği "elektrik ve neon": gönderince kısa "zap" ve tek titreşim; başka biri gönderince çok hafif çıtırtı
(yalnız sende, titreşimsiz); son 5 sn'de küre uğultusu yükselir; açılışta CG-U5 sesleri; kendi ağın bağlanınca iki kısa
titreşim, tek kaldıysan tek uzun yumuşak titreşim.
**Neden:** Bugün genel "hazır/eşleşme/tek" sesleri kullanılıyor; oyunun kimliği yok.
**Ayrıntılar:** Yazarken tuş sesi yok. Başkasının gönderme çıtırtısı yalnız ses (kimin gönderdiği zaten şeritte açık).

### 4f. İlk kez oynayan için öğretme

### CG-U14 · Anlatım: kural, örnek ve sesli söyleme yasağı — **önerim: EVET**
**Ne:** Anlatım adımları: (1) "Ortadaki kelimeyi gör", (2) "**Çoğunluk ne yazar?** Tek bir cevap yaz", (3) "Aynısını
yazanlarla ağ kurarsın; en büyük ağ en çok puanı alır". Görsel: DENİZ → "mavi", "mavi", "dalga" kartları, iki "mavi"
birbirine bağlanır. Altta küçük not: "**Cevabını yüksek sesle söyleme!**"
**Neden:** Bugünkü "aklına gelen tek çağrışımı yaz" metni oyuncuyu yanlış hedefe yönlendiriyor (sorun 7); sesli söyleme
kuralı yazılı değil, masada kavga çıkarıyor.
**Ayrıntılar:** CG-M2 ile adım 3 "Üç kelime, puanlar toplanır"; CG-M3 ile küçük not "Küçük yazım hataları sayılmaz".

### CG-U15 · Son 5 sn: boş alan uyarısı — **önerim: EVET**
**Ne:** Son 5 sn'de hâlâ bir şey yazmadıysan yazı alanı hafifçe titrer ve **"Bir şey yaz, ağa katılma şansın var!"**
yazısı belirir; telefon bir kez titrer.
**Neden:** Yazmayan kesin 0 alıyor; yeni oyuncu düşünürken süreyi kaçırıyor.
**Ayrıntılar:** Yalnız alan boşsa; yazmaya başlamışsan ama göndermediysen yazı "Gönder'e basmayı unutma!" olur.

### 4g. Erişilebilirlik

### CG-U16 · Renk körü, yazı boyutu, ekran okuyucu — **önerim: EVET**
**Ne:**
- Ağ renkleri bugün desen işaretiyle (renk körü işareti) de ayrılıyor; CG-U5'teki çizgilere de aynı işaret düğümde
  eklenir, çizgiler ağa göre düz / kesikli / noktalı olur.
- Cevap metinleri en az 16 px; sistemin büyük yazı ayarında ağ kutuları uzar, metin kesilmez.
- Açılış ekran okuyucuda sırayla okunur: "En büyük ağ: mavi, 4 kişi: Sen, Mert, Kaan, Ayşe. Tek kalanlar: Elif ördek."
  Aşama değişimi: "Cevaplar açıldı".
- Küre sayacı (CG-U2) ekran okuyucuda 10, 5 sn kala "10 saniye kaldı" duyurusu.
**Neden:** Açılış bugün yalnız renk ve avatarla okunuyor.

---

## 5. Yapay zekâ (AI) ile yapılabilecekler

### CG-AI1 · Anlam hakemi ("araba" = "otomobil") — **önerim: HAYIR**
**Ne:** Yapay zekâ anlamca eş cevapları aynı ağa koyar.
**Neden önermiyorum:** ⚠️ Puanı yapay zekâ belirler; "kumsal" ile "sahil" aynı mı sorusunda masa ikiye bölünür ve karar
tutarsız olabilir. CG-M3 eşleşmeyi tutarlı, herkesin görebildiği kurallarla genişletiyor.

### CG-AI2 · Ağ spikeri — **önerim: İSTEĞE BAĞLI**
**Ne:** Büyük açılışın sonunda tek cümle: "DENİZ deyince beş kişi maviye koştu, Oyuncu4 ise ördeği düşündü; kara koyun
ama çok sevimli." Ortak yorum altyapısıyla (API yoksa görünmez, oyun beklemez, yasaklı kelime süzgeci).
**Ayrıntılar:** Modele kelime(ler), ağlar ve tek kalan cevaplar "Oyuncu1…N" olarak gider; adlar ekranda yerine konur;
saklanmaz. Puanı etkilemez.

---

## 6. İçerik ve üretim ekibine düşen işler

**İçerik alanı (İçerik Havuzu yapay zekâsı, senin onayınla):**
- CG-M5: 321 kelimeye **kolay / orta / zor** etiketi; dağılım hedefi %25 / %50 / %25. CG-M2 için her zorlukta en az
  60 kelime.
- CG-M6 verisi geldikçe etiket düzeltmeleri ve hiç ağ kurdurmayan kelimeler için **kapatma önerisi**.
- CG-M7 (onaylanırsa): kelimelere **tema** etiketi (bugünkü 10 tema), her temada her zorlukta en az 5 kelime.
- Havuzu büyütmek: hedef **500** kelime (CG-M2 ile oyun başına 3 kelime harcanıyor).
- Kod isteği (yönetici yapar): havuz formunda zorluk ve tema alanları (açılır liste), istatistik sütunları.

**Ses alanı:** CG-U5 (kart tıkı, ağ bağlanma "vınnn" perde katmanları, sönme "fzz", elektrik patlaması), CG-U13 (zap,
hafif çıtırtı, küre uğultusu). Ses kimliği: elektrik ve neon.

**Görsel (ChatGPT görev akışı):** CG-U5 neon düğüm parıltısı ve elektrik patlaması dokusu; CG-U7 koyun simgesi (SVG ile de
çizilebilir).

**Müzik alanı:** isteğe bağlı oyun teması; CG-M2 ile üçüncü kelimede gerilim katmanı.

---

## 7. Önerilen paket

**EVET:** CG-M1, CG-M2, CG-M3, CG-M4, CG-M5, CG-M6; CG-U1 … CG-U16.

**İSTEĞE BAĞLI:** CG-M7 (tema serisi), CG-AI2 (ağ spikeri).

**HAYIR:** CG-M8 (gönderdikten sonra düzelt), CG-AI1 (anlam hakemi).

Bu paketle oyun şöyle akar: "Çoğunluk ne yazar?" → kolay bir kelime (KAR), küre sayaç gibi söner, gönderdiğin cevap
yörüngeye fırlar → 4 sn'lik mini açılış, isimleriyle kim kiminle buluştu → orta, sonra zor kelime → büyük açılışta
cevaplar avatarların yanında ters kart olarak belirir, aynı cevaplar kürede neon çizgilerle bağlanır, en büyük ağ en
son patlar; "Tek yürek" ya da "Kara koyun" damgası → toplam ağ puanına göre +2 / +1 / 0.

**Değişen kurallar (paket onaylanırsa):** oyun üç kelimeyle (20 sn + 4 sn mini açılış, üç kez) oynanır ve ağ puanları
toplanır; genel skorda eşit liderlerin hepsi +2, sonraki puan +1, herkes eşitse herkes +1; eşleşmede boşluk/tire, çoğul
eki ve (6+ harfte) tek harf farkı yok sayılır; aynı odada son 60 kelime tekrar gelmez (süzgeç yerleşik havuza da
uygulanır); kelimeler kolaydan zora çekilir; oyuncunun yazdığı biçim küçük harfe çevrilmeden gösterilir. `docs/KURALLAR.md`,
wiki ve testler buna göre güncellenir.

**Değişmeyenler:** 2–8 oyuncu, kelime başına tek cevap ve gönderilen cevabın kesinliği, ağın en az iki kişi olması, ağ
puanının ağdaki kişi sayısı olması, tek kalanın ve yazmayanın 0 alması, eksi puan yok, klavyeden bağımsız eşleşme,
erken bitiş kuralı, cevapların açılışa kadar gizli kalması.

**🎨 Yeni görsel gerekenler (paket):** neon düğüm ve elektrik patlaması dokusu (CG-U5), küçük koyun simgesi (CG-U7; SVG
ile de olur).
