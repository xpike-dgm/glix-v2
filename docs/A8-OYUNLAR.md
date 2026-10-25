# A8 — Bozuk Telefon ve Kara Borsa: kural yorumları

Kanonik kural: `docs/KURALLAR.md` §26 ve §28 (ikisi de TASLAK). Ortak kurallar `docs/A4-OYUNLAR.md`, erken bitiş `docs/ERKEN-BITIS.md`.

## Bozuk Telefon (`bozuk-telefon`, 3–8)
- **Döngü:** sunucu `setup`'ta oyuncuları karıştırır (`order`). Zincir `c`'yi `order[c]` başlatır; `s`. adımda `order[(c+s) % n]` tutar.
  Adım sayısı `min(n, 6) ≤ n` olduğundan hiçbir zincir başlatıcısına sona kadar dönmez; her adımda herkes tam bir zincir tutar.
- **Adım türü:** çift adımlar yazı, tek adımlar çizim (yaz → çiz → yaz …). Çift sayıda adımda (4, 6) zincir çizimle biter; "son yazı adımı"
  son *yazı* adımıdır (4 oyuncuda 2. adım).
- **Süre/erken bitiş:** yazma 25 sn, çizme 60 sn; bağlı herkes "Tamam" derse adım 1 sn sonra biter (Tür 1). Yazı taslağı da süre dolunca
  geçerlidir; boş yazı `…`, boş çizim `[]` ("boş tuval"). Yazı ve çizim adımlarında "Tamam" için en az bir yazı / darbe gerekir.
- **Gizlilik:** oyuncu yalnız elindeki zincirin bir önceki adımını (yazarsız) görür; gösteriye kadar başka adım hiçbir görünümde yok.
- **Gösteri:** zincir `0..n-1` sırayla; her adım 3 sn, ardından 10 sn oylama, ardından **3 sn sonuç penceresi** (kural dışı açılış penceresi:
  oy dağılımı + sağlam zincir göstergesi). Yalnız geçerli zincirin adımları `publicView`'da yer alır (boyut sınırı).
- **Oy:** en komik adımın numarası, **tek seferlik** (değiştirilemez); kendi adımına yok. Bağlı herkes oy verince zincir 1 sn sonra sonuca geçer.
  Oy vermeyenin oyu sayılmaz.
- **Çizim sınırları (60 sn):** en çok 150 darbe, 1500 nokta, 400 eylem (Karalama'dan küçük; ortak doğrulama `games/drawing.ts`).
- **Cümle:** `sanitizeWord(…, 60)` (Türkçe büyük harf, boşluk sadeleşir); yalnız emoji/boş reddedilir.
- **Sağlam zincir:** ilk cümle ile son yazı adımının normalize kelime kümeleri (büyük harf, aksansız, noktalamasız) kesişimi,
  **büyük kümenin en az yarısı** ise zincirdeki herkes (yazarlar) +1. Boş (`…`) yazı sağlam sayılmaz. (Kural "kelimelerin en az yarısı" der;
  iki yönlü yarım koşulu seçildi.)
- **Puan:** en komik seçilen her oy adımın yazarına +1; `awards = miniScores`.

## Kara Borsa (`kara-borsa`, 3–8)
- Kutu değerleri ve oyuncu başına ipuçları **`setup`'ta** `ctx.rng` ile üretilir (tick'te rastgelelik yok); durumda gizli kalır.
  Değer: %15 lanetli (−20), aksi 0–60 düzgün. İpuçları gerçek değere göre yalnız doğru adaylardan seçilir; mümkünse oyuncular farklı ipucu alır.
  İpucu yapısaldır (`gt, lt, between, even, odd, multiple, notMultiple, cursed, notCursed`), istemci Türkçeye çevirir.
- Teklif tek seferlik, 0..jeton; **jetonu biten oyuncu otomatik "verdi" sayılır** (beklenmez). Erken bitiş Tür 2: **tüm katılımcılar** verince tur 1 sn sonra biter
  (kopuk oyuncu beklenir, süre dolar).
- Kazanan: en yüksek teklif (>0); eşitlikte önce teklif veren (işlenme sırası). Hepsi 0 → kutu kimsenin değil.
- Açılış 5 sn: kutu değeri, tüm teklifler, kazanan, fiyat.
- Mini puan = kalan jeton + alınan kutuların değer toplamı (lanetli −20 düşürür; negatif olabilir).
- **Genel skor:** rankAwards kuralı uymadığı için (`borsaAwards`): yarışma sıralaması; 1. derece +2, 2. ve 3. derece +1; eşit puan aynı dereceyi ve
  ödülü paylaşır, sonraki derece atlanır (iki birinci → ikisi +2, 3. derece +1). Kimse kutu almazsa herkes eşit → herkes +2.
- Tüm gizli değerler kısa sayı olduğundan `secrets()` boştur; gizlilik yapısal olarak sınanır.
