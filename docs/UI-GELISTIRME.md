# Oyun hissi geliştirmesi: karar defteri

Sahiple oyun oyun konuşulan, kabul edilen arayüz önerileri ve kural değişiklikleri. Tüm oyunlar konuşulduktan sonra
yapıma geçilir; o zamana kadar kod değişmez. Kural değişiklikleri yapılırken `docs/KURALLAR.md` ve wiki içeriği de
güncellenir.

## Tüm oyunlar (genel kararlar)

- **Sonuç ekranı oyuncu onayıyla geçer:** her oyunun sonuç ekranında "Devam et" düğmesi olur; bağlı oyuncuların
  hepsi bastığında bir sonraki aşamaya geçilir. Süre sınırı yine vardır ama uzundur (60 sn), böylece kimse sonucu
  tam görmeden geçmez. Ayrıntılar (yapımda uygulanacak varsayılanlar): yalnız bağlı oyuncular beklenir; kopan
  oyuncu beklenmez; izleyiciler beklenmez; kimin bastığı avatarlarla gösterilir; sonuç animasyonu bitmeden düğme
  basılabilir ama animasyon atlanmaz, sayılır. Sahip, sonuç süresi kısalsın derse bu tek ayardan değişir.
- **Öneri dosyaları:** her oyunun önerileri `docs/oneriler/<oyun>.md` dosyasındadır; onaylananlar bu deftere işlenir.
  Yeni görsel (asset) üretimi gereken maddeler öneride ayrıca belirtilir.

## Aşırı Yükleme

### Kural değişikliği (sahip isteği)

- Bar 100'ü geçtikten sonra basan **herkes** patlar ve ceza alır; ceza tek kişiye (yalnız ilk aşana) verilmez.
  Bugünkü kural: 100'ü aşan ilk tık patlatır ve tur o anda biter.
- Oyun sırasında toplam basılan sayı yine **gösterilmez** (kimse doluluğu bilmez).

Sahibin kararları:
1. **Tur akışı:** bar 100'e ulaşınca gizli tehlike penceresi (3 sn) başlar ve tur ilk aşan tıkta bitmez; pencere
   sonuna kadar sürer. Pencerede (100'ü geçtikten sonra) basan herkes patlar.
2. **Patlama cezası:** 100'den sonra en çok basan tek kişi -2, diğer patlayanlar -1. Yalnız bir kişi 100'den
   sonra bastıysa o kişi -1 alır. 100'den sonra en çok basanlar eşitse hepsi -1 alır (kimse -2 almaz).
3. **Sıralama ödülü:** yalnız patlamayanlar sıralanır; sayılan, 100'ü geçmeden (bar dolana kadar) yapılan
   tıklamalardır. Tek lider +2, ikinci +1, diğerleri 0. Liderler eşitse hepsi +1 alır (bugünkü kuraldaki gibi bu
   durumda +2 ve ikinci sıra ödülü verilmez). Hiç tıklamayan ödül almaz.
4. **Patlayanlar sıralamaya girmez:** 100'den önce ne kadar basmış olursa olsun yalnız patlama cezasını alır.
5. **Kimse 100'ü geçmezse:** eksi puan yok (bugünkü "en az tıklayana -1" cezası tamamen kalkar). Bar hiç dolmadan
   süre biterse de sıralama ödülü aynı şekilde verilir.
6. Oyun sırasında toplam yine gösterilmez; toplam yalnız sonuç ekranında (sıralı açılışta) görünür.

### Kabul edilen arayüz önerileri

**Dokunma anı**
- **Çekirdek tepki versin:** her dokunuşta çekirdek kısa bir an içe çöküp geri esner; halkalar dokunulan yönden
  dalgalanır.
- **Dokunulan yerden çekirdeğe enerji aksın:** parmağın değdiği noktadan çekirdeğe küçük ışık parçacıkları çekilir
  ("ben besliyorum" hissi).
- **Kendi hızına göre yükselen ses:** hızlı bastıkça vınlama sesi inceleşir, durunca söner. Yalnız oyuncunun kendi
  hızını yansıtır, barı değil. Kısa bir seri olunca küçük bir "ritim" efekti çıkar.
- **Titreşim:** yavaş basışta yumuşak, seride daha sert vuruşlar.
- **Arka plan yaşasın:** üstteki reaktör tüpünde borular nabız gibi parlar, ara ara buhar fışkırır, uyarı lambaları
  döner. Hepsi zamana bağlıdır, doluluğu göstermez.

**Patlama ve sonuç**
- **Patlama sahnesi:** beyaz flaş, çekirdek parçalara ayrılır, ekranı kaplayan şok dalgası, güçlü sarsıntı, çok
  kısa yavaş çekim, derin patlama sesi (bugün yalnız beyaz parlama ve hafif sarsıntı var).
- **Sonuçlar sırayla açılsın:** önce toplam sayaç 0'dan gerçek toplama hızla yükselir (herkes doluluğu ilk kez
  burada görür); sonra oyuncular tek tek gelir; patlayan(lar) en son, avatarın üstünde çatlak efekti ve
  "PATLATTI" damgasıyla açılır.
- **Kendi satırın parlasın:** puan, ekranın üstündeki puan yazısına uçarak eklenir.

### Not edilen, karar bekleyen

- Tehlike başladığında ekranda hâlâ "Çekirdeğe hızlıca dokun!" yazıyor; o anda dokunmak patlatıyor. Yeni kuralda
  da çelişkili kalır. Önerilen: tehlikede yazı kırmızı ve titreyen "DOKUNMA!" ya da "AŞIRI YÜK!" olur.
- Sıralı sonuç açılışı ve patlama sahnesi bugünkü 5 sn sonuç süresine sığmayabilir (7-8 sn gerekebilir).
- Kabul edilmeyenler (şimdilik): tehlike anı efektleri (siren, çatlama, kalp atışı), geri sayımın reaktör
  ateşlemesine dönmesi, izleyici ekranı, diğer oyuncuların kıvılcımları, yanıltıcı uyarılar.

## Gizli Alışveriş

Ayrıntılar: `docs/oneriler/gizli-alisveris.md`. Onaylananlar (dosyadaki ayrıntılarıyla):

- **GA-M1** Her maç farklı raf: 20 ürünlük havuzdan 12'si, fiyatlar maç başına ±%30.
- **GA-M2** Gizli kupon: herkese kendine özel bir üründe %50 indirim (yalnız ödenen fiyat düşer, değer değişmez).
- **GA-M3** Vitrin fısıltısı: 15. saniyede ürünlerin üstünde talep ateşi (🔥/🔥🔥/🔥🔥🔥), 15. saniyedeki duruma göre
  donar.
- **GA-M4 (değiştirilmiş)** Puanlama: en değerli sepet **+2**, ikinci **+1**, diğerleri **0**. **Eksi puan yok**
  (önerideki "en değersiz −1" kaldırıldı). Birincide eşitlik varsa hepsi +2, sonraki farklı değer +1. Herkesin
  değeri aynıysa kimse puan almaz. Değeri 0 olan (boş sepet) ödül almaz.
- **GA-U1** Gerçek mağaza rafı (renkli ürünler, büyük görseller, raf tahtası, etiket).
- **GA-U2** Ürün sepete uçsun, üstte sepet şeridi, dönen bütçe sayacı.
- **GA-U3** Son 10 saniye gerilimi ("Kasa kapanıyor!").
- **GA-U4** Tamam sonrası paketlenmiş sepet bekleme ekranı.
- **GA-U5** Sahne sahne sonuç açılışı (kepenk → ürün ürün çakışma → sepetler sondan başa → puanlar). Sonuç süresi
  genel karara bağlanır: herkes "Devam et" deyince geçer, en çok 60 sn.
- **GA-U6** Mağazaya özel ses ve titreşim seti.
- **GA-U7** İzleyici ve TV vitrini (talep ateşi dahil).
- **Ürün sınırı yok (sahip kararı):** oyuncu bütçesiyle alabildiği kadar ürün alır; tek sınır 60 kredi ve her
  üründen bir tane. Raftaki "en ucuz 5 ürünün toplamı 60'ı geçmeli" şartı kalkar.
- Onaylanmayanlar: GA-M5 (tekel bonusu), GA-M6 (sabotaj etiketi), GA-AI1, GA-AI2.

**Yeni görsel gerekenler:** 8 yeni ürün görseli (GA-M1; mevcut 12 ürünle aynı tarz), kupon etiketi (GA-M2),
alışveriş poşeti (GA-U4), metal kepenk (GA-U5), raf tahtası ve fiyat etiketi (GA-U1; CSS ile de çizilebilir).

## Kontrol Paneli Kaosu

Ayrıntılar: `docs/oneriler/kontrol-paneli-kaosu.md`. Onaylananlar (dosyadaki ayrıntılarıyla):

- **KP-M1** Üç dalga, artan zorluk (25 / 25 / 20 sn; dalga 3'te 5 kablo, 5. renk mor; dalgalar arası 4 sn kısa sonuç).
- **KP-M2** Yeni ipucu türleri (değilse, yan yana, konum hedefi, sıra); her ipucu yalnız hedef panele uyar.
- **KP-M3** Ortak bomba saati: yanlış kesim herkesin saatinden 5 sn düşer (en az 3 sn kalır).
- **KP-M4** Puan: dalgalarda toplanan imha puanına göre +2 / +1 / 0; herkes eşitse herkes +1; eksi yok.
- **KP-M5** KURALLAR'daki "kablo nabız atar" maddesi kaldırılır.
- **KP-U1** Gerçek bomba (gövde, 7 segmentli kırmızı saat, hızlanan tik, yanlış kesimde "bzzzt").
- **KP-U3** İpucu notu buruşuk kâğıt, "🎤 Sesli oku" rozeti, dokununca büyür.
- **KP-U5** İzleyici ve TV: büyük bomba saati, dalga numarası, kimin kestiği.
- **KP-U6** Bombaya özel ses ve titreşim seti.
- **KP-AI2** Bomba uzmanı yorumu (oyun sonunda tek cümlelik esprili özet; yapay zekâ yalnız metin yazar, hata olursa
  yorum görünmez, oyun beklemez, yasaklı kelime süzgeci, API anahtarı yoksa özellik kapalı).
- Onaylanmayanlar: KP-U2 (basılı tutarak pense; bugünkü seç + KES düğmesi kalır), KP-U4 (çember zincir sonuç; bugünkü
  liste düzeni kalır, dalga bilgisiyle genişler), KP-M6 (sabotajcı), KP-AI1 (yapay zekâ ipucu).

**Yeni görsel gerekenler:** bomba gövdesi (KP-U1), kâğıt not dokusu ve bant (KP-U3), mor kablo (KP-M1; mevcut kablo
görselinin renk varyantı).

## Zehirli Kadeh

Ayrıntılar: `docs/oneriler/zehirli-kadeh.md`. Onaylananlar:

- **ZK-M2 (değiştirilmiş) Kontrol hakkı:** her oyuncunun **1 kontrol hakkı** vardır: süre içinde istediği zaman,
  kendisi dışındaki bir oyuncunun **o anki** kadehini seçip gizlice kontrol eder (zehirli mi temiz mi; sonuç yalnız
  kendisine görünür ve oyun boyunca hatırlanır). Kendi kadehini kontrol edemez. Kontrol rastgele değildir, oyuncu
  seçer. Kontrol edilen kadeh daha sonra takasla yer değiştirirse oyuncunun bilgisi o kadehe (kadeh numarasına) bağlı
  kalır. Kimin kimi kontrol ettiği herkese açık değildir; kontrol hakkını kullanıp kullanmadığın da gizlidir.
  Takas hakkı (kişi başı 1) ve puanlama (temiz +1, zehirli 0) aynen kalır. Kendi kadehini bilmek (ZK-M1) yoktur.
- **ZK-U1** Ziyafet masası sahnesi (büyük kadehler, avatarlar, eriyen mum sayaç, belirgin seçili kadeh).
- **ZK-U3** Takas anı (yay animasyonu, "Mert ⇄ Elif" şeridi, takas geçmişi okları, hakkı kullananın işareti).
- **ZK-U4** "Şerefe!" sonuç açılışı (kadehler tek tek, kendi kadehin en son; altın kadeh yok).
- **ZK-U5** Son 5 saniye gerilimi (mum titrer, kalp atışı, titreşim).
- **ZK-U6** İzleyici ve TV ziyafet masası (zehir bilgisi sonuca kadar yok).
- Onaylanmayanlar: ZK-M1, ZK-M3 (altın kadeh), ZK-M4, ZK-M5, ZK-U2, ZK-U7 (ses seti), ZK-AI1.

**Yeni görsel gerekenler:** ziyafet masası arka planı, mum; kontrol anı için kadehin gizlice açıldığı küçük bir
görünüm (mevcut kadeh görselleriyle, CSS ile yapılabilir).

## Çapraz Ateş

Ayrıntılar: `docs/oneriler/capraz-ates.md`. Onaylananlar (dosyadaki ayrıntılarıyla):

- **CA-M1** Siper al: hedef yerine siper seçilebilir; siperde hedeflenme cezası yok, +1 de yok; siperdekini
  hedefleyen "ateş etti" sayılır.
- **CA-M2** İki tur (20 sn + 20 sn), tur 1 sonrası 5 sn kısa açılış, puanlar toplanır (−2…+2). Eksi puan bu oyunda
  korunur.
- **CA-U1** Nişan alma anı (kayarak kilitlenen nişangâh, alttaki kendi avatarın, lazer çizgisi, siper düğmesi).
- **CA-U2** "Tamam" → "ATEŞE HAZIR" (silah kurma sesi, mermi simgeleri).
- **CA-U3** Son 5 saniye düello anı ("3 · 2 · 1 · ATEŞ!", ıslık).
- **CA-U4** Ağır çekim mermili tam ekran açılış; "Seni vuranlar" satırı; "En çok hedeflenen" özeti.
- **CA-U5** İkinci turda tur 1 bilgisi (rozetler, mini halka).
- **CA-U6** Ses ve titreşim seti.
- **CA-U7** İzleyici ve TV.
- **CA-AI1** Düello spikeri yorumu (ortak yapay zekâ yorum altyapısıyla; API anahtarı bağlanınca açılır).
- Onaylanmayanlar: CA-M3 (döngü kuralı; bugünkü kural kalır), CA-M4 (eksisiz puanlama), CA-M5 (hedef sayacı).

**Yeni görsel gerekenler:** namlu ateşi, mermi parıltısı, kalkan, cam çatlağı katmanı; isteğe bağlı silah/el.

## Zaman Bombası Hafızası

Ayrıntılar: `docs/oneriler/zaman-bombasi-hafizasi.md`. Onaylananlar (dosyadaki ayrıntılarıyla):

- **ZB-M1** Bombayı at: diziyi doğru giren, sırayı kime geçireceğini seçer (4 sn; seçmezse rastgele); kendine ve
  bombayı az önce kendisine atana hemen geri atamaz (3+ oyuncuda); elenmeden sonra yeni kurbanı bombayı atan seçer.
- **ZB-M2** Rengi sen eklersin: doğru giren, eklenecek rengi seçer (ani ölümde biri oyuncu, biri rastgele;
  elenme sonrası yeni 2 renk rastgele; seçmezse rastgele).
- **ZB-M3 (değiştirilmiş, eksi puan yok)** Puan: oyun sonunda hayatta kalanlar **+2**, bütün elenenler **0**
  (ilk elenen dahil; −1 yok). Kimse elenmeden 90 sn dolarsa herkes **+1**. Biriken "+1"ler kalkar. Kartlarda
  "birinci" = hayatta kalanlar, "sonuncu" = elenenler.
- **ZB-U1** Fitilli gerçek bomba; bomba seçilen kişiye fırlatılır.
- **ZB-U2** Sıra sana geçtiğinde güçlü titreşim, kenar ışığı, "SIRA SENDE!" bandı; oynatma uyarıdan sonra başlar.
- **ZB-U3** Dolgun oynatma ve büyük "DİZİ 7" sayacı.
- **ZB-U4** Doğru giriş anı ("TEMİZ!", yeni nokta, ardından renk ve hedef seçimi).
- **ZB-U5** Elenme anı (avatar savrulur, sarsıntı).
- **ZB-U8** TV ekranı yeni düzen.
- **ZB-U9** Ses ve titreşim seti.
- Onaylanmayanlar: ZB-M4 (tahmin), ZB-M5 (ters dizi), ZB-U6 (ani ölüm girişi), ZB-U7 (tahmin ekranı), ZB-AI1.

**Yeni görsel gerekenler:** fitilli bomba (gövde + fitil + kıvılcım).
