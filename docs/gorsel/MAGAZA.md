# Mağaza tasarımı ve mağaza görselleri

Önce `/srv/glix/gorsel/OKU-BENI.md` içindeki talimat ve ortak kuralları uygula (stil öneki dahil).
Kayıt: `/srv/glix/gorsel/gelen/magaza/` (tam olarak aşağıdaki dosya adlarıyla). Bitince `TAMAM` bırak.

## Ne bu?
Oyuncular maç oynayıp **Glix** (oyun içi para) kazanır ve mağazadan görünüş ürünleri alır. Ürünler şimdilik üç tür:
- **Avatar çerçevesi:** oyuncunun yuvarlak avatarının etrafındaki süs halka.
- **Unvan:** adın altında görünen kısa yazı ("Parti Canavarı", "Efsane").
- **Ad efekti:** kullanıcı adının renk/ışık stili (oyun yazıyla çizer; görsel istenmiyor).

Nadirlik: **Sıradan** (camgöbeği), **Nadir** (mor), **Efsanevi** (altın). Kart sistemindeki çerçeve dili
(`gelen/kartlar/cerceve-*.png`) ve rozetler (`gelen/rozet/`) referans: aynı neon, kaliteli, cel-shaded aile.

Sahip mevcut mağaza ekranını "çok kötü" buldu; kodla çizilmiş çerçeveleri de beğenmedi. Senden iki şey istiyoruz:
**(A) mağaza ekranının tasarım şablonu** ve **(B) mağazanın gerçek görselleri**. Oyunda her şey kaliteli görünmeli.
Mevcut (beğenilmeyen) hâli: `referans/ekranlar/magaza-mevcut.jpg` — bunu tekrar etme, daha iyisini yap.

## (A) Tasarım şablonu — `tasarim/` klasörü
Telefon ekranı maketleri, **1080×2340** (dikey), oyunun arka planı ve neon dünyasıyla. Bunlar **yön gösteren
tasarım çizimleri**; oyun bunları birebir koda dökecek. Yazılar Türkçe olsun; okunaksız çıkan yazı sorun değil, ama
**yerleşim, boyut, boşluk, hiyerarşi** net olmalı. Sade ve anlaşılır: kalabalık değil, büyük kalın kutular değil.
1. `magaza-1.png`, `magaza-2.png` — Mağaza ana ekranı, **iki farklı yaklaşım**. İçermesi gerekenler: geri düğmesi,
   "Mağaza" başlığı, sağ üstte Glix bakiyesi (jeton + sayı), **Günün fırsatı** (2 indirimli ürün, eski fiyat çizili,
   yenilenmeye kalan süre), tür sekmeleri (Çerçeveler / Unvanlar / Ad efektleri), ürün vitrini (her üründe önizleme,
   ad, nadirlik, fiyat; sahip olunan ürünlerde "Kuşanıldı"/"Sahipsin").
2. `satin-al.png` — Ürüne dokununca açılan alt pencere: büyük önizleme (oyuncunun avatarı ve adıyla), ürün adı,
   nadirlik, kısa açıklama, tek ana düğme "280 Glix'e satın al"; yetmiyorsa "190 Glix daha gerekli".
3. `dolabim.png` — Dolabım: üstte oyuncunun mevcut görünüşü (avatar + çerçeve, ad + efekt, unvan), altında her tür
   için sahip olunan ürünler ve "Yok" seçeneği.

## (B) Görseller (saydam PNG)

### Avatar çerçeveleri — `cerceve/` (5 dosya, 1024×1024)
Ortada avatar için **tam yuvarlak boş bir delik**: çapı görselin **%62'si**, tam ortada (delik içi tamamen saydam).
Süsler halkanın üzerinde ve dışında. Telefonda avatar 44–96 px görünür: kalın, net, tek bakışta okunur olsun.
Avatarın **üst ortasına** oyun kazanana taç, **sağ üstüne** ev sahibi işareti, **altına** "Sen" etiketi koyar:
bu üç bölgede süs alçak ve sade kalsın (efsanevide üst süs küçük olabilir).

| Dosya | Ad | Nadirlik | Tarif |
|---|---|---|---|
| `camgobegi-halka.png` | Camgöbeği Halka | Sıradan | Temiz, parlak camgöbeği neon halka, ince iç çizgi |
| `pembe-halka.png` | Pembe Halka | Sıradan | Macenta/pembe neon halka, hafif ışık taneleri |
| `cift-halka.png` | Çift Halka | Nadir | İç içe iki mor neon halka, aralarında küçük parlak düğümler |
| `donen-neon.png` | Dönen Neon | Nadir | Dönerek gösterilecek: **dönme simetrili** neon desen (kesikli yay parçaları, ışık izleri); döndüğünde güzel dursun |
| `altin-tac-halkasi.png` | Altın Taç Halkası | Efsanevi | Altın neon, en gösterişli: oyma desenli halka, yanlarda kanatçık/ışın, altta küçük mücevher |

### Ürün vitrini kutuları — `kutu/` (3 dosya, 768×960)
Mağaza vitrinindeki ürün kartının **arka plan çerçevesi**, nadirliğe göre. İçi koyu, sakin ve **boş** (oyun önizleme,
ad ve fiyatı üstüne basar); kenar neonu nadirlik renginde. Kart sistemindeki çerçevelerle aynı aile ama daha sade/ince.
`kutu-siradan.png`, `kutu-nadir.png`, `kutu-efsanevi.png`.

### Unvan levhaları — `unvan/` (3 dosya, 1024×256)
Adın altında unvan yazısının durduğu küçük **levha/şerit** arka planı, nadirliğe göre; ortası düz ve koyu (yazı
okunur kalsın), uçlarda küçük süs. `levha-siradan.png`, `levha-nadir.png`, `levha-efsanevi.png`.

### Glix jetonu — `jeton/` (2 dosya)
- `glix-jeton.png` (512×512): oyun parası jetonu. Kalın neon kenarlı yuvarlak jeton, ortada soyut bir "parıltı"
  simgesi (harf/logo yok). 16–24 px'te bile jeton olduğu anlaşılmalı.
- `glix-yigin.png` (512×512): üst üste birkaç jeton (bakiye/kazanç anlatımında büyük gösterim).

## Kayıt
Dosya yazma aracında `encoding: base64` kullan. Her PNG'nin gerçekten **saydam arka planlı** olduğunu (tasarım
maketleri hariç) ve boyutunun doğru olduğunu kontrol et; çerçevelerde ortadaki deliğin tamamen saydam ve tam ortada
olduğunu ölç. Yalnız `/srv/glix/gorsel/gelen/magaza/` klasörüne yaz; başka yere dokunma, paket kurma.
Bitince `TAMAM` dosyasına her madde için "yaptım / yapamadım / şu kısmı eksik" yaz.
Görsel üretme limitin dolarsa nerede kaldığını yaz; yeni bir sohbette kaldığın yerden devam edilecek.
