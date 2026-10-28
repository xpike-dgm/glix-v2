# Başarım ölçümü

Üretim yapısı (küçültülmüş, gzip, immutable başlıklar), başsız Chromium + swiftshader. Telefon: 390x844 @3x, CPU 4x, 10 Mbps / 40 ms. TV: 1920x1080 kısıtsız. Ölçüm penceresi 5 sn. Hücrelerde "a | b" = soğuk | ılık.

## Yükleme ve görseller

| ekran | ekran hazır (ms) | FCP (ms) | LCP (ms) | görünür görsel | >300 ms geç görsel | en geç çözülen (ms, hazırdan sonra) | JS+CSS aktarım (KB) | betik (ms) | yazı tipleri indi (ms) |
|---|---|---|---|---|---|---|---|---|---|
| home | 1144 \| 541 | 1400 \| 592 | 1400 \| 592 | 6 | 0 \| 0 | 53 \| 0 | 370 | 415 | 1225 |
| lobi-8 | 618 \| 593 | 980 \| 399 | 980 \| 399 | 17 | 17 \| 0 | 630 \| 205 | 370 | 310 | 1265 |
| anlatim-kule | 620 \| 631 | 1096 \| 445 | 1204 \| 445 | 9 | 9 \| 0 | 896 \| 160 | 366 | 264 | 1144 |
| anlatim-kor-bomba | 577 \| 704 | 780 \| 462 | 1300 \| 462 | 10 | 10 \| 0 | 705 \| 138 | 366 | 215 | 1053 |
| anlatim-zaman | 575 \| 638 | 784 \| 457 | 1316 \| 457 | 9 | 9 \| 0 | 776 \| 182 | 366 | 230 | 1083 |
| anlatim-asiri | 588 \| 509 | 768 \| 391 | 1292 \| 391 | 9 | 9 \| 0 | 779 \| 135 | 365 | 203 | 829 |
| anlatim-karalama | 591 \| 559 | 792 \| 386 | 1356 \| 386 | 9 | 9 \| 0 | 790 \| 139 | 367 | 217 | 888 |
| geri-sayim | 558 \| 598 | 760 \| 446 | 760 \| 446 | 0 | 0 \| 0 | 0 \| 0 | 370 | 243 | 831 |
| sonuc-5 | 634 \| 658 | 1000 \| 872 | 1956 \| 1212 | 12 | 12 \| 1 | 1219 \| 482 | 370 | 343 | 1304 |
| final-8 | 710 \| 661 | 896 \| 952 | 1212 \| 1356 | 15 | 15 \| 0 | 1364 \| 238 | 370 | 444 | 1247 |
| kart-secim | 653 \| 625 | 1064 \| 424 | 1112 \| 424 | 11 | 11 \| 0 | 981 \| 177 | 366 | 305 | 1109 |
| tv-lobi-8 | 90 \| 99 | 376 \| 272 | 376 \| 272 | 9 | 0 \| 0 | 92 \| 56 | 225 | 22 | 385 |
| tv-sonuc | 114 \| 132 | 300 \| 288 | 300 \| 288 | 10 | 0 \| 0 | 80 \| 49 | 225 | 28 | 308 |
| tv-final | 102 \| 112 | 324 \| 280 | 324 \| 280 | 17 | 15 \| 16 | 1241 \| 968 | 370 | 399 | 157 |
| oyun-kule | 605 \| 588 | 708 \| 624 | 1548 \| 624 | 6 | 6 \| 0 | 441 \| 192 | 372 | 233 | 1129 |
| oyun-kor-bomba | 598 \| 630 | 632 \| 660 | 1760 \| 872 | 10 | 10 \| 0 | 1117 \| 185 | 373 | 215 | 1113 |
| oyun-zaman | 632 \| 659 | 660 \| 688 | 1768 \| 688 | 6 | 6 \| 0 | 1097 \| 233 | 375 | 270 | 1182 |
| oyun-butona-bas | 610 \| 573 | 648 \| 600 | 1536 \| 1120 | 8 | 8 \| 0 | 910 \| 164 | 373 | 251 | 1115 |
| oyun-asiri | 585 \| 587 | 612 \| 628 | 1452 \| 628 | 3 | 3 \| 0 | 843 \| 203 | 371 | 211 | 784 |
| oyun-karalama | 618 \| 632 | 652 \| 664 | 1456 \| 664 | 1 | 1 \| 0 | 816 \| 115 | 375 | 245 | 1079 |

## Sıradaki oyunun görselleri (anlatım 3 kare + dünya arka planı; sonuç ekranında 5 sn sonra istenir)

| ekran | sıradaki oyun (ms) | önden inmeyen kontrol oyunu (ms) |
|---|---|---|
| sonuc-5 | 253 | 306 |

## Kararlı durum

| ekran | ort. FPS | p95 kare (ms) | p99 kare (ms) | >33 ms kare % | uzun görev >50 ms | layout/sn | stil hesabı/sn | ana iş p. meşgul % | betik % | paint ms/sn | raster ms/sn | composite ms/sn | resim çözme ms/sn |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home | 60.0 | 16.8 | 16.8 | 0.0 | 0 (0 ms) | 0.0 | 0.0 | 7 | 4 | 7.8 | 0.0 | 16.0 | 0.0 |
| lobi-8 | 60.0 | 16.7 | 16.8 | 0.0 | 0 (0 ms) | 0.0 | 60.6 | 10 | 1 | 17.2 | 0.0 | 59.5 | 0.0 |
| anlatim-kule | 60.0 | 16.7 | 16.8 | 0.0 | 0 (0 ms) | 9.0 | 60.0 | 6 | 1 | 11.9 | 0.3 | 21.7 | 0.0 |
| anlatim-kor-bomba | 60.0 | 16.8 | 16.8 | 0.0 | 0 (0 ms) | 8.4 | 60.2 | 5 | 1 | 12.6 | 0.4 | 17.0 | 0.0 |
| anlatim-zaman | 60.0 | 16.7 | 16.8 | 0.0 | 0 (0 ms) | 8.2 | 60.2 | 6 | 1 | 9.3 | 0.4 | 15.7 | 0.0 |
| anlatim-asiri | 60.0 | 16.7 | 16.8 | 0.0 | 0 (0 ms) | 8.0 | 60.2 | 5 | 0 | 14.3 | 0.4 | 23.1 | 0.0 |
| anlatim-karalama | 60.0 | 16.7 | 16.8 | 0.0 | 0 (0 ms) | 8.4 | 60.2 | 6 | 0 | 9.9 | 0.4 | 17.5 | 0.0 |
| geri-sayim | 60.0 | 16.7 | 16.8 | 0.0 | 0 (0 ms) | 1.0 | 39.6 | 6 | 1 | 6.7 | 0.3 | 11.8 | 0.0 |
| sonuc-5 | 60.0 | 16.7 | 16.8 | 0.0 | 0 (0 ms) | 0.0 | 10.2 | 7 | 2 | 5.5 | 0.0 | 26.9 | 0.0 |
| final-8 | 58.0 | 16.8 | 33.4 | 1.4 | 0 (0 ms) | 0.2 | 0.0 | 5 | 2 | 4.4 | 0.0 | 33.3 | 0.0 |
| kart-secim | 60.0 | 16.8 | 16.8 | 0.0 | 0 (0 ms) | 2.4 | 14.2 | 6 | 1 | 6.6 | 0.3 | 22.8 | 0.0 |
| tv-lobi-8 | 17.3 | 66.7 | 66.8 | 100.0 | 0 (0 ms) | 0.0 | 17.2 | 1 | 0 | 0.3 | 0.0 | 2.3 | 0.0 |
| tv-sonuc | 55.0 | 16.8 | 66.7 | 3.6 | 0 (0 ms) | 0.0 | 10.8 | 2 | 1 | 1.2 | 0.1 | 4.9 | 0.0 |
| tv-final | 50.5 | 16.8 | 83.4 | 4.8 | 1 (140 ms) | 0.2 | 0.0 | 4 | 3 | 0.6 | 0.0 | 2.3 | 0.0 |
| oyun-kule | 59.6 | 16.8 | 16.8 | 0.3 | 0 (0 ms) | 1.2 | 59.8 | 17 | 2 | 60.7 | 2.0 | 46.2 | 0.0 |
| oyun-kor-bomba | 60.0 | 16.7 | 16.8 | 0.0 | 0 (0 ms) | 0.0 | 60.2 | 20 | 1 | 83.9 | 6.5 | 89.3 | 0.0 |
| oyun-zaman | 60.0 | 16.8 | 16.8 | 0.0 | 0 (0 ms) | 2.0 | 60.2 | 19 | 3 | 81.9 | 4.5 | 84.3 | 0.0 |
| oyun-butona-bas | 55.2 | 33.3 | 33.4 | 3.6 | 1 (55 ms) | 25.2 | 73.6 | 51 | 8 | 107.2 | 10.1 | 147.2 | 0.0 |
| oyun-asiri | 60.0 | 16.7 | 16.8 | 0.0 | 0 (0 ms) | 60.0 | 60.0 | 13 | 0 | 55.1 | 2.0 | 33.7 | 0.0 |
| oyun-karalama | 60.0 | 16.8 | 16.8 | 0.0 | 0 (0 ms) | 0.0 | 60.2 | 11 | 1 | 54.0 | 1.9 | 44.5 | 0.0 |

## Geç gelen görseller (soğuk açılış; ekran hazır olduktan >300 ms sonra çözülenler)

- **lobi-8**
  - `/assets/worlds/lobi-portrait.webp` 70 KB: DOM'a girdi -1 ms, istek 207 ms, yüklendi 596 ms, çözüldü 630 ms
  - `/assets/avatars/busts/p3-amber-bust-v1.webp` 5 KB: DOM'a girdi -1 ms, istek 277 ms, yüklendi 601 ms, çözüldü 630 ms
  - `/assets/avatars/busts/p5-violet-bust-v1.webp` 5 KB: DOM'a girdi -1 ms, istek 256 ms, yüklendi 601 ms, çözüldü 630 ms
  - `/assets/avatars/busts/p7-emerald-bust-v1.webp` 5 KB: DOM'a girdi -1 ms, istek 257 ms, yüklendi 601 ms, çözüldü 630 ms
  - `/assets/avatars/busts/p1-cyan-bust-v1.webp` 5 KB: DOM'a girdi -1 ms, istek 124 ms, yüklendi 595 ms, çözüldü 618 ms
  - `/assets/avatars/busts/p2-magenta-bust-v1.webp` 5 KB: DOM'a girdi -1 ms, istek 149 ms, yüklendi 595 ms, çözüldü 618 ms
- **anlatim-kule**
  - `/assets/briefing/kule-ustasi-3.webp` 93 KB: DOM'a girdi -12 ms, istek 182 ms, yüklendi 886 ms, çözüldü 896 ms
  - `/assets/briefing/kule-ustasi-2.webp` 76 KB: DOM'a girdi -12 ms, istek 177 ms, yüklendi 522 ms, çözüldü 883 ms
  - `/assets/briefing/kule-ustasi-1.webp` 73 KB: DOM'a girdi -12 ms, istek 173 ms, yüklendi 506 ms, çözüldü 513 ms
  - `/assets/worlds/kule-ustasi-portrait.webp` 76 KB: DOM'a girdi -12 ms, istek 156 ms, yüklendi 489 ms, çözüldü 500 ms
  - `/assets/avatars/busts/p5-violet-bust-v1.webp` 5 KB: DOM'a girdi -12 ms, istek 227 ms, yüklendi 372 ms, çözüldü 393 ms
  - `/assets/avatars/busts/p3-amber-bust-v1.webp` 5 KB: DOM'a girdi -12 ms, istek 202 ms, yüklendi 372 ms, çözüldü 391 ms
- **anlatim-kor-bomba**
  - `/assets/briefing/kor-bomba-3.webp` 72 KB: DOM'a girdi -14 ms, istek 218 ms, yüklendi 679 ms, çözüldü 705 ms
  - `/assets/worlds/kor-bomba-portrait.webp` 54 KB: DOM'a girdi -14 ms, istek 216 ms, yüklendi 679 ms, çözüldü 703 ms
  - `/assets/briefing/kor-bomba-2.webp` 63 KB: DOM'a girdi -14 ms, istek 229 ms, yüklendi 679 ms, çözüldü 703 ms
  - `/assets/briefing/kor-bomba-1.webp` 65 KB: DOM'a girdi -14 ms, istek 230 ms, yüklendi 679 ms, çözüldü 684 ms
  - `/assets/avatars/busts/p3-amber-bust-v1.webp` 5 KB: DOM'a girdi -14 ms, istek 274 ms, yüklendi 359 ms, çözüldü 368 ms
  - `/assets/avatars/busts/p5-violet-bust-v1.webp` 5 KB: DOM'a girdi -14 ms, istek 257 ms, yüklendi 338 ms, çözüldü 361 ms
- **anlatim-zaman**
  - `/assets/briefing/zaman-bombasi-hafizasi-1.webp` 78 KB: DOM'a girdi -18 ms, istek 242 ms, yüklendi 709 ms, çözüldü 776 ms
  - `/assets/worlds/zaman-bombasi-hafizasi-portrait.webp` 56 KB: DOM'a girdi -18 ms, istek 218 ms, yüklendi 709 ms, çözüldü 730 ms
  - `/assets/briefing/zaman-bombasi-hafizasi-2.webp` 76 KB: DOM'a girdi -15 ms, istek 243 ms, yüklendi 708 ms, çözüldü 730 ms
  - `/assets/briefing/zaman-bombasi-hafizasi-3.webp` 79 KB: DOM'a girdi -15 ms, istek 229 ms, yüklendi 707 ms, çözüldü 722 ms
  - `/assets/avatars/busts/p3-amber-bust-v1.webp` 5 KB: DOM'a girdi -15 ms, istek 269 ms, yüklendi 381 ms, çözüldü 687 ms
  - `/assets/avatars/busts/p5-violet-bust-v1.webp` 5 KB: DOM'a girdi -15 ms, istek 286 ms, yüklendi 382 ms, çözüldü 687 ms
- **anlatim-asiri**
  - `/assets/briefing/asiri-yukleme-3.webp` 101 KB: DOM'a girdi -24 ms, istek 241 ms, yüklendi 697 ms, çözüldü 779 ms
  - `/assets/briefing/asiri-yukleme-1.webp` 89 KB: DOM'a girdi -25 ms, istek 255 ms, yüklendi 686 ms, çözüldü 723 ms
  - `/assets/briefing/asiri-yukleme-2.webp` 93 KB: DOM'a girdi -24 ms, istek 241 ms, yüklendi 686 ms, çözüldü 719 ms
  - `/assets/worlds/asiri-yukleme-portrait.webp` 70 KB: DOM'a girdi -25 ms, istek 203 ms, yüklendi 685 ms, çözüldü 702 ms
  - `/assets/avatars/busts/p3-amber-bust-v1.webp` 5 KB: DOM'a girdi -24 ms, istek 255 ms, yüklendi 332 ms, çözüldü 355 ms
  - `/assets/avatars/busts/p5-violet-bust-v1.webp` 5 KB: DOM'a girdi -24 ms, istek 193 ms, yüklendi 332 ms, çözüldü 353 ms
- **anlatim-karalama**
  - `/assets/briefing/karalama-defteri-3.webp` 69 KB: DOM'a girdi -11 ms, istek 266 ms, yüklendi 738 ms, çözüldü 790 ms
  - `/assets/briefing/karalama-defteri-2.webp` 76 KB: DOM'a girdi -11 ms, istek 225 ms, yüklendi 738 ms, çözüldü 782 ms
  - `/assets/worlds/karalama-defteri-portrait.webp` 59 KB: DOM'a girdi -11 ms, istek 213 ms, yüklendi 738 ms, çözüldü 778 ms
  - `/assets/briefing/karalama-defteri-1.webp` 72 KB: DOM'a girdi -11 ms, istek 223 ms, yüklendi 738 ms, çözüldü 777 ms
  - `/assets/avatars/busts/p3-amber-bust-v1.webp` 5 KB: DOM'a girdi -11 ms, istek 298 ms, yüklendi 366 ms, çözüldü 369 ms
  - `/assets/avatars/busts/p5-violet-bust-v1.webp` 5 KB: DOM'a girdi -11 ms, istek 271 ms, yüklendi 346 ms, çözüldü 369 ms
- **sonuc-5**
  - `/assets/cards/kor-bomba.webp` 69 KB: DOM'a girdi -18 ms, istek 260 ms, yüklendi 581 ms, çözüldü 1219 ms
  - `/assets/avatars/moods/p1-cyan-happy.webp` 35 KB: DOM'a girdi -18 ms, istek 233 ms, yüklendi 530 ms, çözüldü 581 ms
  - `/assets/avatars/moods/p3-amber-idle.webp` 23 KB: DOM'a girdi -18 ms, istek 244 ms, yüklendi 530 ms, çözüldü 581 ms
  - `/assets/avatars/moods/p4-lime-idle.webp` 23 KB: DOM'a girdi -18 ms, istek 230 ms, yüklendi 529 ms, çözüldü 581 ms
  - `/assets/avatars/moods/p5-violet-shock.webp` 35 KB: DOM'a girdi -18 ms, istek 228 ms, yüklendi 529 ms, çözüldü 581 ms
  - `/assets/avatars/moods/p1-cyan-idle.webp` 21 KB: DOM'a girdi -18 ms, istek 204 ms, yüklendi 528 ms, çözüldü 578 ms
- **final-8**
  - `/assets/avatars/moods/p8-cobalt-idle.webp` 17 KB: DOM'a girdi -20 ms, istek 310 ms, yüklendi 422 ms, çözüldü 1364 ms
  - `/assets/avatars/moods/p5-violet-idle.webp` 22 KB: DOM'a girdi 32 ms, istek 295 ms, yüklendi 409 ms, çözüldü 1359 ms
  - `/assets/avatars/moods/p1-cyan-idle.webp` 21 KB: DOM'a girdi 32 ms, istek 241 ms, yüklendi 392 ms, çözüldü 433 ms
  - `/assets/avatars/busts/p5-violet-bust-v1.webp` 5 KB: DOM'a girdi 32 ms, istek 246 ms, yüklendi 392 ms, çözüldü 433 ms
  - `/assets/avatars/moods/p7-emerald-idle.webp` 19 KB: DOM'a girdi -20 ms, istek 212 ms, yüklendi 392 ms, çözüldü 433 ms
  - `/assets/avatars/moods/p2-magenta-idle.webp` 19 KB: DOM'a girdi 32 ms, istek 204 ms, yüklendi 392 ms, çözüldü 433 ms
- **kart-secim**
  - `/assets/avatars/busts/p3-amber-bust-v1.webp` 5 KB: DOM'a girdi -20 ms, istek 419 ms, yüklendi 509 ms, çözüldü 981 ms
  - `/assets/avatars/busts/p5-violet-bust-v1.webp` 5 KB: DOM'a girdi -20 ms, istek 428 ms, yüklendi 509 ms, çözüldü 981 ms
  - `/assets/worlds/lobi-portrait.webp` 70 KB: DOM'a girdi -20 ms, istek 142 ms, yüklendi 505 ms, çözüldü 981 ms
  - `/assets/cards/cift-puan.webp` 54 KB: DOM'a girdi -20 ms, istek 186 ms, yüklendi 505 ms, çözüldü 981 ms
  - `/assets/cards/cerceve-nadir.webp` 45 KB: DOM'a girdi -20 ms, istek 206 ms, yüklendi 505 ms, çözüldü 981 ms
  - `/assets/cards/celme.webp` 52 KB: DOM'a girdi -20 ms, istek 169 ms, yüklendi 450 ms, çözüldü 505 ms
- **tv-final**
  - `/assets/avatars/busts/p2-magenta-bust-v1.webp` 5 KB: DOM'a girdi 65 ms, istek 33 ms, yüklendi 65 ms, çözüldü 1241 ms
  - `/assets/avatars/busts/p1-cyan-bust-v1.webp` 5 KB: DOM'a girdi 65 ms, istek 38 ms, yüklendi 65 ms, çözüldü 1241 ms
  - `/assets/avatars/moods/p1-cyan-happy.webp` 35 KB: DOM'a girdi 20 ms, istek 39 ms, yüklendi 58 ms, çözüldü 1241 ms
  - `/assets/avatars/busts/p3-amber-bust-v1.webp` 5 KB: DOM'a girdi 65 ms, istek 39 ms, yüklendi 65 ms, çözüldü 1241 ms
  - `/assets/avatars/moods/p3-amber-idle.webp` 23 KB: DOM'a girdi 20 ms, istek 40 ms, yüklendi 58 ms, çözüldü 1241 ms
  - `/assets/avatars/busts/p7-emerald-bust-v1.webp` 5 KB: DOM'a girdi 20 ms, istek 41 ms, yüklendi 62 ms, çözüldü 1241 ms
- **oyun-kule**
  - `/assets/worlds/kule-ustasi-portrait.webp` 76 KB: DOM'a girdi -26 ms, istek 193 ms, yüklendi 430 ms, çözüldü 441 ms
  - `/assets/avatars/busts/p2-magenta-bust-v1.webp` 5 KB: DOM'a girdi 372 ms, istek 122 ms, yüklendi 372 ms, çözüldü 400 ms
  - `/assets/avatars/busts/p1-cyan-bust-v1.webp` 5 KB: DOM'a girdi 372 ms, istek 118 ms, yüklendi 372 ms, çözüldü 400 ms
  - `/assets/avatars/busts/p3-amber-bust-v1.webp` 5 KB: DOM'a girdi 372 ms, istek 235 ms, yüklendi 372 ms, çözüldü 400 ms
  - `/assets/avatars/busts/p4-lime-bust-v1.webp` 5 KB: DOM'a girdi 372 ms, istek 143 ms, yüklendi 372 ms, çözüldü 400 ms
  - `/assets/avatars/busts/p5-violet-bust-v1.webp` 5 KB: DOM'a girdi 372 ms, istek 236 ms, yüklendi 372 ms, çözüldü 400 ms
- **oyun-kor-bomba**
  - `/assets/props/bomba/kivilcim.webp` 45 KB: DOM'a girdi 369 ms, istek 462 ms, yüklendi 1105 ms, çözüldü 1117 ms
  - `/assets/props/bomba/fitil.webp` 17 KB: DOM'a girdi 369 ms, istek 446 ms, yüklendi 1105 ms, çözüldü 1116 ms
  - `/assets/props/bomba/govde.webp` 26 KB: DOM'a girdi 369 ms, istek 437 ms, yüklendi 1105 ms, çözüldü 1115 ms
  - `/assets/avatars/busts/p1-cyan-bust-v1.webp` 5 KB: DOM'a girdi 369 ms, istek 192 ms, yüklendi 369 ms, çözüldü 394 ms
  - `/assets/avatars/busts/p2-magenta-bust-v1.webp` 5 KB: DOM'a girdi 369 ms, istek 179 ms, yüklendi 369 ms, çözüldü 394 ms
  - `/assets/avatars/busts/p3-amber-bust-v1.webp` 5 KB: DOM'a girdi 369 ms, istek 256 ms, yüklendi 369 ms, çözüldü 394 ms
- **oyun-zaman**
  - `/assets/worlds/zaman-bombasi-hafizasi-portrait.webp` 56 KB: DOM'a girdi -15 ms, istek 240 ms, yüklendi 1066 ms, çözüldü 1097 ms
  - `/assets/avatars/busts/p3-amber-bust-v1.webp` 5 KB: DOM'a girdi 371 ms, istek 250 ms, yüklendi 371 ms, çözüldü 416 ms
  - `/assets/avatars/busts/p4-lime-bust-v1.webp` 5 KB: DOM'a girdi 371 ms, istek 159 ms, yüklendi 371 ms, çözüldü 416 ms
  - `/assets/avatars/busts/p5-violet-bust-v1.webp` 5 KB: DOM'a girdi 371 ms, istek 256 ms, yüklendi 371 ms, çözüldü 416 ms
  - `/assets/avatars/busts/p1-cyan-bust-v1.webp` 5 KB: DOM'a girdi 371 ms, istek 127 ms, yüklendi 371 ms, çözüldü 416 ms
  - `/assets/avatars/busts/p2-magenta-bust-v1.webp` 5 KB: DOM'a girdi 371 ms, istek 149 ms, yüklendi 371 ms, çözüldü 415 ms
- **oyun-butona-bas**
  - `/assets/props/genel/arcade-dugme.webp` 21 KB: DOM'a girdi 353 ms, istek 400 ms, yüklendi 900 ms, çözüldü 910 ms
  - `/assets/props/genel/arcade-dugme-basili.webp` 21 KB: DOM'a girdi 353 ms, istek 445 ms, yüklendi 900 ms, çözüldü 910 ms
  - `/assets/worlds/butona-bas-portrait.webp` 60 KB: DOM'a girdi -17 ms, istek 208 ms, yüklendi 409 ms, çözüldü 426 ms
  - `/assets/avatars/busts/p2-magenta-bust-v1.webp` 5 KB: DOM'a girdi 353 ms, istek 122 ms, yüklendi 353 ms, çözüldü 392 ms
  - `/assets/avatars/busts/p3-amber-bust-v1.webp` 5 KB: DOM'a girdi 353 ms, istek 232 ms, yüklendi 353 ms, çözüldü 392 ms
  - `/assets/avatars/busts/p4-lime-bust-v1.webp` 5 KB: DOM'a girdi 353 ms, istek 160 ms, yüklendi 353 ms, çözüldü 392 ms
- **oyun-asiri**
  - `/assets/props/genel/enerji-cekirdegi-asiri.webp` 37 KB: DOM'a girdi 355 ms, istek 650 ms, yüklendi 839 ms, çözüldü 843 ms
  - `/assets/props/genel/enerji-cekirdegi.webp` 20 KB: DOM'a girdi 355 ms, istek 653 ms, yüklendi 784 ms, çözüldü 787 ms
  - `/assets/worlds/asiri-yukleme-portrait.webp` 70 KB: DOM'a girdi -17 ms, istek 205 ms, yüklendi 663 ms, çözüldü 698 ms
- **oyun-karalama**
  - `/assets/worlds/karalama-defteri-portrait.webp` 59 KB: DOM'a girdi -11 ms, istek 209 ms, yüklendi 808 ms, çözüldü 816 ms
