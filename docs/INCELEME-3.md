# İnceleme 3 — Sunucu sıcak yolları ve üretim göç güvenliği

Kapsam: `apps/server` (hesap veritabanı göçleri, odaya giriş, yayın yükü, maç sonu hattı, mağaza ucu, yönetici ekonomi sorgusu, görev gerçekleri). Ölçümler yoğun bir makinede, tek süreçte alınmıştır; mutlak değerlerden çok oranlar önemlidir.

## 1. Göç güvenliği

İncelenen göçler: Glix (#13), kozmetik (#14), ekonomi indeksleri (#15), günlük görevler (#16), defter yeniden kurulumu (#17).

| Soru | Sonuç |
| --- | --- |
| Her göç işlem içinde mi? | Evet. `migrate()` her göçü `BEGIN`/`COMMIT` içinde çalıştırır ve sürüm satırını aynı işlemde yazar; hata `ROLLBACK` + yeniden fırlatma (sunucu açılmaz, yarım şema kalmaz). |
| Eski veritabanı sırayla göç eder mi? | Evet; sürüm tablosundan devam eder. Yeni test, Glix öncesi (12. göç) gerçekçi veriyle kurulmuş bir dosyayı baştan sona göç ettirir. |
| #17 satır, kimlik, indeks, yabancı anahtar korur mu? | Satırlar ve kimlikler birebir, iki indeks yeniden kurulur, `ON DELETE CASCADE` korunur. `foreign_keys = ON` iken sorunsuz: defteri gösteren başka tablo yok, `DROP TABLE` kaskad tetiklemez. `PRAGMA foreign_key_check` ve `integrity_check` temiz. |
| Hata ortasında tutarlı mı? | Evet (testte yeniden kurulumun ilk adımı kasten çökertilir: sürüm, satırlar ve eski tablo olduğu gibi kalır; sorun giderilince tamamlanır). |

Bulunan sorunlar ve düzeltmeler:

1. **AUTOINCREMENT sayacı (#17).** Yeni tabloya satırlar kopyalanınca `sqlite_sequence` yalnız kalan en büyük kimliğe iner; en son satırlar silinmişse (örn. hesap silme kaskadı) kimlikler yeniden kullanılır. Defter "değişmez" ve `ref`/denetim kayıtları kimliğe dayanabilir. #17 sayacı eski tablodan taşıyacak şekilde düzeltildi (test: 60'a kadar yazılıp 51-60 silinmiş defterde yeni satır 61 alır). Not: #17 üretimde henüz uygulanmadıysa değişiklik etkilidir; uygulandıysa göç zaten geçmiştir ve düzenleme zararsızdır.
2. **Göç öncesi kopya yoktu.** Günlük yedek var, ama bekleyen göç + gerçek veri durumunda artık `VACUUM INTO` ile `<db>.oncesi-v<sürüm>` kopyası alınır (yoksa; hata göçü engellemez, uyarı günlüğe yazılır). Geri dönüş: kopyayı `hesap.db` yerine koy. Dosya, veritabanı büyüdükçe disk yer; her sürüm için bir kez oluşur ve elle silinebilir.
3. Göç listesi testler için `ACCOUNT_MIGRATIONS` adıyla dışa açıldı (yalnız sona eklenir).

Yeni test: `apps/server/src/hesap-gocu.test.ts` (5 test: tam göç + veri bütünlüğü + kaskadlar, göç öncesi kopya, #17 değişmezleri, ortada hata).

## 2. Sıcak yollar

### Odaya giriş (kozmetik okuma)
`cosmeticsOf` her girişte `accounts.cosmetics()` çağırıyordu: sahip listesini de çeken 2 sorgu. Artık yalnız `equippedCosmetics` (1 sorgu); `ownsCosmetic` (tepki çıkartması) tüm sahip listesini çekip `some` yapmak yerine PK araması (1 sorgu). Mağaza `equip` yanıtı da aynı şekilde. Giriş başına DB okuması 1 küçük PK sorgusu; önbellek gerekmedi (misafirde hiç okuma yok).

### Yayın yükü (PlayerInfo + kozmetik)
8 oyuncu, her oyuncuda tüm türlerden kozmetik (en kötü durum), ilk tam `room` mesajı:

| | bayt |
| --- | --- |
| kozmetiksiz | 4026 |
| tam kozmetikli | 6034 (oyuncu başına +251) |

Tek oyuncunun puanı değişince giden `patch`: 990 B → 2998 B. Sebep: JSON Merge Patch dizileri bütün değiştirir, `players` bir dizi; bir oyuncunun tek alanı bile değişse 8 oyuncunun tüm alanları yamaya girer. Oyuncu listesi değişimleri (giriş, hazır, bağlantı, puan) oyun içinde seyrek olduğundan (kare başına değil) şimdilik sorun değil; kalıcı çözüm `players`ı kimlik anahtarlı nesne yapmak, ama bu protokol değişikliği (istemci + sahne) gerektirir, kapsam dışı bırakıldı. `cosmeticsChanged` zaten JSON karşılaştırıp yalnız gerçek değişimde yayın işaretliyor (gereksiz yayın yok). Test sınırı koyar (`sicak-yol.test.ts`).

### Maç sonu hattı (recordMatch → rozet → Glix → görev)
8 hesaplı maç için depo çağrıları: `recordMatch` 1; oyuncu başına `earnedBadges`, `badgeStats`, `awardBadges`, `creditMatchGlix`, `creditBadgeGlix`, `questFacts` (+ ödenecek görev varsa `creditQuests`). Yazan işlem sayısı yaklaşık 1 + 8×3; hepsi WAL + `synchronous=NORMAL` altında fsync'siz. Hat eşzamanlıdır, süre hesabın geçmişiyle doğrusal artar (`badgeStats` tüm `account_games` satırlarını tarıyordu).

Ölçüm (8 hesap, her birinde 3000 maç / 9000 oyun satırı): 21 ms → 15-16 ms; 1500 maçlık geçmişte 9 ms. Düzeltme: #18 kapsayıcı indeksler `account_games (account_id, game_id, won)` ve `account_matches (account_id, ended_at, won)`; `COUNT/DISTINCT/SUM(won)` sorguları tablo satırı okumadan indeksten yanıtlanır (`EXPLAIN QUERY PLAN`: `COVERING INDEX`). Bedel: iki küçük indeks, maç/oyun yazımında hafif artış. Oyuncu başı ~1,3 ms'de kaldığından 8 hesapla belirgin bir olay döngüsü engeli yok; daha da büyütmek (özet sayaç tablosu) şimdilik gereksiz.

Görev gerçekleri (`questFacts`): 3 sorgu, hepsi `(account_id, ended_at)` indeksli, gün aralığıyla sınırlı; sorun yok. `badges`'in `earned_at` sorgusu PK önekiyle hesap başına birkaç satırı tarar.

### Mağaza `GET /api/shop`
Oturum çözme (1 sorgu; `last_seen` yazımı zaten 5 dk sınırlı) + `cosmetics` (2) + `glixBalance` (1) = 4 sorgu, N+1 yok. Test en çok 4 çağrı doğrular.

### Yönetici ekonomi sorgusu (100 bin defter satırı, 2000 hesap, 90 gün)
Tüm sorgular zaman indeksini kullanır (`SEARCH glix_ledger USING INDEX glix_ledger_at (at>? AND at<?)`; hesap bazlı sorgular `glix_ledger_account`); yalnız GROUP BY için geçici B-ağacı var. Süre: 7 gün 5,6 ms, 30 gün 18 ms, 90 gün 53 ms. Yönetici panelinde seyrek çağrılır, kabul edilebilir; indeks eklenmedi (kapsayıcı indeks defteri iki katına çıkarırdı). `glix_ledger_account (account_id, at)` ile `ORDER BY id DESC LIMIT 20` hesap satırlarını sıralar (hesap başına yüzlerce satır), sorun değil.

## 3. Değişiklikler

- `accountStore.ts`: `ACCOUNT_MIGRATIONS` dışa açık; #17 sayaç taşıma; #18 kapsayıcı indeksler; göç öncesi kopya; `equippedCosmetics`, `ownsCosmetic`.
- `social.ts`, `shopApi.ts`: yeni dar sorgular.
- Testler: `hesap-gocu.test.ts`, `sicak-yol.test.ts` (yayın baytı, maç sonu çağrı sayısı + süre, mağaza çağrı sayısı, 100 bin satırlık ekonomi planı + süre); `laf-havuz-goc.test.ts` yeni göç sayısına uyarlandı.
- Not: `yedek-yayinlar.test.ts` ("ikincisi sürerken başlamaz") tam koşuda yoğun makinede aralıklı kırıldı, tek başına ve sonraki koşuda geçti; bu işle ilgisiz zamanlama hassasiyeti.
