# Kürsü karakteri — kaliteli parça denemesi

Önce `/srv/glix/gorsel/OKU-BENI.md` içindeki talimat ve ortak kuralları uygula (stil öneki dahil).
Kayıt: `/srv/glix/gorsel/gelen/karakter/` (tam olarak aşağıdaki dosya adlarıyla). Bitince `TAMAM` bırak.

## Ne bu?
Mini oyun sonlarında ve finalde ilk 3 oyuncu kürsüde **karakter** olarak durur; birinci, satın aldığı dansı yapar.
Karakter parçalardan oluşur (kafa, gövde, kollar, bacaklar); oyun parçaları eklem noktalarından döndürerek dans ettirir.
Giysiler (şapka, ceket) ilgili parçanın üstüne giydirilen ayrı görsellerdir.

Önceki deneme (`gelen/karakter-deneme/`) **teknik olarak doğruydu** (eklemler, `pivots.json`, `dance.json` biçimi iyi);
ama parçalar kodla çizilmiş düz şekillerdi. Bu sefer görsel **resim üreticisiyle**, rozet ve avatarlarla aynı kalitede
çizilecek. Asıl sınadığımız şey: **kaliteli çizilmiş parçalar birbirine kusursuz oturuyor mu?**

## Yöntem (sırayla; bu sıra tutarlılık için şart)
Parçaları **tek tek ayrı ayrı çizme.** Önce karakterin tamamını tek görsel olarak çiz, sonra o görseli kesip parçala.
Giysileri de aynı ana görselin **düzenlenmiş hâli** olarak üret (aynı poz, aynı oran), sonra yalnız giysiyi kes.

### 1) Ana karakter — `ana.png` (1024×1536, saydam arka plan)
- Tam boy, **tam önden**, ayakta; yükseklik görselin ~%85'i, ortada.
- Poz: **A-pozu** — kollar gövdeden ~30° açık ve dümdüz, bacaklar hafif açık ve düz, ayaklar öne bakar.
  Hiçbir uzuv gövdenin ya da başka uzvun **üstüne binmez**; aralarında boşluk görünür.
- Görünüş: `referans/avatarlar/` ve `gelen/asama-2/` avatarlarının ailesi — yüzsüz, parlayan geometrik **camgöbeği
  neon maske**, koyu tonlu sade bir temel kıyafet (tulum gibi; giysiler sonra üstüne gelecek), kalın koyu kontur,
  cel-shaded. Biraz şirin/oyuncak oranı (baş gövdeye göre büyükçe) olabilir.
- **Eklemler yuvarlak olsun** (oynar bebek / mafsallı figür gibi): omuz, dirsek, bilek, kalça, diz, bilek (ayak).
  Her eklemde parça uçları **yuvarlak** biter; böylece parça döndüğünde arada boşluk ya da kırık görünmez.
  Eklem yerinde ince bir neon halka olabilir (stile uyar ve dikişi saklar).
- Ellerde parmak ayrıntısı az: yumruk ya da eldiven gibi tek parça.
- Telefonda karakter 120–200 px boyunda görünecek: kalın hatlar, net siluet, az ince ayrıntı.

### 2) Parçalara kes — `govde/` klasörü (14 PNG, saydam)
`ana.png`'yi aşağıdaki parçalara kes. Kurallar:
- **Ölçek değişmez:** parçalar `ana.png` ile aynı piksel ölçeğinde kalır; yalnız etrafındaki boşluk kırpılır.
- **Gizli kalan yerleri tamamla:** bir parçanın altında kalan alanı (ör. üst kolun kapattığı omuz, uyluğun kapattığı
  kalça) boş bırakma; aynı stille boya ki parça döndüğünde delik görünmesin. Her uzuv parçası **üst ucundaki yuvarlak
  eklemi tam** içerir; alt ucu da yuvarlak biter (bir sonraki parçanın altına girer).
- Kenarlar temiz: beyaz/renkli hale, kesik kontur, yarım saydam çöp piksel yok.

| Dosya | Parça | Bağlı olduğu (parent) | Eklem noktası (pivot) |
|---|---|---|---|
| `torso.png` | Gövde (kalça dahil) | root | Kalçanın ortası |
| `head.png` | Baş + maske (boyun dahil) | torso | Boynun dibi |
| `left_upper_arm.png` | Sol üst kol | torso | Omuz ekleminin merkezi |
| `left_forearm.png` | Sol ön kol | left_upper_arm | Dirsek merkezi |
| `left_hand.png` | Sol el | left_forearm | Bilek merkezi |
| `right_upper_arm.png` | Sağ üst kol | torso | Omuz |
| `right_forearm.png` | Sağ ön kol | right_upper_arm | Dirsek |
| `right_hand.png` | Sağ el | right_forearm | Bilek |
| `left_thigh.png` | Sol uyluk | torso | Kalça eklemi |
| `left_shin.png` | Sol baldır | left_thigh | Diz |
| `left_foot.png` | Sol ayak | left_shin | Ayak bileği |
| `right_thigh.png` | Sağ uyluk | torso | Kalça eklemi |
| `right_shin.png` | Sağ baldır | right_thigh | Diz |
| `right_foot.png` | Sağ ayak | right_shin | Ayak bileği |

"Sol/sağ" izleyicinin gördüğü yöndür (görselin solu = `left_*`).

### 3) Giysiler — `giysi/` klasörü (saydam PNG)
Her giysi için `ana.png`'yi **düzenle** (aynı karakter, aynı poz, aynı oran; yalnız giysi eklenir), önizleme olarak sakla,
sonra **yalnız giysiyi** parçalara göre kes.
- **Şapka** — önizleme `ana-sapka.png`; kesilen: `sapka.png` (başa bağlı). Neon şeritli bir fötr ya da kep.
- **Ceket** — önizleme `ana-ceket.png`; neon fermuarlı/şeritli kısa bomber ceket. Kesilenler (her biri kendi uzvuna
  bağlı, uzvun üstüne giydirilir):
  `ceket_torso.png`, `ceket_left_upper_arm.png`, `ceket_left_forearm.png`, `ceket_right_upper_arm.png`,
  `ceket_right_forearm.png`.
- Giysi parçası, bağlı olduğu vücut parçasıyla **aynı eklem noktasına** göre hizalanır; uzvu döndürünce giysi de
  birlikte döner ve kaymaz. Kol parçalarında da eklem uçları yuvarlak ve tam olsun.

### 4) Eklem dosyası — `pivots.json`
Önceki denemedeki biçimle **aynı** (`"format": "glix-parts-1"`): her parça için `file`, `size`, `pivot` (PNG içindeki
piksel), `parent`, `position` (parent'ın pivotuna göre eklem konumu), `rotation: 0`; ayrıca `root`, `drawOrder`.
Giysiler `wardrobe` altında: her giysi için hangi dosyanın hangi parçaya bağlı olduğu ve çizim sırasında hangi parçanın
hemen üstüne geldiği. Dosya yolları `govde/…` ve `giysi/…` biçiminde.

### 5) Kendi kontrolün — `kontrol/` klasörü
- `montaj.png`: parçaları `pivots.json`'a göre yeniden birleştir (döndürmeden). `ana.png` ile üst üste konunca kayma
  **2 pikselden az** olmalı. `fark.png`: ikisinin farkı (fark yalnız kenarlarda ince çizgi olmalı).
- `dans.apng` ve `dans.html`: önceki `gelen/karakter-deneme/dans/dance.json`'daki **açıları** yeni parçalara uygula
  (konumları yeni `pivots.json`'dan al) ve oynat; şapka/ceket açılıp kapatılabilsin.
- `zorlama.png`: her eklemi ayrı ayrı **−60° ve +60°** döndürdüğün bir ızgara; eklem yerlerinde boşluk/delik var mı?
- Rapor `kontrol/rapor.txt`: kayma ölçümü, sorunlu eklemler, neyin eksik kaldığı.

## Kayıt
Dosya yazma aracında `encoding: base64` kullan. Her PNG'nin gerçekten **saydam arka planlı** olduğunu kontrol et.
Yalnız `/srv/glix/gorsel/gelen/karakter/` klasörüne yaz; başka yere dokunma, paket kurma.
Bitince `TAMAM` dosyasına her adım için "yaptım / yapamadım / şu kısmı eksik" yaz.
Görsel üretme limitin dolarsa nerede kaldığını yaz; yeni bir sohbette kaldığın yerden devam edilecek.
