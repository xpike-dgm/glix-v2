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

## Karalama Defteri

Ortak stil: oyunun mevcut görselleriyle uyumlu (`apps/client/public/assets/worlds/karalama-defteri-*.webp`: gece
atölyesi; koyu lacivert masa, sarı masa lambası, kalemlikler, sarmaşık; çizimler koyu tahtada kalın neon kalem: camgöbeği
#2ef2ff, macenta #ff2bd6, amber #ffc23b, lime #b6ff3b). Yer `apps/client/public/assets/props/karalama-defteri/<ad>.webp`.
Dosya yokken ekran CSS/SVG karşılığını çizer ve dosyayı hiç istemez; dosya konunca kod değişmeden kullanılır
(`__KARALAMA_PROPS__`, `karalamaProp()` — Sözlük Blöfü düzeni).

- **KD-U1 · defter sayfası kart arkası** — `apps/client/public/assets/props/karalama-defteri/kart-arka.webp` · 3:4,
  768×1024 · şeffaf DEĞİL (köşeleri kod yuvarlar) · Gizli kelime kartının arka yüzü: hafif sararmış, çizgili okul
  defteri sayfası; solda kırmızı kenar çizgisi, üstte spiral delikleri, köşede küçük kurşun kalem karalaması ve bir
  kahve lekesi; sayfanın ortası sade kalmalı (üstüne "Kelimeni görmek için basılı tut" yazısı kodla yazılır). Gece
  atölyesi ışığında hafif sıcak ton. Yazı YOK. İki rolde aynı görsel kullanılır. · Geçici: CSS çizgili kâğıt
  (`.kdcard__back`; repeating-linear-gradient + kırmızı kenar çizgisi).
- **KD-U5 · ışık izi parçacığı** — `apps/client/public/assets/props/karalama-defteri/isik-izi.webp` · 4:1, 512×128 ·
  şeffaf · Oy verenin çiziminden seçtiği çizime kıvrılan ışık izinin ucu/dokusu: soldan sağa incelen camgöbeği neon
  kuyruk, uçta beyaza yakın parlak çekirdek ve 3–4 minik kıvılcım; koyu zeminde `screen` ile parlayacak. Yazı YOK. ·
  Geçici: SVG yol (`.kdop__trail`, camgöbeği çizgi + drop-shadow, stroke-dash animasyonu). Not: dosya geldiğinde yol
  boyunca doku olarak bağlanması küçük bir kod işidir (şu an yalnız varlığı işaretlenir).
- **KD-U5 · "YAKALANDI!" damgası** — `apps/client/public/assets/props/karalama-defteri/damga-yakalandi.webp` · 2:1,
  1024×512 · şeffaf · Sergi duvarına vurulan lastik damga: kalın çerçeveli, hafif eğik (−10°), mürekkebi yer yer
  atlamış "YAKALANDI!" yazısı, lime (#b6ff3b) mürekkep; kenarlarda mürekkep sıçraması. · Geçici: CSS damga
  (`.kdop__stamp b`, lime kenarlıklı eğik yazı).
- **KD-U5 · "KURTULDU!" damgası** — `apps/client/public/assets/props/karalama-defteri/damga-kurtuldu.webp` · 2:1,
  1024×512 · şeffaf · Aynı damga, amber (#ffc23b) mürekkep, "KURTULDU!" ve yanında küçük kaçan ayak izleri. · Geçici:
  CSS damga (amber).
- **KD-U3 · ahşap çerçeve** — `apps/client/public/assets/props/karalama-defteri/cerceve.webp` · 1:1, 512×512 · şeffaf
  ortası (çizim içinden görünür) · Sergi duvarına asılan ince ceviz ahşap çerçeve, üstte küçük pirinç askı halkası,
  köşelerde hafif aşınma. · Geçici: CSS degrade kenarlık (`.kd__hangframe`) ve çizgili örtü (`.kd__veil`). Not: bu
  dosya geldiğinde çerçeveye bağlanması küçük bir kod işidir.
- **maske** (yeni görsel gerekmedi) — KD-U5 maske düşüşü Sızma'nın maske görselini kullanır
  (`apps/client/public/assets/props/sizma/maske.webp`; yoksa Sızma'nın SVG maskesi).
- **ses** (dosya gerekmedi) — KD-U5, KD-U7 ve KD-U13 sesleri (kalem cızırtısı yalnız çizende, silgi sürtme, geri al
  "fıs", temizle kâğıt buruşturma, Bitti defter kapanma + "tık", oy raptiye "çıt", Tamam çerçeve vuruşu, açılışta oy
  "vınn", davul, maske kırılma, damga, son şans saat tiki, doğruysa zil, yanlışsa "bzzt") mevcut ses sistemiyle üretildi
  (`apps/client/src/games/karalama-defteri/sounds.ts`). İstenirse Ses alanı gerçek kayıtlarla değiştirebilir (kâğıt,
  kurşun kalem, ahşap kimliği).

## Butona Bas

Ortak stil: oyunun mevcut görselleriyle uyumlu (`apps/client/public/assets/worlds/butona-bas-*.webp`: karanlık neon arcade
salonu, kırmızı-camgöbeği ışıklı oyun makineleri, ıslak yansımalı zemin; buton `genel/arcade-dugme*.webp`). Halkalar,
dolum halkası, eşleşme çizgileri, taç ve ✓ / ✕ işaretleri CSS/SVG ile çizildi; yeni görsel dosyası istenmez.

- **BB-U11 · TV arcade salonu zemini** (yeni görsel gerekmedi) — TV görünümü mevcut 16:9 manzara zeminini
  (`apps/client/public/assets/worlds/butona-bas-landscape.webp`, 1280×720) `cover` ile kullanır, ortası koyu radyal örtüyle
  karartılır. İstenirse ileride aynı sahnenin 1920×1080 keskin sürümü üretilebilir; şart değil.
- **ses** (dosya gerekmedi) — BB-U13 arcade ses seti (basış "KLAK" 3 varyasyon, eşleşmede kişi sayısıyla kalabalıklaşan
  akor, KALABALIK "tezahürat" vuruşu, tek basış "bzzzt", dolum bitti "çıt", tur başı gong, ara "vuuş", oyun sonu fanfar)
  ve BB-U6 son 3 saniye tıkları (son saniyede çift tık) mevcut ses sistemiyle kodla üretildi
  (`apps/client/src/games/butona-bas/sounds.ts`). Ses alanı istenirse gerçek kayıtlarla değiştirebilir: hepsi ≤ 0,4 sn
  (gong ve fanfar ≤ 2 sn); yalnız kendi basışına ve sonucuna çalar.

## Kör Kronometre

Ortak stil: oyunun mevcut görselleriyle uyumlu (`apps/client/public/assets/props/genel/kronometre.webp`: kalın siyah
konturlu, cel-shaded gümüş cep kronometresi, camgöbeği–macenta neon kenar ışığı, koyu lacivert cam; dünya zemini
`worlds/kor-kronometre-*.webp`: karanlık saat kulesi). Dosya `apps/client/public/assets/props/kor-kronometre/<ad>.webp`
olarak konunca kod değişmeden kullanılır (derlemede `__KRONOMETRE_PROPS__` listesi, `kronometreProp()` — Sözlük Blöfü
düzeni); yokken ekran CSS karşılığını çizer ve dosyayı hiç istemez. Zaman çizgisi, ibre, hedef çizgisi, ★ ● ○ işaretleri,
derece rozetleri, metal BAS düğmesi ve kilit plakası CSS/SVG ile çizildi.

- **KR-U2 · taçı basılı, camı donmuş kronometre** — `apps/client/public/assets/props/kor-kronometre/kronometre-donmus.webp` ·
  1:1, 384×384 (mevcut `genel/kronometre` ile **aynı kadraj, aynı ölçek ve konum**: üst üste konunca kenarlar örtüşmeli) ·
  şeffaf arka plan · Aynı gümüş cep kronometresi; tepedeki taç (kurma düğmesi) gövdeye **gömülmüş** (kısa görünür, altında
  gölge), iki yan düğme aynı; camın üstüne kenarlardan merkeze doğru yayılan **buz/kırağı dokusu** (beyaz–açık mavi
  #d8f4ff kristal dallar, kenarda yoğun, ortası yarı saydam ki koyu cam hâlâ seçilsin); neon kenar ışığı sönükleşmiş, buz
  mavisine dönmüş; yazı ve rakam YOK. · Geçici: aynı görsel `saturate/brightness` filtresi, taçın üstüne koyu degrade
  (`.kro-dial__crown`), camın üstüne konik + radyal CSS kırağı (`.kro-dial__frost`).
- **KR-U10 · TV zemini** (yeni görsel gerekmedi) — TV görünümü mevcut 16:9 zemini
  (`apps/client/public/assets/worlds/kor-kronometre-landscape.webp`, 1280×720) `cover` ile kullanır, ortası koyu radyal
  örtüyle karartılır (sayarken daha da kararır). İstenirse ileride aynı sahnenin 1920×1080 keskin sürümü üretilebilir.
- **ses** (dosya gerekmedi) — KR-M2 / KR-U5 / KR-U12 kronometre ses seti (BAŞLA derin gong, basış "klik" 2 varyasyon, ibre
  "vızz", avatar düşüşünde "tik" (oyuncu başına perde), hedef "ding", +2 zafer notası, TAM İSABET cam çanı, puan
  yükselen/alçalan kısa ses) mevcut ses sistemiyle kodla üretildi (`apps/client/src/games/kor-kronometre/sounds.ts`). Ses
  alanı istenirse gerçek kayıtlarla değiştirebilir: hepsi ≤ 0,4 sn (gong ≤ 1,5 sn). **Müzik yok:** sayma sırasında tam
  sessizlik kuraldır (müzik kaydında "Kör Kronometre: yok").

## Kör Bomba

Ortak stil: oyunun mevcut görselleriyle uyumlu (`apps/client/public/assets/props/bomba/*.webp`: kalın konturlu, cel-shaded
siyah-gümüş bomba gövdesi, camgöbeği neon çekirdek, fitil ve kıvılcım, patlama bulutu; dünya zemini
`worlds/kor-bomba-*.webp`: karanlık depo/kasa dairesi). Onaylanan paket (BM-U15 ve BM-M5 hayır) yeni görsel dosyası
gerektirmedi: koltuk simgeleri (fiş, geri ok + çarpı, parmak, bomba rozeti), pas zinciri, fitil çizgisi, şok dalgası,
patlama damgası, yolculuk şeridi ve ✓ / ✕ işaretleri CSS/SVG ile çizildi.

- **BM-U11 · TV masa zemini** (yeni görsel gerekmedi) — TV görünümü mevcut 16:9 zemini
  (`apps/client/public/assets/worlds/kor-bomba-landscape.webp`, 1280×720) `cover` ile kullanır, ortası koyu radyal örtüyle
  karartılır; masa elipsi CSS. İstenirse ileride aynı sahnenin 1920×1080 keskin sürümü üretilebilir; şart değil.
- **ses** (dosya gerekmedi) — BM-U5 / BM-U13 bomba ses seti mevcut ses sistemiyle kodla üretildi
  (`apps/client/src/games/kor-bomba/sounds.ts`): taşıyıcıda **sabit** fitil cızırtısı döngüsü (zamanla hızlanmaz, değişmez),
  pas atma "vuuş", bombayı alma tok "tak" + kıvılcım çıtırtısı, kilit bitiş "çıt", patlama (bas gümbürtü + cam/metal döküntü,
  ≤ 2 sn), kazanan bahis zili, kısık bahis "çıt". Ses alanı istenirse gerçek kayıtlarla değiştirebilir. Kural: **hiçbir ses
  süreye bağlı olamaz** (son saniyelerde hızlanan katman, tik ya da uyarı sesi yok; ek süre kıvılcımı sessiz). İsteğe bağlı
  müzik de temposu sabit olmalı.

## Rus Ruleti

Ortak stil: oyunun mevcut görselleriyle uyumlu (`apps/client/public/assets/props/rus-ruleti/tabanca.webp` ve `tambur.webp`:
kalın konturlu, cel-shaded gümüş-siyah oyuncak tabanca, camgöbeği #2ef2ff ve macenta #ff2bd6 neon şeritler; dünya zemini
`worlds/rus-ruleti-*.webp`: kırmızı-mor gotik yeraltı kumarhanesi, tek lamba altında yuvarlak masa). Dosya
`apps/client/public/assets/props/rus-ruleti/<ad>.webp` olarak konunca kod değişmeden kullanılır (derlemede `__RULET_PROPS__`
listesi, `ruletProp()` — Sözlük Blöfü düzeni); yokken ekran mevcut görseli kullanır ve dosyayı hiç istemez.

- **RR-U1 · üstten görünen neon tabanca** — `apps/client/public/assets/props/rus-ruleti/tabanca-ust.webp` · 1:1, 512×512 ·
  şeffaf arka plan · Mevcut `rus-ruleti/tabanca` ile aynı tabanca, bu kez **tam üstten (kuş bakışı)** görünür: namlu
  **tam yukarı** bakar (kod görseli namlu yukarıdayken 0° kabul edip hedefe döndürür), kabza aşağıda, tambur ortada daire
  olarak seçilir; aynı gümüş-siyah gövde, camgöbeği ve macenta neon şeritler, kalın kontur, hafif alt gölge (masaya yatmış
  gibi); kadrajın ortasında, kenarlarda ~%8 boşluk; yazı YOK. Masa ortasında ~100 px (TV'de ~170 px) gösterilir, 64 px'te
  de okunmalı. · Geçici: mevcut yandan tabanca (`tabanca.webp`) hedefe göre döndürülür (sağa bakarken aynalanır).
- **RR-U6 · namlu ateşi ve cam çatlağı** (yeni görsel gerekmedi) — Çapraz Ateş için üretilmiş
  `props/capraz-ates/namlu-atesi.webp` ve `props/capraz-ates/cam-catlagi.webp` kullanılır; kırmızı flaş, "ELENDİ" damgası,
  ✓ / ✕ işaretleri, kurukafa sayacı, kilit ve fiş simgeleri CSS/SVG ile çizildi.
- **RR-U18 · anlatım döngüsü** (yeni görsel gerekmedi) — %16 → %26 → %36 → BAM döngüsü CSS ile çizildi; mevcut anlatım
  görselleri (`briefing/rus-ruleti-*.webp`) aynen.
- **RR-U14 · TV zemini** (yeni görsel gerekmedi) — mevcut `worlds/rus-ruleti-landscape.webp` `cover` ile, ortası koyu radyal
  örtüyle.
- **ses** (dosya gerekmedi) — RR-U16 seti mevcut ses sistemiyle kodla üretildi (`apps/client/src/games/rus-ruleti/sounds.ts`):
  horoz çekme (silah sana geçince), tambur dönüşü (1,2 sn, yavaşlayan tıkırtı), kalp atışı (risk ≥ %56'da sert), kuru klik,
  derin BAM + cam çatlağı kuyruğu, el değiştirme "şak", son söz alçak notası, açılışta tok "bitti" vuruşu; son 5 sn tiki
  kabuk saatinden gelir. Ses alanı istenirse gerçek kayıtlarla değiştirebilir (olay adları `rus-ruleti.<an>`). ⭐ yıldız
  çınlaması RR-M2 reddedildiği için yok.

## Gizli Hırsız

Ortak stil: oyunun mevcut görselleriyle uyumlu (`apps/client/public/assets/props/genel/kasa-kapisi.webp`: kalın konturlu,
cel-shaded gümüş-siyah yuvarlak kasa kapısı, solda menteşeler, ortada tekerlek kol, camgöbeği #2ef2ff ve macenta #ff2bd6 neon
şeritler; dünya zemini `worlds/gizli-hirsiz-*.webp`: kırmızı lazerli karanlık kasa koridoru). Dosya
`apps/client/public/assets/props/gizli-hirsiz/<ad>.webp` olarak konunca kod değişmeden kullanılır (derlemede `__HIRSIZ_PROPS__`
listesi, `hirsizProp()` — Sözlük Blöfü düzeni); yokken ekran mevcut görseli kullanır ve dosyayı hiç istemez.

- **GH-U5 · açık kasa (içi altın/para dolu)** — `apps/client/public/assets/props/gizli-hirsiz/kasa-acik.webp` · 1:1,
  512×512 · şeffaf arka plan · Mevcut `genel/kasa-kapisi` ile **aynı kasa**, aynı açıdan (tam karşıdan) ama kapı **sola doğru
  ~110° açılmış** (menteşeler solda kalır, kapının iç yüzü kalın gümüş kenarla görünür); açıklıktan içeride istiflenmiş altın
  külçeler, taşan altın paralar ve birkaç yeşil-neon banknot destesi, içeriden sıcak altın ışık (#ffd23f) dışarı vurur; neon
  şeritler aynı renklerde, kalın kontur; kasa gövdesi kadrajın ~%85'i, ortalanmış; yazı YOK. Tek hırsız açılışında çekirdeğin
  içinde ~280 px (TV'de ~380 px), genel sonuç şeridinde 60 px gösterilir; 60 px'te de "açık, içi altın" okunmalı. · Geçici:
  kapalı kasa kapısı altın ışık (sepya + parlaklık + altın gölge) ve CSS altın yağmuru ile "açılmış" gösterilir.
- **GH-U16 · anlatım döngüsü** (isteğe bağlı; yeni görsel gerekmedi) — "tek parmak izi → yeşil kasa (+1)" ve "iki parmak izi
  → kırmızı alarm (−1)" iki karesi SVG ile çizildi (`BriefingArt`). Mevcut anlatım görselleri (`briefing/gizli-hirsiz-1..3.webp`)
  aynen; istenirse ileride 3. görsel "iki hırsız aynı anda basıyor, kırmızı alarm, kelepçe" sahnesiyle değiştirilebilir
  (aynı ölçü ve stil, `briefing/gizli-hirsiz-3.webp`).
- **GH-U5 · kelepçe, kıpırtı, kilit, göz simgeleri; altın yağmuru, siren ışığı, toz bulutu, stetoskop dalgası, lazerler**
  (yeni görsel gerekmedi) — CSS/SVG ile çizildi; hareket azaltmada sabit renk.
- **GH-U13 · TV zemini** (yeni görsel gerekmedi) — mevcut `worlds/gizli-hirsiz-landscape.webp` `cover` ile.
- **ses** (dosya gerekmedi; istenirse gerçek kayıtlarla değiştirilir) — GH-U15 seti mevcut ses sistemiyle kodla üretildi
  (`apps/client/src/games/gizli-hirsiz/sounds.ts`): oyun boyu alçak alarm uğultusu + lazer vızıltısı (son 5 sn hızlanır),
  kadran tıkırtısı (çok kısık), son 5 sn alçak tik, işaret anında stetoskop "dinleme", "Kasa sessiz" sakin nota, "Kasada
  kıpırtı var!" kalp çarpıntısı, açılışta kasa mekanizması, parmak izi sayacının her rakamında tık, soygunda nota + para
  şıkırtısı, alarmda siren + kelepçe şakırtısı, boş kasada alçak "rüzgâr". **Kural (ses haritasına):** karar anında (ÇAL /
  ÇALMA) hiç ses yoktur; titreşim kadran tıkırtısıyla aynıdır. Gerçek kayıt istenirse olay adları `gizli-hirsiz.<an>`.
  Müzik (alçak döngüsel "soygun" teması, son 5 sn tempo katmanı) ses ekibine iştir; şimdilik yok.
