# GLIX — Yol Haritası: UI/UX, Oyun İyileştirmeleri, Yapay Zekâ (6 aşama)

Durum: 24 oyun önizlemede, erken bitiş yayında. Bu belge sonraki büyük işin planıdır; kural değiştiren her madde
`KURALLAR.md`'ye işlenmeden uygulanmaz (sahip onayı). İş kolları: **U** (UI/UX), **O** (oyun iyileştirmeleri),
**Y** (yapay zekâ — ayrıntılı plan: `docs/YAPAY-ZEKA.md`; içerik üretimi yapay zekâ ile yapılmaz, sağlayıcı OpenAI'nin ucuz bir modeli). Altta 6 aşamalı uygulama planı.

---

## U — UI/UX iş kolu

### U1. Ortak oyun kabuğu (GameShell)
- Tek üst şerit: sol oyun adı + "2/5", orta süre bileşeni, sağ ses/çıkış. Oyunlar yalnız orta alanı çizer.
- **Süre bileşeni (`<Clock>`):** ince çubuk; son 5 sn kalınlaşır, kırmızıya döner, sayı belirir, tik sesi + hafif titreşim.
  Erken bitişte çubuk yumuşak kapanır (bugünkü sıçrama biter).
- **Durum cümlesi (`<Status>`):** her an tek büyük cümle: "Seç!", "Bekle…", "Sıra Mert'te", "Açılıyor!".
- **Hazır şeridi:** "n/m hazır" + avatar noktaları her oyunda aynı yerde (TamamBar ile birleşir).
- **Maç yolu:** üstte 5 noktalı ilerleme (oyun simgeleri), geçilen yeşil, şu anki nabız atar.
- Kabul: 24 oyunun hepsi kabuğa taşınmış; `ui:check`'e "kabuk tutarlılığı" denetimi (şerit yüksekliği, süre konumu).

### U2. Lobi yeniden düzeni
- 5+ oyuncuda 4 sütun küçük avatar ızgarası; boşalan yere yatay **oyun kartları şeridi** (rastgele modda dönen "?" kartlar).
- "Minigame Seçimi" → "Oyunlar". Oyun kartında süre, oyuncu aralığı, tür etiketi (Hız / Blöf / Çizim / Sayı / Sosyal).
- **QR ile katılma** (oda kodunun yanında, dokununca büyür) — bağımlılıksız küçük QR üreticisi ya da gerekçeli tek bağımlılık.
- Host olmayanlar için: avatar değiştirme, "hazırım" işareti, avatara dokununca tepki animasyonu.
- Kabul: 8 oyuncu + oyun şeridi 320×568'de kaydırmasız; QR telefon kamerasıyla okunuyor (gerçek cihaz testi).

### U3. Anlatım (briefing) 2.0
- Metin yerine **3 karelik otomatik mini animasyon** (oyun başına `BriefingDemo`), metin altta tek satır.
- "Biliyorum" düğmesi (oyunu daha önce oynayan anında hazır; cihazda oynanan oyunlar listesi).
- "2 kişi ilk kez oynuyor" bilgisi; hazır avatar tekrarı kaldırılır (tek sıra).
- Kabul: anlatımda ortalama bekleme (stats) %40 azalır.

### U4. Sonuç ve final ekranı
- Sıralama değişimi animasyonu (↑2 yeşil ok, satırlar kayar), puan jetonları avatardan tabloya uçar.
- **Tur özeti satırı:** oyunun `result`'ından türeyen tek cümle ("Elif 3 eşleşme ile turun yıldızı") — oyun başına
  `summarize(result)` saf fonksiyonu (engine), Y5 ile zenginleşir.
- "Sıradaki: Kör Kronometre" kartı + **"Devam" (herkes basınca 7 sn beklenmez)** — sunucu `results` aşamasına erken bitiş.
- Final: podyum + unvanlar + "Aynı ekiple yeni maç" + paylaşım kartı (U7).

### U5. Canlılık (juice)
- **Tepki yağmuru:** sonuç/final ekranında 😂 😱 🔥 👏; sunucuda hız sınırlı yeni mesaj `react`, herkese yayın.
- **Avatar ifadeleri:** 4 durum (bekliyor-nefes, sevinç, elendi-çatlak, düşünüyor) — mevcut avatar SVG'lerine katman.
- **Geçiş perdesi:** briefing → countdown → oyun → sonuç arasında tutarlı ışık süpürmesi.
- **Ses katmanı:** lobi döngüsü, oyun içi gerilim ritmi (süre bileşenine bağlı), tek ana ses + müzik/efekt ayrı düzey.

### U6. Erişilebilirlik ve ayarlar
- Ayarlar sayfası: büyük yazı, titreşim aç/kapa, müzik/efekt ayrı, hareket azaltma (sistem ayarına ek), **renk körü modu**
  (Zaman Bombası, Kontrol Paneli, avatarlarda renk + desen/şekil kodu zorunlu).
- Başparmak bölgesi kuralı: birincil eylemler alt %40'ta; `ui:check`'e konum denetimi.

### U7. Paylaşılabilir anlar
- Maç sonunda 9:16 kartlar (en iyi çizim, en çok kandıran blöf, 10,00'a en yakın basış…), istemcide canvas ile üretilir
  (sunucuya görüntü gitmez). Web Share API; yoksa indir.
- Kartta "Sen de oyna: glix…/KOD" — yalnız takma ad, başka kişisel veri yok.

### U8. Büyük ekran / TV (sahne) modu
- Yeni rol **sahne**: `publicView` alır, `view` almaz (izleyiciyle aynı güvenlik sınıfı). `/tv` → oda kodu/QR ekranı.
- Her oyuna `StageView` (yatay, büyük animasyon); sahne varken telefon arayüzü sade kumandaya döner.
- Tablet/masaüstü: iki sütun (sol oyun, sağ oyuncular/skor).

---

## O — Oyun iyileştirmeleri iş kolu

**Kural değiştirenler (sahip onayı → KURALLAR.md güncellemesi → uygulama):**

| # | Oyun | Değişiklik |
|---|---|---|
| O1 | Zaman Bombası | 90 sn toplam sınır; 60 sn sonra ani ölüm (+2 renk); oynatma 600→350 ms; giriş 1,5 sn + 1 sn/renk |
| O2 | Zehirli Kadeh | Her oyuncuya 1 "koklama": seçtiği kadehin durumu yalnız ona açılır |
| O3 | Rüşvet ve Darbe | Gerçek darbe: pay almayanların ortak darbe oyu, çoğunlukta başkanın +1'i iptal |
| O4 | İttifak | Pazarlıkta puansız "söz" işaretleri; sonda tutulan/bozulan sözler açılır |
| O5 | Ortalamaya En Yakın | 3 kısa tur, çarpan her tur değişir (½, ⅔, ¾), önceki ortalama görünür |
| O6 | Kör Kronometre | Hedef 7–13 sn arası rastgele, başta gösterilir; basmayan sıralamaya girmez |
| O7 | Aşırı Yükleme | En az tıklayan da −1 (risksiz pasifliği kırar) — sahip kararı |
| O8 | Butona Bas | 3 tur, pencere 300→200→120 ms |
| O9 | Kör Bomba / Rus Ruleti | İzleyen tahmini ("patlar mı?") doğru +1 (Rus Ruleti'nde rozet) |
| O10 | Gizli Kareler | 2. aşamada bir "ödül karesi" (+2) |
| O11 | Sızma | Sonda "fark ettin mi?" — kendini fark eden sızmaya +1 |
| O12 | Çizgiyi Geçme | Bölge genişliği oyuncu sayısına göre |

**Kural değiştirmeyen cilalar (onaysız yapılabilir):**
- Karalama: renk paleti + kalınlık, oylamada çiziliş tekrarı, maç sonu galeri.
- Gizli Alışveriş: gerçek ürün ikon seti (12 SVG).
- Kontrol Paneli: ipucunu metin yerine mini panel çizimiyle göster.
- Sözlük Blöfü / Çağrışım / Sızma: sıralı dramatik açılış (en çok kandıran en son).
- Yazı Yaz: puansız "şüphe göstergesi". Kendim: sürükle-bırak eşleştirme.
- Çapraz Ateş / Açgözlülük: sinematik açılış sahneleri.
- Tüm oyunlar: `summarize(result)` (U4 tur özeti).

**Kabul (her O maddesi):** kural senaryo testleri + invariants + sızıntı testleri + sunucu testi + `ui:check`; oyun
karnesinde (stats) ortalama puan ve süre önce/sonra karşılaştırılır.

---

## Y — Yapay zekâ iş kolu

### Mimari ilkeleri
1. **Sunucu tarafı tek kapı:** `apps/server/src/ai/` modülü (`AiGateway`): tek istemci, zaman aşımı, yeniden deneme,
   oda başına ve global bütçe, devre kesici. İstemci (telefon) yapay zekâya asla doğrudan bağlanmaz; anahtar yalnız
   sunucuda (ortam değişkeni / VDS sırrı).
2. **Her özelliğin yedeği:** API yoksa/geç kalırsa oyun aynen oynanır (şablon anlatıcı, kural tabanlı eşleşme, havuz).
3. **Determinizm:** canlı yapay zekâ çıktısı oyun durumunu etkiliyorsa (hakem kararı, bot hamlesi) **eylem olarak**
   `GameLog`'a yazılır; `replay` aynı sonucu üretir. `tick` yapay zekâ çağırmaz.
4. **Gecikme gizleme:** canlı çağrılar yalnız doğal bekleme anlarında (açılış penceresi, briefing, results) ve
   önceden tetiklenir (prefetch); en kötü durumda yedek kullanılır, oyun beklemez.
5. **Gizlilik:** takma ad yerine "Oyuncu A/B" etiketleri gönderilir; çizim/metin yalnız ilgili özellik açıkken ve
   aydınlatma metniyle. İçerik kalıcı saklanmaz.
6. **Yapılandırılmış çıktı:** tüm çağrılar JSON şemalı (`output_config.format`), sunucuda tekrar doğrulanır
   (CLAUDE.md: ağdan gelen her veri doğrulanır — yapay zekâ çıktısı da "ağdan gelen veri"dir).

### Model seçimi
- Varsayılan: **Claude Opus 5.5** (`claude-opus-5-5`) — çevrimdışı içerik üretimi, doğrulama, analiz için.
- Canlı ve gecikmeye duyarlı yollar (anlatıcı, hakem, moderasyon, bot) için ölçüm sonrası sahip kararıyla daha hızlı
  bir model (Claude Sonnet 5.5 / Claude Haiku 5.5) ya da Opus 5.5 düşük effort değerlendirilir. Karar, Y0'daki küçük
  değerlendirme setinde gecikme + kalite + maliyet ölçülerek verilir; varsayım yok.
- Çevrimdışı toplu işler **Message Batches API** ile (≈%50 daha ucuz, eşzamansız).
- Sabit sistem talimatları + kelime kılavuzu **prompt caching** ile önbelleğe alınır (değişken içerik sona).

### Özellikler

| # | Özellik | Tür | Nerede | Yedek |
|---|---|---|---|---|
| Y1 | İçerik fabrikası: tema paketleri, zorluk etiketleri, Sızma/Çağrışım/Karalama/Kontrol ipuçları | Çevrimdışı, batch | `scripts/content/` + insan onay ekranı | Mevcut havuzlar |
| Y2 | Sözlük doğrulama + 500 kelime | Çevrimdışı | aynı | 88'lik havuz |
| Y3 | Moderasyon: takma ad, blöf, kelime, hikâye, geri bildirim | Canlı, hızlı | `ai/moderate.ts` (yerel kara liste önce) | Yalnız yerel liste |
| Y4 | Hakem: anlamsal eşleşme (Çağrışım, Yazı Yaz), host itirazı | Canlı, açılış penceresinde | engine'e "hakem eylemi" | Kural tabanlı normalize eşleşme |
| Y5 | Anlatıcı: tur arası espri, tur özeti zenginleştirme, TV'de seslendirme (TTS opsiyonel) | Canlı, prefetch | results/briefing | Şablon cümleler |
| Y6 | Bot oyuncu (Sızma, Sözlük, İttifak, Çağrışım) — "Bot" etiketli | Canlı | Oda'ya sanal katılımcı | Mevcut test botları (kural tabanlı) |
| Y7 | Karalama: yapay zekâ tahmini ("YZ bile bilemedi") + galeri başlıkları | Canlı, açılışta | Karalama açılışı | Özellik gizlenir |
| Y8 | Yeni YZ oyunları: Makine Kim?, Prompt Düellosu, Savunma Avukatı, Hikâye Zinciri | Oyun | `games/<id>/` | Oyun katalogdan gizlenir |
| Y9 | Analist: haftalık geri bildirim özeti, denge raporu, hata kümeleri | Çevrimdışı, zamanlanmış | `stats` + rapor | Ham istatistik |

### Maliyet ve güvenlik kontrolleri
- Oda başına çağrı sınırı (ör. maç başına ≤ 20 canlı çağrı), günlük global bütçe, aşılırsa otomatik yedek.
- Çıktı uzunluğu sınırlı (`max_tokens` küçük canlı yollar), önbellek isabet oranı izlenir (`cache_read_input_tokens`).
- Kayıt: model, gecikme, token, yedeğe düşme oranı → `/health` metrikleri ve stats.
- Değerlendirme seti (Y0): her canlı özellik için 50–100 örnek; model/effort değişikliği bu setle ölçülür.

---

## 6 aşamalı uygulama planı

Her aşama: lint, typecheck, test, build + e2e + `ui:check` + pwa:check yeşil, önizlemede yayın, kısa oyun gecesi.
Ajan düzeni: en çok 2 eşzamanlı ajan, her oyun/özellik sonrası commit.

### Aşama 1 — Temel ve hızlı kazançlar (1 hafta)
- O1 Zaman Bombası kısaltma (onaylı).
- U2 lobi yeniden düzeni + "Oyunlar" + QR.
- U4'ün sunucu kısmı: results "Devam" erken bitişi.
- Y0 altyapısı: `AiGateway` iskeleti (anahtar, bütçe, devre kesici, metrik), değerlendirme seti formatı — henüz
  oyuncuya görünür yapay zekâ yok.
- Kapı: lobi 8 oyuncu 320 px kaydırmasız; Zaman Bombası ort. süre ≤ 90 sn (stats).

### Aşama 2 — Ortak kabuk ve sonuç deneyimi (2 hafta)
- U1 GameShell + Clock + Status + maç yolu; 24 oyunun kabuğa taşınması (iki ajan, 12'şer oyun).
- U4 sıralama animasyonu, tur özeti (`summarize`), sıradaki oyun kartı.
- Kural değiştirmeyen cilaların ilk yarısı (Karalama paleti/tekrar, Alışveriş ikonları, sıralı açılışlar).
- Kapı: kabuk tutarlılık denetimi 24/24; oyun gecesinde "ne yapacağımı anladım" ≥ 4/5.

### Aşama 3 — Oyun derinliği (2 hafta)
- O2–O12 içinden sahibin onayladıkları (öneri sırası: O2 koklama, O3 darbe, O4 söz, O5 çok tur, O6 kronometre, O8).
- Kalan cilalar (Kontrol görsel ipucu, Kendim sürükle-bırak, Yazı Yaz şüphe göstergesi).
- Kelime havuzlarının elle genişletilmesi (yapay zekâ ile değil); Sözlük tanımlarının TDK'dan elle doğrulanması.
- Kapı: değişen her oyunun karne puanı önceki sürümden düşük değil.

### Aşama 4 — His ve paylaşım (2 hafta)
- U3 animasyonlu anlatım + "Biliyorum" (24 BriefingDemo; iki ajan).
- U5 tepki yağmuru, avatar ifadeleri, geçiş perdesi, ses katmanı.
- U6 ayarlar + renk körü modu; U7 paylaşım kartları.
- Y3 moderasyon (serbest metin oyunları + takma ad), yerel liste + yapay zekâ, yedekli.
- Kapı: anlatım bekleme süresi −%40; paylaşım kartı açılma ≥ %10 (beta grubunda).

### Aşama 5 — Canlı yapay zekâ (3 hafta)
- Y4 hakem (Çağrışım, Yazı Yaz) + host itirazı; `GameLog` hakem eylemi; replay testi.
- Y5 anlatıcı (metin; TTS opsiyonel, TV ile).
- Y6 bot oyuncular (önce Sızma ve Sözlük), Y7 Karalama tahmini.
- Model/effort kararı Y0 setinde ölçülerek; bütçe ve yedeğe düşme metrikleri izlenir.
- Kapı: canlı çağrıların p95 gecikmesi açılış penceresi içinde; yedeğe düşme < %5; maç başına maliyet hedefin altında.

### Aşama 6 — Sahne ve yeni nesil oyunlar (3–4 hafta)
- U8 TV/sahne modu: sahne rolü, `/tv`, 24 oyuna StageView (iki ajan), telefonun kumanda moduna geçmesi.
- Y8 yeni YZ oyunları (önce Makine Kim? ve Savunma Avukatı), Y9 haftalık analist raporu.
- A7: gerçek alan adına geçiş ve canlıya alma (glix.lynrax.com).
- Kapı: TV + 6 telefonla tam maç (e2e'ye sahne istemcisi eklenir); oyun gecesi ortalama ≥ 4,3/5.

---

## Ölçütler (her aşama sonunda)
- Linkten ilk oyuna süre, maç tamamlama oranı, oyun başına ortalama puan ve süre (stats), terk oranı.
- Yapay zekâ: çağrı sayısı, p95 gecikme, yedeğe düşme oranı, maç başına maliyet, moderasyon yanlış pozitif oranı.
- Teknik: tick p95, bellek, `ui:check` sayısı, e2e süresi.
