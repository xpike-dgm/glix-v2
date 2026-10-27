# GLIX v2 — Protokol v2 (A1)

Tek WebSocket: `/ws`. Tüm mesajlar JSON, `type` alanlı. Tipler: `packages/engine/src/protocol.ts`.
Sunucu tek otoritedir; istemci yalnız niyet gönderir.

## İstemci → sunucu

| type | alanlar | not |
|---|---|---|
| `hello` | `clientVersion` | bağlantı açılınca ilk mesaj |
| `ping` | `t` | saat farkı ölçümü |
| `createRoom` | `nickname` | 1–16 karakter, kırpılır; biçim/yön/görünmez karakter (`Cf`,`Zl`,`Zp`,`Co`,`Cs`) yasak, en çok 2 ardışık birleştirici işaret, en az bir harf/rakam (yalnız emoji reddedilir) |
| `joinRoom` | `code`, `nickname`, isteğe bağlı `avatar` (0–7) | 5 karakter, büyük harfe çevrilir |
| `joinStage` | `code` | **Sahne (TV)** olarak odaya bağlan (bkz. "Sahne (TV) rolü"). `nickname`/`avatar` yok; `room_not_found` / `stage_full` / `draining` / `rate_limited` döner |
| `resume` | `token` | yeniden bağlanma; başarısızsa `error{code:"resume_failed"}` |
| `leaveRoom` | — | |
| `kick` | `playerId` | yalnız host, yalnız lobide (maçta `wrong_phase`); kendini/olmayanı atamaz (`not_in_room`). Atılanın oturum anahtarı silinir; `resume` `resume_failed` döner. Oda koduyla yeniden katılma engellenmez |
| `transferHost` | `playerId` | yalnız host, yalnız lobide; hedef odada ve bağlı olmalı, kendisi olamaz (`not_in_room`). Taç hedefe geçer, bekleyen host devri iptal olur, hedefin hazır işareti silinir |
| `rename` | `nickname` | `normalizeNickname` kuralları; yalnız lobide (`wrong_phase`); odada başkasında olan ad (büyük/küçük harf duyarsız) `nickname_taken`; oyuncu başına 1 sn'de en çok bir değişiklik (`rate_limited`); aynı ad sessizce yok sayılır |
| `react` | `emoji` | yalnız `LOBBY_EMOJIS` (👋 😂 🔥 😱 👏 ❤️), aksi `invalid_message`; yalnız lobi, sonuç (`results`) ve final aşamalarında (oyun sırasında blöf işareti taşıyabileceği için kapalı); oyuncu başına 700 ms'de bir. Fazlası ve izinsiz aşama **sessizce** atılır (hata yok). Cevap: herkese `reaction` olayı |
| `setReady` | `ready` (boolean) | lobide "Hazırım" işareti; yalnız lobide (`wrong_phase`); host için sessizce yok sayılır. Başlamak için şart değildir |
| `setGames` | `gameIds` | yalnız host, yalnız lobide; boş olamaz, tekrar yok; modu `manual` yapar |
| `setRandom` | `count` | yalnız host, yalnız lobide; 1..katalog boyu; modu `random` yapar |
| `chooseAvatar` | `avatar` (0–7) | yalnız lobide (`wrong_phase`); başkasında olan karakter `avatar_taken` ("Bu karakteri X aldı"), ilk gelen alır; aynı değer sessizce yok sayılır |
| `setJoinPolicy` | `policy` (`izleyici`\|`kapali`) | yalnız host, yalnız lobide; başka değer `invalid_message`, maçta `wrong_phase`, host değilse `not_host`; aynı değer sessizce yok sayılır |
| `setTone` | `tone` (`aile`\|`arkadas`\|`ofis`) | yalnız host, yalnız lobide; başka değer `invalid_message`, maçta `wrong_phase`, host değilse `not_host`; aynı değer sessizce yok sayılır |
| `startMatch` | — | yalnız host; bağlı oyuncu sayısı tüm seçili oyunların min'ini karşılamalı |
| `ready` | — | yalnız `briefing` aşamasında (lobi işareti için `setReady`) |
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
| `welcome` | `protocolVersion`, `serverVersion`, `pushKey?` — sunucu web bildirimi gönderebiliyorsa VAPID genel anahtarı (base64url); yoksa alan hiç gelmez ve istemci Ayarlar'daki anahtarı gizler |
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

## İçerik tonu

- `RoomSnapshot.tone`: `"aile" | "arkadas" | "ofis"`; yeni oda `"arkadas"`. Oyuna özel değil, odaya özel küçük bir ayardır;
  içerik havuzu olan oyunlar (şimdilik Laf Sokma) kullanır, diğerleri yok sayar. Maçlar arası lobiye dönünce korunur.
- Sunucu tonu maç başında (her oyunun `setup`ında) `GameContext.tone` olarak verir; yalnız `setup` okur.
  Oyun içinde ton değişmez (lobi dışında `setTone` reddedilir).
- `GameLog.tone` kaydedilir; `replay` `setup`ı aynı tonla çağırır, böylece aynı havuz kurulur.

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
lobby → [her oyun için: briefing → countdown(3 sn) → playing → results(7 sn)] → final → (host) lobby
```

- **briefing:** Katılımcıların hepsi `ready` gönderince biter. Bağlantısı kopmuş oyuncu beklenmez.
  Güvenlik süresi 40 sn; dolunca otomatik geçilir.
- **playing:** Oyunun `isFinished` true olunca biter.
- **results:** `GameResult` gösterilir; `awards` genel skora eklenmiş olarak gelir.
- **results:** `match.continueIds` "Devam" diyenleri taşır (yalnız kimler). Sıradaki oyun `gameIds[round+1]` ile bellidir (zaten herkese açık). Önceki genel puan, istemcide `player.score − result.awards[id]` ile bulunur (sıra değişimi animasyonu için ek alan yok). Tur özeti satırı istemcide `summarizeRound(gameId, result, players, publicView)` ile (engine, saf) üretilir.
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
  (yalnız bellekte, `hesap → abonelik`; çıkışta istemci `pushUnsubscribe` yollar, sunucu yeniden başlayınca ya da push servisi 404/410
  derse düşer, aynı cihaz başka hesaba geçerse eski eşleme silinir). Davet edilen hesabın canlı bağlantısı yoksa bu abonelikle
  `{title: "GLIX daveti", body: "<kullanıcı> seni GLIX odasına çağırıyor", tag: "glix-davet-KOD", url: "/?oda=KOD"}` gider; hizmet çalışanı
  yalnız `/` ile başlayan (`//` olmayan) `url`'yi tıklamada açar (açık pencere varsa ona gider). `url` oyun bildirimlerinde yoktur.

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
`invite_failed`, `friend_not_found`.

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
  `POST password {current, password}` → 200 `{ok:true}` (diğer oturumlar silinir); 401 `login_required` / `bad_credentials` (`field:"current"`), 409 `no_password`, 429 `rate_limited`.
- Çerez `glix_sess`: 32 rastgele bayt (base64url), `HttpOnly; SameSite=Lax; Path=/; Max-Age=180 gün`, https ise `Secure` (doğrudan TLS ya da `TRUST_PROXY=1` ile güvenilen vekilin `X-Forwarded-Proto: https` bildirimi). Sunucuda yalnız sha256 özeti saklanır.
- POST'larda `Origin` zorunlu ve `Host` ile aynı olmalı (CSRF); `ALLOWED_ORIGINS` varsa onda da olmalı → 403 `forbidden`.
- Hız sınırı: IP başına kayıt/giriş 20 ani, 6 sn'de 1; hatalı parola hesap başına 8 ani, 30 sn'de 1 → 429 `rate_limited`.
- WS yükseltmesinde çerez okunur ve bağlantı hesaba bağlanır; oyuncu kaydında `accountId` yalnız sunucuda tutulur, hiçbir mesajda yayınlanmaz.
- Veri: `accounts`, `sessions`, `email_tokens` (`kind` verify|reset, yalnız sha256 özeti, `expires_at`) tabloları; `ACCOUNTS_DB` (varsayılan: `STATS_DB`; ikisi de yoksa bellekte, kalıcı değil). Şifre: scrypt (N=16384, r=8, p=1, 16 bayt tuz), parametreler özetle birlikte saklanır.

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
