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
  = geçilen gizli eşik sayısı. Eşikler `setup`'ta bitişe göre rastgele seçilir ve durumda gizli tutulur: düzey 1 bitişten
  5–8 sn, düzey 2 2,5–4,5 sn, düzey 3 0,8–2,2 sn önce (her biri başlangıçtan ≥ 1 sn sonra, artan sırada); sabit oran yok,
  yoksa istemci düzey-1 anından bitişi hesaplardı. Bitiş zamanı ve eşikler hiçbir görünümde yok.
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
