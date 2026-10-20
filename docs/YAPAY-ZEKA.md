# GLIX — Yapay Zekâ ile Yapılabilecekler (kapsamlı plan)

**Sahip kararları:** içerik üretimi (kelime havuzları, tanımlar, ipuçları) yapay zekâ ile **yapılmaz**; havuzlar
insan eliyle hazırlanır. Sağlayıcı: **OpenAI'nin ucuz/hızlı bir modeli** (kesin model adı maliyet/gecikme ölçümünden
sonra sahip tarafından seçilir). Aşağıdaki her özellik bu varsayımla tasarlandı: kısa girdi, kısa ve şemalı çıktı,
düşük gecikme, yapay zekâ yoksa da çalışan yedek.

---

## 0. Temel mimari (her özellik bunun üstüne kurulur)

- **Tek kapı:** `apps/server/src/ai/` — sağlayıcıdan bağımsız arayüz (`AiProvider`), ilk uygulama OpenAI.
  İleride sağlayıcı değişirse yalnız bu dosya değişir. Anahtar yalnız sunucuda (VDS sırrı); telefon yapay zekâya hiç
  bağlanmaz.
- **Şemalı çıktı:** her çağrı JSON şemasıyla istenir ve sunucuda yeniden doğrulanır (CLAUDE.md: ağdan gelen her veri
  doğrulanır). Geçersiz çıktı = yedek.
- **Zaman aşımı + yedek:** canlı çağrılar 1,5–3 sn sınırlı; aşılırsa kural tabanlı yedek. Oyun asla yapay zekâyı
  beklemez — çağrılar doğal bekleme anlarında (anlatım, açılış penceresi, sonuç ekranı) önceden tetiklenir.
- **Determinizm:** puanı etkileyen her yapay zekâ kararı (hakem, bot hamlesi) oyuna **eylem olarak** girer ve
  `GameLog`'a yazılır; `replay` aynı sonucu verir. `tick` yapay zekâ çağırmaz.
- **Gizlilik:** takma ad yerine "Oyuncu A/B/C"; görsel/metin yalnız ilgili özellik açıkken; kalıcı saklama yok;
  aydınlatma metni + host'un odada yapay zekâyı kapatma anahtarı.
- **Bütçe:** maç başına çağrı tavanı, günlük global tavan, devre kesici; metrikler `/health` ve `stats`'ta
  (çağrı, p95 gecikme, yedeğe düşme oranı, token, maliyet).
- **Önbellek:** aynı girdiye aynı cevap (ör. aynı kelime çifti eşleşmesi) sunucuda LRU ile saklanır; tekrar eden
  kararlar bedava.
- **Değerlendirme seti:** her canlı özellik için 50–100 örnek; model/talimat değişikliği bu setle ölçülmeden yayına
  çıkmaz.

---

## 1. Hakem ve adalet (puanı etkileyen, en yüksek değer)

| # | Özellik | Nerede | Yedek |
|---|---|---|---|
| H1 | **Anlamsal eşleşme:** "araba" = "otomobil", "TV" = "televizyon", yazım hatası ("kahfe" ~ "kahve") | Çağrışım Ağı, Yazı Yaz tahmini, Sızma tahmini (varsa) | Türkçe normalize + Levenshtein ≤ 1 |
| H2 | **Host itiraz akışı:** sonuç ekranında "Bu iki cevap aynı sayılsın mı?" → yapay zekâ gerekçeli öneri, son söz host'ta | Tüm kelime eşleşmeli oyunlar | Yalnız host kararı |
| H3 | **Blöf kalitesi kontrolü:** Sözlük Blöfü'nde gerçek tanımın neredeyse aynısı olan blöfü yakalama (bugün yalnız birebir aynısı reddediliyor) | Sözlük Blöfü | Birebir karşılaştırma |
| H4 | **Kelime geçerliliği:** Kendim / Yazı Yaz'da anlamsız, kişisel bilgi içeren ya da kural dışı girişleri yumuşakça reddetme ("tek kelime yaz") | Yazı giren oyunlar | Biçim kuralları |

Kabul: H1 değerlendirme setinde ≥ %95 doğru; yanlış pozitif (farklı şeyleri aynı sayma) ≤ %2.

## 2. Canlı eğlence katmanı (puanı etkilemez, oyunu renklendirir)

| # | Özellik | Ayrıntı |
|---|---|---|
| E1 | **Anlatıcı:** tur aralarında 1–2 cümle espri | "Mert üçüncü kez son kaçan… cesaret mi, alışkanlık mı?" Girdi: tur sonucu özeti (etiketli). Yedek: 200 şablon cümle |
| E2 | **Tur özeti / "turun yıldızı"** | Sonuç ekranında tek cümlelik anlatı; yedek: kural tabanlı `summarize(result)` |
| E3 | **Unvan üretici** | Maç sonunda her oyuncuya o maça özgü komik unvan ("Kronometre Keşişi", "Blöfün Babası") — istatistikten |
| E4 | **Maç hikâyesi** | Final ekranında 3–4 cümlelik "bu gecenin hikâyesi" — paylaşım kartına da girer |
| E5 | **Karalama yorumcusu** | Oylama sonrası en çok oy alan çizim için sanat eleştirmeni ağzından kısa yorum (görsel girdi; açılış penceresinde) |
| E6 | **Kendim/Yazı Yaz "grup röntgeni"** | Herkesin yazdığı kelimelerden eğlenceli grup analizi ("Bu grup %60 aç, %40 uykusuz") |
| E7 | **Ceza/görev çarkı** | Son sıradakine gruba uygun eğlenceli görev (host'un seçtiği ton: aile / arkadaş / ofis) |

## 3. Yapay zekâ oyuncu ve dolgu

| # | Özellik | Ayrıntı |
|---|---|---|
| B1 | **Bot oyuncu** ("🤖 Bot" etiketli, gizlenmez) | 2–3 kişilik gruplar 3+ isteyen oyunları oynayabilsin: Sızma (ipucu metni ekranda), Sözlük Blöfü (sahte tanım yazar), Çağrışım (cevap verir), Kendim, Yazı Yaz |
| B2 | **Zorluk ayarı** | Bot "acemi / usta"; acemi bilerek hata yapar |
| B3 | **Kopan oyuncunun yerine geçici bot** (host açarsa) | Oyuncu dönünce kontrol geri verilir; bot hamleleri "bot oynadı" diye işaretlenir |
| B4 | **Sözlük Blöfü yemleri** | Odada az blöf varsa 1–2 yapay zekâ blöfü eklenir (sahibi "Bot") — oyun daha zor ve eğlenceli |

Kural: botlar her zaman açıkça bot; puan tablosunda ayrı renk; host kapatabilir.

## 4. Yeni oyun türleri (yapay zekâ olmadan olmayacak oyunlar)

| # | Oyun | Nasıl |
|---|---|---|
| G1 | **Makine Kim?** | Herkes aynı soruya kısa cevap yazar; biri yapay zekânın. Makineyi bulan +1, makineye oy alan insan −… (blöf) |
| G2 | **Savunma Avukatı** | Absürt suçlama ("Buzdolabını kırmızıya boyamak"), herkes 30 sn savunma yazar; yapay zekâ jüri gerekçeli karar verir, oyuncular jüriye itiraz oyu verir |
| G3 | **Çiz ve Kandır** | Yapay zekâ bir çizimi tahmin eder; amaç insanların bulup yapay zekânın bulamayacağı çizim yapmak |
| G4 | **Hikâye Zinciri** | Herkes bir cümle ekler, yapay zekâ beklenmedik bir "olay" araya sokar, sonda en iyi katkı oylanır |
| G5 | **Emoji Tercüman** | Yapay zekâ bir film/şarkıyı emojilerle anlatır (ya da oyuncunun emoji anlatımını puanlar) |
| G6 | **İkna Et** | Yapay zekâ bir karakter (inatçı kapıcı); oyuncular 1 cümlede ikna etmeye çalışır, karakter en iknaedici olanı seçer |
| G7 | **Yalan Dedektörü** | Herkes 2 doğru 1 yalan yazar; yapay zekâ da tahmin eder — onu kandıran bonus alır |
| G8 | **Tartışma Hakemi** | İki oyuncu bir konuda 20 sn savunma yazar, yapay zekâ + seyirciler kazananı seçer |

Her yeni oyun normal oyun kurallarıyla (`defineGame`, testler, sızıntı testi) yazılır; yapay zekâ çıktısı eylem
olarak kaydedilir; API yoksa oyun katalogdan otomatik gizlenir.

## 5. Oyuncuya yardım ve öğrenme

| # | Özellik | Ayrıntı |
|---|---|---|
| Ö1 | **"Ne yapacaktım?" düğmesi** | Oyunda takılan oyuncuya o anki duruma göre tek cümle ipucu ("Bir sayı seç, ortalamanın yarısına en yakın olan kazanır") — kural metni + mevcut aşama girdi |
| Ö2 | **Kural sorusu** | Lobide/oyunda "Kural sor" — `KURALLAR.md` bölümüne dayalı kısa cevap (yalnız o oyunun metni gönderilir) |
| Ö3 | **Oyun önerisi** | "Bu gece 4 kişiyiz, sakin bir şey istiyoruz" → 5 oyun önerisi (katalog + oyun karneleri girdi) |
| Ö4 | **Sonuç açıklaması** | "Neden −1 aldım?" — puan hesabını sade dille anlatır (sonuç verisi girdi) |

## 6. Güvenlik ve moderasyon

| # | Özellik | Ayrıntı |
|---|---|---|
| M1 | **Metin moderasyonu** | Takma ad, blöf, kelime, savunma, geri bildirim; önce yerel kara liste (anında), sonra yapay zekâ (şüphelilerde) |
| M2 | **Aile modu** | Host açarsa tüm serbest metinler daha sıkı filtre; okul/aile ortamı için varsayılan önerisi |
| M3 | **Kişisel bilgi süzgeci** | Telefon, adres, tam isim gibi bilgileri metinden ayıklar/maskeler |
| M4 | **Görsel moderasyon** | Karalama çizimlerinde uygunsuz içerik — paylaşım kartı ve galeri öncesi (yedek: rapor düğmesi) |
| M5 | **Kötüye kullanım raporu ön değerlendirmesi** | "Sorun bildir" kayıtlarını sınıflandırır, yöneticiye özet |

Kabul: yanlış pozitif (masum metni engelleme) ≤ %1; engellenen metin oyuncuya kibar Türkçe açıklamayla döner.

## 7. Erişilebilirlik

| # | Özellik | Ayrıntı |
|---|---|---|
| A1 | **Sesli okuma** | Anlatım ve kart metinlerini seslendirme (TTS) — görme zorluğu / çocuklar / TV modu |
| A2 | **Sesle cevap** | Konuşarak kelime girme (konuşmadan yazıya) — klavye zorluğu yaşayanlar için Çağrışım/Yazı Yaz |
| A3 | **Sade anlatım** | Briefing'in "çok kısa" sürümü (çocuklar, ilk kez oynayanlar) |
| A4 | **Çizim betimleme** | Karalama oylamasında görme zorluğu olanlar için çizimin kısa betimlemesi |

## 8. Host araçları ve parti yönetimi

| # | Özellik | Ayrıntı |
|---|---|---|
| P1 | **Akıllı maç planlayıcı** | Oyuncu sayısı, istenen süre ve ton → dengeli 5 oyunluk sıra (hız/blöf/çizim karışık) |
| P2 | **Tema gecesi** | Host bir tema yazar ("90'lar"), anlatıcı ve unvanlar o temada konuşur (içerik havuzları değişmez) |
| P3 | **Takım dengeleyici** | Geçmiş performansa göre dengeli takımlar (takım modu gelince) |
| P4 | **Maç sonu duyuru metni** | Host'a WhatsApp grubuna atılacak eğlenceli kazanan duyurusu |

## 9. Operasyon ve ürün (iç kullanım, oyuncuya görünmez)

| # | Özellik | Ayrıntı |
|---|---|---|
| İ1 | **Haftalık geri bildirim özeti** | Anonim geri bildirim metinleri → temalar, şikâyet sıralaması, oyun bazında duygu |
| İ2 | **Denge raporu** | Oyun kayıtlarından puan dağılımı anomalileri ("Rüşvet'te başkan ort. +3, diğerleri +0,4") — sayılar kodla hesaplanır, yapay zekâ yorumlar |
| İ3 | **Hata kümeleri** | İstemci hata kayıtlarını gruplar, olası kök neden ve öncelik |
| İ4 | **Sürüm notu yazıcı** | Commit listesinden oyuncuya dönük eğlenceli Türkçe sürüm notu taslağı (insan onaylı) |
| İ5 | **Mağaza / sosyal metin taslakları** | Mağaza açıklaması, duyuru metinleri (insan onaylı) |

---

## Öncelik ve aşamalar (YOL-HARITASI.md ile uyumlu)

| Sıra | Paket | İçerik | Neden önce |
|---|---|---|---|
| 1 | Altyapı | Bölüm 0 (kapı, bütçe, yedek, metrik, değerlendirme seti) | Her şeyin temeli; oyuncuya görünmez, risksiz |
| 2 | Güvenlik | M1, M2, M3 | Serbest metin oyunları zaten yayında; en somut risk |
| 3 | Adalet | H1, H2, H3 | En çok tartışma çıkan an; doğrudan puanı düzeltir |
| 4 | Eğlence | E1, E2, E3, E4 | Ucuz, yedekli, oyunun hissini en çok değiştirir |
| 5 | Dolgu | B1, B2, B4 | Küçük gruplara 24 oyunun tamamını açar |
| 6 | Yeni oyunlar | G1, G2, G3 (sonra G4–G8) | Ayırt edici özellik; altyapı ve moderasyon hazır olunca |
| 7 | Yardım + erişilebilirlik | Ö1–Ö4, A1–A4 | Yeni oyuncu kazanımı ve kapsayıcılık |
| 8 | Host + operasyon | P1–P4, İ1–İ5 | Sürekli değer, düşük risk |

## Maliyet ve gecikme varsayımları (ölçülecek)
- Canlı çağrılar kısa: girdi ~200–600, çıktı ~20–120 token; ucuz modelde maç başına toplam maliyet kuruş
  mertebesinde olmalı — kesin rakam Bölüm 0'daki ölçümle çıkarılır ve tavanlar buna göre ayarlanır.
- Gecikme hedefleri: moderasyon < 800 ms (şüpheli metinlerde), hakem < 1,5 sn (açılış penceresinde gizlenir),
  anlatıcı prefetch ile 0 algılanan gecikme; aşılırsa yedek.
- Görsel girdili özellikler (E5, G3, M4, A4) daha pahalı: yalnız açılış anında, en fazla 1–2 görsel/tur, küçültülmüş
  çizim (PNG ≤ 256 px).
