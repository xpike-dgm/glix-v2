# A6 — Kalan 17 oyun: kural yorumları

Kanonik kural: `docs/KURALLAR.md`. Ortak kurallar `docs/A4-OYUNLAR.md` "Ortak kurallar" ile aynıdır
(publicView herkes için aynı, gizli bilgi yalnız sahibinin view'ında, bitişten sonra eylem reddi, tick `connected`'a bakmaz,
hedef seçen eylemlerde hedef bağlı katılımcı). Puanlar aksi yazmıyorsa doğrudan genel skora (awards = miniScores).
Kısa oyun içi açılış penceresi (≤ 7 sn) açılış animasyonu için kullanılabilir; kural süresi ve puan değişmez.

## Grup 1 — zamanlama ve sayı
- **Gizli Hırsız** (2–8, 30 sn): tek basış; ilk geçerli basış kaydedilir, ikinci yok sayılır. Basışlar sona kadar
  gizli (kimin bastığı da). Tek basan +1; ≥2 basan her biri −1; basmayan 0.
- **Kör Kronometre** (2–8, 18 sn): hedef 10,000 sn (oyun başlangıcından, sunucu saati). Tek basış; basmayan 18,000 sn
  kabul. |t−10| en küçük +2, ikinci +1. Eşitlik: aynı dereceyi paylaşanlar aynı ödülü alır, sonraki derece atlanır
  (iki birinci → ikisi +2, kimse +1 almaz). **Ekranda zamana bağlı hiçbir gösterge yok**; halka/nabız zamandan bağımsız.
- **Son Kişi** (2–8): gizli bitiş 10,000–20,000 ms (rastgele, ms). Tek basış ("kaç"). Bitişten önce basanlar arasında
  en geç basan(lar) +1 (eşit zaman damgası → hepsi +1); diğer kaçanlar 0; hiç basmayan −1; kimse kaçmazsa herkes −1.
  Bitiş ve sonrasında gelen basış reddedilir. Gerilim göstergesi: publicView'da yalnız `tension` 0–3
  (geçen/toplam ≥ 0,5 → 1, ≥ 0,75 → 2, ≥ 0,9 → 3); bitiş zamanı hiçbir görünümde yok.
- **Ortalamaya En Yakın** (3–8, 20 sn): 0–100 tam sayı, değiştirilebilir, gizli. Göndermeyene sunucu 0–100 rastgele tam
  sayı atar (sonuçta normal seçim gibi görünür). Hedef = ortalama / 2 (ondalık). En yakın tek kişiyse +2, sonraki
  derece(ler) +1 (aynı mesafedekilerin hepsi); en yakınlar eşitse hepsi +1 ve ikinci ödül yok.
- **Çizgiyi Geçme** (2–8, 30 sn): 0–100 tam sayı, değiştirilebilir, gizli. Bölgeler 0–9, 10–19, …, 90–99, 100.
  Aynı bölgede ≥2 kişi → hepsi pasif (0). Seçmeyen pasif. Tek kalanlar sayıya göre: en yüksek +2, ikinci +1.
- **Aşırı Yükleme** (2–8): ortak bar 100; her tık +1; toplam ve tıklama sayıları gizli. Bar 100'e ulaşınca
  publicView'da `danger: true` (kenar kırmızı) ama sayaç yok; 3 sn gizli pencere başlar. Pencerede 101. tık
  (sunucu sırası) patlamayı belirler, tur hemen biter: patlayan −1 ve sıralamaya girmez. Pencere taşmadan biterse
  normal kapanır. Patlamayanlar tıklama sayısına göre: tek lider +2, sonraki +1; liderler eşitse hepsi +1, +2 yok.
  **Teknik üst sınır 90 sn** (kimse tıklamazsa oda takılmasın): dolarsa patlama olmadan sıralama. Tık başına hız
  sınırı sunucunun genel mesaj sınırıdır.

## Grup 2 — hedef, takas ve gizli seçim
- **Rus Ruleti** (2–8): başlangıçta herkes hayatta, silah rastgele birinde, risk %16. Sahip 18 sn içinde kendini ya da
  hayatta olan başka bir **bağlı** oyuncuyu hedefler. Patlama sunucuda `ctx.rng` ile atış anında belirlenir (önceden
  gizli değer yok). Patlamazsa silah hedefe geçer (kendiyse kalır), risk +10 (en çok %76). Patlarsa hedef elenir,
  risk %16, silah hayatta kalan rastgele birine. Bitiş: hayatta kalan ≤ başlangıç/2. Süre dolarsa sahip dışındaki
  rastgele hayatta oyuncuya otomatik atış (tek hayatta kalan sahipse kendine). Her atıştan sonra 2,5 sn açılış
  penceresi (sonuç animasyonu); sonraki 18 sn pencere bitince başlar. Hayatta kalanlar +1.
- **Zehirli Kadeh** (2–8): zehirli kadeh sayısı 2–3 → 1, 4–5 → 2, 6–8 → 3; rastgele dağıtılır, **kimse göremez**
  (sahibi dahil) — yalnız sonuçta açılır. Her oyuncu bir kez takas **başlatabilir** (hedef olmak hak harcamaz);
  hedef başka bir bağlı katılımcı. Takas anında uygulanır, süreye +5 sn ekler (başlangıç 20 sn). Takas olayları
  herkese açık (kim kiminle takas etti); kadeh içeriği değil. Sonda temiz kadeh +1.
- **Gizli Kareler** (2–8): 2–4 oyuncu 3×3, 5–8 oyuncu 4×4. İki aşama, her biri 20 sn; seçim süre bitene kadar
  değiştirilebilir ve gizli. Aşama sonunda: tek kalan hücredekiler +1 ve devam; çakışanlar elenir; seçim yapmayan
  pasif → puan almaz ve ikinci aşamaya geçmez. Aşamalar arasında 4 sn açılış penceresi. 1. aşamada herkes aynı
  kareyi seçtiyse ya da hiç canlı kalmadıysa oyun biter; tek canlı kalırsa o kişi ikinci aşamayı rakipsiz
  sayılır (+1) ve oyun biter. 2. aşamada yalnız hayatta kalanlar seçer; diğerleri izler.
- **İttifak** (3–8): 60 sn sözlü pazarlık (uygulamada eylem yok; portreler ve süre), sonra 15 sn gizli oylama.
  Kendine oy yok; oy süre bitene kadar değiştirilebilir. Oy vermeyenin oyu kendisi dışındaki rastgele bir
  katılımcıya gider. Alınan her oy +1 genel puan. Oylar ve sayılar sonuç açılana kadar gizli; sonuçta oy akışı
  (kim kime) herkese açılır.
- **Rüşvet ve Darbe** (3–8): 20 sn gizli başkanlık oyu (kendine yok, değiştirilebilir; vermeyenin oyu rastgele
  başka birine). En çok oy alan başkan. Eşitlikte darbe düellosu: eşit adaylar 8 sn içinde gizli taş/kağıt/makas
  seçer (seçmeyene rastgele), aynı anda açılır, 2,5 sn açılış penceresi. Elde tam iki farklı işaret varsa kazanan
  işareti verenler devam eder; tek işaret ya da üç işaret varsa el tekrarlanır. Tek aday kalınca başkan. 6 elden
  sonra hâlâ eşitse sunucu kalanlar arasından rastgele başkan seçer (güvenlik sınırı). Başkan oy sayısı kadar
  jetonu 25 sn içinde kendisi dışındakilere dağıtır (kişi başı en çok 2; dağıtım süre içinde değiştirilebilir ve
  gizli). Dağıtılmayan jetonlar sonda sınıra uyularak rastgele dağıtılır. Başkan +1, jetonlar doğrudan genel puan.
  Seçim sonucu (başkan + aldığı oy sayısı) seçim bitince açılır; oy akışı ve dağıtım sonda.
- **Gizli Alışveriş** (3–8): 60 kredi, 12 sabit ürün (sıra maç başına karışır), 30 sn. Sepet sunucuda canlı tutulur
  (her ekleme/çıkarma bir eylem; bütçeyi aşan ya da aynı ürünü ikinci kez ekleyen eylem reddedilir); süre
  bittiğindeki sepet geçerlidir, boş sepet 0. Ürün değeri = fiyat / alıcı sayısı; sepet değeri toplam
  (gösterimde iki ondalık, sıralama yuvarlanmamış değerle). En yüksek değer > 0 olan sepet(ler) +1.
  Sepetler ve alıcı sayıları sonuca kadar gizli.
