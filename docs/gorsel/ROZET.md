# Rozet madalyonları (16 görsel)

Önce `/srv/glix/gorsel/OKU-BENI.md` içindeki talimat ve ortak kuralları uygula.
Kayıt: `/srv/glix/gorsel/gelen/rozet/` (tam olarak aşağıdaki dosya adlarıyla). Bitince `TAMAM` bırak.

## Ne bunlar?
Oyuncu profilinde ve maç sonunda "Yeni rozet!" kartında görünen başarım madalyonları. Telefonda küçük (64–96 px)
gösterilir; büyük kartta 160 px'e kadar. **Küçükte de tek bakışta okunmalı**: tek net simge, kalın kenar, az detay.

## Ortak stil (16'sında da aynı)
- **Saydam arka plan** (PNG, alfa kanallı). Madalyonun dışında hiçbir şey yok: zemin, gölge düzlemi, sahne yok.
- 1024×1024, madalyon ortada, kenarlarda ~6% boşluk.
- GLIX dünyasının neon stili: koyu lacivert/mor madalyon gövdesi, parlak neon kenar halkası, içte tek büyük simge,
  hafif iç parıltı. Referans: `referans/secilen/stil-arka-plan-zehirli-kadeh.png`, `gelen/asama-5/5.1-kart-*.png`,
  `gelen/logo/` (neon dil). Karakter gerekiyorsa `gelen/asama-2/` avatarları gibi **yüzsüz, neon maskeli**.
- **Yazı, harf, logo yok.** Rakam yalnız aşağıda açıkça istenen yerde ve büyük, kalın, tek başına.
- Renk körleri için her **aile kendi dış şeklini** taşır (renk tek ipucu değil):

| Aile | Dış şekil | Ana neon renk |
|---|---|---|
| Maç sayısı | Daire | Camgöbeği |
| Galibiyet | Altıgen | Altın / amber |
| Özel başarı | Yuvarlatılmış kare | Macenta |
| Gizli | Elmas (45° kare) | Mor |

- Aynı ailede kademe artıkça madalyon zenginleşir (ek halka, kanatçık, yıldız), ama şekil aynı kalır.

## Dosyalar
| Dosya | Rozet | Aile | İçteki simge |
|---|---|---|---|
| `ilk-mac.png` | İlk Adım — ilk maçını bitir | Daire, kademe 1 (sade) | Tek ayak izi / ilk adım |
| `on-mac.png` | Alışıyorum — 10 maç | Daire, kademe 2 | Büyük "10" |
| `elli-mac.png` | Müdavim — 50 maç | Daire, kademe 3 (ek halka) | Büyük "50" |
| `yuz-mac.png` | Efsane Oyuncu — 100 maç | Daire, kademe 4 (kanatçıklı, en gösterişli) | Büyük "100" |
| `ilk-galibiyet.png` | İlk Zafer — bir maçı birinci bitir | Altıgen, kademe 1 | Tek yıldız |
| `on-galibiyet.png` | Kazanmayı Biliyor — 10 galibiyet | Altıgen, kademe 2 | Defne dalı içinde yıldız |
| `yirmibes-galibiyet.png` | Şampiyon — 25 galibiyet | Altıgen, kademe 3 (en gösterişli) | Taç |
| `cok-yonlu.png` | Çok Yönlü — 10 farklı oyunda birinci ol | Yuvarlatılmış kare | Yelpaze gibi açılmış birkaç kart |
| `kalabalik-sampiyonu.png` | Kalabalığın Şampiyonu — 8 kişilik maçı kazan | Yuvarlatılmış kare | Önde tek kupa, arkasında 7 küçük avatar silueti |
| `can-dost.png` | Can Dost — aynı arkadaşla 10 maç | Yuvarlatılmış kare | İki avatar elini çakıyor (high-five) |
| `seri.png` | Seri Galip — üst üste 3 galibiyet | Yuvarlatılmış kare | Üç alev / üç ok art arda |
| `kahin-on.png` | Büyük Kâhin — Rus Ruleti'nde 10 kez Kâhin | Yuvarlatılmış kare | Tek açık göz, altında tabanca tamburu silüeti (şiddet yok, sadece tambur) |
| `kule-ustasi.png` | Kule Ustası — tek oyunda 3 kusursuz | Yuvarlatılmış kare | Kule Ustası'ndaki neon cam bloklardan 3 katlı kusursuz kule (`gelen/kule/` stili) |
| `gece-kusu.png` | Gece Kuşu — gece 02–05 arası maç bitir (gizli) | Elmas | Hilal ay ve baykuş silüeti |
| `hepsi-bir-arada.png` | Hepsi Bir Arada — her oyunu oyna (gizli) | Elmas | Dört parçalı yapboz, parçalar birleşmiş |
| `kilitli.png` | Henüz kazanılmamış gizli rozet | Elmas | Soru işareti — **soluk, gri-mor**, kenar neonu sönük |

## Kayıt
Dosya yazma aracında `encoding: base64` kullan; her dosyanın gerçekten **saydam arka planlı PNG** olduğunu ve
1024×1024 olduğunu kontrol et. Yalnız `/srv/glix/gorsel/gelen/rozet/` klasörüne yaz; başka yere dokunma, paket kurma.
