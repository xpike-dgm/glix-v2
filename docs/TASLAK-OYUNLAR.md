# GLIX — Taslak Oyunlar (sahip onayı bekliyor)

Bu dosya yeni mini oyun önerilerini ve seçilen üçünün tam kural taslağını içerir. **Hiçbiri onaylanmadı**:
oyunlar kodda vardır ama kapalıdır (aşağıda "Kapalı tutma"). Onaylanan kural `docs/KURALLAR.md`'ye 30., 31., 32.
madde olarak taşınır ve oyun `GAMES` kaydına alınır. İçerik kuralı: hiçbir oyun yapay zekâ üretimi kelime/ifade
havuzu kullanmaz; içerik yalnız sayı, renk, şekil ve oyuncuların kendi hamlelerinden gelir.

## 1. Beş kısa kavram

| # | Ad | Özet | Neden eğlenceli | Oyuncu | Süre | Mevcut 28 oyundan farkı |
|---|---|---|---|---|---|---|
| 1 | **Ortak Nokta** | Herkes 6 şekilli kutudan gizlice birini seçer; seninle aynı kutuyu seçen herkes sana puan getirir. Kutuların dizilişi her telefonda farklıdır. | Konuşmadan "ne düşünür bunlar?" anı; ortak şekil tercihleri (yıldız mı, daire mi) arkadaş grubunu ele verir. | 3–8 | ~70 sn | Çağrışım Ağı sözcükle eşleşir; bu, sözcüksüz odak noktası (Schelling) oyunu. Ortalamaya En Yakın sayısal; bu kategorik ve işbirlikçi. |
| 2 | **Tek ve Küçük** | Her tur 1–(n+2) arası gizli sayı; çakışmayan sayılar arasında en küçüğü kazanır. | Herkes "1 seçsem herkes 1 seçer" diye düşünür; blöf ve ters psikoloji. | 3–8 | ~72 sn | Ortalamaya En Yakın ortalama hedefler; bu, eşsizlik ve çakışma kaçınma oyunu. |
| 3 | **Sessiz Sıra** | Gizli kartlar (1–99) konuşmadan küçükten büyüğe oynanır; hata paylaşılan canı götürür. | Sessizlikte artan gerilim, "ben mi şimdi?" ikilemi, takımca zafer/yenilgi. | 3–8 | ~60–80 sn | Tek işbirlikçi oyun; gizli el ve takım canı. Kör Kronometre bireysel zamanlama, bu ise başkalarının gizli sayılarına zamanlama. |
| 4 | **Aykırı Renk** | Dört renkten birini seç; en az seçilen (ama sıfır olmayan) renkteki herkes puan alır. | Azınlık oyunu; "herkes ne yapar?" tahmini. | 3–8 | ~60 sn | Tek ve Küçük'e çok yakın olduğu için ayrı oyun yapılmadı; ileride Tek ve Küçük'ün varyantı olabilir. |
| 5 | **Ritim Kopyası** | Bir oyuncu dört vuruşluk ritim çalar, diğerleri kendi telefonunda tekrarlar; en yakın kazanır. | Fiziksel, gülünç, TV'de okunur. | 3–8 | ~75 sn | Zamanlama ölçümü telefon gecikmesine duyarlı, adil kılmak zor; bu yüzden ertelendi. |

**Seçilenler:** 1, 2, 3. Gerekçe: üçü de içeriksiz (yalnız renk/şekil/sayı), kısa, telefonda tek başparmakla
oynanır, TV'de okunur; her biri farklı bir sosyal dinamik verir (odak noktası, ters psikoloji, sessiz işbirliği);
4. kavram 2'nin içinde kalır, 5. kavramın ölçüm adaleti ayrıca çözülmeli.

---

## 2. Ortak Nokta — `ortak-nokta` — TASLAK — sahip onayı bekliyor

- **Amaç:** Konuşmadan, diğerlerinin de seçeceğini düşündüğün kutuyu seç; ne kadar çok kişiyle eşleşirsen o kadar puan.
- **Oyuncu sayısı:** 3–8. Dikey (portrait).
- **Aşamalar ve süreler:** 4 tur. Her tur: seçim 12 sn, sonuç 5 sn (son tur 7 sn). En uzun 70 sn.
  Erken bitiş: bağlı herkes seçip "Tamam" derse seçim 1 sn sonra biter. Anlatım ~10 sn.
  - Her turda 6 kutu görünür; her kutu ayrı bir renk ve ayrı bir şekildir (renk körü için şekil de ayırt eder).
    Kutular sunucu rastgeleliğiyle çekilir. **Kutuların ekran sırası her oyuncuda farklıdır** (konum odak noktası olamaz).
  - Oyuncu bir kutuya dokunur (değiştirebilir), "Tamam" ile kilitler.
- **Puanlama (tur):** Seçen her oyuncu, kendisiyle aynı kutuyu seçen kişi sayısı kadar puan alır (yalnız kalan 0).
  Tek en kalabalık grup (en az 2 kişi) üyelerine ayrıca +1. Seçim yapmayan 0 alır ve hiçbir gruba sayılmaz.
- **Genel skor:** 4 turun toplamı; en yüksek +2, ikinci +1; en yüksek eşitse liderlerin hepsi +1 (ortak sıralama ödülü).
- **Beraberlik:** Yukarıdaki eşitlik kuralı; grup boyutları eşitse bonus verilmez.
- **Kopan oyuncu:** Beklenmez; kilit sayımına girmez. Seçmişse seçimi geçerli kalır, seçmemişse o tur 0.
- **Gizli bilgi:** Seçimler (sonuç açılana dek) ve her oyuncunun ekran sırası yalnız `view`'da; ortak görünümde yalnız kimlerin
  kilitlediği bulunur. Gelecek turların kutuları görünümde yoktur.
- **Tutorial/görsel:** Üç parmağın aynı parlayan şekle uzandığı kısa çizim; "Konuşmak yok, tahmin et" vurgusu. Sonuçta
  kutuların altında seçenlerin avatarları belirir, en kalabalık kutu altın parlar.

## 3. Tek ve Küçük — `tek-ve-kucuk` — TASLAK — sahip onayı bekliyor

- **Amaç:** Başkasının seçmediği en küçük sayıyı seçmek.
- **Oyuncu sayısı:** 3–8. Dikey.
- **Aşamalar ve süreler:** 5 tur. Seçim 10 sn, sonuç 4 sn (son tur 6 sn). En uzun 72 sn. Erken bitiş "Tamam" ile (Ortak Nokta gibi).
  - Seçilebilecek sayı 1 ile **oyuncu sayısı + 2** arasıdır (3 kişide 5, 8 kişide 10).
  - Önceki turların kazanan sayıları herkese açık ipucu olarak görünür.
- **Puanlama (tur):** Tam olarak bir kişinin seçtiği sayılar arasında **en küçüğü** seçen turu kazanır ve +3 alır. Tek kalan sayı yoksa kimse puan almaz. Seçmeyen yarışmaz.
- **Genel skor:** 5 turun toplamı; en yüksek +2, ikinci +1; liderler eşitse +1. Kimse puan almadıysa genel skor yok.
- **Beraberlik:** Tur içinde beraberlik olamaz (tek seçilen sayının sahibi tektir). Toplamda ortak sıralama ödülü.
- **Kopan oyuncu:** Beklenmez; seçmişse seçimi sayılır.
- **Gizli bilgi:** Seçimler ve sayımlar sonuç açılana dek yalnız sahibinin `view`'ında; ortak görünümde yalnız kilitleyenler ve önceki tur kazanan sayıları.
- **Tutorial/görsel:** Çakışan iki "1" kırmızı elenir, tek kalan "2" altın parlar. Sonuçta sütun grafiği: her sayının üstünde seçenlerin avatarları; ★ kazanan, ● tek, ✕ çakışan (renge ek ipucu).

## 4. Sessiz Sıra — `sessiz-sira` — TASLAK — sahip onayı bekliyor

- **Amaç:** Takım olarak, gizli kartları konuşmadan küçükten büyüğe sırayla oynamak; 3 canı korumak.
- **Oyuncu sayısı:** 3–8. Dikey. Tur süresi göstergesi yoktur (gizli); kuralı gereği kabuk saati çizilmez.
- **Aşamalar ve süreler:** 3 tur: kartlara bakma 3 sn → oynama (en çok 18/22/22 sn; tüm kartlar bitince 1 sn sonra) → sonuç 3 sn (son tur 5 sn). En uzun 82 sn.
  - Oyuncu başına kart: 1. tur 1, 2. ve 3. tur 2 (1–99 arası, tur içinde benzersiz). Takımın 3 canı vardır (3 tur boyunca ortak).
  - "OYNA": oyuncunun elindeki **en küçük** kartı oynar (sıra seçilemez). Başka birinin elinde daha küçük kart yoksa hamle doğrudur.
  - Hata: başka birinin elinde daha küçük kart varsa takım 1 can kaybeder; o küçük kartlar açılıp atılır.
  - Süre dolarsa elde kalan kartlar açılır ve takım 1 can kaybeder (kart kalmadıysa kayıp yok).
  - Canlar biterse oyun hemen son sonuç ekranına geçer, kalan turlar oynanmaz.
- **Puanlama:** Doğru hamle +1, hatalı hamleyi yapan −1 (mini puan). Takım ayakta kalırsa genel skor mini puana göre: en yüksek +2, ikinci +1 (eşitse liderler +1; yalnız 0'dan büyük puanlar ödül alır). **Takım batarsa kimse genel skor almaz.**
- **Beraberlik:** Ortak sıralama ödülü kuralı.
- **Kopan oyuncu:** Kartları elinde kalır; oynanamazsa süre dolunca açılır (takım canı gider). Bu, kopmanın takımı cezalandırması demektir; sahip isterse kopan oyuncunun kartlarını tur başında hiç dağıtmama seçeneğini onaylayabilir (açık soru).
- **Gizli bilgi:** Eldeki kartlar yalnız sahibinin `view`'ında; ortak görünümde yalnız kart sayıları, oynanan (ve açılan) kartlar.
- **Tutorial/görsel:** Küçükten büyüğe dizilen 12-47-90 kartları, parmak dudakta. Oynama ekranında büyük kart ve tek büyük OYNA düğmesi; oynananlar sırayla avatar etiketli olarak dizilir (yeşil doğru, kırmızı hata, kesik çizgi açılan).

## 5. Açık sorular (sahibe)

1. Ortak Nokta'da en kalabalık gruba +1 bonus gerekli mi, yoksa yalnız eşleşme sayısı mı?
2. Tek ve Küçük kazanan puanı +3 mü (5 tur)? Sayı aralığı oyuncu+2 uygun mu?
3. Sessiz Sıra'da canlar bitince oyunun erken bitmesi ve genel skorun sıfırlanması çok sert mi? Süre göstergesi hiç olmasın mı?
4. Üçü de rastgele havuzdan **çıkarılmış** olarak mı onaylanacak (varsayılan), yoksa havuza mı?

## 6. Kapalı tutma ve deneme yolu

- Taslak oyunlar `GAMES` kaydında, motor kataloğunda, lobi seçicisinde ve rastgele havuzda **yoktur**; `setGames` reddeder
  (`packages/engine/src/games/taslak.ts`, `apps/server/src/taslak.ts`).
- Yalnız sunucu `GLIX_TASLAK_OYUNLAR=1` ile başlatılırsa (ya da testte `draftGames: true`) eklenirler; yine de `randomPool: false`
  taşırlar ve yönetici ayarı bile onları havuza alamaz. Yalnız ev sahibi elle seçer.
- Ekran önizlemesi (sunucusuz): `pnpm --filter @glix/client dev` sonra `?mock=ortak-nokta-choosing`, `?mock=tek-ve-kucuk-reveal`,
  `?mock=sessiz-sira-play` (tam liste `apps/client/src/dev/mockTaslak.ts`).
- Gerçek odada deneme: `GLIX_TASLAK_OYUNLAR=1 pnpm --filter @glix/server dev` (3+ tarayıcı sekmesi), lobide oyunu elle seç.
- Onay sonrası: oyun `taslak.ts`'ten silinip `games/index.ts` `GAMES`'ine, botu `games/bots.ts`'e taşınır; `randomPool: false` kaldırılır.
