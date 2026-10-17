# GLIX v2 — Protokol v2 (A1)

Tek WebSocket: `/ws`. Tüm mesajlar JSON, `type` alanlı. Tipler: `packages/engine/src/protocol.ts`.
Sunucu tek otoritedir; istemci yalnız niyet gönderir.

## İstemci → sunucu

| type | alanlar | not |
|---|---|---|
| `hello` | `clientVersion` | bağlantı açılınca ilk mesaj |
| `ping` | `t` | saat farkı ölçümü |
| `createRoom` | `nickname` | 1–16 karakter, kırpılır; biçim/yön/görünmez karakter (`Cf`,`Zl`,`Zp`,`Co`,`Cs`) yasak, en çok 2 ardışık birleştirici işaret, en az bir harf/rakam (yalnız emoji reddedilir) |
| `joinRoom` | `code`, `nickname` | 5 karakter, büyük harfe çevrilir |
| `resume` | `token` | yeniden bağlanma; başarısızsa `error{code:"resume_failed"}` |
| `leaveRoom` | — | |
| `kick` | `playerId` | yalnız host, yalnız lobide |
| `setGames` | `gameIds` | yalnız host, yalnız lobide; boş olamaz, tekrar yok; modu `manual` yapar |
| `setRandom` | `count` | yalnız host, yalnız lobide; 1..katalog boyu; modu `random` yapar |
| `startMatch` | — | yalnız host; bağlı oyuncu sayısı tüm seçili oyunların min'ini karşılamalı |
| `ready` | — | yalnız `briefing` aşamasında |
| `action` | `seq`, `payload` | yalnız `playing`; `seq` istemci sayacı, `actionAck` ile döner |
| `returnToLobby` | — | yalnız host, yalnız `final` |
| `resync` | — | yama uygulanamadığında tam `room` snapshot ister |
| `feedback` | `rating` (1–5), `text?` (≤ 300) | yalnız `final`; maç başına bir kez; cevap `actionAck` değil, sessizce kaydedilir |

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
| `error` | `code`, `message` (Türkçe, oyuncuya gösterilebilir) |

**Görünümler:** `match.publicView` odadaki herkes için aynıdır (oda başına bir kez hesaplanır ve
farklanır); `match.view` yalnız o oyuncuya özeldir. Gizli bilgi yalnız `view`'da, yalnız hak sahibine gider.

**Yama kuralı:** Sunucu her bağlantıya son gönderdiği snapshot'ı tutar ve yalnız farkı yollar.
İstemci `baseRev` kendi `rev`'ine eşitse yamayı uygular, değilse yamayı atıp `resync` gönderir.
Fark tam snapshot'tan büyükse sunucu doğrudan `room` gönderir. Hiçbir görünür alan değişmediyse mesaj
gönderilmez; `rev` ve `serverNow` yalnız gönderilen mesajlarda ilerler (istemci saati ping/pong ile eşler,
`serverNow`'a ihtiyaç duymaz).

## Maç kaydı

Her oyun için `GameLog` (tohum, katılımcılar, zaman damgalı kabul edilen eylemler) bellekte tutulur.
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
- Maç sırasında yeni oyuncu katılamaz (`error{code:"match_in_progress"}`); `resume` her zaman çalışır.
- Bağlantı kopan oyuncu 120 sn içinde dönmezse odadan çıkarılır. Host koparsa 20 sn beklenir; bu sürede dönerse host olarak kalır.
  20 sn dolunca host bağlı en eski oyuncuya geçer (eski host dönünce geri almaz). Host kendi isteğiyle
  `leaveRoom` yaparsa devir hemen olur.
- Oda boş kalırsa 120 sn sonra silinir.

## Hata kodları

`invalid_message`, `rate_limited`, `nickname_invalid`, `room_not_found`, `room_full`, `match_in_progress`,
`resume_failed`, `not_host`, `not_in_room`, `already_in_room`, `invalid_games`, `not_enough_players`,
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
