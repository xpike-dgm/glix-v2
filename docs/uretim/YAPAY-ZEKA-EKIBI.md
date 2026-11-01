# GLIX yapay zekâ ekibi: 13 alan yöneticisi

GLIX'te sahip, her biri bir alanın tam sahibi olan 13 yapay zekâyla sürekli üretim yapar. Hiçbiri koda girmez.
Her yapay zekâ kendi alanındaki her şeyi uçtan uca yönetir:
- yeni şey üretir;
- var olanı düzenler, dengeler ya da emekliye ayırmayı önerir;
- alanının kurallarını ve sayılarını (fiyat, oran, süre, ses düzeyi…) ayarlar.

Bütün teslimler **Üretim Merkezi** sitesine düşer, sahip orada görür ve onaylar. Onaylananlar yönetici (Claude)
"onaylananları ekle" denince oyuna eklenir, test edilir ve kimse oynamıyorken sahip isteyince canlıya alınır.
İçerik havuzu, moderasyon listesi gibi kod gerektirmeyen veriler ise tek tıkla doğrudan oyuna aktarılır.

Modelleri sahip seçer ve istediği zaman değiştirir; bu belge model adı içermez.

Örnek: **Mağaza yapay zekâsı** yeni bir ürün çıkarırken ürünün fikrini, adını, açıklamasını, türünü, nadirliğini,
fiyatını, görselini ve varsa animasyonunu ya da efektini kendisi hazırlar. Mağaza önizlemesinde bitmiş hâliyle
sahibin onayına sunar.

---

## 1. İlkeler

1. **Alan sahipliği.** Her yapay zekânın alanı bu belgede yazılıdır. Alanının içinde tam yetkilidir (üretir,
   düzenler, ayarlar, önerir), dışında hiçbir şey üretmez. Başka bir alandan bir şeye ihtiyacı olursa o alanın
   yapay zekâsına sitede **istek kartı** açar.
2. **Koda girmez, veri teslim eder.** Bütün alanlar oyunda **veriyle yönetilir hâle getirilir** (bkz. bölüm 2).
   Yapay zekâ katalog satırı, görsel, ses, animasyon tanımı gibi veri üretir; oyun bu veriyi okur.
3. **Kod isteği.** Veriyle yapılamayan bir şey gerekirse (yeni kart etkisi, yeni rozet koşulu, yeni efekt türü)
   yapay zekâ bunu üretmeye çalışmaz. Gerekçeli bir **kod isteği** yazar. Sahip onaylarsa yönetici yapar; o andan
   sonra o şey de veriyle yönetilir hâle gelir.
4. **Üç yetki basamağı:**
   - **Kendi kararı:** alan kuralları içinde kalan ayrıntılar (ör. görselin renk tonu, ses dosyasının düzeyi).
     Ön kontrol geçerse onaya hazır sayılır.
   - **Sahip onayı:** oyuncuya görünen her yeni şey ve her değişiklik (yeni ürün, fiyat, kart oranı, wiki metni…).
   - **Kod isteği:** veriyle yapılamayan her şey.
5. **Var olanı bozmaz.** Satılmış bir ürün silinmez, yalnız "satıştan kaldır" önerilir. Kazanılmış bir rozet geri
   alınmaz. Bir dosyayı değiştirmek, eskisinin yerine yeni sürüm teslim etmek demektir; eskisi arşivde kalır.
6. **Her değişiklik bir farktır.** Düzenleme teslimleri "eski → yeni" olarak gelir (ör. fiyat 400 → 350, gerekçe).
   Sahip farkı görür.
7. **Ret notlu yapılır.** Not, o yapay zekânın geri bildirim dosyasına düşer; bir sonraki turda dikkate alır.
8. **Canlıya alma yalnız sahip isteyince ve kimse oynamıyorken yapılır.** Hiçbir yapay zekâ ve otomasyon canlıya
   almaz.
9. **Gizlilik.** Yapay zekâlara oyuncu adı, e-posta, hesap kimliği, anahtar ya da şifre verilmez. Rapor üreten
   yapay zekâ (10) yalnız anonim ve toplu veri görür.
10. **Tarz birliği.** Görsel üreten bütün yapay zekâlar aynı stil önekini (`docs/GORSEL-URETIM.md`) ve renk paletini
    kullanır. Ses üretenler aynı ses kimliğine (bölüm 4.6–4.7) uyar.
11. **Görseller görsel üretim modeliyle.** Görsel üreten yapay zekâ görselleri görsel üretim becerisi ya da aracıyla
    üretir (ör. Codex'in imagegen becerisi, ChatGPT görsel oluşturma). Python/PIL, SVG, canvas gibi kodla çizmek
    yasaktır; beceri ortamda yoksa görsel teslim etmez ve bunu söyler. Önce `okunur/referans/` altındaki oyundaki
    mevcut görsellere bakar; kalite çıtası onlardır. Teslimde `uretimYontemi: "gorsel-model"` yazar ("kod" kalır).
    Ayrıntı: `SOZLESME.md` bölüm 10.
12. **Fikirler panoya, raporlar panoya.** Fikir istenince her fikir ayrı öğe: `ozet`, `kategori`, `etki`, `zahmet`,
    `gerekce` (`tur: "fikir"`). Sahip panoda süzer, onaylar, not yazar. "Onaylananları uygula" işinde `is_oku`
    fikirleri verir; her teslim öğesine uyguladığın fikrin `fikirId`sini yaz. Raporlar (`tur: "rapor"`) metin değil
    yapılandırılmış nesnedir: özet kutucukları, seriler, tablolar, bulgular; site grafikli panoda önceki raporla
    karşılaştırarak gösterir. Kabul edilen teslim "Kabul havuzu"na düşer; sahip "Yöneticiye gönder" der. Ayrıntı:
    `SOZLESME.md` bölüm 12.

---

## 2. Alanların veriyle yönetilmesi için tek seferlik altyapı (yönetici yapar)

Bugün bazı alanlar kodun içinde duruyor. Örneğin mağaza kataloğu kod dosyasında, fiyat yalnız nadirlikten
türüyor, sesler ve müzik kodla sentezleniyor. Bir yapay zekânın alanını koda girmeden tam yönetebilmesi için önce bu
alanların **katalog dosyalarına** (JSON) ve **varlık klasörlerine** taşınması gerekir. Oyun bu dosyaları okur, site
de aynı dosyalarla önizleme yapar. Her madde bir kez yapılır.

| Kod | Alan | Yapılacak | Sonuç |
|---|---|---|---|
| ALT-1 | Mağaza | Ürün kataloğunu `katalog/magaza.json`'a taşı; ürün başına **fiyat** alanı (nadirlik varsayılan aralığı verir, ürün kendi fiyatını taşıyabilir); "satıştan kaldırıldı" ve "koleksiyon" alanları. | Ürün ekleme, fiyat ve nadirlik değiştirme kodsuz |
| ALT-2 | Mağaza | **Efekt tarifi** biçimi: ad efekti, çerçeve, giriş ve zafer efektleri için hazır efekt motorları (parlama, akan renk, kıvılcım, dönen halka, parçacık yağmuru, kare kare animasyon) ve bunların parametreleri (renkler, hız, yoğunluk, doku dosyası). Yeni ürün yeni bir tarif ve doku demektir. | Animasyonlu ürünler kodsuz |
| ALT-3 | Mağaza | Dans ve giysi teslimlerini doğrulayan araç (dans JSON'u `rig.json` kemikleriyle uyumlu mu, giysi katmanı doğru mu). | Kürsü dansları ve giysiler kodsuz |
| ALT-4 | Rozet | Rozet tanımlarını `katalog/rozetler.json`'a taşı; koşulları **ölçülebilir olaylar listesinden** seçilir hâle getir (maç sayısı, galibiyet, belirli oyunda belirli sonuç, seri, arkadaşla oynama…). | Yeni rozet kodsuz; yeni olay türü kod isteği |
| ALT-5 | Maç kartları | Kart kataloğunu (ad, metin, nadirlik, açık/kapalı, çekiliş ağırlıkları, kötü kart oranı, el sınırı, süre) `katalog/kartlar.json`'a taşı. Kart **etkisi** kodda kalır, katalog yalnız var olan etkilere bağlanır. | Kart dengesi ve metni kodsuz; yeni etki kod isteği |
| ALT-6 | Arayüz ikon ve süsleri | İkon kaydı: her ikon adı → SVG dosyası; süsler (köşe, ayraç, rozet çerçevesi) için kayıt; tema renk değişkenleriyle boyanma. | İkon ve süs değişimi kodsuz |
| ALT-7 | Efekt dokuları | Genel efekt kaydı: efekt adı (konfeti, kıvılcım, duman, cam kırığı, ışık huzmesi…) → doku/sprite dosyası + parametreler. Oyunlar efekti adla çağırır. | Oyun efektleri kodsuz değişir |
| ALT-8 | Ses efektleri | **Ses olay haritası**: her oyunun her anı (ör. `kara-borsa.tokmak`) → ses dosyası, düzey, varyasyonlar. Dosya yoksa bugünkü sentez sesi çalar. | Sesler tek tek, kodsuz gerçek sese geçer |
| ALT-9 | Müzik | Müzik kaydı: lobi, oyun başına tema, gerilim, sonuç, final → dosya, döngü noktaları, düzey. Dosya yoksa bugünkü üretilen müzik çalar. | Müzik kodsuz |
| ALT-10 | İçerik havuzu | Mevcut havuzlar zaten yönetici panelinde veriyle yönetiliyor. Eksik: **zorluk etiketi**, **istatistik** (hangi kayıt kaç kez çıktı, kaç kez atlandı) ve dışarıdan toplu aktarma ucu. | Havuzlar tam kodsuz |
| ALT-11 | Moderasyon ve wiki | Yasaklı kelime listesine toplu aktarma ve **yanlış alarm raporu**; wiki JSON'larını teslimden doğrudan alan aktarım. | Kodsuz |
| ALT-12 | Test ve izleme | Salt okunur, anonim **izleme dışa aktarımı** (hata grupları, oyun çökmeleri, performans ölçüleri); test sunucusunda **bot senaryo** biçimi (oyun, oyuncu sayısı, hamle stratejisi, beklenen sonuç). | Yapay zekâ 10 canlıya dokunmadan çalışır |
| ALT-13 | Hepsi | Üretim Merkezi sitesi: teslim kutuları, ön kontroller, alan başına önizleme, fark görünümü, onay, istek kartları, arşiv. | Akışın kendisi |

Önerilen sıra: ALT-13 ile ALT-1/2 (mağaza ilk alan), sonra ALT-8/9 (ses ve müzik oyun hissini en çok artırır),
sonra ALT-4, 5, 10, 11, 12, en son 6 ve 7.

---

## 3. Ortak teslim paketi

Her teslim bir klasördür: `<alan>/<tarih>-<kısa-ad>/`. İçinde:

- **`teslim.json`:** alan, iş kimliği, tür (`yeni` / `düzenleme` / `kaldırma-önerisi` / `rapor` / `kod-isteği` /
  `istek-kartı`), öğeler. Her öğede ad, açıklama, gerekçe ve dosya listesi bulunur. Görsel içeren teslimde
  `uretimYontemi: "gorsel-model"` (bölüm 1, ilke 11).
- **Varlıklar:** görsel (şeffaf PNG), animasyon (kare kare PNG ya da efekt tarifi JSON'u), ses (WAV/OGG), SVG.
- **Katalog satırı:** alanın katalog biçiminde (bölüm 2) eklenecek ya da değişecek satırlar.
- **Önizleme notu:** sitenin bu öğeyi nasıl göstereceği; örneğin "mağaza kartı + kuşanılmış avatar" ya da
  "kart yüzü + oyundaki el".

Yasaklar (hepsinde): gerçek marka, gerçek kişi, telifli karakter ya da müzik, siyasi ve dini hassas içerik,
şiddet, cinsellik, görsellerde istenmedikçe yazı/harf/rakam.

---

## 4. Alan yöneticileri (13)

Her alanda aynı başlıklar:
- **Alanı:** neyin sahibi;
- **Yapabildikleri:** kendi başına;
- **Bir teslimde:** paketin parçaları;
- **Ayarlayabildiği sayılar:**
- **Sınırlar:**
- **Ön kontrol:** site otomatik denetler;
- **Sahibin ekranı:**
- **Kod isteği örnekleri:**
- **Örnek iş:**

### 4.1 Mağaza yapay zekâsı

- **Alanı:** Mağazadaki bütün ürün türleri:
  - lakap (unvan), ad efekti, avatar çerçevesi;
  - kürsü dansı;
  - giysiler (şapka, üst, alt, ayakkabı, aksesuar, kostüm) ve beş neon renk uyumu;
  - kart arkası, zafer kutlaması, tepki paketi, lobi giriş efekti, Glix jeton görselleri;
  - koleksiyonlar, günün fırsatı kuralları, mağaza vitrini.
- **Yapabildikleri:**
  - **Yeni ürün:** fikir, ad, açıklama, tür, nadirlik, **fiyat**, koleksiyon ve görsel. Animasyonlu türlerde
    animasyonu da hazırlar:
    - zafer: 4 kare;
    - tepki paketi: 6 kare;
    - giriş efekti: zemin ve ışık katmanı;
    - dans: `rig.json` iskeletine uygun dans JSON'u;
    - ad efekti ve çerçeve: efekt tarifi + doku (ALT-2).
  - **Var olan ürünü düzenleme:** fiyat, ad, açıklama, görselin yeni sürümü.
  - **Satıştan kaldırma önerisi:** satılmayan ya da tarza uymayan ürünler için.
  - **Koleksiyon ve sezon vitrini:** birlikte çıkan ürün grupları, vitrin sırası.
  - **Fiyat dengesi:** satış istatistiğine bakarak (anonim ve toplu) fiyat ayarı önerir.
- **Bir teslimde:** ürün satırı + kapak görseli + türüne göre varlıklar (kareler, dans JSON'u, efekt tarifi,
  dokular) + mağaza kartı önizlemesi.
- **Ayarlayabildiği sayılar:**
  - ürün fiyatı, nadirlik aralığının içinde (sahip aralıkları belirler; bugün sıradan 150, nadir 400, efsanevi 1000 Glix);
  - günün fırsatı indirim oranı ve kaç ürün olacağı;
  - koleksiyon çıkış tarihi.
- **Sınırlar:**
  - Satılmış ürünü silmez.
  - Para ile satış, şans kutusu ya da kumar benzeri düzenek önermez.
  - Oyun içi görsel, rozet ya da maç kartı üretmez.
  - Kart arkası mağaza ürünüdür ve onun alanındadır; maç kartının yüzü ise Maç Kartları yapay zekâsının alanıdır.
- **Ön kontrol:**
  - ad tekrarı yok, ad ≤ 24 karakter, açıklama ≤ 90 karakter;
  - fiyat aralıkta;
  - görsel oranı ve şeffaflığı türüne uygun;
  - kare sayısı doğru (zafer 4, tepki 6);
  - dans JSON'u iskeletle uyumlu (ALT-3);
  - efekt tarifi geçerli bir motoru ve geçerli parametreleri kullanıyor;
  - dosya boyutu sınırda.
- **Sahibin ekranı:**
  - mağaza kartının birebir önizlemesi;
  - ürün kuşanılmış avatar (lobi, skor şeridi, kürsü);
  - animasyon oynatılarak;
  - aynı koleksiyonun diğer ürünleriyle yan yana.
- **Kod isteği örnekleri:** yeni bir ürün türü (ör. "sohbet balonu"); efekt motorlarında olmayan bir efekt türü.
- **Örnek iş:** "Neon gece koleksiyonu: 4 çerçeve, 2 ad efekti, 1 giriş efekti, 1 zafer kutlaması. Biri efsanevi,
  ikisi nadir."

### 4.2 Rozet yapay zekâsı

- **Alanı:** Bütün rozetler: amacı (kazanılma koşulu), adı, açıklaması, görseli, seviyesi (varsa seri: bronz,
  gümüş, altın), rozet rafındaki sırası, rozetin kazanıldığı andaki kutlama görseli.
- **Yapabildikleri:**
  - Yeni rozet: koşulu ölçülebilir olaylar listesinden kurar (ALT-4). Örnekler: "Kara Borsa'da 3 kez Kelepir",
    "arkadaşla 10 maç", "bir maçta 3 oyunda birinci".
  - Rozet serileri: aynı koşulun artan basamakları.
  - Var olan rozetin adını, açıklamasını ve görselini düzenleme.
  - Zorluk ayarı: çok kolay ya da hiç kazanılmayan rozet için eşik önerisi.
  - Günlük görev sistemine rozet bağlantısı önerisi.
- **Bir teslimde:** rozet satırı (ad, açıklama, koşul, eşik, seri) + kare şeffaf görsel + rafta önizleme.
- **Ayarlayabildiği sayılar:** eşikler (kaç maç, kaç galibiyet…), seri basamakları.
- **Sınırlar:** kazanılmış rozeti geri almaz. Ölçülemeyen koşul ("iyi oynamak") yazmaz. Utandırıcı rozet ("hep
  kaybeden") yapmaz.
- **Ön kontrol:** koşul olay listesinde var, eşik pozitif tamsayı, ad tekrarı yok, görsel 48 px'te okunur (siluet
  kontrastı), yazı yok.
- **Sahibin ekranı:** profil rozet rafı (48 ve 96 px), kazanma anı önizlemesi, "bugünkü verilere göre oyuncuların
  yüzde kaçı bunu zaten kazanmış olurdu" tahmini (ALT-12 verisiyle).
- **Kod isteği örnekleri:** listede olmayan yeni bir olay türü; örneğin "bir oyunda hiç puan almadan kazanmak".
- **Örnek iş:** "Her oyun için 1 ustalık rozeti (toplam 30), bronz, gümüş ve altın serili."

### 4.3 Maç Kartları yapay zekâsı

- **Alanı:** Maç kartı sisteminin bütün verisi: kart adı, kart metni, nadirlik, açık/kapalı, çekiliş ağırlıkları,
  kötü kart oranı, el sınırı, kart evresi süresi, kart yüzü görselleri, kart dengesi.
- **Yapabildikleri:**
  - Var olan etkilerle **yeni kart çeşitleri**: aynı etkinin farklı güçte, adda ya da nadirlikte sürümleri.
  - Kart metinlerini netleştirme: anlaşılmayan kartları yeniden yazma.
  - **Denge ayarı:** maç verisinden hangi kartın çok güçlü ya da hiç seçilmediğini bulur, ağırlık ve nadirlik
    önerir.
  - Kart yüzü görselleri: yeni kart, var olan kartın yeni sürümü.
  - Tamamen yeni bir kart etkisi gerekiyorsa kural taslağını yazar ve kod isteği açar.
- **Bir teslimde:** kart satırı + kart yüzü görseli + "hangi kartlarla etkileşir" özeti + (dengede) eski/yeni
  oranlar ve gerekçe.
- **Ayarlayabildiği sayılar:** nadirlik ağırlıkları, kötü kart oranı, el sınırı, seçenek sayısı, kart evresi süresi
  (sahibin belirlediği aralıklarda).
- **Sınırlar:** kart kuralını kendisi uygulamaz; yeni etki her zaman kod isteğidir. `docs/KURALLAR.md`'deki kart
  kurallarıyla çelişemez.
- **Ön kontrol:** etki var olan etkilerden biri, metin ≤ 90 karakter, nadirlik geçerli, ağırlıkların toplamı ve
  kötü kart oranı aralıkta, görsel oranı.
- **Sahibin ekranı:** kart yüzü, oyundaki el görünümü, denge değişikliğinde "1000 çekilişte dağılım" benzetimi.
- **Kod isteği örnekleri:** "Takas: iki oyuncunun puanını değiştir" gibi yeni bir etki.
- **Örnek iş:** "Kötü kartların seçilme oranı yüksek; oran ve ağırlık ayarı + 2 yeni savunma kartı çeşidi."

### 4.4 Arayüz İkon ve Süsleri yapay zekâsı

- **Alanı:**
  - bütün arayüz ikonları (ses, çıkış, ayarlar, arkadaş, mağaza, görev, kilit, onay, oyun simgeleri…);
  - süsler: köşe süsleri, ayraçlar, başlık süsleri, düğme süsleri, panel kenarları;
  - boş durum çizimleri ("henüz arkadaşın yok" gibi);
  - oyun simge kartları (oyun seçim ekranındaki küçük simgeler).
- **Yapabildikleri:** yeni ikon, ikon setinin tutarlılık düzeltmesi, eski ikonun yeni sürümü, sezon süsleri
  (yılbaşı köşe süsü gibi), boş durum çizimleri.
- **Bir teslimde:** SVG (tercih) ya da şeffaf PNG + ikon kaydı satırı (ad → dosya) + açık/koyu tema önizlemesi.
- **Ayarlayabildiği sayılar:** ikon çizgi kalınlığı, köşe yuvarlaklığı (set geneli; değişiklik bütün sete uygulanır).
- **Sınırlar:** ekran yerleşimini, düğme boyutlarını, metinleri değiştirmez. Renkleri sabit kodlamaz, tema
  değişkenini kullanır.
- **Ön kontrol:** SVG'de betik ve dış bağlantı yok, görüntü kutusu kare, tek renkle boyanabilir (ya da tema
  değişkenleri), 16/24/32 px'te okunur, dosya ≤ 8 KB.
- **Sahibin ekranı:** bütün ikon seti bir tabloda, eski/yeni yan yana, gerçek ekranda (üst çubuk, menü, düğme).
- **Kod isteği örnekleri:** yeni bir ekrana yeni ikon yeri açılması.
- **Örnek iş:** "Üst çubuktaki 6 ikonu tek kalınlıkta yeniden çiz; 30 oyun için oyun simgesi seti."

### 4.5 Efekt Dokuları yapay zekâsı

- **Alanı:** Oyunlardaki ve genel arayüzdeki bütün görsel efektler:
  - konfeti, kıvılcım, duman, cam kırığı;
  - ışık huzmesi, neon iz, patlama, yıldız tozu, damga ve parıltı;
  - parçacık dokuları, sprite şeritleri ve bunların efekt kaydındaki parametreleri (ALT-7).
- **Yapabildikleri:** yeni efekt dokusu, var olan efektin yeni sürümü, efekt parametre ayarı (renk, hız,
  yoğunluk, süre), oyun başına efekt eşlemesi önerisi ("Kule kusursuz anı → yıldız tozu").
- **Bir teslimde:** doku/sprite PNG + efekt kaydı satırı + canlandırılmış önizleme.
- **Ayarlayabildiği sayılar:** parçacık sayısı, süre, hız, renk listesi (performans sınırları içinde).
- **Sınırlar:**
  - **Mağaza efektleri** (ad efekti, çerçeve, giriş, zafer) mağaza yapay zekâsının alanıdır. Mağaza isterse bu
    yapay zekâdan istek kartıyla doku ister.
  - Performans sınırını aşmaz: telefonda tek efekt en çok 60 parçacık, doku ≤ 256 px.
  - "Hareket azaltma" açıkken efekt sade sürümüne düşmelidir.
- **Ön kontrol:** doku boyutu, alfa, sprite kare sayısı ve ızgarası, parametreler sınırda.
- **Sahibin ekranı:** efekt oynatılarak, oyundaki anında (ör. Kule'nin kusursuz anı).
- **Kod isteği örnekleri:** yeni bir efekt motoru (ör. sıvı akışı).
- **Örnek iş:** "Bütün oyunların kazanma anı için ortak, daha zengin bir konfeti seti."

### 4.6 Ses Efektleri yapay zekâsı

- **Alanı:**
  - bütün oyun ve arayüz sesleri (dokunma, onay, hata, geri sayım tiki, kazanma, kaybetme);
  - oyun başına anlar (tokmak, kasa açılması, cam kırılması, vinç, daktilo, maske kırılması…);
  - tepki sesleri;
  - ses olay haritası, ses düzeyleri, varyasyonlar (aynı an için 2–3 farklı ses; tekrar sıkmasın diye).
- **Yapabildikleri:** sentezle çalan bir anı gerçek sese çevirme, var olan sesin yeni sürümü, düzey dengesi (bütün
  sesler aynı algılanan yükseklikte), oyun başına "ses kimliği" (Kara Borsa: ahşap ve metal; Zehirli Kadeh: cam ve
  sıvı).
- **Bir teslimde:** ses dosyaları (OGG, mono) + ses olay haritası satırları + an açıklaması.
- **Ayarlayabildiği sayılar:** an başına düzey (dB), varyasyon sayısı, gecikme.
- **Sınırlar:** telifli ses yok. Efekt ≤ 2 sn, arayüz sesi ≤ 0,4 sn. "Sessizde çal" ve ses düzeyi ayarları korunur.
  Spiker sesi (konuşma) bu alanda değil.
- **Ön kontrol:** süre, algılanan yükseklik (LUFS aralığı), baş/son sessizlik kırpılmış, kırpılma yok, dosya boyutu.
- **Sahibin ekranı:** an listesi; her anda eski (sentez) ve yeni ses yan yana oynat; oyun önizlemesinde o an
  tetiklenerek.
- **Kod isteği örnekleri:** haritada olmayan yeni bir an (oyunun kodunda o anın tetiklenmesi gerekir).
- **Örnek iş:** "Kara Borsa'nın bütün anları: tokmak, kapak, lanet dumanı, jeton, zarf."

### 4.7 Müzik yapay zekâsı

- **Alanı:** Bütün müzikler:
  - lobi müziği, oyun başına tema;
  - gerilim, son saniyeler, sonuç ve final müzikleri;
  - sezon müzikleri;
  - müzik kaydı: döngü noktaları, düzey, geçişler.
- **Yapabildikleri:** üretilen müzikten gerçek müziğe geçiş, oyun başına tema, gerilim katmanı (son 10 saniyede
  tempo artışı için ayrı katman), sezon varyantı.
- **Bir teslimde:** OGG + müzik kaydı satırı (döngü başı/sonu, düzey, hangi ekran).
- **Ayarlayabildiği sayılar:** düzey, döngü noktaları, geçiş süresi.
- **Sınırlar:** sözlü müzik yok (konuşmayı bastırmasın), telifli müzik yok, ticari kullanım lisansı olan araç.
  Müzik ses efektlerinden yüksek olmaz.
- **Ön kontrol:** döngü dikişi (baş/son dalga uyumu), algılanan yükseklik, süre (30–120 sn), dosya boyutu.
- **Sahibin ekranı:** döngü 3 kez arka arkaya, oyun ekranı önizlemesiyle birlikte.
- **Kod isteği örnekleri:** müziğin oyun anına bağlı değişmesi (yeni tetik).
- **Örnek iş:** "Lobi müziği + 5 oyunun teması + ortak sonuç müziği."

### 4.8 İçerik Havuzu yapay zekâsı

- **Alanı:** Oyunların bütün içerik havuzları:
  - Sözlük Blöfü kelimeleri ve tanımları;
  - Sızma ve Karalama Defteri kelime çiftleri;
  - Çağrışım Ağı kelimeleri;
  - Laf Sokma soruları;
  - Yazı Yaz ve Kendim konuları;
  - ileride eklenecek her yeni havuz.
- **Yapabildikleri:**
  - Yeni kayıt ekleme.
  - Var olanı düzeltme (yazım, zorluk).
  - Kapatma önerisi: çok sık atlanan, anlaşılmayan, tekrar eden kayıtlar.
  - Zorluk etiketi verme (ALT-10).
  - Tema paketleri hazırlama (okul, mutfak, tatil).
  - Havuz dengesi: kolay, orta ve zor oranı.
- **Bir teslimde:** havuz alanlarına birebir uyan satırlar (ekleme, düzeltme, kapatma) + gerekçe.
- **Ayarlayabildiği sayılar:** zorluk etiketleri, tema etiketleri.
- **Sınırlar:** havuz kurallarına (karakter sınırları, tek kelime vb.) uyar. Marka, ünlü, siyaset, din, argo,
  aşağılama yok. Yeni havuz açamaz (kod isteği).
- **Ön kontrol:**
  - uzunluk ve biçim;
  - tekrar (havuzdaki kayıtlar + aynı teslim + benzerlik);
  - yasaklı kelime;
  - çiftlerde iki kelime aynı değil ve biri diğerinin içinde geçmiyor;
  - tanımda kelimenin kendisi geçmiyor.
- **Sahibin ekranı:** havuz başına tablo, toplu onay, havuzdaki toplam ve zorluk dağılımı.
- **Ekleme:** onaylananlar **tek tıkla** havuza gider; yönetici gerekmez.
- **Kod isteği örnekleri:** yeni oyun için yeni havuz.
- **Örnek iş:** "Sızma için 80 yeni çift (mutfak ve okul temalı); Laf Sokma'da en çok atlanan 20 soruyu kapat."

### 4.9 Moderasyon ve Wiki yapay zekâsı

- **Alanı (iki parça):**
  - **Moderasyon:** yasaklı kelime listesi (küfür ve argonun farklı yazılışları, harf ve rakam oyunları, birleşik
    yazımlar), yanlış alarm takibi, oyuncu takma adları ve serbest yazılar için kurallar.
  - **Wiki:** oyun sayfaları (nasıl oynanır, ipuçları, SSS), ekran açıklamaları, genel sayfalar (hesap, mağaza,
    kartlar, rozetler), kural değişince güncelleme.
- **Yapabildikleri:** liste ekleme/çıkarma (yanlış alarm yapan kalıbı daraltma), wiki sayfası yazma ve
  güncelleme, `docs/KURALLAR.md` ile wiki arasında çelişki bulup bildirme.
- **Bir teslimde:**
  - Moderasyon: kalıp + tür (küfür, hakaret, cinsel, nefret) + yanlış alarm riski.
  - Wiki: wiki JSON biçiminde sayfa.
- **Sınırlar:**
  - Oyuncuya ceza vermez, şikâyet kararı vermez; yalnız listeyi yönetir.
  - Wiki kural icat edemez; kuralın kaynağı `docs/KURALLAR.md`'dir.
  - Çelişki bulursa wiki'yi değil, raporu teslim eder.
- **Ön kontrol:**
  - Moderasyon: örnek Türkçe metin taramasında yanlış alarm sayısı (sık kelimeleri yakalıyor mu).
  - Wiki: JSON şeması, her ekran girdisinin görseli var.
- **Sahibin ekranı:** moderasyon tablosu (yanlış alarm riski yüksekler sarı); wiki sayfası önizlemesi, eski/yeni
  fark.
- **Ekleme:** moderasyon listesi tek tıkla; wiki yönetici ile (görseller ve sıra dosyası birlikte).
- **Örnek iş:** "Rakamla yazılan küfür kalıpları + Kara Borsa ve Sızma wiki sayfalarının yeni kurallara göre
  güncellenmesi."

### 4.10 Test, Hata ve Performans yapay zekâsı

- **Alanı:**
  - **Bot test:** test sunucusunda botlarla bütün oyunları oynatan senaryolar (oyun, oyuncu sayısı, bot stratejisi,
    beklenen sonuç: evre ilerler, puan kuralı tutar, gizli bilgi sızmaz).
  - **Hata ayıklama:** telefon hatalarını ve oyun çökmelerini gruplar, oyun/ekran/sürüm/tarayıcı ile bağlar, ilk
    görüldüğü sürümü bulur, olası nedeni yazar.
  - **Performans takibi:** yükleme süresi, paket boyutu, sunucu tik süresi, bellek, görsel ve ses toplam boyutu;
    eğilim ve eşik uyarısı.
- **Yapabildikleri:**
  - yeni test senaryosu yazar;
  - gece test koşusunu yönetir;
  - hata kartı açar, kapanmış hatanın geri gelip gelmediğini izler;
  - performans eşiği aşılınca uyarır;
  - her canlıya almadan sonra 10 dakikalık kontrol yapar (bugün yaşadığımız "eski sürüm parçası" hatası gibi
    durumları hemen yakalar).
- **Bir teslimde:** senaryo dosyaları, rapor, hata kartı (adımlar, sıklık, etkilenen oyun, olası neden, öneri).
- **Ayarlayabildiği sayılar:** eşikler (ör. yükleme > 3 sn uyarı), test sıklığı, senaryo kapsamı.
- **Sınırlar:**
  - Kodu düzeltmez; "düzeltme isteği" yönetici işine dönüşür.
  - Canlıya dokunmaz: testler ayrı test sunucusunda, kimse oynamıyorken çalışır.
  - Yalnız anonim ve toplu veri görür (ALT-12).
  - Sahibin "uçtan uca testi ben isteyince yapacağız" kararı sürer; bu, sürekli ve hafif bir ön uyarıdır.
- **Ön kontrol:** senaryo biçimi geçerli, var olan oyun kimliği, oyuncu sayısı oyunun sınırlarında.
- **Sahibin ekranı:** yeşil/sarı/kırmızı pano; hata kartları önem sırasıyla; performans eğilim grafikleri; "düzelt"
  düğmesi.
- **Örnek iş:** "Her gece 30 oyunu 3, 5 ve 8 oyuncuyla oynat; takılan evreleri ve sızıntıları raporla."

### 4.11 Üretim Merkezi Arayüzü yapay zekâsı

- **Alanı:** Üretim Merkezi sitesinin bütün arayüzü ve kullanım deneyimi:
  - pano, alan sayfaları, inceleme ekranları;
  - telefonda kaydırma, kısayollar, bildirim metinleri, boş ve hata durumları;
  - tema, okunurluk, erişilebilirlik.
- **Amaç:** Sahibin inceleme süresini sürekli kısaltmak ve siteyi kullanmayı keyifli hâle getirmek.
- **Yapabildikleri:**
  - **Arayüz önerisi:** sorun, öneri, önce/sonra ekran taslağı.
  - **Kod yaması:** yalnız izinli dosyalarda (aşağıda).
  - Kullanım verisinden darboğaz bulma (hangi ekranda ne kadar zaman geçiyor, hangi düğme hiç kullanılmıyor).
- **Bir teslimde:**
  - **Öneri:** madde kodlu belge + ekran taslağı.
  - **Yama:** `git diff` biçiminde yama + açıklama + kendi aldığı önce/sonra ekran görüntüleri.
- **İzinli dosyalar (yama yalnız bunlara dokunabilir):** `apps/uretim` içindeki istemci bileşenleri, stil dosyaları
  ve arayüz metinleri.
- **Yasak dosyalar:**
  - sunucu kodu, giriş ve anahtar işleri, MCP ve SSH kanalları, veritabanı;
  - ön kontrol kuralları, dağıtım dosyaları, bağımlılık listeleri (`package.json`, kilit dosyası).

  Yama bunlardan birine dokunursa otomatik olarak reddedilir.
- **Sınırlar:**
  - Yeni bağımlılık ekleyemez.
  - Güvenlik davranışını değiştiremez (onay penceresi kaldırmak gibi).
  - Bir seferde tek konu: bir yama, bir iyileştirme.
- **Ön kontrol (yamaya özel, UM-K7):**
  1. Yama yalıtılmış bir kopyaya uygulanır.
  2. `pnpm check`, `typecheck`, `test`, `build` çalışır.
  3. 390x844, 360x640 ve 1440x900'de bütün ekranların görüntüsü alınır; önceki sürümle karşılaştırılır.
  4. Dosya izin listesi denetlenir.
- **Sahibin ekranı:** önce/sonra ekran görüntüleri yan yana, değişen dosyaların listesi, açıklama. Onaylanan yama
  bana gelir; ben kodu okur, birleştirir, siteyi güncellerim.
- **Girdi:** her gün sitenin bütün ekranlarının güncel görüntüleri, anonim kullanım ölçüleri (ekran başına süre,
  tıklama sayıları), sahibin "şu zor" notları.
- **Örnek iş:** "Telefonda listelerde toplu onay düğmesi başparmak bölgesine taşınsın; inceleme süresi ölçülsün."

### 4.12 Yönetim Paneli Arayüzü yapay zekâsı

- **Alanı:** Oyunun yönetim panelinin (`/admin`) bütün arayüzü ve kullanım deneyimi:
  - hesaplar, içerik, havuzlar, moderasyon;
  - ekonomi, istatistik, hatalar, canlı oyun, bakım, işlem kaydı ekranları.
- **Amaç:** Paneli hızlı, anlaşılır ve telefonda da rahat kullanılır hâle getirmek.
- **Yapabildikleri, teslim, ön kontrol ve sahibin ekranı:** 4.11 ile aynı (öneri ya da kod yaması).
- **İzinli dosyalar:** `apps/client/src/admin/` altındaki bileşenler, `admin.css`, panel metinleri.
- **Yasak dosyalar:**
  - oyunun kendisi (oyun ekranları, oyun kuralları);
  - sunucudaki panel uçları ve yetki denetimleri;
  - giriş kodu akışı;
  - `admin_audit` kaydı;
  - bağımlılıklar.
- **Sınırlar:**
  - Panelin yetkisini ya da gördüğü veriyi genişletemez; yeni veri gerekiyorsa kod isteği açar.
  - Tehlikeli işlemlerin onay adımlarını kaldıramaz (hesap askıya alma, silme, bakım modu).
  - Panel canlı oyunla aynı uygulamada çalıştığı için onaylanan yamalar oyunla birlikte, kimse oynamıyorken
    canlıya alınır.
- **Girdi:** panelin bütün ekranlarının güncel görüntüleri (gerçek veri yerine örnek veriyle), sahibin notları.
- **Örnek iş:** "Hesaplar ekranında arama, filtre ve toplu işlem tek satıra insin; telefonda kart görünümü."

**Not (alanların içinde bir istisna):** Bu iki alan, kod yaması teslim edebilen tek alanlardır. Arayüz kodu veriyle
yönetilemez. Bu yüzden yamalar dar bir dosya izin listesiyle sınırlanır, otomatik testten geçer, sahip ekran
görüntüleriyle onaylar ve yönetici her yamayı okuyup birleştirir. Yapay zekâ depoya doğrudan yazamaz, dal açamaz,
birleştiremez.

### 4.13 Oyun Tasarımı yapay zekâsı (13. alan; sahip kararı Kasım 2026)

- **Alanı:** yeni mini oyun fikirleri; oyunlar arası sistem ve mekanik fikirleri (kart sistemi gibi: maç
  değiştiricileri, olaylar, kombo/seri ödülleri, takım modu, izleyici rolü); var olan bir oyunu daha eğlenceli yapan
  ekler ("Bu oyuna şu eklense").
- **Amaç:** sahip farklı yapay zekâlarla (Claude, GPT, Gemini…) yeni oyunları ve mekanikleri tartışır; aynı istek
  birkaç yapay zekâya birden verilir, fikirler panoda yan yana karşılaştırılır.
- **Teslim:** yalnız fikir kartı (`tur: "fikir"` + `tasarim` nesnesi); dosya ve kod yok. Yeni oyun kartı: ad, tek
  cümle, oyuncu sayısı, süre, tür, adım adım kurallar, eğlencenin kaynağı, telefon ekranları, TV/izleyici, puanlama,
  riskler/kötüye kullanım, benzer GLIX oyunlarından farkı. Sistem kartı: kapsam (tüm / bazı / tek oyun), nasıl çalışır,
  örnek maç anı, eğlenceye etkisi, kartlar/puan/Glix/rozetle etkileşimi, denge riskleri, uygulama zahmeti.
- **Girdi:** `oyun_katalogu_oku`: oyun listesi (ansiklopedi), değişmeyen çerçeve ve kart sistemi
  (`docs/KURALLAR.md`), bir oyunun kilitli kuralları, alanın mevcut fikirleri (tekrar etmesin diye).
- **Tartışma turları:** sahip karta not yazıp **Geliştir** der → aynı yapay zekâya notla ve önceki sürümle iş; dönen
  sürüm aynı kartta yeni sürüm olur (geçmiş ve yan yana fark). **Başka bir yapay zekâya eleştirt** → seçilen anahtara
  eleştiri işi; eleştiri (`elestiri_yaz`) kartın altına not olarak düşer.
- **Onaydan sonra:** onaylanan kart için **Öneri dosyası hazırla**: `docs/oneriler/*.md` biçiminde (M mekanik, U
  arayüz, Y yapay zekâ maddeleri) taslak; yardımcı model (Haiku) yazar, olmazsa sabit kalıp. Kabul havuzuna düşer,
  "Yöneticiye gönder" ile yöneticiye gider; sahip "ekle" deyince yönetici test2'de taslak oyun ya da sistem özelliği
  yapar.
- **Sınırlar:** kod yazmaz, dosya teslim etmez; var olanı tekrar etmez; telefonda 2–8 kişi, kısa; kumar, gerçek para,
  kişisel veri, zorbalığa açık mekanik yok; kilitli kuralları bozmayı önerirken gerekçesini yazar.
- **Örnek iş:** "Telefonda 4–8 kişilik, 3 dakikalık, blöf ağırlıklı 10 yeni oyun fikri; 5 tane de kartlar gibi
  oyunlar arası sistem fikri."
- Ayrıntı: `SOZLESME.md` bölüm 15.

---

## 5. Alanlar arası sınırlar ve istek kartları

| Durum | Sahibi | Nasıl |
|---|---|---|
| Mağaza ürününün animasyon dokusu | Mağaza | Kendisi yapar; isterse Efekt Dokuları'ndan istek kartıyla doku ister |
| Kart arkası (mağaza ürünü) / maç kartı yüzü | Mağaza / Maç Kartları | Ayrı alanlar |
| Rozet görseli | Rozet | Kendisi yapar |
| Rozet kazanma anı efekti | Rozet | Genel efekt gerekiyorsa Efekt Dokuları'na istek |
| Tepki paketi görseli / tepki sesi | Mağaza / Ses Efektleri | Mağaza, ses için istek kartı açar |
| Oyun simgesi ikonları / oyun içi eşya görselleri | İkon ve Süs / Oyun görselleri akışı | Oyun içi eşya görselleri bugünkü ChatGPT görev akışıyla sürer |
| Yasaklı kelime / içerik havuzundaki uygunsuz kayıt | Moderasyon / İçerik Havuzu | Moderasyon bulursa İçerik Havuzu'na istek |
| Wiki'deki ekran görüntüleri | Moderasyon ve Wiki | Ekran görüntülerini yönetici çeker (kodla) |
| Performans sınırı aşan ses, görsel ya da efekt | Test ve Performans uyarır | İlgili alana istek kartı açar |

**İstek kartı:** açan alan, istenen alan, ne istendiği, neden, son tarih. İstenen alan kartı kendi iş listesine
alır; sonucu açan alana bağlanır. Sahip bütün istek kartlarını panoda görür.

**Oyun içi eşya görselleri:** bu 10 alanın dışında kalır. Oyun geliştirmelerinde 🎨 işaretli maddelerin görselleri
bugünkü gibi yöneticinin hazırladığı görev dosyası ve ChatGPT ile üretilir.

---

## 6. Başlangıç sırası

| Adım | Ne | Neden |
|---|---|---|
| 1 | ALT-13 (Üretim Merkezi) + ALT-1/2/3 → **Mağaza** yapay zekâsı | En görünür, en çok "yeni şey geldi" hissi; en karmaşık paket ilk denenir |
| 2 | ALT-8/9 → **Ses Efektleri** ve **Müzik** | Bugün hepsi sentez; oyun hissini en çok artıran değişiklik |
| 3 | ALT-10 → **İçerik Havuzu**; ALT-11 → **Moderasyon ve Wiki** | Altyapının çoğu hazır, hızlı başlar |
| 4 | ALT-12 → **Test, Hata ve Performans** | Canlı sağlığı ve yayın sonrası kontrol |
| 5 | ALT-4 → **Rozet**; ALT-5 → **Maç Kartları** | Oyuncu ilerlemesi ve maç çeşitliliği |
| 6 | ALT-6/7 → **İkon ve Süs**, **Efekt Dokuları** | Cila |
| 7 | UM-K7 + UM-İ11 → **Üretim Merkezi Arayüzü**, **Yönetim Paneli Arayüzü** | Site ilk sürümüyle oturduktan sonra; kod yaması akışı gerekir |

Her alan açılırken:
1. Yönetici altyapıyı yapar.
2. Yönetici alanın talimat dosyasını yazar.
3. İlk teslim deneme olarak birlikte eklenir.
4. Ondan sonra o alan kendi başına üretir.

---

## 7. Sahibin günlük akışı

1. **Pano:** kırmızı uyarı var mı (Test ve Performans)? Varsa önce o.
2. **Bekleyenler:** alan alan inceleme; toplu onay, notlu ret; beğenilenlere "benzerini daha üret".
3. **İş aç:** alanlara yeni iş yaz ya da yapay zekâların açtığı önerileri onayla.
4. **Yöneticiye gönder:** "onaylananları ekle". Yönetici ekler, test eder, "canlıya almaya hazır" der.
5. **Canlıya alma:** kimse oynamıyorken "al".

---

## Ek A: Daha sonra eklenebilecek roller

İlk taslaktaki 50 rollük liste aşağıda başvuru için duruyor. On alan yöneticisi bunların çoğunu kapsar. Kapsanmayanlar
(oyun tasarımcısı, yeni oyun mucidi, denge ve ekonomi analisti, arayüz eleştirmeni, spiker sesi, sezon ve etkinlik,
tanıtım, sosyal medya, çeviri vb.) ileride ayrı alan olarak açılabilir.

### 50 rollük liste

Kısaltmalar. **Ekleme:** P = panele aktar (tek tık, içerik havuzu), C = yönetici (Claude) koda ekler, R = yalnız
rapor ya da öneri (sahip karar verir, gerekirse yönetici uygular). **Etap:** 1 = hemen, 2 = sonra, 3 = oyunlar
bitmeye yakın.

| # | Rol | Grup | Araç türü | Ekleme | Etap |
|---|---|---|---|---|---|
| 1 | Oyun Görselleri | Görsel | Görsel üretici | C | 1 |
| 2 | Mağaza Ürünleri | Görsel | Görsel + metin | C | 1 |
| 3 | Karakter ve Kozmetik | Görsel | Görsel üretici | C | 2 |
| 4 | Maskot | Görsel | Görsel üretici | C | 2 |
| 5 | Anlatım Sahneleri | Görsel | Görsel üretici | C | 2 |
| 6 | Dünyalar ve Arka Planlar | Görsel | Görsel üretici | C | 2 |
| 7 | Rozet Görselleri | Görsel | Görsel üretici | C | 2 |
| 8 | Maç Kartları | Görsel | Görsel + metin | C | 3 |
| 9 | Arayüz İkon ve Süsleri | Görsel | Görsel üretici | C | 3 |
| 10 | Efekt Dokuları | Görsel | Görsel üretici | C | 3 |
| 11 | Sezon ve Etkinlik | Görsel | Görsel + metin | C | 3 |
| 12 | Tanıtım Görselleri | Görsel | Görsel üretici | R | 3 |
| 13 | Ses Efektleri | Ses | Ses efekti üretici | C | 1 |
| 14 | Müzik | Ses | Müzik üretici | C | 2 |
| 15 | Spiker Sesi | Ses | Seslendirme üretici | C | 2 |
| 16 | Tepki ve Emote Sesleri | Ses | Ses efekti üretici | C | 3 |
| 17 | Kelime Havuzları | İçerik | Metin | P | 1 |
| 18 | Sözlük ve Tanım | İçerik | Metin | P | 1 |
| 19 | Soru ve Cümle | İçerik | Metin | P | 1 |
| 20 | Kelime Çiftleri | İçerik | Metin | P | 1 |
| 21 | Moderasyon Listesi | İçerik | Metin | P | 2 |
| 22 | Görev ve Rozet Metinleri | İçerik | Metin | C | 2 |
| 23 | Duyuru ve Bildirim | İçerik | Metin | P/C | 2 |
| 24 | Metin Redaksiyonu | İçerik | Metin | R | 3 |
| 25 | Wiki Yazarı | İçerik | Metin | C | 2 |
| 26 | Öğretici ve İlk Oyun | İçerik | Metin | R | 3 |
| 27 | Hazır Espri Havuzu | İçerik | Metin | P | 2 |
| 28 | İsim ve Takma Ad | İçerik | Metin | P | 3 |
| 29 | Oyun Geliştirme Tasarımcısı | Tasarım | Metin | R | 1 |
| 30 | Yeni Oyun Mucidi | Tasarım | Metin | R | 2 |
| 31 | Oyun Dengesi Analisti | Tasarım | Veri + metin | R | 2 |
| 32 | Ekonomi ve Fiyat Analisti | Tasarım | Veri + metin | R | 2 |
| 33 | Arayüz Eleştirmeni | Tasarım | Görsel okuyabilen metin | R | 2 |
| 34 | Erişilebilirlik Denetçisi | Tasarım | Görsel okuyabilen metin | R | 3 |
| 35 | Bağlılık Tasarımcısı | Tasarım | Metin | R | 3 |
| 36 | Sağlık Nöbetçisi | Operasyon | Zamanlanmış | R | 1 |
| 37 | Hata Ayıklayıcı | Operasyon | Zamanlanmış | R | 2 |
| 38 | Geri Bildirim Tasnifçisi | Operasyon | Zamanlanmış | R | 3 |
| 39 | İçerik Açığı Bekçisi | Operasyon | Zamanlanmış | R | 2 |
| 40 | Bot Test Oyuncusu | Operasyon | Zamanlanmış | R | 3 |
| 41 | Görsel Gerileme Denetçisi | Operasyon | Zamanlanmış | R | 3 |
| 42 | Performans Bekçisi | Operasyon | Zamanlanmış | R | 3 |
| 43 | Güvenlik Bekçisi | Operasyon | Zamanlanmış | R | 2 |
| 44 | Şikâyet Nöbetçisi | Operasyon | Zamanlanmış | R | 2 |
| 45 | Mağaza Sayfası ve Tanıtım Metni | Büyüme | Metin | R | 3 |
| 46 | Sosyal Medya | Büyüme | Metin + görsel | R | 3 |
| 47 | Video ve Fragman | Büyüme | Video üretici | R | 3 |
| 48 | Topluluk Yöneticisi | Büyüme | Metin | R | 3 |
| 49 | Çeviri | Büyüme | Metin | C/P | 3 |
| 50 | Trend ve Rakip Araştırmacısı | Büyüme | Metin + web | R | 3 |

Önceki önerilerle eşleşme: 1 Oyun Görselleri, 2 Mağaza, 17–20 İçerik (kelime/cümle), 13–14 Ses, 22 + 7 Görev ve
Rozet, 21 Moderasyon, 24 + 45–46 Metin ve Tanıtım, 29 Oyun Tasarımcısı, 3 Karakter ve Kozmetik, 15 Spiker Sesi,
11 Sezon ve Etkinlik, 8 Maç Kartları, 49 Çeviri; zamanlanmış işler B1–B6 → 36, 37, 38, 31, 39, 40.

---

