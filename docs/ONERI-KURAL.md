# ÖNERİ: Klavye uyumu ve erken bitiş (sahip onayı bekliyor)

Durum: **ÖNERİ — birleştirilmeyecek.** Dal: `oneri-kural`. Oyunlar KİLİTLİ olduğu için kural değişiklikleri
`docs/KURALLAR.md` içinde "(ÖNERİ — sahip onayı bekliyor)" ile işaretlendi. Onay çıkmazsa dal atılır; ana dala bir şey girmez.

Kaynak: üretimdeki oyuncu geri bildirimi.
(a) "ing klavyeyle türkçe klavye çakışıyor düzelsin" (maçta Yazı Yaz vardı).
(b) "görevler bittiğinde sürenin bitmesini bekliyoruz; herkes bitirince sonuçları görsek daha iyi" (Karalama Defteri, Zaman Bombası
Hafızası, Kör Bomba, Çağrışım Ağı, Butona Bas vardı).

## Önce durum tespiti

Denetim sırasında iki sorunun büyük kısmının ana dalda zaten çözüldüğü görüldü (geri bildirim eski bir sürümden gelmiş olabilir):

- Klavye uyumu: `foldKey` (`games/text.ts`) ana dalda var; Yazı Yaz, Kendim, Çağrışım Ağı, Sözlük Blöfü ve Bozuk Telefon kullanıyor;
  `WordField` zorla büyük harf yapmıyor.
- Erken bitiş: 1 sn'lik "kilit payı" ile bağlı-herkes-bitirdi kuralı 20 oyunda var.

Bu dal, kalan boşlukları kapatır. Oyun çatısı (`GameDefinition`) düz bir arayüzdür (`defineGame` benzeri ortak bir aşama motoru yok);
erken bitiş her oyunun `reduce` içinde, aşama bitiş zamanını öne çekerek yapılır. Bu yüzden tek bir genel mekanizma yerine ortak bir
yardımcı eklendi: `games/ready.ts` → `everyoneReady(players, connected, done)` (bağlı katılımcıların en az biri var ve hepsi
tamamladı). Tamamen `reduce` içinde ve `ctx.connected` ile çalışır; `connected` kayda (presence) yazıldığı için kayıttan oynatma
(replay) aynı sonucu verir. `tick` bağlantıya bakmaz (mevcut sözleşme).

## (a) Yazılı cevap karşılaştırmaları

Anahtar: `foldKey` = büyük/küçük harf yok, ç=c ş=s ğ=g ü=u ö=o, ı=İ=i=I, noktalama atılır, boşluklar teke iner.
"Katı" anahtar: `dedupeKey` (yalnız ı/İ/i/I birleşir, ç ş ğ ü ö korunur). `searchKey`: yönetici panelinde arama için.

| Yer | Karşılaştırma | Karar |
|---|---|---|
| Yazı Yaz — kelime tahmini (`yaziYazJudge`) | `foldKey` | Zaten tolerant. Senaryo testi eklendi (İngilizce klavye "isik EVI" = "ışık evi"). |
| Kendim — kart/oyuncu denkliği (`isCorrect`) | `foldKey` | Zaten tolerant. Senaryo testi eklendi (çay = cay). |
| Çağrışım Ağı — gruplama | `foldKey` | Zaten tolerant. **Yeni:** grup içinde farklı yazılış varsa Türkçe harfli olan gösterilir (kaşık, kasik değil). |
| Sözlük Blöfü — sahte tanım = gerçek tanım (`same_as_real`) | `foldKey` (`compareKey`) | Zaten tolerant. Senaryo testi eklendi. Sahte tanımlar kendi arasında karşılaştırılmaz (kart başına tek; birleştirme yok). |
| Bozuk Telefon — zincir sağlamlığı | kendi katlama tablosu (Ç→C … İ→I, büyük harfe çevirip) | Zaten tolerant (aynı sonuç). Test eklendi. **Yeni (arayüz):** cümle alanı `autocapitalize="characters"` idi; İngilizce klavyede "i" → "I" (noktasız) yazıyordu, ekranda yanlış harf görünürdü. `none` yapıldı, büyük harf CSS ile gösteriliyor (WordField ile aynı). Karşılaştırma zaten tolerant olduğundan puan etkilenmez. |
| Laf Sokma — cevaplar | karşılaştırma yok (oylamayla seçilir) | Değişiklik gerekmez. |
| Kontrol Paneli, Karalama Defteri | yazı yok (renk/çizim/oy) | Gerekmez. |
| Sızma, Rüşvet, İttifak vb. | yazı karşılaştırması yok | Gerekmez. |
| Yönetici içerik havuzları (`dedupeKey`, `searchKey` — Sözlük/Sızma/Karalama/Laf/Çağrışım havuz girdileri) | katı | **Bilinçli olarak değiştirilmedi:** "göl/gol", "kaş/kas" farklı kelimedir; havuza ekleme denetimi onları birleştirmemeli. Oyuncu girişi ile içerik yönetimi ayrı konulardır. |

Girdi alanları: `WordField` (Yazı Yaz, Kendim) `autocapitalize="none"`, `lang="tr"`; istemci `typedWord` Türkçe büyük harf yapar
("i" → "İ"), sunucu `sanitizeWord` aynı yapar, `foldKey` ikisini de "i" yapar: İngilizce klavyedeki "i" artık eşleşmeyi bozmaz.
Çağrışım ve Sözlük alanları zaten `none` / `sentences`.

Risk (kabul edilmiş bedel): aksan duyarsızlık bazen farklı kelimeleri birleştirir (kuş = kus, kaş = kas, ağ = ag). Yazı Yaz'da bu,
yanlış bir tahminin doğru sayılması olarak görülebilir; Çağrışım'da iki kişi anlamca farklı ama klavyece aynı yazarsa grup olur.
İngilizce klavye oyuncusunu cezalandırmamak bu nadir durumdan daha önemli görüldü. Testte belgelendi.

## (b) Erken bitiş: oyun/aşama dökümü

Kural: bağlı bütün katılımcılar gönderince aşama 1 sn sonra biter. Kopuk oyuncu ve izleyici beklenmez; bağlı kimse yoksa erken bitiş yok.
Gizli bilgi yalnız `view()` ile gider; erken bitiş sadece süreyi kısaltır, açılış zamanını önceden ele vermez (kapanış payı zaten
"herkes bitirdi" bilgisini herkese gösteriyordu).

### Zaten erken biten (bağlı-herkes kuralı var; değişmedi)

| Oyun | Aşamalar |
|---|---|
| Yazı Yaz | yazma, konuşma ("atla"), tahmin |
| Kendim | yazma, eşleştirme |
| Sızma | uyarı/ipucu, oylama |
| Sözlük Blöfü | yazma, seçme |
| Çağrışım Ağı | cevap (bağlı herkes cevaplayınca) |
| Karalama Defteri | çizim ("Bitti"), oylama (kilit) |
| Bozuk Telefon | yazma/çizme adımı, zincir oyu |
| Laf Sokma | yazma (kilit), oylar |
| İttifak | pazarlık, oylama |
| Rüşvet ve Darbe | oy kilidi, başkan dağıtımı (kilit) |
| Açgözlülük Limiti, Çapraz Ateş, Çizgiyi Geçme, Gizli Alışveriş, Gizli Kareler, Ortalamaya En Yakın | kilit; Ortalama her tur ayrı |

Not: Karalama ve benzerlerinde "gönderdi" = **kilitledi**. Çizim/oy kilitlenene kadar değiştirilebildiği için ("süre dolana kadar düzenle"
kuralı) yalnız seçim yapmış olmak yetmez; bu bilinçli (kural ihlali olurdu).

### Bu dalda değişenler ("kopuk oyuncu bekleniyordu" → "beklenmiyor")

| Oyun | Aşama | Önce | Şimdi | Neden güvenli |
|---|---|---|---|---|
| Kara Borsa | teklif (her tur) | tüm katılımcılar | bağlı herkes | Teklif gizli ve tek seferlik; kopuk oyuncunun teklifi 0 sayılır. |
| Kontrol Paneli Kaosu | kesim | tüm katılımcılar | bağlı herkes | Kesim gizli, tek seferlik; süre rekabeti yok. |
| Rüşvet ve Darbe | darbe oyu | tüm hak sahipleri | bağlı hak sahipleri | Oy gizli, tek seferlik; vermeyen "Darbe yok" sayılır (kural zaten böyle). |
| Rüşvet ve Darbe | düello işareti | tüm adaylar | bağlı adaylar | İşaret gizli, tek seferlik; vermeyen için sunucu zaten işaret doldurur. |

### Değiştirilmeyen: erken bitiş var ama kopuk oyuncuyu bekliyor (bilinçli)

Kör Kronometre, Gizli Hırsız, Son Kişi, Zehirli Kadeh. Bu oyunlarda puan basış/takas **zamanına** bağlı; kopuk bir oyuncu geri gelip
basabilir ve diğerlerinin sırasını değiştirebilir (Kör Kronometre'de en yakın basan kazanır). Erken bitişi bağlı-oyuncuya çevirmek,
bağlantısı kısa süre kopan oyuncuyu geri dönüşsüz cezalandırır. Mevcut testler bu davranışı sabitliyor (`bağlantıya bakılmaz`). Sahip isterse
aynı `everyoneReady` ile tek satırda çevrilebilir; kasıtlı olarak yapılmadı.

### Kapsam dışı (erken bitmemeli)

| Oyun | Neden |
|---|---|
| Butona Bas | Pencere/ritim oyunu; sürenin kendisi oyun. Gönderim kavramı yok. |
| Kör Bomba | Tek bomba, taşıyıcı değişimi ve gizli patlama süresi; bekleme stratejinin kendisi. Tahminler (patlar/patlamaz) gönüllü yan bahis, "herkes tahmin etti" tanımsız. |
| Zaman Bombası Hafızası | Sıra tabanlı (tek aktif oyuncu); diğerleri izler. Toplam 90 sn sınırı kuraldır. |
| Kule Ustası | Gerçek zamanlı denge; süre/çökme belirler. |
| Aşırı Yükleme | Sınırsız tıklama, bar dolana kadar; "herkes bitirdi" tanımsız. |
| Rus Ruleti | Sıralı atışlar; her atış tek oyuncunun kararı, grup gönderimi yok. |
| Kusursuz Denge | Kodu yok (henüz uygulanmadı). |

### Bilinen sınır (yapılmadı)

Son bekleyen oyuncunun **bağlantısı eylem olmadan koparsa** aşama süre bitimine kadar sürer: `tick` bağlantıya bakamaz (replay
sözleşmesi) ve `reduce` yalnız eylemle tetiklenir. Çözümü için `GameDefinition`'a presence'ta çağrılan isteğe bağlı bir kanca
(kayıt/replay ile birlikte) gerekir; çatı değişikliği olduğundan ayrı onay ister. Bu dalda yapılmadı.

Ayrıca, kullanıcının saydığı oyunlar içinde erken bitişin asıl sorun olduğu yerler büyük olasılıkla "Bitti/Kilitle" düğmesine basılmaması:
bu oyunlarda geri bildirim, arayüzde düğmenin daha belirgin olmasıyla (ayrı bir iş) çözülür; kural değişikliği gerektirmez.

## Testler

- `kara-borsa`, `kontrol-paneli-kaosu`, `rusvet-darbe`: kopuk oyuncu beklenmez, bağlı eksikse bitmez, bağlı kimse yokken erken bitiş yok.
- `games/text.test.ts`: Yazı Yaz, Kendim, Çağrışım (iki sırada görünüm), Sözlük, Bozuk Telefon için İngilizce klavye senaryoları.
- Mevcut değişmezlik/sızıntı (`invariants`, `leak-check`), replay ve simülasyon testleri değişmeden geçer.

## Riskler

1. Bağlantı titremesi: bağlı sayılan herkes gönderdiği an, kısa süre kopuk biri aşamayı kaçırır. Gönderim tek seferlik/gizli olduğu için
   kaybı "göndermedi" ile aynıdır; 1 sn kilit payı korunur.
2. Aksan duyarsız eşleşme farklı kelimeleri birleştirebilir (yukarıda).
3. KİLİTLİ kural metinleri değişiyor; onay yoksa dalın tamamı atılmalı (yalnız Bozuk Telefon `autocapitalize` düzeltmesi bağımsız ve
   zararsızdır, istenirse ayrıca alınabilir).
