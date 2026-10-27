# Kule Ustası — oyun görselleri (6 görsel)

Önce `/srv/glix/gorsel/OKU-BENI.md` içindeki talimat ve ortak kuralları uygula.
Kayıt: `/srv/glix/gorsel/gelen/kule/` (tam olarak aşağıdaki dosya adlarıyla). Bitince `TAMAM` bırak.

## Oyun ne?
Oyuncular sırayla ortak bir **neon kuleye** blok bırakır. Blok kulenin üstünde sağa sola kayar; doğru anda bırakılırsa
alttakine oturur, taşan kısım kesilip düşer ve kule daralır. Tam oturtana "Kusursuz!" denir. Iskalayan kuleyi yıkar.

## Referanslar (her üretimde ilgili olanları ver)
- Stil ve dünya dili: `gelen/asama-4/` (diğer oyunların dünyaları), `referans/secilen/stil-arka-plan-zehirli-kadeh.png`
- Kart stili: `gelen/asama-5/5.1-kart-*.png` (aynı çizgi, ışık ve kompozisyon dili)
- Anlatım karesi stili: `gelen/asama-5/5.2-anlatim-*.png`
- Karakterler: `gelen/asama-2/2.1-p<N>-<renk>-<ifade>.png`, `referans/secilen/stil-avatar-p1-cyan-happy.png`
  (karakterler her zaman **yüzsüz, neon maskeli avatarlar**)
- Yazı, harf, rakam, logo **yok**.

## Kule ve bloklar (tüm görsellerde aynı)
Yarı saydam, içten parlayan **neon cam bloklar**; her blok farklı neon tonunda (camgöbeği, macenta, mor, lime, amber)
ve kenarlarında ince ışık çizgisi. Kule yukarı doğru hafifçe daralan, düzensiz kesilmiş katlardan oluşur. Kesilen
parçalar kıvılcımla aşağı düşer.

## Dosyalar
| Dosya | Boyut | Tarif |
|---|---|---|
| `4-kule-ustasi-dikey.png` | 1024×1536 (9:16'ya yakın en büyük) | Oyun dünyası arka planı: gece, neon bir inşaat alanı / çatı katı; ortada boş bir **kaide (taban platformu)**, çevrede vinç siluetleri ve şehir ışıkları flu. **Orta ve alt bölge sakin ve koyu** (arayüz kuleyi buraya çizecek); ilgi çeken detaylar kenarlarda ve üstte. Kule YOK. |
| `4-kule-ustasi-yatay.png` | 1536×1024 (16:9'a yakın en büyük) | Aynı dünya yatay; orta %60 sakin. |
| `5.1-kart-kule-ustasi.png` | 1200×675 | Kart kapağı: büyük, ışıl ışıl neon cam bloklardan yükselen bir kule ön planda; en üstte kayan bir blok ve düşen kesik parça kıvılcımlarla; arkada dünya flu. Küçük boyutta da okunur, tek net siluet. |
| `5.2-anlatim-kule-ustasi-1.png` | 1024×768 | Çizgi roman karesi: bir avatar, kulenin üstünde sağa-sola kayan parlak bloğa bakıyor; parmağı ekrana dokunmak üzere (hareket çizgileriyle kayma hissi). |
| `5.2-anlatim-kule-ustasi-2.png` | 1024×768 | Blok kuleye oturuyor; dışa taşan kısmı kesilip kıvılcımla düşüyor; avatar sevinçli. |
| `5.2-anlatim-kule-ustasi-3.png` | 1024×768 | Başka bir avatar ıskalıyor: blok boşa düşüyor, kule sarsılıp yıkılıyor; o avatar şaşkın (çizgi film tonu, şiddet yok), diğerleri kenarda tezahürat yapıyor. |

## Kayıt
Dosya yazma aracında `encoding: base64` kullan; her dosyanın gerçekten PNG olduğunu ve boyutunun doğru olduğunu
kontrol et. Yalnız `/srv/glix/gorsel/gelen/kule/` klasörüne yaz; başka yere dokunma, paket kurma.
