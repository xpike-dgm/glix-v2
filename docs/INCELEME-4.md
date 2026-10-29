# İnceleme 4: kararsız (flaky) testler

Yük altında (tek çekirdeğe sabitlenmiş vitest + 12 CPU yakıcı, `taskset -c 0`; ayrıca 4 çekirdekte 16 yakıcı) altı kök neden bulundu ve giderildi.
Hiçbir test atlanmadı, hiçbir doğrulama gevşetilmedi.

## 1. `yedek-yayinlar.test.ts` — "ikincisi sürerken başlamaz" ve günlük sınır testi

- Neden: Testler "temizlik bitti"yi dosya sisteminden (`emptied`: geçici klasör boş) anlıyordu; yedek hizmetinin
  "meşgul" bayrağı ise `rm` geri çağrısından sonra, olay döngüsünün bir sonraki turunda düşer. Yük altında test
  zamanlayıcısı bu iki olay arasına girip `create` çağrısını `null` (uç noktada 409) alabiliyordu.
- Düzeltme: `whenFree` yardımcısı; bayrak düşene dek (en çok ~5 sn) yeniden dener. Gözlenen şey değişmedi:
  meşgulken ikinci yedek reddedilir (aynı testte `expect(await svc.create(1)).toBeNull()` duruyor), temizlikten
  sonra alınır.
- "Günde en çok 3 yedek" testi dört gerçek yedek + temizlik içerir; vitest'in 5 sn varsayılanını yükte aşıyordu.
  Yalnızca makine yükü olduğundan test zaman aşımı 60 sn yapıldı.

## 2. `kartlar.test.ts` — "her senaryo beklenen nihai puanları…"

- Neden: Tek testte ~30 oyun oynanır; `sync` her adımda gerçek zamanda en az ~30 ms bekler. Yükte 5 sn varsayılan
  sınırı aşılıyordu (5,2 sn'de düşüyordu).
- Düzeltme: yalnızca bu teste 60 sn zaman aşımı (neden yalnızca yük; gerekçe testte yazılı).
- İncelenen ve sorun bulunmayanlar: sahte saat 60 ms/`sync` ilerler; "erken biter" gibi 1 sn'lik ek süreli testler
  sahte saatin 17 `sync` turunu aşması gerekeceğinden yükte bile tetiklenmedi (40 CPU yakıcıyla denendi).

## 3. `devam.test.ts` — `expectGrace` (sahte saat payı)

- Neden: Alt sınır "şimdi + 1 sn − 400 ms" idi; sahte saat her `sync` turunda 60 ms ilerler, yayın 6'dan çok turda
  gelirse (yük) pay aşılıp test düşüyordu.
- Düzeltme: sınır, onayın gönderildiği sahte saat anına bağlandı: `sentAt + 1 sn <= bitiş <= şimdi + 1 sn`.
  Sunucu kuralı (bitiş = işlem anı + 1 sn) aynı kesinlikte doğrulanıyor, yük payına bağlı değil.

## 4. Sunucu testleri: vitest 5 sn varsayılanı (`apps/server/vitest.config.ts`)

- Makine 3-5 kat aşırı yüklüyken (başka bir tam test koşusu) `acgozluluk-limiti`, `kullanici-adi`, `sicak-yol`,
  `yonetici-hesaplar`, `oturum-iptal` gibi testler yalnızca "Test timed out in 5000ms" ile düşüyordu. `testTimeout`
  ve `hookTimeout` 30 sn yapıldı (neden yalnızca makine yükü; doğrulamalar aynı, beklemeler koşul tabanlı).

## 5. Gerçek ürün yarışı: HTTP boşta-bağlantı süresi (`server.ts`)

- Belirti: `kullanici-adi.test.ts` yükte `fetch failed / ECONNRESET`.
- Neden: Node'un varsayılan `keepAliveTimeout` değeri 5 sn. İstemci (ve üretimde Caddy) bağlantıyı tam sunucu
  kapatırken yeniden kullanınca bağlantı sıfırlanır. Üretimde de aynı yarış 502/ECONNRESET üretebilir.
- Düzeltme: `keepAliveTimeout` 65 sn, `headersTimeout` 66 sn (`KEEP_ALIVE_MS`). Kapanışta boştaki bağlantılar zaten
  `closeIdleConnections` ile kapatılıyor. Test: `hizmet-baglanti.test.ts`.

## 6. `sicak-yol.test.ts` — duvar saati eşikleri

- Neden: "<250 ms" ve "<1000 ms" eşikleri duvar saatiyle ölçülüyordu; çekirdek başka süreçlere gidince 543 ms görüldü.
- Düzeltme: ölçüm işlemci süresiyle (`process.cpuUsage`) yapılır; eşikler aynı, ölçülen şey işin kendi maliyeti.

## 7. `scripts/ui-check.mjs`

- `karakterHazir`: belirme 0,35 sn'dir ve sahne kurulduktan sonra ticker karelerine bağlıdır. Sahte saatte kare
  yalnız saat ilerleyince garanti gelir; yükte gerçek kareler seyrek olduğundan 25 sn'lik bekleme tükenebiliyordu.
  Artık sahne hazır (`data-chars=ready`) olur olmaz saat 250 ms'lik adımlarla sürülür (belirme gerçek zamandan
  bağımsız biter); varlık yükü için pay 60 sn. Tek çekirdekte `kursu-final-varsayilan` denetimi 35 sn'den 18 sn'ye indi.
- `html[data-ready]` beklemesi 15 sn'den 60 sn'ye çıkarıldı: `final-*` ekranları soğuk Vite dönüşümüyle birkaç işçi
  ve yükte 15 sn'yi aşabiliyordu (denetim başına genel üst sınır 90 sn, değişmedi). Bu neden makine yüküdür;
  doğrulama kapsamı aynıdır.
- Bu iki ui-check değişikliği tek işçi, yük altında bir ekranla doğrulandı; tam koşu başka dizindeki koşuya bırakıldı.

## Kanıt

Yük: `taskset -c 0` ile vitest + 12 CPU yakıcı.

- `kartlar.test.ts`: düzeltmeden önce 3/3 koşuda aynı test düşüyordu; sonra 30/30 geçti.
- `yedek-yayinlar.test.ts`: ilk düzeltmeyle 30 koşuda 28 geçti (2 düşüş = zaman aşımı, yukarıdaki 60 sn'ye yol
  açtı); zaman aşımı düzeltmesinden sonra 30/30 geçti.
