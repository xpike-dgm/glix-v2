# GLIX v2 — Protokol v3 (A1; kartlar ile 3)

Tek WebSocket: `/ws`. Tüm mesajlar JSON, `type` alanlı. Tipler: `packages/engine/src/protocol.ts`.
Sunucu tek otoritedir; istemci yalnız niyet gönderir.

## İstemci → sunucu

| type | alanlar | not |
|---|---|---|
| `hello` | `clientVersion` | bağlantı açılınca ilk mesaj |
| `ping` | `t` | saat farkı ölçümü |
| `createRoom` | `nickname` (hesaplıda sunucu yok sayıp kullanıcı adını koyar; yine de geçerli olmalı) | 1–16 karakter, kırpılır; biçim/yön/görünmez karakter (`Cf`,`Zl`,`Zp`,`Co`,`Cs`) yasak, en çok 2 ardışık birleştirici işaret, en az bir harf/rakam (yalnız emoji reddedilir) |
| `joinRoom` | `code`, `nickname`, isteğe bağlı `avatar` (0–7) | 5 karakter, büyük harfe çevrilir |
| `joinStage` | `code` | **Sahne (TV)** olarak odaya bağlan (bkz. "Sahne (TV) rolü"). `nickname`/`avatar` yok; `room_not_found` / `stage_full` / `draining` / `rate_limited` döner |
| `resume` | `token` | yeniden bağlanma; başarısızsa `error{code:"resume_failed"}` |
| `leaveRoom` | — | |
| `kick` | `playerId` | yalnız host, yalnız lobide (maçta `wrong_phase`); kendini/olmayanı atamaz (`not_in_room`). Atılanın oturum anahtarı silinir; `resume` `resume_failed` döner. Oda koduyla yeniden katılma engellenmez |
| `transferHost` | `playerId` | yalnız host, yalnız lobide; hedef odada ve bağlı olmalı, kendisi olamaz (`not_in_room`). Taç hedefe geçer, bekleyen host devri iptal olur, hedefin hazır işareti silinir |
| `rename` | `nickname` | `normalizeNickname` kuralları; **yalnız misafir** (hesaplı bağlantıda `account_name` ile reddedilir: ad kullanıcı adıdır);  yalnız lobide (`wrong_phase`); odada başkasında olan ad (büyük/küçük harf duyarsız) `nickname_taken`; oyuncu başına 1 sn'de en çok bir değişiklik (`rate_limited`); aynı ad sessizce yok sayılır |
| `react` | `emoji` | yalnız `LOBBY_EMOJIS` (👋 😂 🔥 😱 👏 ❤️), aksi `invalid_message`; yalnız lobi, sonuç (`results`) ve final aşamalarında (oyun sırasında blöf işareti taşıyabileceği için kapalı); oyuncu başına 700 ms'de bir. Fazlası ve izinsiz aşama **sessizce** atılır (hata yok). Cevap: herkese `reaction` olayı |
| `setReady` | `ready` (boolean) | lobide "Hazırım" işareti; yalnız lobide (`wrong_phase`); host için sessizce yok sayılır. Başlamak için şart değildir |
| `setGames` | `gameIds` | yalnız host, yalnız lobide; boş olamaz, tekrar yok; modu `manual` yapar |
| `setRandom` | `count` | yalnız host, yalnız lobide; 1..katalog boyu; modu `random` yapar |
| `chooseAvatar` | `avatar` (0–7) | yalnız lobide (`wrong_phase`); başkasında olan karakter `avatar_taken` ("Bu karakteri X aldı"), ilk gelen alır; aynı değer sessizce yok sayılır |
| `setJoinPolicy` | `policy` (`izleyici`\|`kapali`) | yalnız host, yalnız lobide; başka değer `invalid_message`, maçta `wrong_phase`, host değilse `not_host`; aynı değer sessizce yok sayılır |
| `setTone` | `tone` (metin) | **KALDIRILDI** (ton özelliği sahip kararıyla silindi). Yalnız eski önbellekli istemciler için kabul edilir: biçim doğruysa (`type` + metin `tone`) **sessizce yok sayılır** (hata yok, yayın yok, oda değişmez); bozuksa `invalid_message`. Sonraki sürümde ayrıştırıcıdan da silinecek |
| `setCards` | `enabled` (boolean), `off` (kart kimlikleri, tekrarsız) | yalnız host, yalnız lobide (`not_host` / `wrong_phase`); bilinmeyen/tekrarlı kimlik, eksik ya da fazla alan `invalid_message`. Kapalı liste katalog sırasına çevrilir. Ayar odada kalır, yayında `RoomSnapshot.cardSettings` olarak herkese gider (bkz. "Kartlar") |
| `startMatch` | — | yalnız host; bağlı oyuncu sayısı tüm seçili oyunların min'ini karşılamalı |
| `ready` | — | yalnız `briefing` aşamasında (lobi işareti için `setReady`) |
| `pickCard` | `index` (0–7) | yalnız `cards` aşaması ve yalnız kart hakkı olan oyuncu; geçersiz dizin / zaten alınmış / bitirmiş / değiştirme beklerken `error{card_invalid}`; yanlış aşama `wrong_phase`, izleyici `not_participant` |
| `discardCard` | `index` (0–7 ya da `null`) | yalnız `cards` aşaması, yalnız elin doluyken seçilen iyi kart için karar bekleyen oyuncu: elden `index`inci kartı atar, `null` yeni kartı atar. Aksi `card_invalid` |
| `playCard` | `card`, `target?` (oyuncu kimliği), `gameId?` | yalnız `briefing` aşaması, yalnız katılımcı; kart elde olmalı, oyuncu başına en çok 1, hedef/oyun kartın türüne uymalı (docs/KURALLAR.md K4, K7); geçersizse `card_invalid`. Kabul edilince `match.mine.staged` dolar (yalnız sahibine) |
| `unplayCard` | — | yalnız `briefing`; oynanan (henüz kesinleşmemiş) kartı ele geri alır; yoksa `card_invalid` |
| `continue` | — | yalnız `results` aşaması (`wrong_phase`); izleyici ve katılımcı olmayan sessizce yok sayılır; aynı oyuncudan 300 ms içinde ikinci mesaj `rate_limited`. Bağlı tüm katılımcılar basınca sonuç ekranı 1 sn sonra biter (`phaseEndsAt` kısalır). Yanıt: `match.continueIds` güncellenir. Bkz. `docs/ERKEN-BITIS.md` |
| `action` | `seq`, `payload` | yalnız `playing`; `seq` istemci sayacı, `actionAck` ile döner |
| `returnToLobby` | — | yalnız host, yalnız `final` |
| `resync` | — | yama uygulanamadığında tam `room` snapshot ister |
| `visibility` | `hidden` (boolean) | sayfa gizlendi/göründü. Yalnız oyuncu bildirimi açtıysa ve odadaysa gönderilir; odasız bağlantıda sessizce yok sayılır. Yeniden bağlanınca (`resume`) sunucu bunu "görünür"e sıfırlar, istemci `session` sonrası yeniden bildirir |
| `pushSubscribe` | `endpoint`, `p256dh`, `auth` | web bildirimi aboneliğini bu oyuncunun oturumuna bağlar (bkz. "Web bildirimleri"). `endpoint` https ve ≤ 500 karakter, kimlik bilgisi yok; `p256dh` 87, `auth` 22 karakter base64url (65 / 16 bayt). Sunucuda bildirim kapalıysa sessizce yok sayılır; uç nokta bilinen push servislerinden (FCM, Mozilla, Apple, Windows) değilse `invalid_message` |
| `pushUnsubscribe` | — | aboneliği siler |
| `inviteFriend` | `username` | **Hesaplı** bağlantı, odada, yalnız lobide. Kabul edilmiş arkadaşı odaya çağırır. Başarıda gönderene `inviteSent`; olmazsa `invite_failed` (arkadaş değil / engelli / çevrimdışı ve bildirimsiz / zaten odada), `rate_limited` (aynı arkadaşa 30 sn'de bir, gönderen başına dakikada 20), `not_in_room`, `wrong_phase`, `login_required` |
| `joinFriend` | `username`, `nickname`, `avatar?` | **Hesaplı**, odasız bağlantı. Arkadaşın şu anki odasını sunucu çözer (kod istemciye gelmez) ve `joinRoom` kurallarıyla (maçta izleyici/kapalı, oda dolu) girer. Arkadaş değilse, odada değilse, oda katılıma kapalı ya da doluysa hepsinde aynı `friend_not_found`; misafirde de aynı. Başarıda `session` |
| `feedback` | `rating` (1–5), `text?` (≤ 300) | yalnız `final`; maç başına bir kez; cevap `actionAck` değil, sessizce kaydedilir |
| `perf` | `gameId`, `rttMs`, `ackP50`, `ackP95`, `ackN`, `slowTaps`, `tapP95`, `longTasks`, `longTaskMs` | yalnız `results` aşamasında ve yalnız o anki oyunun `gameId`'si için; oyun başına oyuncu başına bir kez; sessizce kaydedilir (cevap yok). Tam anahtar kümesi, hepsi negatif olmayan tam sayı: `rttMs`,`ackP50`,`ackP95`,`tapP95` ≤ 60 000; `ackN`,`slowTaps`,`longTasks` ≤ 10 000; `longTaskMs` ≤ 600 000; `gameId` ≤ 64 karakter. İsteğe bağlı (eski istemcide yok): `platform` (`ios` / `android` / `diger`, UA'dan kaba grup), `reconnects` (o oyunda soket yeniden açılma sayısı) ve `reloads` (sekme oturumunda sayfa yenileme sayısı), ikisi de ≤ 1 000. Aşan ya da fazladan alanlı mesaj `invalid_message` |

## Sunucu → istemci

| type | alanlar |
|---|---|
| `welcome` | `protocolVersion`, `serverVersion`, `pushKey?` — sunucu web bildirimi gönderebiliyorsa VAPID genel anahtarı (base64url); yoksa alan hiç gelmez ve istemci Ayarlar'daki anahtarı gizler. `site?: SiteNotice` — yayındaki duyuru ve bakım kipi (bkz. "Duyuru ve bakım"); eski sunucuda alan yoktur |
| `pong` | `t`, `serverTime` |
| `session` | `token`, `playerId`, `roomCode` — istemci `localStorage`'a yazar |
| `stage` | `roomCode` — `joinStage` kabul edildi. Belirteç ve oyuncu kimliği yoktur; bağlantı kopunca istemci yeniden `joinStage` yollar |
| `room` | `snapshot: RoomSnapshot` — odaya girişte, resume ve `resync` sonrası (tam) |
| `patch` | `baseRev`, `rev`, `patch` — sonraki değişimler, JSON Merge Patch (RFC 7386) |
| `actionAck` | `seq`, `ok`, `reason?` |
| `left` | `reason: "left" \| "kicked" \| "closed"` |
| `reaction` | `playerId`, `emoji` | **Geçici olay**: oda durumunda (`room`/`patch`) saklanmaz, `rev` almaz, yeniden bağlanana tekrarlanmaz. Lobi/sonuç/finalde gönderenle birlikte odadaki tüm bağlı oyunculara gider |
| `friendStatus` | `username`, `status: "offline" \| "online" \| "lobby" \| "playing"` — yalnız kabul edilmiş arkadaşların canlı bağlantılarına; durum değişince (bkz. "Arkadaşlar") |
| `friendRequest` | `username` — sana arkadaşlık isteği geldi |
| `friendsChanged` | — arkadaş listen/isteklerin değişti (kabul, geri çekme, çıkarma, engel); istemci `GET /api/friends`'i yeniler |
| `invite` | `from`, `roomCode`, `expiresAt` (sunucu saati, ms; gönderildikten 10 dk sonra) — arkadaşın seni odaya çağırıyor |
| `inviteSent` | `username` — `inviteFriend` arkadaşına ulaştırıldı (canlı bağlantı ya da web bildirimi) |
| `badgesEarned` | `ids: string[]` — maç final'e varınca bu maçla kazandığın **yeni** rozet kimlikleri (hesaplı oyuncunun canlı bağlantılarına; boş liste gönderilmez, aynı rozet ikinci kez gelmez). Eski istemciler bilinmeyen tipi yok saydığı için protokol sürümü artmadı. İstemci adları `GET /api/profile`'dan okur |
| `siteNotice` | `site: SiteNotice` — duyuru ya da bakım kipi değişti (ya da duyurunun süresi doldu); **tüm** açık bağlantılara (misafir, hesaplı, sahne) gider |
| `lobbyNotice` | `text` — lobi bilgilendirmesi (ör. "Kule Ustası şu an kapalı, seçimden çıkarıldı."): odadaki bağlı oyunculara gider, istemci kısa bir bildirim (toast) gösterir. Oda durumunda saklanmaz |
| `error` | `code`, `message` (Türkçe, oyuncuya gösterilebilir) |

**Görünümler:** `match.publicView` odadaki herkes için aynıdır (oda başına bir kez hesaplanır ve
farklanır); `match.view` yalnız o oyuncuya özeldir. Gizli bilgi yalnız `view`'da, yalnız hak sahibine gider.

**Yama kuralı:** Sunucu her bağlantıya son gönderdiği snapshot'ı tutar ve yalnız farkı yollar.
İstemci `baseRev` kendi `rev`'ine eşitse yamayı uygular, değilse yamayı atıp `resync` gönderir.
Fark tam snapshot'tan büyükse sunucu doğrudan `room` gönderir. Hiçbir görünür alan değişmediyse mesaj
gönderilmez; `rev` ve `serverNow` yalnız gönderilen mesajlarda ilerler (istemci saati ping/pong ile eşler,
`serverNow`'a ihtiyaç duymaz).

## Sahne (TV) rolü

`/tv` sayfası odaya oyuncu olarak değil **sahne** olarak bağlanır (`joinStage`). Güvenlik sınıfı izleyiciyle aynıdır, ek olarak oyuncu bile değildir:

- Koltuk tutmaz, 8 oyuncu sınırına girmez, `players` listesinde hiç görünmez; sayısı `RoomSnapshot.stageCount` ile herkese açıktır
  (telefon "TV'de oynanıyor" rozeti için). Odada en çok `MAX_STAGES` = 2 sahne olur; fazlası `stage_full`.
- Oyuncu kimliği almaz: `snapshot.selfId` boş dizgidir; oyunun `setup`/`view` çağrılarına kimliği hiç verilmez.
  `match.publicView` herkesle aynıdır, `match.view` = `view(durum, null)` (izleyiciyle aynı). `secrets()` değerleri sahneye gitmez.
- Gönderebildikleri: `hello`, `ping`, `resync`, `leaveRoom` (+ ilk `joinStage`). `action` → `actionAck{ok:false, reason:"not_participant"}`;
  diğer her mesaj `error{code:"stage_readonly"}`. Sahne host olamaz, hazır/eylem/oy sayımına girmez.
- Sahne odayı ayakta tutmaz: oyuncular gidip oda silinince sahneye `left{reason:"closed"}` gider. Sahne kopunca sayaç düşer (bekleme süresi yok).
- Doğrulama: `apps/server/src/sahne.test.ts` (katılım, sınır, yetki, ayrılma) ve `izleyici-gizlilik.test.ts` (27 oyunun hepsinde sahne bağlantıları da denetlenir).

## Lobi: hazır işareti, emoji, yönetim

- `RoomSnapshot.lobbyReady`: `setReady` diyen, bağlı, host olmayan oyuncuların kimlikleri. Lobi dışında boştur; maç başlayınca ve
  maç sonunda lobiye dönünce (ya da maç yarıda iptal olunca) sıfırlanır. Host olan oyuncunun işareti düşer.
  İstemci "herkes hazır" durumunu `allReady(snapshot)` ile hesaplar (host dışındaki bağlı oyuncular hazır, en az biri var);
  yalnızca Başlat düğmesini parlatır, sunucu `startMatch`'te hazır olmayı aramaz.
- Emoji tepkisi odanın bir parçası değildir: sunucu `reaction` mesajını anında yollar ve unutur. Hız sınırı oyuncu başına
  (`REACTION_MIN_GAP_MS` = 700), ayrıca genel mesaj kovası geçerlidir.
- Takma ad benzersizliği: katılırken çakışan ad otomatik numaralanır ("Ali 2"); lobide `rename` çakışmayı numaralamaz, reddeder.
- Yeniden katılma kararı: atılan oyuncu kodu bilerek tekrar girebilir (kalıcı yasak için kimlik yok; IP/ad yasağı kırılgan).
  Eski oturum anahtarı ise geçersizdir, sessizce odaya dönemez.

## İçerik havuzları (ton kaldırıldı)

- Ton özelliği (Aile / Arkadaş / Ofis) **sahip kararıyla kaldırıldı**: lobide seçici, `setTone` işlemi ve odanın tonu yok;
  Laf Sokma tek soru havuzundan (`laf-sokma/sorular`) çeker.
- Geriye dönük uyum (bir sürüm): önbellekteki eski istemciler `RoomSnapshot.tone` ve Laf Sokma ortak görünümündeki `tone`
  alanını zorunlu okuyup bulamazsa anlık görüntüyü atar. Bu yüzden sunucu iki alanı **sabit `"arkadas"`** olarak göndermeye
  devam eder (tipte isteğe bağlı, yeni istemci okumaz); `PROTOCOL_VERSION` artırılmadı (artırmak her açık istemciyi
  güncelleme akışına zorlardı). Sonraki sürümde alanlar ve `setTone` ayrıştırması silinecek. Eski istemcinin `setTone` mesajı sessizce yok sayılır.
- `GameContext.content` (isteğe bağlı, `ContentSet`: havuz kimliği -> etkin girdiler) yalnız yöneticinin değiştirdiği havuzlar için maç başında verilir (yalnız `setup` okur, `poolEntries`); `GameLog.content` olarak kaydedilir ve `replay` aynısını verir. Ağ protokolünde değişiklik yok.
- Eski kayıtlar: ton taşıyan eski `GameLog.tone` okunmaya devam eder; yeni kayıt ton yazmaz. `replay` `tone` varsa `setup`ı
  o tonla çağırır ve Laf Sokma kaydın kurulduğu eski ton listelerini (yalnız replay için tutulur) ve `content`teki eski
  havuz kimliklerini (`laf-sokma/aile|arkadas|ofis`) kullanır; böylece eski kayıt aynı sonucu verir. Ton taşımayan kayıt birleşik havuzu kullanır.

## Maç kaydı

Her oyun için `GameLog` (tohum, katılımcılar, oda tonu, zaman damgalı kabul edilen eylemler) bellekte tutulur.
Aynı tohum ve eylemlerle `replay` aynı `GameResult`'u üretmek zorundadır; `tick` çağrı zamanlaması sonucu
değiştiremez. Son 20 oyunun kaydı bellekte tutulur; bir oyun fonksiyonu hata fırlatırsa o oyunun kaydı
sunucu günlüğüne yazılır.

## Oyun seçimi

- `RoomSnapshot.selection`: `{mode:"manual"}` ya da `{mode:"random", count}`. Yeni oda `{mode:"random", count:5}` ile açılır.
- Rastgele modda `startMatch` anında, bağlı oyuncu sayısının `minPlayers..maxPlayers` aralığına uyan oyunlar arasından
  tekrarsız, rastgele sırayla `count` oyun seçilir; uygun oyun `count`'tan azsa hepsi oynanır; hiç uygun oyun yoksa
  `not_enough_players`. Seçilen liste maçın `gameIds`'idir.
- El ile modda `startMatch`, bağlı oyuncu sayısının seçili oyunların hepsine uymasını ister (değişmedi).

## Maç akışı (sunucu)

```
lobby → [her oyun için: briefing → countdown(3 sn) → playing → results(30 sn; herkes Devam derse erken) → (3., 6. … oyundan sonra, son oyun hariç) cards(15 sn)] → final → (host) lobby
```

- **briefing:** Katılımcıların hepsi `ready` gönderince biter. Bağlantısı kopmuş oyuncu beklenmez.
  Güvenlik süresi 40 sn; dolunca otomatik geçilir.
- **playing:** Oyunun `isFinished` true olunca biter.
- **results:** `GameResult` gösterilir; `awards` genel skora eklenmiş olarak gelir.
- **results:** `match.continueIds` "Devam" diyenleri taşır (yalnız kimler). Sıradaki oyun `gameIds[round+1]` ile bellidir (zaten herkese açık). Önceki genel puan, istemcide `player.score − result.awards[id]` ile bulunur (sıra değişimi animasyonu için ek alan yok). Tur özeti satırı istemcide `summarizeRound(gameId, result, players, publicView)` ile (engine, saf) üretilir.
- **cards:** (kartlar açıksa) her 3. oyunun sonuç ekranından sonra, son oyun hariç. `match.round` az önce biten oyunun sırasıdır; `phaseEndsAt` 15 sn sonrasıdır, bağlı herkes seçince 1 sn sonraya çekilir. Ayrıntı: "Kartlar".
- **final:** Genel skor sıralaması. Host `returnToLobby` ile lobiye döner, skorlar sıfırlanır.
- Maç sürerken katılım (`RoomSnapshot.joinPolicy`, yeni oda `"izleyici"`; yalnız host lobide `setJoinPolicy` ile değiştirir):
  - `izleyici`: `joinRoom` kabul edilir, oyuncu `PlayerInfo.spectator: true` ile eklenir. İzleyici maç oyuncu listesine
    (`participants`, oyunun `setup`ı, `GameContext.connected`) hiç girmez; puan almaz, oy/seçimlere ve erken bitiş
    ("bağlı herkes bitirdi") koşuluna sayılmaz; `ready`/`action` `not_participant` ile reddedilir; geri bildirim veremez.
  - İzleyici de bir yer tutar: oyuncular + izleyiciler en çok 8; doluysa `room_full`.
  - Yalnız herkese açık görünüm: izleyicinin `match.view` değeri `view(durum, null)`dır (kimseye bağlı olmayan görünüm);
    oyun hiçbir zaman izleyicinin kimliğiyle `view` çağrılmaz, oyuncuya özel `view` ve gizli bilgi izleyiciye gitmez
    (`izleyici-gizlilik.test.ts` her oyun için doğrular).
  - Maç bitip oda lobiye dönünce (`returnToLobby`, maç iptali ya da katılımcıların hepsinin çıkması) `spectator` false olur;
    izleyici normal oyuncu olur.
  - `kapali`: maç sürerken `joinRoom` `error{code:"match_in_progress"}` ("Oyun sürüyor, bitince tekrar dene.") ile reddedilir.
  - `resume` her zaman çalışır; kopup kendi oturumuyla dönen oyuncu (ya da izleyici) yerine döner, ayardan etkilenmez.
- Bağlantı kopan oyuncu 120 sn içinde dönmezse odadan çıkarılır. Host koparsa 20 sn beklenir; bu sürede dönerse host olarak kalır.
  20 sn dolunca host bağlı en eski oyuncuya geçer (eski host dönünce geri almaz). Host kendi isteğiyle
  `leaveRoom` yaparsa devir hemen olur.
- Oda boş kalırsa 120 sn sonra silinir.

## Kartlar (docs/KURALLAR.md "0. Maç düzeyi kuralları: Kartlar")

- **Faz:** `RoomPhase` = `lobby | briefing | countdown | playing | results | cards | final`. Yeni faz `cards`; sonuç ekranından sonra, sıradaki oyunun `briefing`ine geçmeden önce açılır.
- **Protokol sürümü 2 → 3 oldu.** Gerekçe: eski (önbellekteki) bir istemci bilinmeyen `cards` aşamasını doğrulamada reddedip bütün anlık görüntüyü düşürür; oyuncu
  kart seçimi sırasında donmuş ekranda kalırdı. Sürüm artınca eski istemci "Güncelleme gerekli" ekranını görür ve yenilenir (diğer eklemeler gibi sessizce yok
  sayılamayacak bir bozulma olduğu için bilinçli artırıldı).
- **`RoomSnapshot.cardSettings`** (`{ enabled, off }`, yoksa kartlar açık sayılır): lobi ayarı, herkese açık. Misafirler yalnız okur.
- **`MatchSnapshot.cards`** (herkese açık; kartlar kapalıysa `null`/yok): `phase` (`cards` aşamasında `{done, silenced}`: seçimini bitirenler ve turu kaçıranlar; seçenekler ve seçimler yok),
  `hands` (oyuncu başına **kart sayısı**), `announce` (aşama bitince açıklanan kötü kartlar; aşama sürerken boş), `plays` (oyun başında kesinleşen kartlar; tetiklenmemiş Ayna/Koruma yok),
  `lines` (yalnız `results` aşamasında: "önceki → sonraki" etki satırları; tetiklenen Ayna/Koruma dahil).
- **`MatchSnapshot.mine`** (yalnız bu oyuncuya; izleyicide, sahnede ve kartı olmayanda `null`): `hand`, `choices` (anlatımda Veto ve Oyunu Seç için oyun listeleri), `pick` (kart seçimi sürerken:
  `options` — Kör Seçim'de ya da alınmışsa `null`, `taken`, `total`, `got`, `held`, `silenced`, `done`), `staged` (geri alınabilir oynanan kart), `played` (kesinleşmiş, gizli dahil).
  Sunucu bunu oyuncu başına üretir ve `patch`e yalnız o oyuncunun bağlantısına yazar; başka oyuncunun seçeneği/eli hiçbir mesajda yer almaz (`kartlar.test.ts` bunu doğrular).
- **`MatchSnapshot.result.awards`:** kart etkileri **dahil** nihai genel skor puanlarıdır (`player.score` bununla artar; hesap istatistiğindeki maç puanı da). `miniScores` değişmez.
- **Hata kodu:** `card_invalid` ("Bu kartı şu an oynayamazsın."). Yanlış aşama `wrong_phase`, izleyici/katılımcı olmayan `not_participant`.
- **Yeniden bağlanma:** `resume` sonrası tam `room` snapshot'ı oyuncunun `mine`ını (seçenekler, el, oynadığı kart) içerir; kart seçimi sırasında dönen aynı seçeneklerle devam eder.
- **Kayıt / tekrar oynatma:** maç tohumu (`CardLog.seed`) maç başında bir kez çekilir; çekilişler ve rastgele seçimler tohumdan **olaya özgü** türetilir (`deriveRng(seed, ...)`), kayıtta akış durumu yoktur.
  Her durum değişikliği bir `CardEvent` olarak zaman damgasıyla `CardLog.events`'e yazılır (`open`, `pick`, `discard`, `close`, `play`, `unplay`, `commit`, `resolve`); `replayCards(log)` aynı durumu kurar.
  Oyun kaydı (`GameLog.cards`) kart hesabının girdilerini (oynayışlar, bekleyen kötü kartlar, eller, ayrılmayanlar, tohum) taşır; `replayWithCards(oyun, kayıt)` ham sonuca uygulayıp nihai puanları ve etki satırlarını birebir üretir.
  Maç bitince/iptalde kart kaydı son-20 listesine (`recentCardLogs`) eklenir.
- **Sunucu akışı:** 3. (6., 9. …) oyunun `results` süresi dolunca `cardPhaseDue` (kartlar açık, oynanan oyun sayısı 3'ün katı, listede oyun kalmış) ise `cards` açılır; seçmeyene süre dolunca rastgele kart verilir, değiştirme bekleyen yeni kart atılır; sonra `briefing`.
  `briefing` biterken (`ready` ya da 40 sn) oynanan kartlar kesinleşir (Veto / Oyunu Seç maç listesini ve `room.gameIds`i günceller); `finishGame` kart hesabını uygular.
  Manuel seçimde maç bitince host'un listesi geri gelir.

## Duyuru ve bakım (U16 A3)

`SiteNotice = { announcement: Announcement | null, maintenance: boolean }`, `Announcement = { id, text (1-140, düz metin), kind: "bilgi" | "uyari", endsAt: ms | null }`
(tipler `packages/engine/src/siteNotice.ts`). Bağlanınca `welcome.site` ile gelir, değişince tüm bağlantılara `siteNotice` gider. Süresi dolan duyuruyu
sunucu turunda kaldırır ve `siteNotice` yollar; `welcome` hiçbir zaman süresi dolmuş duyuru taşımaz. `id` her yeni duyuruda artar (kaldırılıp yeniden yayınlansa da tekrar etmez):
istemci kapatılan duyurunun kimliğini `localStorage`'da (`glix.duyuru`) tutar, yeni duyuru yeniden görünür. Metin düz metindir; istemci HTML yorumlamaz.
- **Bakım kipi** (`maintenance: true`): `createRoom` ve `startMatch` yeni hata kodu `maintenance` ("Kısa bir bakım yapıyoruz, birazdan tekrar dene.") ile reddedilir;
  `joinRoom` / `joinFriend` / `joinStage`, süren maçlar ve `returnToLobby` etkilenmez. Ana sayfada otomatik bir bant görünür.
- **Oyun anahtarları:** `RoomSnapshot.catalog` yönetici ayarlarıyla süzülmüş **etkin** kataloğu taşır: kapalı oyun yoktur, `GameInfo.randomPool` etkin değerdir
  (havuzdaysa alan hiç gelmez, dışındaysa `false`). Kapalı oyun `setGames`/`startMatch`te `invalid_games` ("Seçtiğin oyunlardan biri şu an kapalı.") verir; rastgele seçim
  yalnız bu kataloğun havuzundan seçer. Ayar değişince lobideki odalar yeni kataloğu `patch` ile alır; kapanan oyun lobi seçimlerinden çıkar ve `lobbyNotice` gider.
  Süren maçın oyunu o odanın kataloğunda kalır (sonuç ekranları adı bulsun); maç bitip lobiye dönünce seçimden çıkarılır.
- **Protokol sürümü artmadı** (o zaman `PROTOCOL_VERSION = 2`; kartlarla 3 oldu, bkz. "Kartlar"): `welcome.site`, `siteNotice`, `lobbyNotice` eklemedir; eski istemci bilinmeyen alanı/mesajı yok sayar. Tek bozulma:
  eski (önbellekteki) istemci `maintenance` hata kodunu tanımaz ve mesajı düşürür (oda kurma düğmesi yanıt vermemiş gibi görünür); istemci her dağıtımda kendini yeniler
  ve yeni derleme bu kodu gösterir, bu yüzden sürüm artırılmadı (artırmak herkese "Güncelleme gerekli" ekranı gösterirdi).

## Web bildirimleri
İsteğe bağlı (oyuncu Ayarlar'dan açar; iOS'ta yalnız ana ekrana eklenmişse). Sunucu `GLIX_VAPID_PUBLIC`, `GLIX_VAPID_PRIVATE`,
`GLIX_VAPID_SUBJECT` ile açılır; harici paket yok: VAPID (RFC 8292, ES256) ve ileti şifreleme (RFC 8291, aes128gcm) `node:crypto` ile.
- Abonelik **yalnız bellekte**, `Player` üzerinde durur: oyuncu ayrılınca/atılınca/oda kapanınca silinir; sunucu yeniden başlarsa
  istemci `session` kabulünden sonra aboneliği yeniden gönderir. Push servisi 404/410 derse abonelik düşer.
- Gönderim: `fetch` POST, `TTL: 60`, `Urgency: high`, 5 sn zaman aşımı, yönlendirme izlenmez. Uç nokta izin listesi dışındaysa istek atılmaz.
- Alıcı: abonelik var **ve** (`visibility` ile gizli bildirmiş **ya da** bağlantısı kopuk ama oturumu yaşıyor). Oyuncu başına 20 sn'de en çok bir.
- Tetikleyiciler: (1) host maçı başlattı: "Oyun başlıyor!"; (2) sıra tabanlı oyunda sıra bir oyuncuya geçti: "Sıra sende!"
  (oyun tanımında isteğe bağlı `notify(state, ctx)`; şimdilik Zaman Bombası Hafızası ve Kör Bomba); (3) final sonrası host
  "Aynı ekiple yeni maç" (`returnToLobby`) dedi: "Yeni maç".
- Metin geneldir: `{title, body: "Oda KOD", tag}`; oyun içeriği, ad ya da gizli bilgi asla. Pazarlama yok.
- Tıklama (`public/sw-push.js`): açık pencere varsa öne getirilir, yoksa uygulama açılır ve kayıtlı oturum odayı geri getirir.
- **Arkadaş daveti (H8):** hesaplı bağlantıdan gelen `pushSubscribe` odasız da kabul edilir ve abonelik ayrıca **hesaba** bağlanır
  (U16 A3'ten beri **kalıcı**: `account_push` tablosu, bkz. `docs/HESAP.md`; çıkışta istemci `pushUnsubscribe` yollar ve `POST /api/auth/logout` sunucuda da siler,
  push servisi 404/410 derse düşer, aynı cihaz başka hesaba geçerse eski eşleme silinir; sunucu yeniden başlayınca kalır). Davet edilen hesabın canlı bağlantısı yoksa bu abonelikle
  `{title: "GLIX daveti", body: "<kullanıcı> seni GLIX odasına çağırıyor", tag: "glix-davet-KOD", url: "/?oda=KOD"}` gider; hizmet çalışanı
  yalnız `/` ile başlayan (`//` olmayan) `url`'yi tıklamada açar (açık pencere varsa ona gider). `url` oyun bildirimlerinde yoktur.
- **Herkese bildirim (U16 A3, yönetici):** `{title (≤40), body (≤120), tag: "glix-duyuru", url?}`. Hedefler: `account_push` + açık odalardaki bellek abonelikleri, uç noktaya göre
  tekilleştirilir. Saniyede en çok 20 gönderim (partiler arası 1 sn), 404/410 dönen abonelik silinir, saatte en çok 1 gönderim (son gönderim `server_settings.broadcast_last`te durur).

## Arkadaşlar (HTTP, `/api/friends`, H7; WS, H8)

Hepsi JSON; oturum çerezi şart (yoksa 401 `login_required`); misafir bu uçlardan hiçbir şey göremez. POST'larda `Origin` denetimi (403 `forbidden`),
`Content-Type: application/json`, gövde tam `{username}` (3–20 `[A-Za-z0-9_]`, büyük/küçük harf duyarsız). Hata gövdesi `{ok:false, code, message}` (Türkçe).
Hız sınırı hesap başına: okuma 30 ani/1 sn, yazma 30 ani/2 sn'de 1, `request` ayrıca 10 ani/6 sn'de 1 → 429 `rate_limited`.
- `GET /api/friends` → 200 `{ok:true, friends:[{username, since, status, joinable, withYou}], incoming:[{username, at}], outgoing:[{username, at}], blocked:[{username}]}`.
  `status` `offline|online|lobby|playing`; `joinable`: arkadaşın odasına şimdi girilebilir (lobide yer var, ya da maçta izleyiciye açık ve yer var);
  `withYou`: seninle aynı odada. **Oda kodu hiçbir yanıtta ve durum mesajında yoktur**; arkadaşa katılma `joinFriend` ile sunucuda çözülür. E-posta hiç dönmez.
- `POST request` → 200 `{ok:true, result:"sent"|"accepted"}` (karşı taraf zaten istemişse kendiliğinden kabul, `accepted`). 404 `not_found` (kullanıcı yok), 400 `self`,
  409 `already_friends` / `already_requested` / `blocked_by_me` (yalnız seni engelleyen sen isen) / `limit` (200 arkadaş ya da 50 bekleyen giden istek), 400 `request_failed` "İstek gönderilemedi."
  (karşı taraf seni engellemiş **ya da** karşının kotası dolu: sebep ayırt edilmez, engellendiğin sızmaz). Karşı hesabın bekleyen gelen isteği en çok 100.
- `POST accept` (yalnız karşının sana attığı isteği; yoksa 404 `no_request`, kota doluysa 409 `limit`), `decline` (karşıya haber verilmez), `cancel` (kendi isteğini geri çek),
  `remove` (arkadaşlıktan çıkar), `block` (arkadaşlık/istek silinir; karşı taraf istek atamaz, davet edemez), `unblock`. `decline/cancel/remove/unblock` idempotenttir (200).
  Bilinmeyen kullanıcı adı 404 `not_found`.
- Karşı tarafa canlı bildirim: `request` → `friendRequest`; `accept`, `cancel`, `remove`, `block` ve otomatik kabul → `friendsChanged`.
- **Durum (presence):** sunucu, hesaba bağlı canlı WS bağlantılarından türetir: bağlantı yok `offline`; bağlı ama odasız `online`; bir bağlantısı lobi aşamasındaki odada `lobby`
  (lobi, başka bağlantıdaki maçtan önceliklidir); odası lobi dışında (anlatım…final) `playing`. Sahne (TV) bağlantısı oyuncu sayılmaz. Hesaplı bağlantı odasız da kapatılmaz
  (60 sn boşta kapanma yalnız misafire uygulanır; çevrimiçi durumu ve canlı davet bu bağlantıdan gelir).
  Değişim `friendStatus` ile yalnız kabul edilmiş arkadaşların bağlantılarına yayılır; sunucu durumları en çok **1 sn'de bir** tarar, aralıktaki dalgalanmalar tek mesaj olur.
  Arkadaş değilsen ya da engelliysen hiçbir durum mesajı almazsın.
- **Davet:** `inviteFriend {username}` (yukarıdaki tabloda). Sunucu bekleyen davet tutmaz; `invite.expiresAt = şimdi + 10 dk` istemcide sayılır, katılma normal `joinRoom` ile yapılır
  (maçta "kapalı" ise mevcut `match_in_progress` mesajı). Önce canlı bağlantılara `invite` gider; hiçbiri yoksa hesaba bağlı web bildirimi aboneliği (bkz. "Web bildirimleri").
  Sınırlar: aynı arkadaşa 30 sn'de bir, gönderen başına dakikada 20 (kova denenen her davette harcanır). Yalnız kabul edilmiş arkadaşlara; engelleyen/engellenen davet edemez.
- **Profil:** `GET /api/profile/<kullanıcı>` kabul edilmiş arkadaşlara da açıktır (`recent` ve `coPlayers` yok); arkadaş olmayan ve bilinmeyen ad aynı 404'ü alır.
- Protokol sürümü **2 kalır**: eklenen sunucu mesajlarını eski istemci tanımadığı için yok sayar (parse `null`), eklenen istemci mesajlarını yalnız yeni istemci yollar;
  mevcut mesajların biçimi değişmedi.

## Hata kodları

`invalid_message`, `rate_limited`, `nickname_invalid`, `room_not_found`, `room_full`, `match_in_progress`,
`resume_failed`, `nickname_taken`, `not_host`, `not_in_room`, `already_in_room`, `invalid_games`, `avatar_taken`, `not_enough_players`,
`wrong_phase`, `not_participant`, `game_failed`, `draining`, `server_busy`, `stage_full`, `stage_readonly`, `login_required`,
`invite_failed`, `friend_not_found`, `account_name`, `maintenance`, `report_limit`, `report_duplicate`, `room_blocked`, `card_invalid`.

`login_required`: `createRoom` yalnız hesaplı bağlantıdan kabul edilir. Kodla katılma (`joinRoom`), oynama ve sahne (`joinStage`) misafire açıktır.

## Hesap uçları (HTTP, `/api/auth/`)

Hepsi JSON; yanıtlar `Cache-Control: no-store`. Hata gövdesi `{ok:false, code, message, field?}` (`message` Türkçe, kullanıcıya gösterilir).
- `POST register {username, email, password}` → 200 `{ok:true, account:{username,email}}` + `Set-Cookie`. Kullanıcı adı 3–20 `[A-Za-z0-9_]` (büyük/küçük harf duyarsız benzersiz), e-posta küçük harfe çevrilir ve benzersizdir, şifre 8–128 karakter. 400 `invalid_input`, 409 `username_taken` / `email_taken`.
- `POST login {login, password}` (`login`: kullanıcı adı ya da e-posta) → 200 aynı gövde + `Set-Cookie`; yanlış şifre ve bilinmeyen hesap aynı 401 `bad_credentials`.
- `POST logout` → 200, oturum silinir, çerez temizlenir. `GET me` → 200 `{ok:true, account:{username,email}|null}`.
- `GET me` ayrıca `providers:{google, mail}` (sunucuda Google / e-posta açık mı), `linked:{google, password}` (oturumdaki hesapta Google bağlı mı / şifre var mı) ve `verified` (e-postası doğrulanmış mı; oturum yoksa false) döner.
- **Google ile giriş** (yalnız yapılandırılmışsa): `GET google/start[?returnTo=/yol]` → 302 Google (`scope=openid email`, `prompt=select_account`, PKCE S256, `state`, `nonce`) + `glix_oauth` çerezi (HttpOnly, SameSite=Lax, `Path=/api/auth/google`, 10 dk, https ise Secure).
  `GET google/callback?code&state` → 302: başarıda `returnTo` (varsayılan `/`) + `glix_sess`; hatada `/#google-hata=<kod>` (`kapali`, `cok_deneme`, `gecersiz`, `iptal`, `dogrulanamadi`, `eposta_dogrulanmamis`, `eposta_kayitli`, `baska_hesap`, `zaten_bagli`); yeni kullanıcıda `/#google-yeni=<43 karakter belirteç>&u=<öneri>`.
  `POST google/complete {token, username}` → 200 `{ok:true, account}` + `Set-Cookie`; 400 `invalid_input`, 409 `username_taken` (belirteç korunur) / `email_taken` / `google_linked`, 410 `google_expired`, 404 `google_disabled`. `Origin` zorunlu. `returnTo` yalnız aynı kaynaktaki yol olabilir.
- **E-posta** (yalnız `GLIX_RESEND_API_KEY` + `GLIX_MAIL_FROM` + `GLIX_PUBLIC_URL` varsa; yoksa aşağıdaki POST uçları 404 `mail_disabled`):
  `GET verify?t=<43 karakter>` → 302 `/#eposta=dogrulandi` | `/#eposta=gecersiz` (belirteç 24 sa, tek kullanımlık).
  `POST verify/resend {}` → 200 `{ok:true, verified}`; oturum yoksa 401 `login_required`; hesap başına 60 sn'de 1, günde 5 → 429 `rate_limited`.
  `POST reset/request {email}` → 200 `{ok:true}` (hesap var olsun olmasın); geçersiz e-posta 400 `invalid_input`; IP başına günde 20 → 429. Bağlantı `<GLIX_PUBLIC_URL>/#sifre-sifirla=<belirteç>` (1 sa).
  `POST reset/confirm {token, password}` → 200 `{ok:true, account}` + yeni `Set-Cookie` (hesabın tüm eski oturumları silinir); 410 `token_invalid`, 400 `invalid_input`.
  `POST username {username}` (oturum şart; Origin + JSON + IP hız sınırı) → 200 `{ok:true, account, usernameAvailableAt}`; kurallar `register` ile aynı, büyük/küçük harf duyarsız benzersiz (kendi adının harf boyu değişebilir). **7 günde bir**: ilk değişiklik hemen serbest (hesap açılışından sayılmaz), sonrakiler son değişiklikten 7 gün sonra. 400 `invalid_input` / `username_same`, 401 `login_required`, 409 `username_taken`, 429 `username_cooldown` (`availableAt` ms; metin "Kullanıcı adını 3 Kasım 2026 14:05 tarihinde tekrar değiştirebilirsin.", Türkiye saati). Başarıda odadaki oyuncu adı yayınlanır, arkadaşlar/istek sahipleri `friendsChanged` alır. `GET me` de `usernameAvailableAt` (ms ya da null) döner.
  `POST password {current, password}` → 200 `{ok:true}` (diğer oturumlar silinir); 401 `login_required` / `bad_credentials` (`field:"current"`), 409 `no_password`, 429 `rate_limited`.
- Çerez `glix_sess`: 32 rastgele bayt (base64url), `HttpOnly; SameSite=Lax; Path=/; Max-Age=180 gün`, https ise `Secure` (doğrudan TLS ya da `TRUST_PROXY=1` ile güvenilen vekilin `X-Forwarded-Proto: https` bildirimi). Sunucuda yalnız sha256 özeti saklanır.
- POST'larda `Origin` zorunlu ve `Host` ile aynı olmalı (CSRF); `ALLOWED_ORIGINS` varsa onda da olmalı → 403 `forbidden`.
- Hız sınırı: IP başına kayıt/giriş 20 ani, 6 sn'de 1; hatalı parola hesap başına 8 ani, 30 sn'de 1 → 429 `rate_limited`.
- WS yükseltmesinde çerez okunur ve bağlantı hesaba bağlanır; oyuncu kaydında `accountId` yalnız sunucuda tutulur, hiçbir mesajda yayınlanmaz.
- Veri: `accounts`, `sessions`, `email_tokens` (`kind` verify|reset, yalnız sha256 özeti, `expires_at`) tabloları; `ACCOUNTS_DB` (varsayılan: `STATS_DB`; ikisi de yoksa bellekte, kalıcı değil). Şifre: scrypt (N=16384, r=8, p=1, 16 bayt tuz), parametreler özetle birlikte saklanır.

## KVKK uçları (HTTP, `/api/account/`, H10)

Yalnız `POST`; oturum çerezi, `Origin` denetimi ve IP hız sınırı şart (401 `login_required`, 403 `forbidden`, 405, 429 `rate_limited`). Hata gövdesi `{ok:false, code, message, field?}`.
- `POST export` (gövde yok sayılır) → 200, `Content-Type: application/json`, `Content-Disposition: attachment; filename="glix-verilerim-YYYY-MM-DD.json"`, `no-store`. Gövde: `aciklama`, `exported_at`, `account`, `sessions`, `stats {games, matches, coplay}`,
  `friends {friends, incoming_requests, outgoing_requests, blocked}`, `badges`, `push_subscription`. Şifre özeti ve oturum belirteci özeti yoktur. Hesap başına günde 3 (aşılınca 429).
- `POST delete {confirm, password?}` (JSON) → 200 `{ok:true}` + çerez silen `Set-Cookie`. 400 `invalid_input` / `confirm_mismatch` (`field:"confirm"`), 401 `bad_credentials` (`field:"password"`),
  403 `fresh_login_required` (şifresiz hesapta oturum 10 dk'dan eski), 429 (hesap başına saatte 5 deneme; hatalı şifre `pw:` kovasına da sayılır). Silme anında ve kalıcıdır; ilişkili hesaplar `friendsChanged` alır.
  Hesabın canlı WS bağlantıları misafire döner, odadaki oyuncu adıyla kalır. Yeni WS mesajı yok; protokol sürümü değişmedi.

## Profil ucu (HTTP, `/api/profile`, H5)

Yalnız `GET`; oturum çerezi şart (yoksa 401 `login_required`); yanıtlar `Cache-Control: no-store`. Hata gövdesi hesap uçlarındaki gibi `{ok:false, code, message}`.
- `GET /api/profile` → 200 `{ok:true, username, createdAt, totals:{matches, wins, winRate, games, gameWins}, favoriteGame:{id,name,plays}|null,
  perGame:[{gameId, name, plays, wins, bestMini, avgMini}], recent:[{endedAt, players, place, score}] (son 10 maç, yeniden eskiye),
  coPlayers:[{username, matches}] (en çok 5)}`. `winRate` 0–1 arası (3 ondalık); `wins`/`gameWins` yer 1 sayısı; `perGame` oynamaya göre azalan;
  `favoriteGame` en çok oynanan (eşitte en son oynanan); `name` katalogdaki ad (katalogda olmayan eski oyun için "Eski oyun"). Toplamlar SQL toplamlarıyla hesaplanır.
- Her iki yanıtta `badges:[{id, name, description, secret, earned, earnedAt|null}]` (H6): kendi profilinde tüm rozetler (kazanılmamış gizli rozet
  `{id:"gizli-N", name:"???", description:"Gizli rozet", secret:true, earned:false}` olur, gerçek kimlik/ad sızmaz); arkadaşın profilinde **yalnız kazanılanlar**.
- `GET /api/profile/<kullanıcı>` → aynı gövde, `recent` ve `coPlayers` **yok**. Oturumdaki hesabın kendi adı ve kabul edilmiş arkadaşlar için 200; başka ad,
  bilinmeyen ad ve geçersiz ad 404 `not_found` (hesabın var olup olmadığı sızmaz). Kabul edilmiş arkadaşlar için de 200 (H7).
- Veri: `account_games`, `account_matches`, `account_coplay` (ayrıntı `docs/HESAP.md`). Sunucu bunları oyun/maç bitince tek işlemde yazar (`AccountStatsRecorder`, `Runtime.accountStats`).

## Arkadaş sıralaması (HTTP, `/api/leaderboard`, H9)

Yalnız `GET`; oturum çerezi şart (401 `login_required`); hesap başına hız sınırı (429 `rate_limited`); `Cache-Control: no-store`. Yalnız **sen ve kabul edilmiş arkadaşların**
(bekleyen istek, engelli ve yabancı yok). Geçersiz sorgu 400 `invalid_input`.
- `GET /api/leaderboard?period=week|all&metric=wins|score|matches` → 200 `{ok:true, rows:[{username, value, rank, you}]}`. `value` dönemdeki `account_matches`
  toplamı: `wins` = yer 1 sayısı, `score` = genel skor toplamı, `matches` = maç sayısı. Değere göre azalan; eşit değer aynı `rank`'ı paylaşır (1, 1, 3); eşitlikte kullanıcı adı sırası.
  Maçı olmayan kişi `value: 0` ile listelenir. `week` = **İstanbul pazartesi 00:00'dan** beri (Türkiye yıl boyu UTC+3); `all` = tümü.
- `GET /api/leaderboard/games?period=week|all` → 200 `{ok:true, games:[{gameId, name, leader:{username, wins}, you:{wins}}]}`. Oyun başına en çok birincilik
  (eşitlikte oynama, sonra ad); kimsenin birinciliği olmayan oyun yok; birincilik sayısına göre azalan.
- Tek toplu SQL sorgusu (`IN (kimlikler)`, arkadaş sayısı en çok 200).

## Yönetici uçları (HTTP, `/api/admin/`, U16 A1 salt okunur, A2 hesap işlemleri, A3 içerik ve bakım)

Ayrıntı ve kurulum: `docs/ADMIN.md`. `GLIX_ADMIN_ACCOUNT_IDS` boşsa tüm uçlar ve `/admin` sayfası 404 verir.

- Erişim: geçerli `glix_sess` + hesap kimliği listede + e-postayla alınan koddan sonra verilen `glix_admin` çerezi
  (HttpOnly, SameSite=Strict, Path=/api/admin, Secure, 12 saat; yalnız özeti saklanır, o hesap oturumuna bağlı).
- Yanıtlar: oturum yok 401 `login_required`; yönetici olmayan 404; çerez yok 403 `otp_required`.
- `GET status` -> `{state: "need_otp" | "ready"}`.
- `POST otp/request` (gövdesiz): 6 haneli kod e-postalanır (10 dk, tek kullanım, özet olarak saklanır; hesapta 60 sn arayla,
  günde 10). 503 `mail_disabled`, 502 `mail_failed`, 429 `too_soon`.
- `POST otp/verify {code}`: doğruysa 200 + `glix_admin` çerezi; 400 `invalid_code`/`expired`, 429 `locked` (5 yanlış deneme).
- `POST logout`: yönetici çerezini siler. Tüm POST'larda `Origin` zorunlu ve Host ile aynı olmalı.
- `GET live` (`AdminLive`), `GET stats` (`AdminStats`), `GET errors` (`AdminErrors`): tipler `packages/engine/src/admin.ts`.
  Oyuncu adı, kullanıcı adı, e-posta, IP ve oyun durumu içermez; açık oda satırında yalnız kod, aşama, sayılar ve oyun kimliği.
- Kayıt: `admin_audit(id, account_id, action, detail, at, target_id)`; kod isteği/başarı/hata/kilit, çıkış ve A2 hesap işlemleri yazılır
  (kod, belirteç, e-posta ve askı sebebi asla). 1 yıl saklanır.
- **A2, hesap uçları** (hepsi giriş kodu çerezi ister; tipler `AdminAccounts`, `AdminAccountSearch`, `AdminAccountDetail`, `AdminAuditPage`):
  - `GET accounts`: toplam, doğrulanmış, giriş yöntemi dağılımı (`google`/`password`/`both` ayrık), 7/30 günde maç bitiren, askıdaki sayısı,
    30 günlük yeni hesap, e-posta sayaçları (`mail`: gün x tür x {ok, failed}, 30 gün toplamı; `enabled:false` = istatistik kapalı).
    Sayaç: stats göç 5 `mail_stats(day, kind, ok, failed)`, adres/hesap yok, 90 gün.
  - `GET accounts/search?q=`: `q` "@" içeriyorsa tam e-posta (`account_search_email` kaydı, arama metni yazılmaz), değilse kullanıcı adı öneki
    (büyük/küçük harf duyarsız, 1-20 `[A-Za-z0-9_]`); en çok 20 satır; satırda e-posta yok. 400 `invalid_input`.
  - `GET accounts/detail?id=`: e-postanın göründüğü tek yer; her başarılı çağrı `account_view` (+ hedef kimlik) kaydeder. 404 `not_found`.
  - `GET audit?before=<kayıt kimliği>&limit=` (varsayılan 50, en çok 100): yeniden eskiye `{entries:[{id, actorId, action, targetId, detail, at}], nextBefore}`.
  - `POST accounts/rename {id, username}`, `accounts/suspend {id, duration:"1d"|"7d"|"forever", reason(1-140)}`, `accounts/unsuspend {id}`,
    `accounts/delete {id, confirm:<kullanıcı adı>}`, `accounts/logout-all {id}`: 200 `{ok:true, ...}`; 400 `invalid_input`/`username_same`/`confirm_mismatch`,
    403 `protected` (yönetici hesabı), 404 `not_found`, 409 `username_taken`/`not_suspended`, 429 `rate_limited`
    (işlem: 10 ani, 6 sn'de 1; arama 30 ani, 2 sn'de 1; ayrıntı 20 ani, 3 sn'de 1; yönetici başına). Kayıt eylemleri: `account_rename`,
    `account_suspend` (ayrıntı: süre), `account_unsuspend`, `account_delete`, `account_logout_all` (ayrıntı: kapanan oturum sayısı).
- **A3, içerik ve bakım uçları** (giriş kodu çerezi ister; tipler `AdminContent`, `AdminMaintenance`, `AdminBroadcastStatus` — `packages/engine/src/admin.ts`). Tüm POST'lar:
  `Origin` denetimi, yönetici başına işlem hız sınırı (10 ani, 6 sn'de 1), işlem kaydı. Hata gövdesi `{ok:false, code, message}`.
  - `GET content` -> `{games: AdminGameSwitch[], announcement}`. `POST content/game {id, open?: boolean, random?: boolean}` (en az biri) -> `{ok, games}`; 404 `not_found`.
    Kayıt `game_switch` (`<oyun>:open|closed|pool_in|pool_out`). Ayarlar `server_settings.games` (JSON, yalnız varsayılandan farklılar) içinde kalıcıdır.
  - `POST announcement/set {text, kind, endsAt: ms|null}` (metin 1-140 düz metin, `<` `>` yok; bitiş ileri bir an ve ≤ 30 gün) -> `{ok, announcement}`; `POST announcement/clear {}`.
    Kayıt `announcement_set` (ayrıntı: tür; metin yazılmaz), `announcement_clear`.
  - `GET push/status` -> `{enabled, subscribers, nextAllowedAt, last}`. `POST push/broadcast {title, body, url: "/yol"|null}` -> **202** `{ok, total}` (gönderim arka planda sürer,
    sonuç `push/status`ta `last: {at, title, total, sent, failed, removed, finished}`); 400 `invalid_input`, 409 `broadcast_running`/`broadcast_empty`, 429 `broadcast_cooldown`,
    503 `broadcast_disabled`. Kayıt `push_broadcast` (ayrıntı: hedef sayısı) ve bitince `push_broadcast_done` (`gitti/gitmedi/silindi`); başlık ve metin yazılmaz.
  - `GET maintenance` -> `{on, activeMatches, rooms, players, draining, backup: {usedToday, limit, nextAt}, releases: AdminRelease[≤20]}`. `POST maintenance/set {on}`;
    kayıt `maintenance_on` / `maintenance_off`. Bakım kipi `server_settings.maintenance`te kalıcıdır (yeniden başlatmada da açık kalır).
  - `POST backup {ack: true}` -> **tar akışı** (`application/x-tar`, `Content-Disposition: attachment; filename="glix-yedek-YYYYMMDD-HHMM.tar"`, `Content-Length` bilinir). İçinde `glix.db`
    (hesap ve istatistik aynı dosyaysa, üretimde) ya da `glix-hesap.db` + `glix-istatistik.db`; her biri `VACUUM INTO` ile alınmış tutarlı SQLite kopyası, e-posta adresleri içerir.
    Koşullar: yönetici çerezi en çok 30 dk önce alınmış olmalı (yoksa 403 `fresh_required`, `db_backup_denied` kaydı); son 24 saatte en çok 3 yedek (429 `backup_limit`, sayım işlem kaydından);
    aynı anda tek yedek (409 `backup_busy`); 400 `invalid_input` (`ack` yok). Geçici klasör `os.tmpdir()` altında (konteynerde `/tmp`, bellek diski) `glix-yedek-*`, akış bitince/kopunca silinir.
    Kayıt `db_backup` (ayrıntı: dosya sayısı; indirme başlamadan yazılır), `db_backup_failed`.
- Oyuncu tarafı: askıdaki hesap `POST /api/auth/login` ile 403 `{code:"account_suspended", message, until}` alır; Google dönüşü
  `/#google-hata=askida[&bitis=<ms>]`; şifre sıfırlama onayı da 403 verir.
- İstemci hataları artık kalıcıdır (`/api/client-error` yine 204): `client_errors(day, message, frame, platform, browser, version,
  count, first_seen, last_seen)` gün başına gruplu; mesaj 200 karaktere kısaltılır, adres sorgusu/parçası, e-posta, IP ve uzun
  belirteçler atılır; `frame` yığının tepe karesi (taban dosya adı); ham kullanıcı aracısı saklanmaz; günde en çok 3000 satır.
  Çöken oyunlar: `game_failures(id, game_id, fn, message, at)` (maç kaydı yazılmaz). İkisi de 90 gün saklanır (stats göç 4).

## Oyuncu bildirimi ve yönetici moderasyonu (U16 A4)

Protokol sürümü **artmadı** (2): yalnız yeni mesaj ve değerler eklendi; eski istemci bilinmeyen mesajı yok sayar (eski sunucu yeni `report` mesajını `invalid_message` sayar; ikisi birlikte dağıtılır). Tek fark: eski istemci `left` mesajının yeni sebeplerini (`adminClosed`, `removed`) görmez ve oda ekranında kalır; sonraki hamlesi `not_in_room` hatası alır, sayfayı yenileyince düzelir.

- **`report {playerId, reason: "name"|"abuse"|"cheat"|"other", note?}`** (istemci → sunucu): aynı odadaki başka oyuncuyu bildirir (lobi, sonuç, final; hesaplı ya da misafir; sahne yollayamaz: `stage_readonly`). `note` ≤200 karakter (denetim/biçim karakterleri boşluğa iner, kırpılır; boş not yok sayılır). Başarıda yalnız bildirene `reportAck`; hata: `report_duplicate` (aynı bildiren, hedef, oda: 24 saat), `report_limit` (bildiren başına saatte 5; hesaplıda hesap, misafirde bağlantı IP'si), `not_in_room` (kendini ya da odada olmayanı), `server_busy` (kayıt yazılamadı). Hedefe ve diğerlerine hiçbir şey gitmez.
- **`left` sebepleri:** `adminClosed` ("Oda yönetici tarafından kapatıldı."), `removed` ("Odadan çıkarıldın."). `room_blocked` hatası: yönetici tarafından atıldığın odaya 10 dakika girilemez ("Odadan çıkarıldın, bu odaya şimdilik giremezsin."; `joinRoom`/`joinFriend`).
- **Ad denetimi:** yasaklı kelimeye takılan misafir takma adı (`joinRoom`, `joinFriend`, `rename`) `nickname_invalid` + "Bu ad kullanılamaz." alır. Hesap uçları `POST /api/auth/register|username|google/complete` 400 `invalid_input` (`field:"username"`, `message:"Bu ad kullanılamaz."`) döner.
- **Yönetici uçları** (giriş kodu çerezi; tüm POST'lar Origin + işlem hız sınırı + işlem kaydı; tipler `packages/engine/src/moderation/report.ts`):
  - `GET reports?status=new|reviewed|actioned|rejected&before=&limit=` -> `{reports: AdminReportRow[], nextBefore, counts}`; `GET reports/detail?id=` -> `AdminReportDetail` (not, kanıt, yönetici notu, `targetPlayerId`, `inRoom`, `targetProtected`). Notlu/kanıtlı ayrıntı yalnız bu uçtadır.
  - `POST reports/status {id, status, note(≤300)}`; kayıt `report_status` (`<kimlik>:<durum>`, hedef hesap kimliği `target_id`; not yazılmaz).
  - `GET rooms/players?code=` -> `{code, phase, players:[{id, nickname, connected, spectator, host, account}]}`: görünen adların göründüğü tek uç; her başarılı çağrı `room_view` (oda kodu) yazar. 404 oda yok.
  - `POST rooms/close {code}` (herkese ve TV'ye `left: adminClosed`, süren maç hesap istatistiği/rozet yazılmadan biter; kayıt `room_close`), `POST rooms/kick {code, playerId}` (`left: removed`, 10 dk giriş engeli; kayıt `room_kick`). Canlı durum tablosunda oyuncu adı hâlâ yoktur.
  - `GET banned-words` -> `{words:[{word, addedAt}], max: 500}`; `POST banned-words/add {word}` (1-40 karakter, normalleşince ≥2 harf; 409 `exists`/`full`), `POST banned-words/remove {word}` (404 yok); kayıt `banned_word_add|remove`. `GET banned-words/accounts` -> listeye takılan mevcut hesaplar (en çok 50, salt okunur).
  - `GET pools` -> `{pools: AdminPoolSummary[], customMax}`; `GET pools/entries?pool=&q=&filter=all|builtin|custom|disabled&page=` -> `AdminPoolPage`; `POST pools/toggle {pool,key,disabled}`, `pools/add {pool,fields}`, `pools/edit {pool,key,fields}`, `pools/delete {pool,key}`, `pools/check|bulk {pool,lines[≤200]}` -> `AdminPoolBulk`. Kayıt: `pool_*` (girdi metni yazılmaz). Ayrıntı: `docs/ADMIN.md` "İçerik havuzları".

## Sınırlar (sunucu)

- Mesaj en çok 8 KiB; giden tampon 1 MB'ı aşan (okumayan) soket koparılır. Sunucu 20 sn'de bir ping atar, pong gelmeyen soket koparılır.
- `MAX_SOCKETS`=3000, `MAX_SOCKETS_PER_IP`=40, `MAX_ROOMS`=1000 (`server_busy`); IP başına oda kurma: 10 ani, 6 sn'de 1.
- 60 sn odaya girmeyen **misafir** soketi 4000 ile kapanır (hesaplı soket açık kalır). Soket başına 10 yanlış oda kodunda ve üst üste 100 `rate_limited`'de 1008 ile kapanır; IP başına yanlış kod kovası 20 ani, 3 sn'de 1.
- `TRUST_PROXY=1` iken loopback/özel adresten gelen isteklerde `X-Forwarded-For` son girdisi istemci IP'sidir.
- Maç kaydı en çok 20 000 eylem tutar; aşılırsa `truncated` olur ve `replay` reddeder.

## Telemetri, istatistik, geri bildirim (A5)

Amaç: beta oyun gecelerinden öğrenmek. Kişisel veri tutulmaz: takma ad, IP, oturum anahtarı, cevap/çizim içeriği yok.

- **İstemci hataları:** `POST /api/client-error` gövde JSON `{message, stack?, url?, version, ua?}`, en fazla 4 KB,
  IP başına dakikada 10. Sunucu yapılandırılmış günlüğe `client_error` olarak yazar (IP yazılmaz); yanıt 204.
- **İstatistik (SQLite, `/data/glix.db`, 90 gün saklanır):**
  - `matches(id, started_at, ended_at, player_count, selection_mode, game_count, completed)`
  - `game_plays(match_id, game_id, player_count, started_at, duration_ms, outcome)` — outcome: `finished`|`aborted`|`failed`
  - `feedback(match_id, rating, text, created_at)`
- **Okuma:** yalnız sunucu içinden `node dist/stats.js` ile özet (oyun başına oynanma, ortalama süre, ortalama puan,
  son geri bildirim metinleri). Dışarıya uç nokta açılmaz.
- **Performans (anonim, oyun başına):** istemci her oyunun sonunda tek bir `perf` mesajı yollar (yeni uç nokta yok, aynı WebSocket).
  İçerik yalnız sayılardır; oyuncu kimliği, takma ad, oda kodu, metin yok. Tablo `perf(match_id, game_id, created_at, rtt_ms, ack_p50, ack_p95, ack_n, slow_taps, tap_p95, long_tasks, long_task_ms, platform, reconnects, reloads)` (son üçü göç 3 ile eklendi; eski satırlar `diger`/0), 90 gün saklanır.
  - `rttMs`: ping/pong gidiş-dönüşünün son 9 örnek medyanı. `ackP50`/`ackP95`/`ackN`: `action` gönderiminden `actionAck`'e kadar geçen süre (ms) ve örnek sayısı.
  - `slowTaps`: Event Timing API'de 200 ms'den uzun süren etkileşim sayısı; `tapP95`: bildirilen etkileşim sürelerinin p95'i (tarayıcı yalnız ≥ 40 ms olanları bildirir, bu yüzden yalnız yavaş kuyruğu gösterir).
  - `longTasks`/`longTaskMs`: Long Tasks API sayısı ve toplam süresi. Desteklemeyen tarayıcıda (ör. iOS Safari) Event Timing ve Long Tasks alanları 0 gelir.
  - Eylem yapmamış ve yavaşlık görmemiş oyuncu mesaj göndermez. Geliştirme önizlemesinde (mock) ölçüm yoktur.
  - Özet: `node dist/stats.js` "Cihaz performansı" tablosunu oyun başına örnek sayısı, medyan RTT, medyan onay, onay p95'inin p95'i, örnek başı yavaş dokunma ve uzun görev ms olarak, en kötü oyun başta verir; ayrıca "Platforma göre" tablosu (ios / android / diger) örnek, medyan RTT, medyan onay, onay p95, yavaş dokunma, kopma ve sayfa yenileme ortalamalarını gösterir.
- **Yayın gecikmesi:** sunucu değişiklikleri odaya en çok 16 ms birleştirerek yayar (`BROADCAST_INTERVAL_MS`); WebSocket sıkıştırması (`perMessageDeflate`) kapalı, TCP_NODELAY açıktır.
