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
| `resume` | `token` | yeniden bağlanma; başarısızsa `error{code:"resume_failed"}` |
| `leaveRoom` | — | |
| `kick` | `playerId` | yalnız host, yalnız lobide (maçta `wrong_phase`); kendini/olmayanı atamaz (`not_in_room`). Atılanın oturum anahtarı silinir; `resume` `resume_failed` döner. Oda koduyla yeniden katılma engellenmez |
| `transferHost` | `playerId` | yalnız host, yalnız lobide; hedef odada ve bağlı olmalı, kendisi olamaz (`not_in_room`). Taç hedefe geçer, bekleyen host devri iptal olur, hedefin hazır işareti silinir |
| `rename` | `nickname` | `normalizeNickname` kuralları; yalnız lobide (`wrong_phase`); odada başkasında olan ad (büyük/küçük harf duyarsız) `nickname_taken`; oyuncu başına 1 sn'de en çok bir değişiklik (`rate_limited`); aynı ad sessizce yok sayılır |
| `react` | `emoji` | yalnız `LOBBY_EMOJIS` (👋 😂 🔥 😱 👏 ❤️), aksi `invalid_message`; yalnız lobide; oyuncu başına 700 ms'de bir. Fazlası ve lobi dışı **sessizce** atılır (hata yok). Cevap: herkese `reaction` olayı |
| `setReady` | `ready` (boolean) | lobide "Hazırım" işareti; yalnız lobide (`wrong_phase`); host için sessizce yok sayılır. Başlamak için şart değildir |
| `setGames` | `gameIds` | yalnız host, yalnız lobide; boş olamaz, tekrar yok; modu `manual` yapar |
| `setRandom` | `count` | yalnız host, yalnız lobide; 1..katalog boyu; modu `random` yapar |
| `chooseAvatar` | `avatar` (0–7) | yalnız lobide (`wrong_phase`); başkasında olan karakter `avatar_taken` ("Bu karakteri X aldı"), ilk gelen alır; aynı değer sessizce yok sayılır |
| `setJoinPolicy` | `policy` (`izleyici`\|`kapali`) | yalnız host, yalnız lobide; başka değer `invalid_message`, maçta `wrong_phase`, host değilse `not_host`; aynı değer sessizce yok sayılır |
| `setTone` | `tone` (`aile`\|`arkadas`\|`ofis`) | yalnız host, yalnız lobide; başka değer `invalid_message`, maçta `wrong_phase`, host değilse `not_host`; aynı değer sessizce yok sayılır |
| `startMatch` | — | yalnız host; bağlı oyuncu sayısı tüm seçili oyunların min'ini karşılamalı |
| `ready` | — | yalnız `briefing` aşamasında (lobi işareti için `setReady`) |
| `action` | `seq`, `payload` | yalnız `playing`; `seq` istemci sayacı, `actionAck` ile döner |
| `returnToLobby` | — | yalnız host, yalnız `final` |
| `resync` | — | yama uygulanamadığında tam `room` snapshot ister |
| `feedback` | `rating` (1–5), `text?` (≤ 300) | yalnız `final`; maç başına bir kez; cevap `actionAck` değil, sessizce kaydedilir |
| `perf` | `gameId`, `rttMs`, `ackP50`, `ackP95`, `ackN`, `slowTaps`, `tapP95`, `longTasks`, `longTaskMs` | yalnız `results` aşamasında ve yalnız o anki oyunun `gameId`'si için; oyun başına oyuncu başına bir kez; sessizce kaydedilir (cevap yok). Tam anahtar kümesi, hepsi negatif olmayan tam sayı: `rttMs`,`ackP50`,`ackP95`,`tapP95` ≤ 60 000; `ackN`,`slowTaps`,`longTasks` ≤ 10 000; `longTaskMs` ≤ 600 000; `gameId` ≤ 64 karakter. Aşan ya da fazladan alanlı mesaj `invalid_message` |

## Sunucu → istemci

| type | alanlar |
|---|---|
| `welcome` | `protocolVersion`, `serverVersion` |
| `pong` | `t`, `serverTime` |
| `session` | `token`, `playerId`, `roomCode` — istemci `localStorage`'a yazar |
| `room` | `snapshot: RoomSnapshot` — odaya girişte, resume ve `resync` sonrası (tam) |
| `patch` | `baseRev`, `rev`, `patch` — sonraki değişimler, JSON Merge Patch (RFC 7386) |
| `actionAck` | `seq`, `ok`, `reason?` |
| `left` | `reason: "left" \| "kicked" \| "closed"` |
| `reaction` | `playerId`, `emoji` | **Geçici olay**: oda durumunda (`room`/`patch`) saklanmaz, `rev` almaz, yeniden bağlanana tekrarlanmaz. Lobide gönderenle birlikte odadaki tüm bağlı oyunculara gider |
| `error` | `code`, `message` (Türkçe, oyuncuya gösterilebilir) |

**Görünümler:** `match.publicView` odadaki herkes için aynıdır (oda başına bir kez hesaplanır ve
farklanır); `match.view` yalnız o oyuncuya özeldir. Gizli bilgi yalnız `view`'da, yalnız hak sahibine gider.

**Yama kuralı:** Sunucu her bağlantıya son gönderdiği snapshot'ı tutar ve yalnız farkı yollar.
İstemci `baseRev` kendi `rev`'ine eşitse yamayı uygular, değilse yamayı atıp `resync` gönderir.
Fark tam snapshot'tan büyükse sunucu doğrudan `room` gönderir. Hiçbir görünür alan değişmediyse mesaj
gönderilmez; `rev` ve `serverNow` yalnız gönderilen mesajlarda ilerler (istemci saati ping/pong ile eşler,
`serverNow`'a ihtiyaç duymaz).

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

## Hata kodları

`invalid_message`, `rate_limited`, `nickname_invalid`, `room_not_found`, `room_full`, `match_in_progress`,
`resume_failed`, `nickname_taken`, `not_host`, `not_in_room`, `already_in_room`, `invalid_games`, `avatar_taken`, `not_enough_players`,
`wrong_phase`, `not_participant`, `game_failed`, `draining`, `server_busy`.

## Sınırlar (sunucu)

- Mesaj en çok 8 KiB; giden tampon 1 MB'ı aşan (okumayan) soket koparılır. Sunucu 20 sn'de bir ping atar, pong gelmeyen soket koparılır.
- `MAX_SOCKETS`=3000, `MAX_SOCKETS_PER_IP`=40, `MAX_ROOMS`=1000 (`server_busy`); IP başına oda kurma: 10 ani, 6 sn'de 1.
- 60 sn odaya girmeyen soket 4000 ile kapanır. Soket başına 10 yanlış oda kodunda ve üst üste 100 `rate_limited`'de 1008 ile kapanır; IP başına yanlış kod kovası 20 ani, 3 sn'de 1.
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
  İçerik yalnız sayılardır; oyuncu kimliği, takma ad, oda kodu, metin yok. Tablo `perf(match_id, game_id, created_at, rtt_ms, ack_p50, ack_p95, ack_n, slow_taps, tap_p95, long_tasks, long_task_ms)`, 90 gün saklanır.
  - `rttMs`: ping/pong gidiş-dönüşünün son 9 örnek medyanı. `ackP50`/`ackP95`/`ackN`: `action` gönderiminden `actionAck`'e kadar geçen süre (ms) ve örnek sayısı.
  - `slowTaps`: Event Timing API'de 200 ms'den uzun süren etkileşim sayısı; `tapP95`: bildirilen etkileşim sürelerinin p95'i (tarayıcı yalnız ≥ 40 ms olanları bildirir, bu yüzden yalnız yavaş kuyruğu gösterir).
  - `longTasks`/`longTaskMs`: Long Tasks API sayısı ve toplam süresi. Desteklemeyen tarayıcıda (ör. iOS Safari) Event Timing ve Long Tasks alanları 0 gelir.
  - Eylem yapmamış ve yavaşlık görmemiş oyuncu mesaj göndermez. Geliştirme önizlemesinde (mock) ölçüm yoktur.
  - Özet: `node dist/stats.js` "Cihaz performansı" tablosunu oyun başına örnek sayısı, medyan RTT, medyan onay, onay p95'inin p95'i, örnek başı yavaş dokunma ve uzun görev ms olarak, en kötü oyun başta verir.
- **Yayın gecikmesi:** sunucu değişiklikleri odaya en çok 16 ms birleştirerek yayar (`BROADCAST_INTERVAL_MS`); WebSocket sıkıştırması (`perMessageDeflate`) kapalı, TCP_NODELAY açıktır.
