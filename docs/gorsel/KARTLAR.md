# Kart görselleri (34 görsel)

Önce `/srv/glix/gorsel/OKU-BENI.md` içindeki talimat ve ortak kuralları uygula.
Kayıt: `/srv/glix/gorsel/gelen/kartlar/` (tam olarak aşağıdaki dosya adlarıyla). Bitince `TAMAM` bırak.

## Ne bunlar?
Maçta her 3 oyunda bir oyuncuya 3 kart çıkar, birini seçer; kart elde tutulur ve bir oyunun başında oynanır.
Kart **üç katmandan** oluşur ve oyun bunları üst üste koyar:
1. **Çerçeve** (nadirliğe göre 4 tane) — kartın dış kabuğu, altta **yazı için boş, koyu bir alan** bırakır.
2. **Çizim** (her kart için 1 tane) — çerçevenin üst penceresine oturan büyük simge/sahne.
3. **Yazı** — kart adı ve açıklaması; **oyun gerçek yazıyla basar**. Görsellerde hiçbir yazı olmaz.

Ayrıca kartın **arka yüzü** (1 tane).

## Ortak stil
- GLIX neon dünyası: koyu lacivert/mor zemin, parlak neon kenarlar, hafif parıltı; tarot/oyun kartı havası ama sade.
  Referans: `gelen/asama-5/5.1-kart-*.png`, `gelen/rozet/` (aynı neon dil), `gelen/logo/`.
- Karakter gerekirse **yüzsüz, neon maskeli avatarlar** (`gelen/asama-2/`).
- **Yazı, harf, rakam, logo yok** (rakam yalnız aşağıda istenen yerde).
- Telefonda kart ~110–160 px genişlikte görünür: **tek net simge**, kalın hatlar, az detay.

## 1) Çerçeveler — 4 dosya, 1024×1536 (2:3), saydam arka plan
Çerçevenin dışı saydam. Üstte çizim için **kare pencere** (genişliğin ~%80'i, üstten ~%8 aşağıda), altında yazı için
**düz, koyu, sakin bir panel** (kartın alt ~%35'i; desen yok, okunurluk için). Pencere içi ve yazı paneli **boş** kalır.
Nadirlik köşedeki taşlarla da anlaşılır (renk körleri için):

| Dosya | Nadirlik | Renk | Köşe işareti |
|---|---|---|---|
| `cerceve-siradan.png` | Sıradan | Camgöbeği neon | Alt ortada 1 küçük taş |
| `cerceve-nadir.png` | Nadir | Mor neon, biraz daha süslü | 2 taş |
| `cerceve-efsanevi.png` | Efsanevi | Altın neon, en gösterişli (kanatçık/ışın) | 3 taş |
| `cerceve-kotu.png` | Kötü | Kırmızı neon, çatlak/kırık süsler | Tek **kırık** taş |

## 2) Kart çizimleri — 29 dosya, 1024×1024, saydam arka plan
Pencereye oturacak tek sahne/simge, kenarlarda ~%6 boşluk, kendi içinde arka plan yok (ya da çok hafif neon hale).

**Sıradan**
| Dosya | Kart | Çizim |
|---|---|---|
| `kalkan.png` | Kalkan | Neon kalkan, önünde kırılan eksi işareti |
| `sigorta.png` | Sigorta | Düşen bir avatarı yakalayan neon güvenlik ağı |
| `takviye.png` | Takviye | Parlayan artı işaretli enerji kapsülü |
| `kendine-guven.png` | Kendine Güven | Göğsünü gere avatar, arkasında tek yıldız |
| `tahmin.png` | Tahmin | Bir avatarı işaret eden kristal küre |
| `ortaklik.png` | Ortaklık | İki avatarın ortasında ikiye bölünmüş parlak jeton |
| `koruma.png` | Koruma | Bir avatarın etrafında neon koruyucu kubbe |
| `ayna.png` | Ayna | Gelen oku geri seken neon ayna |
| `vergi.png` | Vergi | Bir avatarın kesesinden süzülüp giden tek jeton |
| `celme.png` | Çelme | Tökezleyen avatar, ayağına takılan neon çizgi |
| `veto.png` | Veto | Üstü çarpıyla çizilmiş oyun kartı / kapı |
| `genis-secim.png` | Geniş Seçim | Yelpaze gibi açılmış dört kart |

**Nadir**
| Dosya | Kart | Çizim |
|---|---|---|
| `cift-puan.png` | Çift Puan | İkiye bölünüp çoğalan parlak jeton (ikizler) |
| `takas.png` | Takas | İki avatar arasında yer değiştiren iki ok |
| `oyunu-sec.png` | Sıradaki Oyunu Seç | Bir el, dönen oyun çarkını durduruyor |
| `lanet.png` | Lanet | Bir avatarın üstünde mor lanet bulutu |
| `hirsiz.png` | Hırsız | Kupadan jeton çalan maskeli el |
| `kart-cal.png` | Kart Çal | Başkasının elinden kayan bir kart |

**Efsanevi**
| Dosya | Kart | Çizim |
|---|---|---|
| `altin-dokunus.png` | Altın Dokunuş | Dokunduğu şeyi altına çeviren parlayan el |
| `ters-kose.png` | Ters Köşe | Ters dönmüş kürsü (1. basamak en altta), kaotik ama eğlenceli |

**Kötü**
| Dosya | Kart | Çizim |
|---|---|---|
| `talihsizlik.png` | Talihsizlik | Avatarın üstünde küçük yağmur bulutu |
| `agir-yuk.png` | Ağır Yük | Sırtında dev yük taşıyan avatar |
| `hayirsever.png` | Hayırsever | Kesesinden jeton saçılan, istemeden "bağış yapan" avatar |
| `acik-hedef.png` | Açık Hedef | Sırtında neon hedef tahtası olan avatar |
| `bos-el.png` | Boş El | Avuçta yanıp kül olan kart |
| `kor-secim.png` | Kör Seçim | Gözleri bağlı avatar, önünde ters kartlar |
| `sessizlik.png` | Sessizlik | Ağzı fermuarlı maske, yanında sönmüş kart |
| `kumarbaz.png` | Kumarbaz | Havada dönen zarlar, biri kırmızı |
| `lanetli-hediye.png` | Lanetli Hediye | Kurdeleli ama içinden mor duman sızan hediye kutusu |

## 3) Kartın arka yüzü — 1 dosya, 1024×1536, saydam arka plan
`arka.png`: GLIX neon desenli kart sırtı; ortada soyut bir simge (logo **değil**, yazı yok), çerçeveyle uyumlu
yuvarlatılmış köşeler. Kör Seçim kartında ve kart açılışında görünür.

## Kayıt
Dosya yazma aracında `encoding: base64` kullan; her dosyanın gerçekten **saydam arka planlı PNG** olduğunu ve boyutunun
doğru olduğunu kontrol et. Yalnız `/srv/glix/gorsel/gelen/kartlar/` klasörüne yaz; başka yere dokunma, paket kurma.
Görsel üretme limitin dolarsa nerede kaldığını söyle; yeni bir sohbette kaldığın yerden devam edilecek.
