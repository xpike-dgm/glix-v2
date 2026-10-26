# Aşama 4 — Oyun dünyaları (53 arka plan)

Önce `/srv/glix/gorsel/OKU-BENI.md` içindeki talimat ve ortak kuralları uygula.
Kayıt: `/srv/glix/gorsel/gelen/asama-4/`, dosya adları aşağıda. Bitince `TAMAM`. Her görselden **tek** sürüm.

## Genel kurallar
- **Stil referansı her üretimde:** `referans/secilen/stil-arka-plan-zehirli-kadeh.png` (ışık, kontur, koyuluk, detay yoğunluğu bununla aynı).
- Yerleşim referansı: `referans/ekranlar/<oyun-id>.webp` — oyunun ekranında arayüzün nereye oturduğunu gösterir; **arayüzün bulunduğu orta-alt bölge sade ve koyu** kalmalı, ilgi noktası üst 1/3'te ve merkeze yakın (kenarlar kırpılacak).
- Dikey: modelin en büyük dikey oranı. Yatay: modelin en büyük yatay oranı. Aynı oyunun dikey ve yatay sürümü aynı sahne/ışık/palette olsun (yatayı dikeyden türet).
- Karakter, insan, yazı, tabela yazısı, rakam, logo yok. Sahne boş ve atmosferik olsun.
- Genel parlaklık düşük (zemin ~%60 karanlık); en parlak noktalar yalnız üst kısımda.

## Sahneler

Tarif kalıbı: "Same style as the reference. <sahne>, color palette <palet>, atmospheric, empty scene without people, calm dark empty area in the lower-middle part for game UI, focal point in the upper third near the center, no text."

| Oyun (id) | Dosyalar | <sahne> | <palet> |
|---|---|---|---|
| Açgözlülük Limiti (`acgozluluk-limiti`) | `4-acgozluluk-limiti-dikey.png`, `4-acgozluluk-limiti-yatay.png` | an overflowing neon vault of glowing coins, pressure gauges near the red line | amber and red |
| Aşırı Yükleme (`asiri-yukleme`) | `4-asiri-yukleme-dikey.png`, `4-asiri-yukleme-yatay.png` | a sci-fi reactor room, a huge glowing core in the distance, warning stripes | cyan and red |
| Bozuk Telefon (`bozuk-telefon`) | `4-bozuk-telefon-dikey.png`, `4-bozuk-telefon-yatay.png` | a messy art studio, easels, paint splashes, a tangled old phone cord across the scene | magenta and amber |
| Butona Bas (`butona-bas`) | `4-butona-bas-dikey.png`, `4-butona-bas-yatay.png` | a retro arcade hall, rows of arcade cabinets glowing in the dark | red and cyan |
| Çağrışım Ağı (`cagrisim-agi`) | `4-cagrisim-agi-dikey.png`, `4-cagrisim-agi-yatay.png` | a vast dark space with a glowing web of connected nodes like constellations | cyan and violet |
| Çapraz Ateş (`capraz-ates`) | `4-capraz-ates-dikey.png`, `4-capraz-ates-yatay.png` | a neon shooting gallery, crossing laser beams in fog | magenta and cyan |
| Çizgiyi Geçme (`cizgiyi-gecme`) | `4-cizgiyi-gecme-dikey.png`, `4-cizgiyi-gecme-yatay.png` | a neon race track finish area with a glowing line across the ground | lime and cyan |
| Gizli Alışveriş (`gizli-alisveris`) | `4-gizli-alisveris-dikey.png`, `4-gizli-alisveris-yatay.png` | a neon night market with shelves and hanging signs (no readable text) | magenta and amber |
| Gizli Hırsız (`gizli-hirsiz`) | `4-gizli-hirsiz-dikey.png`, `4-gizli-hirsiz-yatay.png` | a dark bank vault corridor with laser tripwires | red and cyan |
| Gizli Kareler (`gizli-kareler`) | `4-gizli-kareler-dikey.png`, `4-gizli-kareler-yatay.png` | a dark floor of glowing hexagon/square tiles, some faintly lit | cyan and violet |
| İttifak (`ittifak`) | `4-ittifak-dikey.png`, `4-ittifak-yatay.png` | a secret round meeting table in candle and neon light, chairs around | amber and violet |
| Kara Borsa (`kara-borsa`) | `4-kara-borsa-dikey.png`, `4-kara-borsa-yatay.png` | a foggy underground black market, stalls, crates, dim amber lamps | amber and black |
| Karalama Defteri (`karalama-defteri`) | `4-karalama-defteri-dikey.png`, `4-karalama-defteri-yatay.png` | a cozy sketchbook desk at night, pencils, paper sheets, desk lamp glow | amber and cyan |
| Kendim (`kendim`) | `4-kendim-dikey.png`, `4-kendim-yatay.png` | a hall of mirrors with soft neon reflections | violet and magenta |
| Kontrol Paneli Kaosu (`kontrol-paneli-kaosu`) | `4-kontrol-paneli-kaosu-dikey.png`, `4-kontrol-paneli-kaosu-yatay.png` | a spaceship control room with blinking panels and cables | cyan and red |
| Kör Bomba (yatay öncelikli) (`kor-bomba`) | `4-kor-bomba-dikey.png`, `4-kor-bomba-yatay.png` | a bomb-disposal bunker, warning lights, sandbags | red and amber |
| Kör Kronometre (`kor-kronometre`) | `4-kor-kronometre-dikey.png`, `4-kor-kronometre-yatay.png` | a dark room full of floating clock gears, time distortion | cyan and violet |
| Laf Sokma Düellosu (`laf-sokma`) | `4-laf-sokma-dikey.png`, `4-laf-sokma-yatay.png` | a stand-up comedy stage with spotlight and two microphone stands | amber and magenta |
| Ortalamaya En Yakın (`ortalamanin-yarisi`) | `4-ortalamanin-yarisi-dikey.png`, `4-ortalamanin-yarisi-yatay.png` | a futuristic stock exchange board glowing with abstract graphs (no numbers) | lime and cyan |
| Rus Ruleti (`rus-ruleti`) | `4-rus-ruleti-dikey.png`, `4-rus-ruleti-yatay.png` | a smoky underground casino with a round table under a single lamp | red and violet |
| Rüşvet ve Darbe (`rusvet-darbe`) | `4-rusvet-darbe-dikey.png`, `4-rusvet-darbe-yatay.png` | a marble palace hall with a throne on stairs, red banners (no symbols/text) | amber and red |
| Sızma (`sizma`) | `4-sizma-dikey.png`, `4-sizma-yatay.png` | a spy headquarters with screens and silhouettes behind frosted glass | cyan and lime |
| Son Kişi (`son-kisi`) | `4-son-kisi-dikey.png`, `4-son-kisi-yatay.png` | a long neon corridor with an exit door at the end, red alarm light | red and cyan |
| Sözlük Blöfü (`sozluk-blofu`) | `4-sozluk-blofu-dikey.png`, `4-sozluk-blofu-yatay.png` | an ancient library with floating glowing books | amber and violet |
| Yazı Yaz (`yazi-yaz`) | `4-yazi-yaz-dikey.png`, `4-yazi-yaz-yatay.png` | a dark room with two glowing vintage typewriters on desks | lime and amber |
| Zaman Bombası Hafızası (`zaman-bombasi-hafizasi`) | `4-zaman-bombasi-hafizasi-dikey.png`, `4-zaman-bombasi-hafizasi-yatay.png` | a memory-game panel with four big colored pads glowing, alarm light | red, blue, green and yellow |
| Zehirli Kadeh (`zehirli-kadeh`) | `4-zehirli-kadeh-yatay.png` (dikey zaten seçildi: `referans/secilen/stil-arka-plan-zehirli-kadeh.png`; yatayı ondan türet) | royal banquet hall, same as the reference | violet and lime |

Toplam: **53 görsel**.

Not: Kör Bomba yatay oynanır; önce yatayı üret, dikey sürüm yalnız anlatım/geçiş ekranları için.
