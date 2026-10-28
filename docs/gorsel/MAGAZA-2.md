# Mağaza 2. dalga — kart arkaları, zafer kutlamaları, tepki paketleri, giriş efektleri

Önce `/srv/glix/gorsel/OKU-BENI.md` içindeki talimat ve ortak kuralları uygula (stil öneki dahil).
Kayıt: `/srv/glix/gorsel/gelen/magaza-2/` (tam olarak aşağıdaki dosya adlarıyla). Bitince `TAMAM` bırak.

## Ne bu?
Mağazaya dört yeni ürün türü geliyor. Kalite çıtası: senin yaptığın süslü çerçeveler (`gelen/cerceve-suslu/`) ve
mağaza maketleri (`gelen/magaza/tasarim/`). Aynı neon, cel-shaded, kaliteli aile. **Yazı, harf, logo yok.**
Nadirlik renkleri: Sıradan camgöbeği, Nadir mor, Efsanevi altın (ürünün ana rengi buna uymak zorunda değil, ama
efsaneviler belirgin şekilde daha gösterişli olmalı).

Bazı görseller **sayfa** (birden çok parça tek PNG'de, ızgara hâlinde) olarak istenir; parçaları ben keserim.
Izgaradaki her hücre kendi içinde ortalı olsun, hücreler arasında taşma olmasın, arka plan saydam.

## 1) Kart arkaları — `kart-arkasi/` (5 dosya, 1024×1536, saydam köşeler)
Kart sistemindeki kartların **arka yüzü** (`gelen/kartlar/arka.png` bugünkü varsayılan; aynı oran ve köşe yuvarlaklığı).
Oyuncu kendi kart arkasını seçer; kart dağıtılırken ve açılırken görünür. Ortada soyut simge olabilir, yazı yok.

| Dosya | Ad | Nadirlik | Tarif |
|---|---|---|---|
| `neon-izgara.png` | Neon Izgara | Sıradan | Camgöbeği neon ızgara/perspektif zemin, sade |
| `gece-sehri.png` | Gece Şehri | Sıradan | Mor-lacivert neon şehir silueti, pencerelerde ışıklar |
| `mor-girdap.png` | Mor Girdap | Nadir | Ortada dönen mor-pembe enerji girdabı |
| `elektrik.png` | Elektrik | Nadir | Kenarlardan merkeze çakan camgöbeği/beyaz şimşekler |
| `altin-kraliyet.png` | Altın Kraliyet | Efsanevi | Altın oymalı kraliyet deseni, ortada parlayan mücevher, ince altın ışınlar |

## 2) Zafer kutlamaları — `zafer/` (5 sayfa, her biri 1024×1024, 2×2 ızgara = 4 parçacık)
Maçı birinci bitiren oyuncunun final ekranında **kendi kutlaması** oynar: oyun bu parçacıkları çoğaltıp
uçurur/döndürür/patlatır. Her hücre (512×512) **tek bir parçacık/sprite**: net, kalın, küçükte (24–64 px) okunur.

| Dosya | Ad | Nadirlik | 4 parçacık |
|---|---|---|---|
| `konfeti.png` | Konfeti Patlaması | Sıradan | 4 farklı neon konfeti şeridi/parçası (kıvrık şerit, kare, üçgen, yıldız) |
| `balon.png` | Neon Balonlar | Sıradan | 4 renkli neon balon (camgöbeği, pembe, mor, sarı), ipleri kısa |
| `havai-fisek.png` | Havai Fişek | Nadir | Fişek patlaması yıldızı, kıvılcım izi, küçük ışık topu, halka şeklinde patlama |
| `simsek.png` | Şimşek Fırtınası | Nadir | 2 farklı şimşek çatlağı, elektrik kıvılcımı, küçük enerji küresi |
| `altin-yagmur.png` | Altın Yağmur | Efsanevi | Altın jeton (bizim Glix jetonu tarzı), altın yıldız, altın parıltı, küçük taç |

## 3) Tepki paketleri — `tepki/` (3 sayfa, her biri 1536×1024, 3×2 ızgara = 6 çıkartma)
Lobide ve maç sonunda oyuncuların gönderdiği tepkiler. Şu an emojiler var; paketler **çıkartma** (sticker) ekler.
Her hücre (512×512) tek çıkartma: kalın beyaz/koyu dış kontur (çıkartma hissi), net ifade, küçükte (40–56 px) okunur.
Karakter gerekiyorsa yüzsüz neon maskeli avatarlar (`gelen/asama-2/`); maskedeki ifade neon çizgilerle anlatılır.

| Dosya | Ad | Nadirlik | 6 çıkartma (soldan sağa, üstten alta) |
|---|---|---|---|
| `neon-yuzler.png` | Neon Yüzler | Sıradan | maske: gülüyor, şaşkın, sinirli, ağlıyor (komik), göz kırpıyor, uykulu |
| `parti.png` | Parti | Nadir | parti şapkası + düdük, disko topu, kadeh tokuşturma, havai fişek, dans eden avatar, "alkış" eller |
| `efsane-tepkiler.png` | Efsane Tepkiler | Efsanevi | altın taç, ateş topu, "mikrofonu bırak" (düşen mikrofon), roket, elmas, şimşekli kupa |

## 4) Lobi giriş efektleri — `giris/` (5 sayfa, her biri 1024×512, 2×1 ızgara = 2 katman)
Oyuncu lobiye girince koltuğunda kısa (≈1 sn) bir efekt oynar. Oyun bu iki katmanı büyütüp döndürüp söndürerek
canlandırır. Sol hücre: **zemin/halka** (avatarın arkasında, yuvarlak, ortası boş ya da şeffaf); sağ hücre: **patlama/ışık**
(avatarın önünde, ortadan dışa). Her hücre 512×512.

| Dosya | Ad | Nadirlik | Tarif |
|---|---|---|---|
| `isinlanma.png` | Işınlanma | Sıradan | Camgöbeği ışınlanma halkası + yukarı doğru ışık sütunu parçaları |
| `duman.png` | Duman | Sıradan | Mor neon duman halkası + dağılan duman bulutu |
| `simsek.png` | Şimşek | Nadir | Elektrikli halka + merkezden dışa çakan şimşekler |
| `portal.png` | Portal | Nadir | Dönen mor-pembe portal halkası + portaldan saçılan kıvılcımlar |
| `altin-isik.png` | Altın Işık Sütunu | Efsanevi | Altın rün halkası + yukarı yükselen altın ışık ve parıltılar |

## Kayıt ve kontrol
Dosya yazma aracında `encoding: base64` kullan. Her PNG'nin gerçekten saydam olduğunu ve boyutunun doğru olduğunu
kontrol et; sayfalarda her hücrenin kendi sınırları içinde kaldığını (komşu hücreye taşma yok) ölç.
`kontrol/onizleme.png`: her ürünü küçük boyutta (kart arkası 120 px genişlik, parçacık 48 px, çıkartma 48 px,
giriş efekti bir avatarın arkasında/önünde 96 px) gösteren tek sayfa.
Yalnız `/srv/glix/gorsel/gelen/magaza-2/` klasörüne yaz; başka yere dokunma, paket kurma.
Bitince `TAMAM` dosyasına her dosya için "yaptım / yapamadım / şu kısmı eksik" yaz. Görsel üretme limitin dolarsa
nerede kaldığını yaz; yeni bir sohbette kaldığın yerden devam edilecek.
