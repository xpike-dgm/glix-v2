# GLIX v2 — Tasarım Yönü

> Hedef: Telefonda açılan bir **konsol oyunu** hissi. Web sitesi, dashboard veya form hissi yok.
> Her ekranda oyuncunun yapacağı **tek ana eylem** ilk bakışta belli.

## 1. İlkeler

1. **Sahne, kart değil.** Ekranlar tam ekran sahnelerdir (100dvh). Kutu içinde kutu, gölgeli panel yığını yok.
   Bilgi doğrudan sahnenin üstünde, büyük ve az.
2. **Başparmak bölgesi.** Ana eylem butonu ekranın alt üçte birinde, en az 64 px yüksek, tam genişliğe yakın.
   İkincil eylemler küçük ve sakin.
3. **Az kelime.** Bir ekranda en fazla 1 başlık + 1 kısa açıklama. Türkçe, samimi, emir kipi kısa cümleler.
   Teknik kelime yok (bağlantı, sunucu, protokol, sürüm, hata kodu…).
4. **Her dokunuşa cevap.** Basınca 80 ms içinde görsel tepki (ölçek 0.96 + parlama), destekleniyorsa
   10 ms titreşim, kısa ses. Bekleme varsa iskelet/animasyon, asla donuk ekran.
5. **Hareket anlam taşır.** Ekran geçişleri 220–320 ms, `cubic-bezier(.2,.8,.2,1)`. Yeni gelen öğe aşağıdan
   12 px kayarak belirir. Sürekli dönen/parlayan dekor yok; arka plan hareketi yavaş ve ucuz.
   `prefers-reduced-motion`'da hareketler kaybolur, geçişler anlık olur.
6. **Kimlik = karakter.** Oyuncular her yerde kendi avatar karakteri ve rengiyle görünür
   (`public/assets/avatars/busts/p{1-8}-*.webp`, simge: `hud-pips/p{1-8}-*.svg`).

## 2. Görsel dil

### Renk değişkenleri (CSS custom properties)

| token | değer | kullanım |
|---|---|---|
| `--bg-0` | `#05081A` | en arka |
| `--bg-1` | `#0A1030` | sahne zemini (radyal gradyanın merkezi) |
| `--bg-2` | `#121A45` | yükseltilmiş yüzey (çok az kullan) |
| `--line` | `rgba(140,160,255,.14)` | ince ayırıcı |
| `--text` | `#F3F5FF` | ana metin |
| `--text-dim` | `#8E97C7` | ikincil metin |
| `--cyan` | `#2EF2FF` | birincil vurgu, ana buton |
| `--magenta` | `#FF2BD6` | ikincil vurgu |
| `--lime` | `#B6FF3B` | başarı, +puan |
| `--violet` | `#8B5CFF` | dekor |
| `--amber` | `#FFC23B` | uyarı, host tacı |
| `--red` | `#FF3B5C` | hata, −puan, Butona Bas butonu |

Oyuncu renkleri (avatar sırası): cyan `#2EF2FF`, magenta `#FF2BD6`, amber `#FFC23B`, lime `#B6FF3B`,
violet `#8B5CFF`, orange `#FF8A3B`, emerald `#2BFFA8`, cobalt `#3B7BFF`.

Neon etkisi = 1 renkli `box-shadow`/`text-shadow` (en fazla 2 katman). `backdrop-filter: blur` kullanılmaz.

### Tipografi

- Başlık: **Unbounded** 700/800 (Türkçe karakter tam). Oda kodu, oyun adı, geri sayım, skor.
- Metin: **Inter** (variable) 400/600.
- Fontlar `@fontsource` paketleriyle yerelden gelir (çevrimdışı/PWA, harici istek yok), yalnız `latin` + `latin-ext`.
- Ölçek: 13 / 15 / 18 / 24 / 32 / 48 / 72 px. Gövde 16 px altına inmez (13 yalnız etiket).
- Rakamlar `font-variant-numeric: tabular-nums`.

### Boşluk ve şekil

- 4 px ızgara: 4 / 8 / 12 / 16 / 24 / 32 / 48.
- Köşe: buton 18 px, küçük öğe 12 px, avatar çerçevesi tam yuvarlak ya da altıgen maske.
- Kenar boşluğu 20 px + `env(safe-area-inset-*)`.

### Bileşenler

- **PrimaryButton:** 64 px, tam genişlik (max 420), Unbounded 18 px büyük harf, cyan dolgu + koyu metin,
  altta 4 px daha koyu "kalınlık" kenarı (arcade tuşu hissi), basınca 3 px aşağı iner ve kenar kaybolur.
  Devre dışıyken soluk ve altında küçük gerekçe metni ("En az 2 oyuncu gerekli").
- **GhostButton:** şeffaf, ince çerçeve, ikincil eylemler.
- **Avatar:** büst görseli + renk halkası; durum rozetleri: host tacı (amber), hazır tik (lime),
  bağlantısı kopuk (gri ve %40 opak, "bekleniyor" kıpırtısı).
- **BottomSheet:** alttan kayan sayfa (takma ad girişi, oyuncu çıkarma onayı). Arka plan kararır.
- **Toast:** üstte kısa bildirim, 2,5 sn.

## 3. Ekranlar

### Ana sayfa
- Arka plan: Pixi ile yavaş akan neon partiküller + hafif ızgara ufku (30 fps sınırı, sekme gizliyken durur).
- Ortada büyük **GLIX** wordmark (Unbounded 800, cyan→magenta gradyan, ince neon gölge), altında tek satır:
  "Arkadaşlarınla telefondan parti oyunu".
- Altta iki buton: **ODA KUR** (Primary), **ODAYA KATIL** (Ghost, aynı boy).
- Takma ad ilk kez gerekince BottomSheet'te sorulur ve hatırlanır (`localStorage`); sonra sağ üstte
  küçük avatar + ad, dokununca değiştirilebilir.
- "Nasıl oynanır?" küçük bağlantı → BottomSheet, 3 madde, kapatılabilir.

### Odaya katıl
- 5 büyük harf kutusu (Unbounded 32 px), otomatik büyük harf, yapıştırma desteği, eksik/yanlışta kutular
  kırmızı titrer. `?oda=KOD` bağlantısıyla gelince kod dolu gelir.

### Lobi
- Üstte oda kodu çok büyük (Unbounded 48 px, harf aralıklı) ve yanında **Paylaş** (Web Share API;
  yoksa bağlantıyı kopyala + toast "Bağlantı kopyalandı").
- Ortada oyuncular: 2 sütunlu ızgara, her oyuncu büyük avatar + ad; boş koltuklar soluk "+" silüeti
  (8'e kadar). Kendin "Sen" etiketiyle.
- Host bir oyuncuya dokununca BottomSheet: "{ad} odadan çıkarılsın mı?" → **ÇIKAR** (kırmızı) / Vazgeç.
- **Minigame Seçimi**: varsayılan kapalı akordeon. Açılınca oyun kartları (ad + 2–8 oyuncu etiketi),
  seçili olanlar cyan çerçeve. Host olmayan yalnız görür.
- Altta sabit: host için **BAŞLAT** (Primary), diğerleri için "Oyunu host başlatacak" sakin metni.

### Anlatım (briefing) — tam ekran
- Üstte küçük "OYUN 1 / 3", ortada oyun adı (Unbounded 32–40 px).
- Bir cümle amaç; altında en fazla 3 madde, her biri numaralı büyük nokta ile.
- Oyuna özel küçük canlı görsel örnek (Butona Bas: nabız atan kırmızı buton ikonu).
- Altta **HAZIRIM** (Primary). Basınca butona tik gelir, "Diğerleri bekleniyor" ve avatar şeridinde
  hazır olanlar lime halkayla yanar.

### Geri sayım
- Tam ekran 3 · 2 · 1 (Unbounded 120 px), her rakam ölçek 1.4→1 ile düşer, kısa tık sesi.

### Butona Bas — oyun
- Ekranın %55'i dev kırmızı arcade butonu (CSS/SVG ya da Pixi): kalın metal halka, iç parlama,
  basınca 6 px gömülme + beyaz halka dalgası (300 ms, pencere uzunluğu).
- Üstte ince süre çubuğu (45 sn azalır) ve büyük kendi skorun.
- Altta avatar şeridi: bir penceredeki basanlar aynı anda yanar. Eşleşme → basanlar lime parlar,
  ekranda "+1" lime yükselir; tek kalırsan buton kırmızı sarsılır, "−1" düşer.
- Teknik ayrıntı yok: milisaniye, pencere numarası gösterilmez.

### Sonuç
- Oyun sonu: mini oyun puanlarıyla sıralama; ilk 3 avatar büyük ve kademeli (podyum hissi),
  genel skora eklenen puan "+2" rozetiyle sayarak artar.
- 30 sn sonra (herkes "Devam" derse hemen) otomatik sonraki oyuna/final'e geçer; süre ince çubukla görünür.

### Final
- Kazanan büyük avatar + Pixi konfeti (2 sn, sonra durur). Tam sıralama altta.
- Host için **LOBİYE DÖN**, diğerleri için bekleme metni.

### Bağlantı koptuğunda
- Yarı saydam tam ekran örtü: dönen GLIX halkası + "Tekrar bağlanıyor…". Dönünce kendiliğinden kalkar.
- Oda bulunamazsa nazik mesaj ve **ANA SAYFA** butonu.

## 4. Ses

WebAudio ile kod içinde üretilen kısa sesler (dosya yok): dokunma "tık", eşleşme yükselen iki nota,
tek kalma alçalan "bzzt", geri sayım bip, sonuç fanfarı. Sağ üstte ses aç/kapat; tercih hatırlanır.

## 5. Kabul ölçütleri

- 320×568, 390×844, 430×932 dikeyde taşma ve kaydırma yok (lobi oyuncu listesi hariç).
- Yatay telefonda içerik ortada en fazla 480 px sütun, arka plan tüm ekranı doldurur.
- İlk yükleme (gzip) ana JS < 120 kB; Pixi yalnız gerektiğinde yüklenir.
- Tüm dokunma hedefleri ≥ 48 px. Kontrast metin için ≥ 4.5:1.

## 6. Oyun çerçevesi, izleyici, ses (A3)

- **GameFrame** (`ui/GameFrame.tsx`): oyun yönünü `MatchSnapshot.orientation` belirler. Dikey oyun: en çok 480 px
  ortalı sütun, sol üstte çık düğmesi. Yatay oyun: sahne tüm alanı (güvenli alanlar hariç) doldurur; solda 104 px'lik
  yan şerit (çık, dikey süre çubuğu, kendi puanın, avatarlar+puan, ses) sahneye binmez. Telefon dikeyse tam ekran
  "Telefonunu yan çevir" örtüsü çıkar (atlama yok; çık/ses düğmeleri örtünün köşelerinde çalışır). Mümkünse
  `screen.orientation.lock("landscape")` denenir. Yatay oyunlar kayıt defterinde `hud(match, selfId)` ile şerit
  verisini verir. Geliştirmede `?mock=landscape` yer tutucu "Neon Masa" sahnesini açar.
- **İzleyici** (`participants` içinde değilsen): üstte "İzliyorsun — sonraki oyuna katılacaksın" şeridi, oyun
  `inert` (dokunulmaz, hafif soluk), anlatımda HAZIRIM yerine "Bu turu izleyeceksin". Oyun ekranları
  `GameScreenProps.spectator` ile kendi eylemlerini gizleyebilir.
- **Ses** tek ana ses düzeyi (`setVolume`, kalıcı) ve kalıcı sessiz tercihiyle; bağlam ilk dokunuşta açılır.
  Olaylar: dokunma, hazırım, geri sayım tıkı, başla, eşleşme (+), tek kalma (−), tur sonucu, final, hata.
  Titreşim aynı olaylara eşlenir; `prefers-reduced-motion`'da süreler yarıya iner.
- **Denetim:** `pnpm ui:check` her ekranı 5 telefon boyutunda gezer (taşma, kırpılan metin, >= 48 px hedef,
  üst üste binme, kontrast, konsol hatası); görüntüler `docs/qa/a3/`. Büyük yazıda (>= 24 px) kontrast 3:1.
  Üç kip (denetimler aynı, yalnız kapsam değişir): `pnpm ui:check` tam (her ekran, 5 boyut; dağıtım öncesi/CI);
  `pnpm ui:check:hizli` her ekran yalnız 320x568 ve 667x375'te; `pnpm ui:check:degisen [taban]` yalnız
  `git diff taban...HEAD` + commitlenmemiş değişikliklerin etkilediği ekranlar, hızlı boyutlarda (`--tum-boyut` ile 5).
  Dosya→ekran eşlemesi `scripts/ui-check-degisen.mjs` başındaki tablodadır; ortak dosyalar (styles/ui/fx/net, App.tsx,
  `public/assets`) ve bilinmeyenler küçük bir duman kümesine düşer. `UI_WORKERS` işçi sayısı (varsayılan min(4, çekirdek));
  `--liste` koşmadan seçimi yazar. Uygulama dev'de `<html data-ready>` işaretler; betik sabit bekleme yerine onu bekler.
