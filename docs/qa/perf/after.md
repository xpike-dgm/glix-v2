# Başarım: önce / sonra

Araç: `node scripts/perf-check.mjs --cikti docs/qa/perf/after.md` (üretim yapısı `apps/client/vite.perf.config.ts` ile `dist-perf/`e üretilir; mock ekranlar için `import.meta.env.DEV` açık, hizmet çalışanı kapalı). Ölçüm ortamı ve sınırları: betiğin başındaki açıklama. Önceki ham ölçüm: `docs/qa/perf/before.md`.

## Okuma notları (dürüstlük)

- Başsız Chromium'da raster yazılımsaldır ve CSS animasyonları ana iş parçacığında tıklar ("stil hesabı/sn" 60 görünmesi her animasyonda, sade bir opacity animasyonunda bile çıkıyor; gerçek telefonda bu iş bileşene gider). Bu yüzden "stil hesabı" sütunu yorumlanmaz; paint/composite ve ana iş p. meşgul % ile FPS yorumlanır.
- 1920x1080'de tek 20 px'lik opacity animasyonu bile yazılımsal bileşimle ~40 fps'e düşürüyor (ölçüldü). TV lobisinin 38 fps'i bu ortamın tabanıdır; gerçek TV/dizüstü GPU'sunda bu sınır yoktur. Düzeltmenin kanıtı 17 -> 38 fps sıçramasıdır.
- Yükleme sayıları ±150 ms gürültülüdür (aynı yapıyı art arda koşunca ilk açılışta zaman zaman 1,2 sn'lik tek tük sapma görülür); anlatım/ana sayfa/lobi satırlarındaki küçük artışlar ardışık koşu sırasından geliyor, aynı sayfayı değişmeli koşunca fark çıkmadı (Kör Bomba anlatımı: ana iş p. %5 / %5). tv-final 32-52 fps arasında her iki yapıda da salınıyor (Pixi konfeti + 17 görsel çözme).
- "Geç görsel" sütunu soğuk ilk istek içindir; yani ekrana ilk kez gelen görsel ağdan inmek zorundadır. Bu sütun düzelmez; düzelen şey, bu ekranlara gelmeden ÖNCE görselin inmiş olmasıdır (aşağıdaki "Sıradaki oyun" tablosu).

## Sıradaki oyunun görselleri hazır mı

Sonuç ekranı açıkken 5 sn sonra sıradaki oyunun 3 anlatım karesi + dünya arka planı bir `<img>`e verilir, hepsi çözülene kadar geçen süre. Kontrol: önden indirilmeyen bir oyunun aynı dört görseli.

| | sıradaki oyun | kontrol (önden inmeyen) |
|---|---|---|
| önce | 253 ms | 306 ms |
| sonra | 3 ms | 304 ms |

Yani anlatım ekranı açıldığında çizgi roman ve arka plan zaten bellekte; önceden ilk 0,3-1,5 sn boş/geç geliyordu (soğuk tablolar).

## Karşılaştırma (önce -> sonra)

Kararlı durum, 5 sn. FPS yüksek iyi; diğerleri düşük iyi. Başsız Chromium'da yazılım rasterı kullanıldığından mutlak sayılar değil, önce/sonra farkı okunur.

| ekran | FPS | p95 kare (ms) | >33 ms kare % | ana iş p. meşgul % | paint ms/sn | composite ms/sn |
|---|---|---|---|---|---|---|
| home | 60.0 -> 60.0 | 16.8 -> 16.7 | 0.0 -> 0.0 | 7 -> 9 | 7.8 -> 8.4 | 16.0 -> 18.7 |
| lobi-8 | 60.0 -> 60.0 | 16.7 -> 16.8 | 0.0 -> 0.0 | 10 -> 15 | 17.2 -> 32.9 | 59.5 -> 80.6 |
| anlatim-kule | 60.0 -> 60.0 | 16.7 -> 16.8 | 0.0 -> 0.0 | 6 -> 8 | 11.9 -> 13.7 | 21.7 -> 24.1 |
| anlatim-kor-bomba | 60.0 -> 60.0 | 16.8 -> 16.8 | 0.0 -> 0.0 | 5 -> 8 | 12.6 -> 20.8 | 17.0 -> 22.7 |
| anlatim-zaman | 60.0 -> 60.0 | 16.7 -> 16.8 | 0.0 -> 0.0 | 6 -> 9 | 9.3 -> 16.6 | 15.7 -> 23.9 |
| anlatim-asiri | 60.0 -> 60.0 | 16.7 -> 16.8 | 0.0 -> 0.0 | 5 -> 8 | 14.3 -> 16.5 | 23.1 -> 24.8 |
| anlatim-karalama | 60.0 -> 60.0 | 16.7 -> 16.8 | 0.0 -> 0.0 | 6 -> 10 | 9.9 -> 16.5 | 17.5 -> 27.1 |
| geri-sayim | 60.0 -> 60.0 | 16.7 -> 16.8 | 0.0 -> 0.0 | 6 -> 8 | 6.7 -> 9.6 | 11.8 -> 14.4 |
| sonuc-5 | 60.0 -> 59.8 | 16.7 -> 16.8 | 0.0 -> 0.3 | 7 -> 8 | 5.5 -> 5.3 | 26.9 -> 28.7 |
| final-8 | 58.0 -> 58.8 | 16.8 -> 16.8 | 1.4 -> 0.0 | 5 -> 7 | 4.4 -> 3.0 | 33.3 -> 27.9 |
| kart-secim | 60.0 -> 60.0 | 16.8 -> 16.7 | 0.0 -> 0.0 | 6 -> 7 | 6.6 -> 7.5 | 22.8 -> 26.6 |
| tv-lobi-8 | 17.3 -> 37.7 | 66.7 -> 33.4 | 100.0 -> 14.9 | 1 -> 1 | 0.3 -> 0.6 | 2.3 -> 2.4 |
| tv-sonuc | 55.0 -> 57.6 | 16.8 -> 16.8 | 3.6 -> 1.0 | 2 -> 2 | 1.2 -> 1.5 | 4.9 -> 4.9 |
| tv-final | 50.5 -> 40.8 | 16.8 -> 50.0 | 4.8 -> 15.7 | 4 -> 6 | 0.6 -> 0.8 | 2.3 -> 3.0 |
| oyun-kule | 59.6 -> 59.6 | 16.8 -> 16.8 | 0.3 -> 0.3 | 17 -> 15 | 60.7 -> 15.8 | 46.2 -> 48.3 |
| oyun-kor-bomba | 60.0 -> 60.0 | 16.7 -> 16.7 | 0.0 -> 0.0 | 20 -> 16 | 83.9 -> 17.7 | 89.3 -> 91.8 |
| oyun-zaman | 60.0 -> 60.0 | 16.8 -> 16.8 | 0.0 -> 0.0 | 19 -> 22 | 81.9 -> 52.8 | 84.3 -> 79.0 |
| oyun-butona-bas | 55.2 -> 56.4 | 33.3 -> 33.3 | 3.6 -> 1.1 | 51 -> 47 | 107.2 -> 84.9 | 147.2 -> 123.1 |
| oyun-asiri | 60.0 -> 60.0 | 16.7 -> 16.7 | 0.0 -> 0.0 | 13 -> 8 | 55.1 -> 9.2 | 33.7 -> 19.7 |
| oyun-karalama | 60.0 -> 60.0 | 16.8 -> 16.8 | 0.0 -> 0.0 | 11 -> 6 | 54.0 -> 10.4 | 44.5 -> 19.7 |

Yükleme (soğuk açılış | ılık açılış). "Geç görsel": ekran gösterildikten >300 ms sonra çözülen görünür görsel sayısı.

| ekran | ekran hazır (ms) | FCP (ms) | geç görsel | en geç çözülen (ms) | yazı tipleri indi (ms) |
|---|---|---|---|---|---|
| home | 1144 -> 1127 | 1400 -> 1384 | 0 -> 0 | 53 -> 51 | 1225 -> 1206 |
| lobi-8 | 618 -> 757 | 980 -> 1496 | 17 -> 17 | 630 -> 1302 | 1265 -> 1349 |
| anlatim-kule | 620 -> 614 | 1096 -> 864 | 9 -> 9 | 896 -> 908 | 1144 -> 1157 |
| anlatim-kor-bomba | 577 -> 651 | 780 -> 852 | 10 -> 10 | 705 -> 809 | 1053 -> 928 |
| anlatim-zaman | 575 -> 639 | 784 -> 796 | 9 -> 9 | 776 -> 944 | 1083 -> 870 |
| anlatim-asiri | 588 -> 590 | 768 -> 828 | 9 -> 9 | 779 -> 975 | 829 -> 909 |
| anlatim-karalama | 591 -> 637 | 792 -> 804 | 9 -> 6 | 790 -> 749 | 888 -> 1103 |
| geri-sayim | 558 -> 550 | 760 -> 744 | 0 -> 0 | 0 -> 0 | 831 -> 840 |
| sonuc-5 | 634 -> 646 | 1000 -> 1336 | 12 -> 12 | 1219 -> 664 | 1304 -> 1369 |
| final-8 | 710 -> 688 | 896 -> 956 | 15 -> 15 | 1364 -> 2294 | 1247 -> 1352 |
| kart-secim | 653 -> 595 | 1064 -> 1012 | 11 -> 11 | 981 -> 818 | 1109 -> 1100 |
| tv-lobi-8 | 90 -> 106 | 376 -> 376 | 0 -> 0 | 92 -> 69 | 385 -> 384 |
| tv-sonuc | 114 -> 118 | 300 -> 308 | 0 -> 0 | 80 -> 78 | 308 -> 375 |
| tv-final | 102 -> 93 | 324 -> 304 | 15 -> 15 | 1241 -> 791 | 157 -> 168 |
| oyun-kule | 605 -> 741 | 708 -> 892 | 6 -> 6 | 441 -> 426 | 1129 -> 1266 |
| oyun-kor-bomba | 598 -> 620 | 632 -> 656 | 10 -> 10 | 1117 -> 1322 | 1113 -> 1295 |
| oyun-zaman | 632 -> 616 | 660 -> 652 | 6 -> 6 | 1097 -> 968 | 1182 -> 1226 |
| oyun-butona-bas | 610 -> 657 | 648 -> 680 | 8 -> 8 | 910 -> 730 | 1115 -> 1166 |
| oyun-asiri | 585 -> 623 | 612 -> 644 | 3 -> 3 | 843 -> 923 | 784 -> 783 |
| oyun-karalama | 618 -> 634 | 652 -> 652 | 1 -> 1 | 816 -> 649 | 1079 -> 1134 |

## Ne değişti ve neden

1. **TV: `backdrop-filter: blur(6px)` kaldırıldı** (`stage/tv.css`, `.tv__side`). 1080p'de büyük panelin arkası içindeki her animasyonda yeniden bulanıyordu. TV lobisi 17 -> 38 fps (ortam tabanı ~40). Zemin biraz koyulaştırıldı (0.62 -> 0.74) ki görünüm yakın kalsın; arkadaki dünya görseli zaten koyu örtülü.
2. **Bağlantısı kopan oyuncu (`.av--off`)**: aynı öğede hem `filter: grayscale(1)` hem sonsuz opacity animasyonu vardı; her karede süzgeç yeniden çalışıyordu (TV lobisinin 17 fps'inin asıl nedeni, telefon lobisinde de geçerli). Gri tonlama çocuklara taşındı; görünüm aynı (`styles/ui.css`).
3. **Animasyonlu `box-shadow` -> `opacity`/`transform` (bileşen katmanı)**: `mpath-pulse` (her oyunun üstündeki tur noktaları, `styles/frame.css`), `start-glow` (lobide Başlat düğmesi, `styles/screens.css`), `kbo-invite` (Kör Bomba davet halkası), `ztotal-pulse` (Zaman Bombası rozeti). Oyun ekranlarında paint maliyeti: Kule 61 -> 16, Kör Bomba 84 -> 18, Aşırı Yükleme 55 -> 9, Karalama 54 -> 10 ms/sn. Azaltılmış hareket davranışı korundu (animasyon kapalıyken statik hâl önceki ile aynı).
4. **Görsel önden yükleme**: yeni `ui/imageWarm.ts` (yinelemesiz, decode ile çözülmüş hâlini sıcak tutar, düşük öncelik seçeneği, bellek üst sınırı) ve `ui/artPreload.ts`. `App.tsx`/`TvApp.tsx`: mevcut oyunun görselleri hemen, **sıradaki oyunun** (dünya arka planı, 3 çizgi roman karesi, nesne görselleri, sonuç ekranındaki kapak) 1,2 sn sonra düşük öncelikle; lobide elle seçilmiş ilk oyun için de. Eskiden yalnız o anki oyun anlatım başlarken indiriliyordu, yani her oyun geçişinde arka plan ve çizgi roman ağdan sonradan beliriyordu.
5. **Ruh hâli görselleri düşük öncelikli** (`ui/preloadMoods.ts`): 8 oyuncu x 4 hâl = 32 dosya maçın ilk anlatımının görselleriyle yarışıyordu; sonuç/finalde lazım oldukları için artık arkada iniyor.
6. **Dünya arka planı** (`ui/WorldBackdrop.tsx`): görsel zaten çözülmüş/önbellekteyse 600 ms'lik belirme beklemeden ilk karede görünür. **Anlatım karelerinde** `fetchpriority` (ilk kare yüksek, 2-3 düşük). **Lobi "Bu gece" kapakları** `loading="lazy"` yerine hemen (`screens/Lobby.tsx`).

## Denenip bırakılan

- Ana sayfa yazı tiplerini HTML'den `<link rel="preload" as="font">` ile istemek yazı tiplerini ~390 ms erken indirdi ama bu ortamda (HTTP/1.1 sunucu, 6 bağlantı) ilk boyamayı gecikti (FCP ~2000 -> ~2950 ms, art arda değişmeli 4 koşuda tutarlı). Uygulanmadı; üretimde HTTP/2-3 ile farklı olabilir, gerçek cihazda RUM (telemetry/perf.ts) ile denenmeli.
- Reaktif churn incelendi: oyun ekranlarında DOM değişimi 10-60/sn, tamamı küçük düğümler (saat çubuğu stili, tek metin). 100 ms'lik `createServerNow` büyük alt ağaç çizmiyor; değişiklik gerekmedi.
- Pixi tuvalleri (ana sayfa, konfeti) zaten `resolution <= 1.5`, `maxFPS 30` (ana sayfa), sekme gizlenince duruyor; dokunulmadı.

## Ham ölçüm (sonra)

Üretim yapısı (küçültülmüş, gzip, immutable başlıklar), başsız Chromium + swiftshader. Telefon: 390x844 @3x, CPU 4x, 10 Mbps / 40 ms. TV: 1920x1080 kısıtsız. Ölçüm penceresi 5 sn. Hücrelerde "a | b" = soğuk | ılık.

### Yükleme ve görseller

| ekran | ekran hazır (ms) | FCP (ms) | LCP (ms) | görünür görsel | >300 ms geç görsel | en geç çözülen (ms, hazırdan sonra) | JS+CSS aktarım (KB) | betik (ms) | yazı tipleri indi (ms) |
|---|---|---|---|---|---|---|---|---|---|
| home | 1127 \| 580 | 1384 \| 628 | 1384 \| 628 | 6 | 0 \| 0 | 51 \| 12 | 370 | 519 | 1206 |
| lobi-8 | 757 \| 615 | 1496 \| 435 | 1496 \| 435 | 17 | 17 \| 0 | 1302 \| 262 | 370 | 325 | 1349 |
| anlatim-kule | 614 \| 618 | 864 \| 403 | 1528 \| 403 | 9 | 9 \| 0 | 908 \| 196 | 366 | 294 | 1157 |
| anlatim-kor-bomba | 651 \| 596 | 852 \| 391 | 1488 \| 391 | 10 | 10 \| 0 | 809 \| 192 | 366 | 268 | 928 |
| anlatim-zaman | 639 \| 564 | 796 \| 435 | 1156 \| 435 | 9 | 9 \| 0 | 944 \| 281 | 366 | 274 | 870 |
| anlatim-asiri | 590 \| 710 | 828 \| 484 | 1540 \| 484 | 9 | 9 \| 0 | 975 \| 170 | 365 | 267 | 909 |
| anlatim-karalama | 637 \| 670 | 804 \| 486 | 1396 \| 486 | 9 | 6 \| 0 | 749 \| 209 | 367 | 251 | 1103 |
| geri-sayim | 550 \| 520 | 744 \| 406 | 744 \| 406 | 0 | 0 \| 0 | 0 \| 0 | 370 | 240 | 840 |
| sonuc-5 | 646 \| 718 | 1336 \| 992 | 2228 \| 1452 | 12 | 12 \| 0 | 664 \| 233 | 370 | 374 | 1369 |
| final-8 | 688 \| 698 | 956 \| 920 | 956 \| 1588 | 15 | 15 \| 0 | 2294 \| 207 | 370 | 383 | 1352 |
| kart-secim | 595 \| 664 | 1012 \| 467 | 1112 \| 467 | 11 | 11 \| 0 | 818 \| 166 | 366 | 245 | 1100 |
| tv-lobi-8 | 106 \| 98 | 376 \| 276 | 376 \| 276 | 9 | 0 \| 0 | 69 \| 70 | 226 | 27 | 384 |
| tv-sonuc | 118 \| 93 | 308 \| 300 | 308 \| 300 | 10 | 0 \| 0 | 78 \| 77 | 226 | 28 | 375 |
| tv-final | 93 \| 94 | 304 \| 300 | 304 \| 300 | 17 | 15 \| 16 | 791 \| 722 | 371 | 332 | 168 |
| oyun-kule | 741 \| 661 | 892 \| 696 | 1828 \| 696 | 6 | 6 \| 0 | 426 \| 203 | 373 | 313 | 1266 |
| oyun-kor-bomba | 620 \| 735 | 656 \| 760 | 1320 \| 1020 | 10 | 10 \| 0 | 1322 \| 205 | 373 | 256 | 1295 |
| oyun-zaman | 616 \| 565 | 652 \| 600 | 1652 \| 600 | 6 | 6 \| 0 | 968 \| 174 | 376 | 267 | 1226 |
| oyun-butona-bas | 657 \| 643 | 680 \| 680 | 1364 \| 1236 | 8 | 8 \| 0 | 730 \| 154 | 373 | 269 | 1166 |
| oyun-asiri | 623 \| 674 | 644 \| 716 | 1512 \| 716 | 3 | 3 \| 0 | 923 \| 199 | 371 | 227 | 783 |
| oyun-karalama | 634 \| 557 | 652 \| 584 | 652 \| 584 | 1 | 1 \| 0 | 649 \| 145 | 375 | 236 | 1134 |

### Sıradaki oyunun görselleri (anlatım 3 kare + dünya arka planı; sonuç ekranında 5 sn sonra istenir)

| ekran | sıradaki oyun (ms) | önden inmeyen kontrol oyunu (ms) |
|---|---|---|
| sonuc-5 | 3 | 304 |

### Kararlı durum

| ekran | ort. FPS | p95 kare (ms) | p99 kare (ms) | >33 ms kare % | uzun görev >50 ms | layout/sn | stil hesabı/sn | ana iş p. meşgul % | betik % | paint ms/sn | raster ms/sn | composite ms/sn | resim çözme ms/sn |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | 60.0 | 16.7 | 16.8 | 0.0 | 0 (0 ms) | 0.0 | 0.0 | 9 | 5 | 8.4 | 0.0 | 18.7 | 0.0 |
| lobi-8 | 60.0 | 16.8 | 16.8 | 0.0 | 0 (0 ms) | 0.0 | 60.6 | 15 | 1 | 32.9 | 0.0 | 80.6 | 0.0 |
| anlatim-kule | 60.0 | 16.8 | 16.8 | 0.0 | 0 (0 ms) | 8.8 | 60.2 | 8 | 1 | 13.7 | 0.5 | 24.1 | 0.0 |
| anlatim-kor-bomba | 60.0 | 16.8 | 16.8 | 0.0 | 0 (0 ms) | 7.2 | 60.2 | 8 | 1 | 20.8 | 0.5 | 22.7 | 0.0 |
| anlatim-zaman | 60.0 | 16.8 | 16.8 | 0.0 | 0 (0 ms) | 8.6 | 60.2 | 9 | 1 | 16.6 | 0.5 | 23.9 | 0.0 |
| anlatim-asiri | 60.0 | 16.8 | 16.8 | 0.0 | 0 (0 ms) | 7.8 | 60.2 | 8 | 1 | 16.5 | 0.6 | 24.8 | 0.0 |
| anlatim-karalama | 60.0 | 16.8 | 16.8 | 0.0 | 0 (0 ms) | 8.4 | 60.2 | 10 | 1 | 16.5 | 0.4 | 27.1 | 0.0 |
| geri-sayim | 60.0 | 16.8 | 16.8 | 0.0 | 0 (0 ms) | 1.0 | 39.6 | 8 | 2 | 9.6 | 0.4 | 14.4 | 0.0 |
| sonuc-5 | 59.8 | 16.8 | 16.8 | 0.3 | 0 (0 ms) | 0.0 | 10.4 | 8 | 2 | 5.3 | 0.0 | 28.7 | 0.0 |
| final-8 | 58.8 | 16.8 | 33.3 | 0.0 | 0 (0 ms) | 0.2 | 0.0 | 7 | 3 | 3.0 | 0.0 | 27.9 | 0.0 |
| kart-secim | 60.0 | 16.7 | 16.8 | 0.0 | 0 (0 ms) | 2.4 | 15.0 | 7 | 2 | 7.5 | 0.3 | 26.6 | 0.0 |
| tv-lobi-8 | 37.7 | 33.4 | 33.4 | 14.9 | 0 (0 ms) | 0.0 | 37.8 | 1 | 0 | 0.6 | 0.0 | 2.4 | 0.0 |
| tv-sonuc | 57.6 | 16.8 | 33.4 | 1.0 | 0 (0 ms) | 0.0 | 12.0 | 2 | 1 | 1.5 | 0.0 | 4.9 | 0.0 |
| tv-final | 40.8 | 50.0 | 100.0 | 15.7 | 2 (185 ms) | 0.6 | 0.4 | 6 | 4 | 0.8 | 0.0 | 3.0 | 0.0 |
| oyun-kule | 59.6 | 16.8 | 16.8 | 0.3 | 0 (0 ms) | 1.2 | 59.8 | 15 | 2 | 15.8 | 0.2 | 48.3 | 0.0 |
| oyun-kor-bomba | 60.0 | 16.7 | 16.8 | 0.0 | 0 (0 ms) | 0.0 | 60.2 | 16 | 1 | 17.7 | 0.0 | 91.8 | 0.0 |
| oyun-zaman | 60.0 | 16.8 | 16.8 | 0.0 | 0 (0 ms) | 2.0 | 60.2 | 22 | 3 | 52.8 | 3.4 | 79.0 | 0.0 |
| oyun-butona-bas | 56.4 | 33.3 | 33.4 | 1.1 | 1 (60 ms) | 23.0 | 72.4 | 47 | 8 | 84.9 | 9.1 | 123.1 | 0.0 |
| oyun-asiri | 60.0 | 16.7 | 16.8 | 0.0 | 0 (0 ms) | 60.2 | 60.2 | 8 | 0 | 9.2 | 0.0 | 19.7 | 0.0 |
| oyun-karalama | 60.0 | 16.8 | 16.8 | 0.0 | 0 (0 ms) | 0.0 | 60.2 | 6 | 1 | 10.4 | 0.0 | 19.7 | 0.0 |

### Geç gelen görseller (soğuk açılış; ekran hazır olduktan >300 ms sonra çözülenler)

- **lobi-8**
  - `/assets/worlds/lobi-portrait.webp` 70 KB: DOM'a girdi -10 ms, istek 43 ms, yüklendi 521 ms, çözüldü 1302 ms
  - `/assets/avatars/busts/p3-amber-bust-v1.webp` 5 KB: DOM'a girdi -10 ms, istek 87 ms, yüklendi 521 ms, çözüldü 1302 ms
  - `/assets/avatars/busts/p4-lime-bust-v1.webp` 5 KB: DOM'a girdi -10 ms, istek -14 ms, yüklendi 521 ms, çözüldü 1302 ms
  - `/assets/avatars/busts/p5-violet-bust-v1.webp` 5 KB: DOM'a girdi -10 ms, istek 150 ms, yüklendi 521 ms, çözüldü 1302 ms
  - `/assets/avatars/busts/p6-orange-bust-v1.webp` 5 KB: DOM'a girdi -10 ms, istek 27 ms, yüklendi 521 ms, çözüldü 1302 ms
  - `/assets/avatars/busts/p7-emerald-bust-v1.webp` 5 KB: DOM'a girdi -10 ms, istek 111 ms, yüklendi 521 ms, çözüldü 1302 ms
- **anlatim-kule**
  - `/assets/briefing/kule-ustasi-2.webp` 76 KB: DOM'a girdi -13 ms, istek 232 ms, yüklendi 898 ms, çözüldü 908 ms
  - `/assets/briefing/kule-ustasi-3.webp` 93 KB: DOM'a girdi -13 ms, istek 264 ms, yüklendi 898 ms, çözüldü 908 ms
  - `/assets/worlds/kule-ustasi-portrait.webp` 76 KB: DOM'a girdi -13 ms, istek 191 ms, yüklendi 518 ms, çözüldü 523 ms
  - `/assets/briefing/kule-ustasi-1.webp` 73 KB: DOM'a girdi -13 ms, istek 180 ms, yüklendi 483 ms, çözüldü 486 ms
  - `/assets/avatars/busts/p3-amber-bust-v1.webp` 5 KB: DOM'a girdi -13 ms, istek 214 ms, yüklendi 407 ms, çözüldü 438 ms
  - `/assets/avatars/busts/p5-violet-bust-v1.webp` 5 KB: DOM'a girdi -13 ms, istek 206 ms, yüklendi 407 ms, çözüldü 438 ms
- **anlatim-kor-bomba**
  - `/assets/briefing/kor-bomba-2.webp` 63 KB: DOM'a girdi -22 ms, istek 263 ms, yüklendi 794 ms, çözüldü 809 ms
  - `/assets/briefing/kor-bomba-3.webp` 72 KB: DOM'a girdi -19 ms, istek 274 ms, yüklendi 794 ms, çözüldü 809 ms
  - `/assets/briefing/kor-bomba-1.webp` 65 KB: DOM'a girdi -22 ms, istek 196 ms, yüklendi 456 ms, çözüldü 457 ms
  - `/assets/worlds/kor-bomba-portrait.webp` 54 KB: DOM'a girdi -22 ms, istek 210 ms, yüklendi 444 ms, çözüldü 456 ms
  - `/assets/avatars/busts/p3-amber-bust-v1.webp` 5 KB: DOM'a girdi -19 ms, istek 240 ms, yüklendi 384 ms, çözüldü 417 ms
  - `/assets/avatars/busts/p5-violet-bust-v1.webp` 5 KB: DOM'a girdi -19 ms, istek 213 ms, yüklendi 384 ms, çözüldü 414 ms
- **anlatim-zaman**
  - `/assets/briefing/zaman-bombasi-hafizasi-2.webp` 76 KB: DOM'a girdi -15 ms, istek 231 ms, yüklendi 915 ms, çözüldü 944 ms
  - `/assets/briefing/zaman-bombasi-hafizasi-3.webp` 79 KB: DOM'a girdi -15 ms, istek 243 ms, yüklendi 915 ms, çözüldü 944 ms
  - `/assets/worlds/zaman-bombasi-hafizasi-portrait.webp` 56 KB: DOM'a girdi -15 ms, istek 217 ms, yüklendi 489 ms, çözüldü 892 ms
  - `/assets/briefing/zaman-bombasi-hafizasi-1.webp` 78 KB: DOM'a girdi -15 ms, istek 174 ms, yüklendi 489 ms, çözüldü 892 ms
  - `/assets/avatars/busts/p3-amber-bust-v1.webp` 5 KB: DOM'a girdi -15 ms, istek 212 ms, yüklendi 351 ms, çözüldü 377 ms
  - `/assets/avatars/busts/p5-violet-bust-v1.webp` 5 KB: DOM'a girdi -15 ms, istek 188 ms, yüklendi 351 ms, çözüldü 375 ms
- **anlatim-asiri**
  - `/assets/briefing/asiri-yukleme-1.webp` 89 KB: DOM'a girdi -13 ms, istek 197 ms, yüklendi 922 ms, çözüldü 975 ms
  - `/assets/briefing/asiri-yukleme-2.webp` 93 KB: DOM'a girdi -12 ms, istek 254 ms, yüklendi 922 ms, çözüldü 975 ms
  - `/assets/briefing/asiri-yukleme-3.webp` 101 KB: DOM'a girdi -12 ms, istek 273 ms, yüklendi 922 ms, çözüldü 975 ms
  - `/assets/worlds/asiri-yukleme-portrait.webp` 70 KB: DOM'a girdi -13 ms, istek 200 ms, yüklendi 505 ms, çözüldü 914 ms
  - `/assets/avatars/busts/p3-amber-bust-v1.webp` 5 KB: DOM'a girdi -12 ms, istek 251 ms, yüklendi 388 ms, çözüldü 420 ms
  - `/assets/avatars/busts/p5-violet-bust-v1.webp` 5 KB: DOM'a girdi -12 ms, istek 214 ms, yüklendi 388 ms, çözüldü 416 ms
- **anlatim-karalama**
  - `/assets/briefing/karalama-defteri-1.webp` 72 KB: DOM'a girdi -16 ms, istek 154 ms, yüklendi 726 ms, çözüldü 749 ms
  - `/assets/briefing/karalama-defteri-2.webp` 76 KB: DOM'a girdi -16 ms, istek 202 ms, yüklendi 726 ms, çözüldü 749 ms
  - `/assets/briefing/karalama-defteri-3.webp` 69 KB: DOM'a girdi -16 ms, istek 224 ms, yüklendi 726 ms, çözüldü 749 ms
  - `/assets/worlds/karalama-defteri-portrait.webp` 59 KB: DOM'a girdi -16 ms, istek 176 ms, yüklendi 726 ms, çözüldü 749 ms
  - `/assets/avatars/busts/p3-amber-bust-v1.webp` 5 KB: DOM'a girdi -16 ms, istek 196 ms, yüklendi 292 ms, çözüldü 317 ms
  - `/assets/avatars/busts/p5-violet-bust-v1.webp` 5 KB: DOM'a girdi -16 ms, istek 168 ms, yüklendi 292 ms, çözüldü 302 ms
- **sonuc-5**
  - `/assets/cards/kor-bomba.webp` 69 KB: DOM'a girdi -12 ms, istek 343 ms, yüklendi 659 ms, çözüldü 664 ms
  - `/assets/avatars/busts/p3-amber-bust-v1.webp` 5 KB: DOM'a girdi -12 ms, istek 223 ms, yüklendi 515 ms, çözüldü 592 ms
  - `/assets/avatars/moods/p3-amber-idle.webp` 23 KB: DOM'a girdi -12 ms, istek 242 ms, yüklendi 515 ms, çözüldü 592 ms
  - `/assets/avatars/moods/p1-cyan-idle.webp` 21 KB: DOM'a girdi -12 ms, istek 258 ms, yüklendi 515 ms, çözüldü 592 ms
  - `/assets/avatars/moods/p4-lime-idle.webp` 23 KB: DOM'a girdi -12 ms, istek 266 ms, yüklendi 515 ms, çözüldü 592 ms
  - `/assets/avatars/busts/p5-violet-bust-v1.webp` 5 KB: DOM'a girdi -12 ms, istek 278 ms, yüklendi 515 ms, çözüldü 592 ms
- **final-8**
  - `/assets/avatars/moods/p1-cyan-idle.webp` 21 KB: DOM'a girdi 38 ms, istek 628 ms, yüklendi 2281 ms, çözüldü 2294 ms
  - `/assets/avatars/moods/p5-violet-idle.webp` 22 KB: DOM'a girdi 38 ms, istek 916 ms, yüklendi 2281 ms, çözüldü 2294 ms
  - `/assets/avatars/moods/p2-magenta-idle.webp` 19 KB: DOM'a girdi 38 ms, istek 220 ms, yüklendi 507 ms, çözüldü 1710 ms
  - `/assets/avatars/moods/p1-cyan-happy.webp` 35 KB: DOM'a girdi -21 ms, istek 180 ms, yüklendi 506 ms, çözüldü 1710 ms
  - `/assets/avatars/busts/p3-amber-bust-v1.webp` 5 KB: DOM'a girdi 38 ms, istek 191 ms, yüklendi 506 ms, çözüldü 1710 ms
  - `/assets/avatars/moods/p3-amber-idle.webp` 23 KB: DOM'a girdi 38 ms, istek 211 ms, yüklendi 507 ms, çözüldü 1710 ms
- **kart-secim**
  - `/assets/avatars/busts/p3-amber-bust-v1.webp` 5 KB: DOM'a girdi -17 ms, istek 479 ms, yüklendi 798 ms, çözüldü 818 ms
  - `/assets/avatars/busts/p5-violet-bust-v1.webp` 5 KB: DOM'a girdi -17 ms, istek 473 ms, yüklendi 798 ms, çözüldü 814 ms
  - `/assets/worlds/lobi-portrait.webp` 70 KB: DOM'a girdi -17 ms, istek 196 ms, yüklendi 798 ms, çözüldü 813 ms
  - `/assets/cards/cift-puan.webp` 54 KB: DOM'a girdi -17 ms, istek 240 ms, yüklendi 798 ms, çözüldü 813 ms
  - `/assets/cards/cerceve-nadir.webp` 45 KB: DOM'a girdi -17 ms, istek 256 ms, yüklendi 494 ms, çözüldü 783 ms
  - `/assets/cards/celme.webp` 52 KB: DOM'a girdi -17 ms, istek 220 ms, yüklendi 479 ms, çözüldü 494 ms
- **tv-final**
  - `/assets/avatars/busts/p2-magenta-bust-v1.webp` 5 KB: DOM'a girdi 64 ms, istek 33 ms, yüklendi 64 ms, çözüldü 791 ms
  - `/assets/avatars/busts/p1-cyan-bust-v1.webp` 5 KB: DOM'a girdi 64 ms, istek 35 ms, yüklendi 64 ms, çözüldü 791 ms
  - `/assets/avatars/busts/p3-amber-bust-v1.webp` 5 KB: DOM'a girdi 64 ms, istek 39 ms, yüklendi 64 ms, çözüldü 791 ms
  - `/assets/avatars/busts/p4-lime-bust-v1.webp` 5 KB: DOM'a girdi 20 ms, istek 49 ms, yüklendi 61 ms, çözüldü 791 ms
  - `/assets/avatars/moods/p4-lime-idle.webp` 23 KB: DOM'a girdi 20 ms, istek 49 ms, yüklendi 61 ms, çözüldü 791 ms
  - `/assets/avatars/busts/p8-cobalt-bust-v1.webp` 5 KB: DOM'a girdi 20 ms, istek 49 ms, yüklendi 62 ms, çözüldü 791 ms
- **oyun-kule**
  - `/assets/worlds/kule-ustasi-portrait.webp` 76 KB: DOM'a girdi -48 ms, istek 81 ms, yüklendi 388 ms, çözüldü 426 ms
  - `/assets/avatars/busts/p2-magenta-bust-v1.webp` 5 KB: DOM'a girdi 331 ms, istek 9 ms, yüklendi 331 ms, çözüldü 381 ms
  - `/assets/avatars/busts/p1-cyan-bust-v1.webp` 5 KB: DOM'a girdi 331 ms, istek -4 ms, yüklendi 331 ms, çözüldü 381 ms
  - `/assets/avatars/busts/p3-amber-bust-v1.webp` 5 KB: DOM'a girdi 331 ms, istek 118 ms, yüklendi 331 ms, çözüldü 381 ms
  - `/assets/avatars/busts/p4-lime-bust-v1.webp` 5 KB: DOM'a girdi 331 ms, istek 17 ms, yüklendi 331 ms, çözüldü 381 ms
  - `/assets/avatars/busts/p5-violet-bust-v1.webp` 5 KB: DOM'a girdi 331 ms, istek 120 ms, yüklendi 331 ms, çözüldü 381 ms
- **oyun-kor-bomba**
  - `/assets/props/bomba/kivilcim.webp` 45 KB: DOM'a girdi 447 ms, istek 345 ms, yüklendi 1251 ms, çözüldü 1322 ms
  - `/assets/props/bomba/govde.webp` 26 KB: DOM'a girdi 447 ms, istek 317 ms, yüklendi 484 ms, çözüldü 1240 ms
  - `/assets/props/bomba/fitil.webp` 17 KB: DOM'a girdi 447 ms, istek 323 ms, yüklendi 484 ms, çözüldü 1231 ms
  - `/assets/avatars/busts/p2-magenta-bust-v1.webp` 5 KB: DOM'a girdi 447 ms, istek 180 ms, yüklendi 447 ms, çözüldü 483 ms
  - `/assets/avatars/busts/p3-amber-bust-v1.webp` 5 KB: DOM'a girdi 447 ms, istek 249 ms, yüklendi 447 ms, çözüldü 483 ms
  - `/assets/avatars/busts/p4-lime-bust-v1.webp` 5 KB: DOM'a girdi 447 ms, istek 236 ms, yüklendi 447 ms, çözüldü 483 ms
- **oyun-zaman**
  - `/assets/worlds/zaman-bombasi-hafizasi-portrait.webp` 56 KB: DOM'a girdi -16 ms, istek 242 ms, yüklendi 952 ms, çözüldü 968 ms
  - `/assets/avatars/busts/p2-magenta-bust-v1.webp` 5 KB: DOM'a girdi 378 ms, istek 152 ms, yüklendi 378 ms, çözüldü 389 ms
  - `/assets/avatars/busts/p1-cyan-bust-v1.webp` 5 KB: DOM'a girdi 378 ms, istek 132 ms, yüklendi 378 ms, çözüldü 389 ms
  - `/assets/avatars/busts/p3-amber-bust-v1.webp` 5 KB: DOM'a girdi 378 ms, istek 248 ms, yüklendi 378 ms, çözüldü 389 ms
  - `/assets/avatars/busts/p4-lime-bust-v1.webp` 5 KB: DOM'a girdi 378 ms, istek 161 ms, yüklendi 378 ms, çözüldü 389 ms
  - `/assets/avatars/busts/p5-violet-bust-v1.webp` 5 KB: DOM'a girdi 378 ms, istek 255 ms, yüklendi 378 ms, çözüldü 389 ms
- **oyun-butona-bas**
  - `/assets/worlds/butona-bas-portrait.webp` 60 KB: DOM'a girdi -23 ms, istek 203 ms, yüklendi 650 ms, çözüldü 730 ms
  - `/assets/props/genel/arcade-dugme.webp` 21 KB: DOM'a girdi 304 ms, istek 287 ms, yüklendi 650 ms, çözüldü 730 ms
  - `/assets/props/genel/arcade-dugme-basili.webp` 21 KB: DOM'a girdi 304 ms, istek 404 ms, yüklendi 650 ms, çözüldü 730 ms
  - `/assets/avatars/busts/p1-cyan-bust-v1.webp` 5 KB: DOM'a girdi 304 ms, istek 92 ms, yüklendi 304 ms, çözüldü 335 ms
  - `/assets/avatars/busts/p2-magenta-bust-v1.webp` 5 KB: DOM'a girdi 304 ms, istek 119 ms, yüklendi 304 ms, çözüldü 335 ms
  - `/assets/avatars/busts/p3-amber-bust-v1.webp` 5 KB: DOM'a girdi 304 ms, istek 222 ms, yüklendi 304 ms, çözüldü 335 ms
- **oyun-asiri**
  - `/assets/worlds/asiri-yukleme-portrait.webp` 70 KB: DOM'a girdi -29 ms, istek 171 ms, yüklendi 858 ms, çözüldü 923 ms
  - `/assets/props/genel/enerji-cekirdegi.webp` 20 KB: DOM'a girdi 355 ms, istek 269 ms, yüklendi 858 ms, çözüldü 923 ms
  - `/assets/props/genel/enerji-cekirdegi-asiri.webp` 37 KB: DOM'a girdi 355 ms, istek 379 ms, yüklendi 858 ms, çözüldü 923 ms
- **oyun-karalama**
  - `/assets/worlds/karalama-defteri-portrait.webp` 59 KB: DOM'a girdi -17 ms, istek 216 ms, yüklendi 634 ms, çözüldü 649 ms
