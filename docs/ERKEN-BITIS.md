# Erken bitiş (gereksiz beklemeyi kaldırma)

Sahip geri bildirimi: "herkes çizimini tamamladığında sürenin dolmasını bekliyoruz". Kural: **süre bir üst sınırdır;
bağlı tüm katılımcıların girdisi kesinleştiyse aşama beklemeden biter.** Puanlama ve gizlilik değişmez.

## Tür 1 — değiştirilebilir seçim: "Tamam" ile kilitleme
- Eylem: `{ kind: "lock" }` (oyunun mevcut eylem birliğine eklenir). Kilitleyen oyuncunun o aşamadaki seçimi kesinleşir;
  sonraki değiştirme eylemleri reddedilir (`locked`). Seçimi olmayan kilitleyemez (`nothing_to_lock`) — bir seçimin
  "boş" olmasının anlamlı olduğu yerde (ör. Gizli Alışveriş boş sepet) boş kilit serbesttir.
- Aşama bitişi: kilitleyen kümesi, o aşamada eylem yapabilecek **bağlı** katılımcıların hepsini kapsıyorsa (ve en az bir
  bağlı katılımcı varsa) aşama `ctx.now + 1000` anında biter (1 sn: son dokunuşun animasyonu). Karar `reduce` içinde,
  `ctx.connected` ile verilir; `tick` yalnız kaydedilmiş bitiş anına bakar (bağlantıya bakmaz).
- Herkese açık görünümde yalnız **kimlerin kilitlediği** (oyuncu id listesi) yer alır; seçimin kendisi gizli kalır.
  İstemci portrelerde "hazır" işareti gösterir. Kendi view'ında `locked: boolean`.
- İstemci: birincil eylemin yanında/altında büyük "Tamam" düğmesi (≥ 64 px), seçim yokken pasif; kilitlenince seçim
  arayüzü donar ve "Diğerleri bekleniyor" + hazır sayacı ("3/5 hazır") görünür.
- Uygulanır: Açgözlülük Limiti, Çapraz Ateş, Çağrışım Ağı (cevaplar), Karalama Defteri (çizim "Bitti", oylama),
  Ortalamaya En Yakın, Çizgiyi Geçme, Gizli Kareler (her aşamada yalnız o aşamada oynayanlar), Gizli Alışveriş,
  İttifak (oylama), Rüşvet ve Darbe (başkan oyu; düelloda işaret = tek seferlik, aşağıya bakın; dağıtım: yalnız başkan
  "Bitti" der).
- Konuşma aşamaları (İttifak 60 sn pazarlık): eylem `{ kind: "skip" }` = "Oylamaya geçelim"; bağlı herkes basınca
  aşama 1 sn sonra biter. Basanlar herkese açık.

## Tür 2 — tek seferlik hamle: herkes hamlesini yaptıysa bitiş
Sonuç artık değişemiyorsa (her katılımcı tek hakkını kullandıysa) aşama `ctx.now + 1000`'de biter. Bağlantı koşulu
yok: **tüm katılımcılar** hamlesini yapmış olmalı (bağlı olmayanı beklemek yerine süre dolar). Bilgi sızıntısı
yaratmamalı: bitiş yalnız "herkes yaptı" durumunda olur, bu da zaten herkese açık bir bilgi değilse dikkat:
- Kör Kronometre: herkes bastıysa bitiş (basış bilgisi zaten sonda açılıyor; erken bitiş "herkes bastı"yı açar — kabul).
- Gizli Hırsız: herkes bastıysa bitiş (sonuç kesin: herkes −1).
- Son Kişi: herkes kaçtıysa bitiş (kaçanlar zaten açık). Gizli bitiş zamanı açığa çıkmaz; sonuç ekranında bitiş yok.
- Zehirli Kadeh: herkes takas hakkını kullandıysa bitiş.
- Rüşvet ve Darbe düello işareti: düellodaki herkes işaret verdiyse açılış hemen başlar.

## Tür 3 — değişmez
Butona Bas, Aşırı Yükleme, Kör Bomba, Rus Ruleti (zaten hamleyle ilerler), Zaman Bombası Hafızası (kontrol edilir:
herkes girişi bitirdiyse aynı kural uygulanır).

## Test
Her oyun için: (a) herkes kilitleyince/hamle yapınca aşama 1 sn sonra biter, (b) bir kişi eksikken bitmez,
(c) bağlantısı kopan oyuncu beklenmez (Tür 1), (d) kilit sonrası değişiklik reddedilir, (e) kilit listesi seçimleri
sızdırmaz, (f) replay/invariants (tick zamanlamasından bağımsızlık) geçer.
