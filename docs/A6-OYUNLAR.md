# A6 — Kalan 17 oyun: kural yorumları

Kanonik kural: `docs/KURALLAR.md`. Ortak kurallar `docs/A4-OYUNLAR.md` "Ortak kurallar" ile aynıdır
(publicView herkes için aynı, gizli bilgi yalnız sahibinin view'ında, bitişten sonra eylem reddi, tick `connected`'a bakmaz,
hedef seçen eylemlerde hedef bağlı katılımcı). Puanlar aksi yazmıyorsa doğrudan genel skora (awards = miniScores).
Kısa oyun içi açılış penceresi (≤ 7 sn) açılış animasyonu için kullanılabilir; kural süresi ve puan değişmez.

## Grup 1 — zamanlama ve sayı
- **Gizli Hırsız** (2–8, 30 sn): herkes bir kez ÇAL ya da ÇALMA der (GH-M1); ilk karar kaydedilir, sonrakiler yok
  sayılır. Kararlar sona kadar gizli (kimin çaldığı da); herkese açık yalnız `decided` (kimlerin karar verdiği). Bağlı
  herkes karar verince 1 sn sonra biter (kopan beklenmez; `onPresence` de denetler). 3+ oyuncuda 15. saniyede ortak işaret
  `signal`: o ana kadar ≥1 ÇAL → "stir", yoksa "quiet"; sonra değişmez, 2 oyuncuda ve 15. sn'den önce herkes karar
  verdiyse yok (GH-M2). Açılışta `reveal.pressedAt` (başlangıçtan ms) açılır; oyun içi açılış 4,5 sn (GH-U5). Tek çalan +1;
  ≥2 çalan her biri −1; çalmayan 0.
- **Kör Kronometre** (2–8, 18 sn): hedef 10,000 sn (oyun başlangıcından, sunucu saati). Tek basış; basmayan 18,000 sn
  kabul. |t−10| en küçük +2, ikinci +1. Eşitlik: aynı dereceyi paylaşanlar aynı ödülü alır, sonraki derece atlanır
  (iki birinci → ikisi +2, kimse +1 almaz). **Ekranda zamana bağlı hiçbir gösterge yok**; halka/nabız zamandan bağımsız.
- **Son Kişi** (2–8; SK öneri paketi): 3 tur. Her turun gizli alarmı turun başından 8,000–16,000 ms (rastgele, ms);
  tur arası 4 sn, son açılış 6 sn. Tur başına tek basış ("kaç"); alarm anında/sonrasında ve tur arasında basış reddedilir.
  Tur puanı: en geç kaçan(lar) +2, sondan ikinci (sonraki farklı zaman; 3+ oyuncuda) +1, alarmdan önceki son 1 000 ms'de
  (uç dahil) kaçan +1 ek; diğerleri ve yakalanan 0 (eksi yok). Genel skor toplamla +2/+1/0 (birincide eşitlik hepsi +2;
  herkes eşit ve > 0 ise +1; 0 ödülsüz). Herkes kaçarsa tur 1 sn sonra kapanır, sonraki turlar öne kayar. Görünüm:
  `tension` 0–3 (turun gizli eşikleri: alarmdan 5–8, 2,5–4,5, 0,8–2,2 sn önce, turun başından ≥ 1 sn sonra), `escapedCount`
  (kimin kaçtığı oyun sırasında yok — sahip kararı), `results` (kapanmış turlar: `alarmMs`, `rang`, kaçışlar, puanlar),
  `totals`, `final`; kişisel `escaped`, `myMs`. Görünümlerde mutlak zaman yalnız `startedAt`; alarm anları ve eşikler
  `secrets()`te.
- **Ortalamaya En Yakın** (3–8, 20 sn): 0–100 tam sayı, değiştirilebilir, gizli. Göndermeyene sunucu 0–100 rastgele tam
  sayı atar (sonuçta normal seçim gibi görünür). Hedef = ortalama / 2 (ondalık). En yakın tek kişiyse +2, sonraki
  derece(ler) +1 (aynı mesafedekilerin hepsi); en yakınlar eşitse hepsi +1 ve ikinci ödül yok.
- **Çizgiyi Geçme** (2–8, 30 sn): 0–100 tam sayı, değiştirilebilir, gizli. Bölgeler 0–9, 10–19, …, 90–99, 100.
  Aynı bölgede ≥2 kişi → hepsi pasif (0). Seçmeyen pasif. Tek kalanlar sayıya göre: en yüksek +2, ikinci +1.
- **Aşırı Yükleme** (2–8): ortak bar 100; her tık +1; toplam ve tıklama sayıları gizli. Bar 100'e ulaşınca
  publicView'da `danger: true` (kenar kırmızı) ama sayaç yok; 3 sn gizli pencere başlar ve tur pencere sonuna kadar
  sürer (aşan tık turu bitirmez). Pencerede (100'den sonra) basan herkes patlar: 100'den sonra en çok basan tek kişi
  −2, diğer patlayanlar −1 (eşitlikte hepsi −1). Patlayanlar sıralamaya girmez. Patlamayanlar 100'e kadarki
  tıklamalarına göre: tek lider +2, sonraki +1; liderler eşitse hepsi +1, +2 yok. Başka eksi puan yok.
  **Teknik üst sınır 90 sn** (kimse tıklamazsa oda takılmasın): yalnız bar dolmadıysa uygulanır, dolarsa
  sıralama aynı kuralla; bar dolduysa pencere her zaman tam 3 sn sürer. Tık başına hız
  sınırı sunucunun genel mesaj sınırıdır.

## Grup 2 — hedef, takas ve gizli seçim
- **Rus Ruleti** (2–8): başlangıçta herkes hayatta, silah rastgele birinde, risk %16. Sahip 18 sn içinde kendini ya da
  hayatta olan başka bir **bağlı** oyuncuyu hedefler. Patlama sunucuda `ctx.rng` ile atış anında belirlenir (önceden
  gizli değer yok). Patlamazsa silah hedefe geçer (kendiyse kalır), risk +10 (en çok %76). Patlarsa hedef elenir,
  risk %16, silah hayatta kalan rastgele birine. Bitiş: hayatta kalan ≤ başlangıç/2. Süre dolarsa sahip dışındaki
  rastgele hayatta oyuncuya otomatik atış (tek hayatta kalan sahipse kendine). Her atıştan sonra 2,5 sn açılış
  penceresi (sonuç animasyonu); sonraki 18 sn pencere bitince başlar. Hayatta kalanlar +1.
  RR öneri paketi (Kasım 2026): hemen geri ateş yok (`no_return_fire`, 3+ hayattayken tek karar), patlamada elenen 4 sn
  içinde silahı verir (`pass`, seçmezse rastgele), kopan oyuncu elle hedeflenebilir ve kopan sahibin süresi 6 sn
  (`onPresence`), bekleme 3,5 sn (patlamada son sözle 7,5 sn), ilk karar 18,8 sn, oyun içi açılış en az 6 sn. Ayrıntı:
  KURALLAR §7.
- **Zehirli Kadeh** (2–8): zehirli kadeh sayısı 2–3 → 1, 4–5 → 2, 6–8 → 3; rastgele dağıtılır, **kimse göremez**
  (sahibi dahil) — yalnız sonuçta açılır. Her oyuncu bir kez takas **başlatabilir** (hedef olmak hak harcamaz);
  hedef başka bir bağlı katılımcı. Takas anında uygulanır, süreye +5 sn ekler (başlangıç 20 sn). Takas olayları
  herkese açık (kim kiminle takas etti); kadeh içeriği değil. Sonda temiz kadeh +1.
- **Gizli Kareler** (2–8): 2–4 oyuncu 3×3, 5–8 oyuncu 4×4. İki aşama, her biri 20 sn; seçim süre bitene kadar
  değiştirilebilir ve gizli. Aşama sonunda: tek kalan hücredekiler +1 ve devam; çakışanlar elenir; seçim yapmayan
  pasif → puan almaz ve ikinci aşamaya geçmez. Aşamalar arasında 6 sn (5 sn açılış + 1 sn "2. AŞAMA" bandı). 1. aşamada
  herkes aynı kareyi seçtiyse ya da hiç canlı kalmadıysa oyun biter. 1. aşamada tek kalamayanlar (çakışan / pasif)
  2. aşamada **hayalettir** (GK-M2): gizlice kare tutar; tek kalan yarışanın karesinde hayalet varsa `haunted` (2. aşama
  +1'i ve ödül yok); hayalet puan almaz. Tek canlı kalırsa ve 1. aşama kapanırken bağlı bir hayalet varsa 2. aşama
  oynanır; yoksa rakipsiz (+1) ve oyun biter (`ghostLive` 1. aşama kapanırken donar; `online` `onPresence` ile yazılır).
  2. aşamada her yarışana yalnız kendi `view`ında ödül karesi için doğru bir **pusula** ipucu (GK-M1; bant anından
  2. aşama sonuna kadar); ipuçları `stage2Reveal.compass` ile açılışta herkese açılır. Erken bitiş 2. aşamada bağlı
  yarışanlar ve bağlı hayaletlerin hepsi Tamam deyince. Son açılış en az 8 sn.
- **İttifak** (3–8): sözlü pazarlık 3–4 oyuncuda 45 sn, 5–6'da 60 sn, 7–8'de 75 sn (uygulamada yalnız gizli söz
  işareti: 3–4 oyuncuda en çok 1, 5–8'de en çok 2; yalnız sözü veren görür), 1 sn "PAZARLIK BİTTİ" bandı, sonra 15 sn
  gizli oylama. Kendine oy yok; kopan katılımcıya da oy verilebilir; oy süre bitene kadar değiştirilebilir. Oy
  vermeyenin oyu kendisi dışındaki rastgele bir katılımcıya gider ve açılışta zarla işaretlenir (`random`). Oyun içi
  puan = alınan oy; genel skora en çok oy +2, ikinci +1 (birincide eşitlik hepsi +2; herkes eşitse herkes +1; 0 oy
  ödülsüz; `awards`). Oylar sonuç açılana kadar gizli; açılışta oylar tek tek okunur (en az 3 + 0,9 × oyuncu sn),
  sözler ✓/✗, İTTİFAK ikilileri ve "Sözünün eri / Çifte oyun / Hain" etiketleri gösterilir.
- **Rüşvet ve Darbe** (3–8): gizli başkanlık oyu, 3–5 oyuncuda 20 sn, 6–8 oyuncuda 30 sn (kendine yok,
  değiştirilebilir; vermeyenin oyu rastgele başka birine). Seçim süresince herkes portresine isteğe bağlı, herkese açık,
  puansız bir vaat asar ("Oy verene jeton" / "Herkese jeton"). En çok oy alan başkan. 4+ aday eşitse önce 12 sn ikinci
  oylama (yalnız adaylara; vermeyenin oyu sayılmaz); yine eşitlik ya da 2–3 aday eşitse darbe düellosu: eşit adaylar 8 sn
  içinde gizli taş/kâğıt/makas seçer (seçmeyene rastgele), aynı anda açılır, 2,5 sn açılış penceresi. Elde tam iki
  farklı işaret varsa kazanan işareti verenler devam eder; tek işaret ya da üç işaret varsa el tekrarlanır. Tek aday
  kalınca başkan; 6 elden sonra hâlâ eşitse kalanlar arasından kura. Başkan belli olunca 1,5 sn taç anı; ardından başkan
  oy sayısı kadar jetonu 25 sn içinde kendisi dışındakilere dağıtır (kişi başı en çok 2; dağıtım süre içinde
  değiştirilebilir ve gizli). Başkan dağıtımda kendisine kimin oy verdiğini (yalnız kendisi) görür. Dağıtılmayan jetonlar
  sonda sınıra uyularak rastgele dağıtılır; başkan kopuksa önce seçmenlerine birer birer. Jeton almayanlar 10 sn gizli
  darbe oylaması yapar; kesin çoğunluk Darbe derse başkanın puanı silinir. Başkan +2 (darbe tutmazsa), jetonlar doğrudan
  genel puan. Açılış en az 11 sn: oklu oy akışı (rastgele oylar kesikli), taht, jetonlar (rastgele olanlar gümüş), darbe,
  başkanın vaadi TUTTU/BOZDU, puanlar.
- **Gizli Alışveriş** (3–8): 60 kredi, 12 sabit ürün (sıra maç başına karışır), 30 sn. Sepet sunucuda canlı tutulur
  (her ekleme/çıkarma bir eylem; bütçeyi aşan ya da aynı ürünü ikinci kez ekleyen eylem reddedilir); süre
  bittiğindeki sepet geçerlidir, boş sepet 0. Ürün değeri = fiyat / alıcı sayısı; sepet değeri toplam
  (gösterimde iki ondalık, sıralama yuvarlanmamış değerle). En yüksek değer > 0 olan sepet(ler) +1.
  Sepetler ve alıcı sayıları sonuca kadar gizli.

## Grup 3 — yazı ve sosyal çıkarım
Ortak: serbest metin girişleri sunucuda temizlenir (denetim/görünmez karakter yok, boşluk sadeleşir, Türkçe büyük
harf `toLocaleUpperCase("tr-TR")`), karşılaştırma bu biçimle yapılır. Kelime girişleri 1–24 karakter, tek satır.
- **Yazı Yaz** (3–8): sunucu rastgele 2 yazan seçer; rol yalnız sahibine görünür. Yazma 30 sn: yazan kendi
  kelimesini, diğerleri `MASUM` yazar (masumun girişinde yalnız `MASUM` kabul edilir; ekran aynı görünür).
  Sözlü tartışma 60 sn (eylem yok). Tahmin 30 sn: herkes kendisi dışında bir oyuncu + bir kelime seçer/yazar
  (değiştirilebilir). Kişi doğruysa (seçilen gerçekten yazan; yazan için diğer yazan) +1; kelime yalnız kişi doğruysa
  ve o yazanın kelimesiyle eşleşirse +1. Kelime yazmamış yazanın kelimesi bilinemez. Tahmin vermeyen 0.
- **Kendim** (3–8): yazma 30 sn (tek kelime), eşleştirme 30 sn. Kartlar yazılan kelimelerden oluşur, karışık sırada,
  sahipsiz gösterilir; oyuncu kendi kartını görmez (eşleştiremez). Her kart en çok bir kişiye, her kişi en çok bir
  karta eşlenir (kendisi hariç); eşleştirmeler değiştirilebilir ve gizli. Doğru +1, yanlış −1, boş 0. Kartı tam bir
  kişi doğru bulduysa kart sahibine +1 bonus. Genel skor: en yüksek mini puan (> 0) olan(lar) +1.
- **Sızma** (3–8): ortak kelime + sızma kelimesi çifti havuzdan (yakın anlamlı somut kavramlar). Sızma kendisinin
  sızma olduğunu bilmez; herkes yalnız "kelimen: …" görür. İpucu aşaması süresiz: ekranda rastgele söyleme sırası
  (iki tur aynı sıra) ve "Oylamaya geç" düğmesi; bağlı tüm katılımcılar bastığında oylama başlar (yeniden basmak
  yeniden kontrol eder). Teknik üst sınır 5 dk. Oylama 30 sn, tek oy, kendine serbest, değiştirilebilir, gizli.
  Sızma tek başına en çok oyu aldıysa yakalanır: diğer herkes +1. Aksi halde (eşitlik, hiç oy yok) sızma +2.
- **Sözlük Blöfü** (3–8): havuz gerçek, az bilinen Türkçe kelimeler ve **doğru** sözlük anlamlarıyla (yönetici
  gözden geçirir). Yazma 50 sn (1–100 karakter); yazmayanın kartı olmaz. Seçme 30 sn: gerçek tanım + blöfler
  karışık; kendi blöfü seçilemez; tek seçim, değiştirilebilir, gizli. Gerçek tanımı seçen +1; blöfü seçilen her
  seçim için +1. Kart sahipleri sonuca kadar gizli.
- **Kontrol Paneli Kaosu** (2–8): 4 renk (mavi, yeşil, kırmızı, sarı); her oyuncunun dizilimi farklı permütasyon.
  Sunucu tek döngülü, kendini hedeflemeyen bir eşleme kurar: her oyuncu bir başka oyuncunun paneline ait ipucunu
  taşır. İpucu: "N. kablo R1 ve M. kablo R2 ise K'yi kes" — koşul hedef panelde doğrudur ve konum çifti, mümkünse
  yalnız hedef paneli tanımlayacak şekilde seçilir (yoksa üç konum). İpucu yalnız taşıyıcısının view'ında, yapısal
  veri olarak (istemci Türkçe cümleye çevirir). Herkes tek kesim yapar, geri alınamaz; kesim sonuca kadar gizli
  (kendi kesimi kendine açık, doğru/yanlış sonda). 60 sn. Doğru kesen +1, o panelin ipucu taşıyıcısı +1.
