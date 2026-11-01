# 15 oyun uygulaması — görsel ihtiyaçları

Oyunlar uygulanırken gereken yeni görseller burada toplanır. Hepsi bittiğinde sahip ChatGPT ile üretir (CLAUDE.md
görsel akışı: VDS görev dosyası + tek istem), yönetici ekler. Görsel gelene kadar oyun mevcut varlıklarla ya da
CSS ile çalışır; hiçbir madde görsele bağlı olarak bozuk kalmaz.

Her satır: oyun · madde · dosya adı ve yeri · boyut/oran · şeffaflık · tarif · geçici çözüm.

## Sözlük Blöfü

Ortak stil: oyunun mevcut görselleriyle uyumlu (koyu mor-lacivert gotik kütüphane arka planı, neon amber/macenta/lime
vurgu, eski kâğıt ve mürekkep). Dosyalar `apps/client/public/assets/props/sozluk-blofu/<ad>.webp` olarak konunca kod
değişmeden kullanılır (derlemede `__SOZLUK_PROPS__` listesi); yokken ekran CSS/SVG karşılığını çizer ve dosyayı istemez.

- **SB-U1 · sözlük sayfası dokusu** — `apps/client/public/assets/props/sozluk-blofu/sayfa.webp` · 3:4 dikey, 900×1200
  (kart gibi kırpılır, `cover`) · şeffaf değil (opak) · Açık bir eski sözlüğün sağ sayfası: hafif sararmış krem kâğıt
  (#f3e6c8 → #d9bf8a kenarlara doğru), ince lif dokusu, sol kenarda cilt gölgesi, sağ kenarda kırmızı-kahve deri harf
  sekmesi izi; yazı alanının okunması için ortası düz ve sakin, metin/harf YOK, çizgi YOK (satır çizgilerini kod çizer).
  · Geçici: CSS degrade kâğıt + cilt gölgesi + kod çizgili satırlar, harf sekmesi CSS.
- **SB-U5 · "SÖZLÜKTE" mührü** — `apps/client/public/assets/props/sozluk-blofu/muhur.webp` · 1:1, 256×256 · şeffaf
  arka plan · Yuvarlak lastik/mum mühür damgası: dış çift halka, içinde kavisli "SÖZLÜKTE" yazısı ve ortada küçük açık
  kitap simgesi; lime-yeşil (#b6ff3b) mürekkep, kenarlarda hafif mürekkep taşması ve damga dokusu (eksik basılmış yerler),
  hafif −12° eğik. · Geçici: SVG çift halka + tik, "SÖZLÜKTE" yazısı CSS.
- **SB-U5 · mürekkep sıçraması** — `apps/client/public/assets/props/sozluk-blofu/murekkep.webp` · 2:1 yatay, 800×400 ·
  şeffaf arka plan · Kartın arkasından yayılan mavi (#2e78ff) ve amber (#ffc23b) mürekkep lekesi/sıçraması, sağ üstten
  sola doğru dağılan damlacıklar; koyu zeminde `screen` karışımıyla parlayacak, merkezi saydamlaşan. · Geçici: iki
  radyal CSS degradesi, dairesel açılma animasyonu.
- **SB-U8 · altın tüy kalem rozeti** — `apps/client/public/assets/props/sozluk-blofu/tuy-kalem.webp` · 1:1, 128×128 ·
  şeffaf arka plan · "BLÖF USTASI" damgasının yanındaki küçük altın tüy kalem: çapraz duran parlak altın tüy, ucunda
  mürekkep damlası, hafif neon amber parıltı; 20 px'te de okunacak sade siluet. · Geçici: tek renkli SVG tüy kalem.
- **ses** (dosya gerekmedi) — SB-U5 ve SB-U15 sesleri (kart çevirme, kısa davul, mühür vuruşu, tüy kalem çizgisi, sayfa
  kapanma, deste karıştırma, kâğıt dokunuşu, "boing", kısa fanfar) mevcut ses sistemiyle üretildi
  (`apps/client/src/games/sozluk-blofu/sounds.ts`). İstenirse Ses alanı gerçek kayıtlarla değiştirebilir (kâğıt,
  mürekkep, tahta masa kimliği).
