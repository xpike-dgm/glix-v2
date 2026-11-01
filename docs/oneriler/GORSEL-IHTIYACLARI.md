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

## Çağrışım Ağı

Ortak stil: oyunun mevcut görselleriyle uyumlu (`apps/client/public/assets/worlds/cagrisim-agi-*.webp`: koyu
mor-lacivert uzay/şehir zemini, neon camgöbeği #2ef2ff, macenta #ff2bd6, lime #b6ff3b vurgu, elektrikli küre ve şimşek
çizgileri). Önerilen yer `apps/client/public/assets/props/cagrisim-agi/<ad>.webp`. Görseller gelene kadar ekran
CSS/SVG karşılığını çizer; dosyalar gelince ekrana bağlanması küçük bir kod işidir (Sözlük Blöfü'ndeki
`__SOZLUK_PROPS__` düzeni gibi).

- **CG-U5 · neon düğüm parıltısı** — `apps/client/public/assets/props/cagrisim-agi/dugum.webp` · 1:1, 256×256 ·
  şeffaf arka plan · Ağ düğümünün arkasındaki yuvarlak neon ışıma: ortası beyaza yakın parlak çekirdek, dışa doğru
  camgöbeği (#2ef2ff) halka ve yumuşak sönen hale, çevresinde 4–6 ince kıvılcım çatalı; koyu zeminde `screen` karışımıyla
  parlayacak (renk koddan tonlanacağı için tek renk/beyaz ağırlıklı olabilir). Yazı YOK. · Geçici: CSS kenarlık +
  `box-shadow` parıltılı kutu (`.cgring__node`).
- **CG-U5 · kısa elektrik patlaması** — `apps/client/public/assets/props/cagrisim-agi/patlama.webp` · 1:1, 512×512 ·
  şeffaf arka plan · En büyük ağ bağlanınca kürenin çevresinde bir kez açılan elektrik patlaması: merkezden dışa
  yayılan dallı şimşekler (camgöbeği + lime #b6ff3b), ortada beyaz flaş, kenarlara doğru saydamlaşan; tek kare (kod
  ölçekleyip söndürür) ya da yatay 6 karelik sprite (3072×512). · Geçici: radyal + konik CSS degradesi, 0,9 sn büyüyüp
  sönme (`.cgring__burst`).
- **CG-U7 · koyun simgesi** — `apps/client/public/assets/props/cagrisim-agi/koyun.webp` · 1:1, 128×128 · şeffaf arka
  plan · "KARA KOYUN" damgasındaki küçük, sevimli koyun: yuvarlak beyaz-lavanta yün bulutu, koyu mor yüz ve bacaklar,
  hafif neon mor (#8b5cff) kenar ışığı; alaycı değil sevimli; 18–22 px'te okunacak sade siluet. · Geçici: SVG koyun
  (`SheepIcon`, `apps/client/src/games/cagrisim-agi/Reveal.tsx`).
- **ses** (dosya gerekmedi) — CG-U5 ve CG-U13 sesleri (gönderme "zap", başkası gönderince hafif çıtırtı, son 5 sn küre
  uğultusu, kart çevirme tıkı, ağ bağlanma "vınnn" (ağ büyüdükçe perde yükselir), tek kalan sönme "fzz", en büyük ağda
  çıtırtılı patlama, kelime geçişinde küre sönüp yanma) mevcut ses sistemiyle üretildi
  (`apps/client/src/games/cagrisim-agi/sounds.ts`). İstenirse Ses alanı gerçek kayıtlarla değiştirebilir (elektrik ve
  neon kimliği).
