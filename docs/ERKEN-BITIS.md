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

## Sonuç ekranı "Devam" (oyun kuralı değil, tur arası hız)
- Mesaj: `{ type: "continue" }` (yalnız `results` aşaması; başka aşamada `wrong_phase`). KURALLAR etkilenmez.
- Sayılanlar: o oyunun katılımcıları (izleyici sayılmaz; izleyicinin mesajı sessizce yok sayılır). Bağlı olmayan katılımcı
  beklenmez (Tür 1 ile aynı). `MatchSnapshot.continueIds` yalnız kimlerin bastığını taşır.
- Süre: `results` en çok 60 sn sürer (`RESULTS_MS`; eskisi 30 sn).
- Bitiş: bağlı katılımcıların hepsi bastıysa `phaseEndsAt = ctx.now + 1000` (`CONTINUE_GRACE_MS`); yalnız kısaltır, uzatmaz.
  Karar sunucunun `stepMatch` adımında verilir (oyun `tick`i değil; bağlantıya bakmak burada serbest), böylece son bekleneni
  kopma da sayımı tamamlar. Oyun durumu ve kayıt (`replay`) etkilenmez.
- Hız sınırı: aynı oyuncudan `CONTINUE_MIN_GAP_MS` (300 ms) içinde gelen ikinci mesaj `rate_limited`; tekrar onay sessizdir.
- İstemci: `TamamBar` ("Devam" / "Hazırsın · n/m hazır") + "Sıradaki: <oyun>" kartı.

## Oyun içi sonuç ekranı "Devam et" (oyun kuralı değil, bitiş zamanlaması; Ekim 2026 sahip kararı)
Sahip kararı: "Sonuç ekranı tüm oyuncuların devam et tarzı bir butona bastıktan sonra geçilsin; manuel süre fazlaca artsın
(örnek 60 sn); neyin ne olduğu tam görülsün." Bu, oyunun **kendi** son açılışı içindir (genel puan tablosu `results`
aşaması ayrıdır ve aşağıdaki "Sonuç ekranı Devam" kuralıyla, 60 sn tavanla sürer).
- Çatı: `GameDefinition.revealAt(state, ctx)` (isteğe bağlı, bütün oyunlarda tanımlı; invariants testi zorunlu tutar) son
  açılışın başladığı anı (oyun saati) ya da null döner. Sözleşme: açılış başladıktan sonra bu an kaymaz ve `result` değişmez;
  `isFinished`'in true olduğu an açılış animasyonunun bittiği andır (eskiden oyunun bittiği sabit süre, ör. Gizli Alışveriş
  8 sn, Kontrol Paneli 8 sn, Aşırı Yükleme 5 sn, artık **en az gösterim** süresidir). Açılışı olmayan oyunlarda (Butona Bas,
  Gizli Hırsız, Son Kişi, Karalama Defteri, Kule Ustası, Zaman Bombası…) `revealAt` oyunun bittiği andır: son ekran düğmeyle kalır.
- Sunucu (`stepMatch`, `match.ts`): açılış başlayınca `MatchSnapshot.reveal = {startedAt, endsAt, continueIds}` yayınlanır
  (`endsAt` = `startedAt` + `REVEAL_HOLD_MS` = 60 sn). Oyun `isFinished` olduktan sonra şu iki koşuldan biri gelince biter:
  bağlı katılımcıların hepsi "Devam et" dedi → `max(herkesin bastığı an, animasyon bitişi) + 1 sn` (`CONTINUE_GRACE_MS`);
  ya da açılış başından 60 sn geçti. Animasyon bitmeden asla bitmez (basış sayılır, animasyon kesilmez). Bağlantıya bakmak
  burada serbesttir (oyun `tick`i değil); son bekleneni kopması sayımı tamamlar. Oyun durumu ve kayıt (`replay`) etkilenmez:
  açılıştaki sonuç sabit olduğu için geç biten kayıt aynı sonucu verir (invariants testi `endedAt + 60 sn` ile doğrular).
- Mesaj: `{ type: "revealContinue", round }` (bkz. `docs/PROTOKOL.md`). Yanlış aşama / açılış yok / başka oyunun sırası:
  `wrong_phase`. İzleyici ve tekrar onay sessizce yok sayılır; 300 ms içinde ikinci mesaj `rate_limited`.
- İstemci: ortak `RevealContinue` bileşeni (`apps/client/src/ui/RevealContinue.tsx`) her oyunun ekranının altında durur ve
  yalnız `match.reveal` doluyken görünür: "Devam et" düğmesi, basınca "Hazırsın" + "Diğerleri bekleniyor · 3/5 hazır" ve
  bağlı katılımcıların avatarları (basan sevinir). Düğme açılışın ilk 1,5 sn'sinde pasiftir (`REVEAL_CONTINUE_ARM_MS`, tek
  sabit). İzleyici yalnız sayacı görür.
- Kapsam (tutucu): yalnız oyunun **son** açılışı düğmeyle geçer; tur aralarındaki ara açılışlar (Ortalamaya En Yakın, Kara
  Borsa, Laf Sokma düelloları, Bozuk Telefon zincirleri…) eskisi gibi süreyle ilerler.

## Test
Her oyun için: (a) herkes kilitleyince/hamle yapınca aşama 1 sn sonra biter, (b) bir kişi eksikken bitmez,
(c) bağlantısı kopan oyuncu beklenmez (Tür 1), (d) kilit sonrası değişiklik reddedilir, (e) kilit listesi seçimleri
sızdırmaz, (f) replay/invariants (tick zamanlamasından bağımsızlık) geçer.
