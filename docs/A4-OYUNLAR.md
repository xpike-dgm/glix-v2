# A4 — İlk 7 oyun: sözleşme ve kural yorumları

Kanonik kural: `docs/KURALLAR.md`. Bu dosya yalnız uygulama kararlarını ve belirsizlik yorumlarını tutar.
Her oyun `packages/engine/src/games/<id>/` (types.ts, index.ts, bots.ts, words.ts gerekiyorsa, testler) ve
`apps/client/src/games/<id>/` altında. Puan aktarımı: aksi yazmıyorsa `awards = miniScores` (genel skora direkt).

## Ortak kurallar
- `publicView` herkes için aynıdır; gizli bilgi yalnız hak sahibinin `view`'ında. Her gizli değer `secrets()` ile bildirilir.
- Oyun bitişinden sonra gelen eylem reddedilir. Oyun içi kısa açılış/animasyon pencereleri
  (Çapraz Ateş +7 sn, Açgözlülük +5 sn, Çağrışım +6 sn, Kör Bomba +2 sn) sahip onayıyla kalır; kural süresi ve puan değişmez.
- Zaman Bombası puanlaması birikimli kalır (sahip onayı). Süreler sunucu saatiyle (`ctx.now`).
- `ctx.connected`: hedef seçilen eylemlerde hedef bağlı bir katılımcı olmalıdır (aksi `rejected`). `tick`
  `connected`'a bakmaz (`setup` ve `reduce` bakabilir); bağlantısı kopan oyuncunun sırası/süresi zaman aşımıyla çözülür.
- Serbest metin için teknik üst sınır 60 karakter (protokol mesajı 4 KB ile sınırlı); kural "sınır yok" diyorsa bile bu teknik sınırdır.

## Kararlar
- **Açgözlülük Limiti** (3–8, 20 sn): seçim 0..oyuncu sayısı, değiştirilebilir (son seçim geçerli), gönderilmezse 0.
  Limit tablosu 3→6, 4→11, 5→17, 6→24, 7→33, 8→43. Seçimler süre bitene kadar gizli (secrets: her oyuncunun seçimi,
  sahibi kendisi). Toplam ≤ limit → herkes seçtiği kadar; aşarsa herkes 0.
- **Çapraz Ateş** (3–8, 25 sn): tek hedef, değiştirilebilir (son seçim), kendine yok. Hedefler süre sonunda açılır.
  Hedeflenen −1 (kaç kişi hedeflese de bir kez); karşılıklı hedefleşen iki taraf 0 (hedeflenme cezası dahil, ikisine de
  uygulanmaz); hedeflenmeyen ve karşılıklı olmayan bir hedefe ateş eden +1. Hem ateş edip hem (karşılıklı olmayan biçimde)
  hedeflenen: −1 (hedeflenme baskın; +1 ve −1 toplanmaz). Hedefsiz oyuncu: hedeflenirse −1, değilse 0.
- **Çağrışım Ağı** (2–8, 30 sn): ana kelime havuzdan rastgele; tek cevap, gönderildikten sonra değiştirilemez; boş cevap
  reddedilir. Normalizasyon: Türkçe küçük harf (`toLocaleLowerCase("tr")`), baş/son boşluk kırp, iç boşlukları teke indir.
  Grup = aynı normalleştirilmiş cevap ≥ 2 kişi; her üye grup büyüklüğü kadar puan. Cevaplar süre bitene kadar gizli.
  Cevap vermeyen 0. **Genel skor (sahip kararı):** mini puan sıralamasına göre tek lider +2, sıradaki +1; liderler
  eşitse yalnız liderler +1; mini puanı 0 olan (grup kuramayan) ödül almaz.
- **Karalama Defteri** (3–8): çizim 75 sn, oylama 20 sn. Rastgele 1 bilgisiz oyuncu; kelime havuzu (ana, yakın) çiftleri.
  Herkes yalnız kendi kelimesini görür (secret: ana kelime bilgisize, yakın kelime diğerlerine gizli; kimin bilgisiz
  olduğu herkese gizli). Çizim fırça darbeleriyle gönderilir: her darbe ayrı eylem (renk 6'dan biri ya da silgi, kalınlık
  3 kademe, ≤ 120 nokta, nokta 0–1000 tamsayı ızgarası); `undo` ve `clear` eylemleri; oyuncu başına ≤ 400 darbe.
  Çizimler oylamada `publicView`'da açılır. Kendine oy yok, 1 oy, değiştirilebilir. En çok oyu tek başına bilgisiz alırsa
  diğer herkes +1; aksi (eşitlik dahil) bilgisiz +1. Oy vermeyen sayılmaz.
- **Kör Bomba** (2–8, yatay): bomba rastgele bağlı katılımcıda; patlama ilk verilişte 15–20 sn sonra (ms çözünürlükte
  rastgele). Pas: yalnız taşıyıcı, kendisi dışında bağlı bir katılımcıya, sınırsız; her pas patlamaya 1–4 sn ekler.
  Taşıyıcı patlama zamanını göremez (secret: `explodeAt`, sahipleri taşıyıcı dışındaki herkes — izleyici dahil herkese
  açık değil, yalnız taşıyıcı dışındaki katılımcıların `view`'ında). Patlamada taşıyıcı −1, diğerleri 0. Patlama ile aynı
  `now`'da gelen pas reddedilir.
- **Zaman Bombası Hafızası** (2–8): 4 renk, ilk dizi 2; sıra maç başında karıştırılır ve döngü sabit, elenen atlanır,
  bağlantısı kopan oyuncunun sırası gelince zaman aşımıyla yanlış sayılır. Her sırada önce dizi herkese oynatılır
  (`publicView`, eleman başına 600 ms), sonra aktif oyuncu girer; süre = dizi uzunluğu × 3 sn. Doğru → dizi 1 uzar
  (öncekine rastgele 1 renk eklenir), sıra sonrakine. Yanlış/zaman aşımı → oyuncu elenir, −1; o an aktif kalan diğer
  her oyuncu +1 (her elenmede birikir; eski uygulamayla aynı); dizi yeni rastgele 2 renge döner. Elenen sayısı
  ⌈başlangıç/2⌉ olunca biter. Gizli bilgi yok.
- **Butona Bas**: A1'deki haliyle; A4'te yalnız görsel cila.
