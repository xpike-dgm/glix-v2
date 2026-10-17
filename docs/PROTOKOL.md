# GLIX v2 — Protokol v2 (A1)

Tek WebSocket: `/ws`. Tüm mesajlar JSON, `type` alanlı. Tipler: `packages/engine/src/protocol.ts`.
Sunucu tek otoritedir; istemci yalnız niyet gönderir.

## İstemci → sunucu

| type | alanlar | not |
|---|---|---|
| `hello` | `clientVersion` | bağlantı açılınca ilk mesaj |
| `ping` | `t` | saat farkı ölçümü |
| `createRoom` | `nickname` | 1–16 karakter, kırpılır |
| `joinRoom` | `code`, `nickname` | 5 karakter, büyük harfe çevrilir |
| `resume` | `token` | yeniden bağlanma; başarısızsa `error{code:"resume_failed"}` |
| `leaveRoom` | — | |
| `kick` | `playerId` | yalnız host, yalnız lobide |
| `setGames` | `gameIds` | yalnız host, yalnız lobide; boş olamaz, tekrar yok |
| `startMatch` | — | yalnız host; bağlı oyuncu sayısı tüm seçili oyunların min'ini karşılamalı |
| `ready` | — | yalnız `briefing` aşamasında |
| `action` | `seq`, `payload` | yalnız `playing`; `seq` istemci sayacı, `actionAck` ile döner |
| `returnToLobby` | — | yalnız host, yalnız `final` |

## Sunucu → istemci

| type | alanlar |
|---|---|
| `welcome` | `protocolVersion`, `serverVersion` |
| `pong` | `t`, `serverTime` |
| `session` | `token`, `playerId`, `roomCode` — istemci `localStorage`'a yazar |
| `room` | `snapshot: RoomSnapshot` — her durum değişiminde, oyuncu başına |
| `actionAck` | `seq`, `ok`, `reason?` |
| `left` | `reason: "left" \| "kicked" \| "closed"` |
| `error` | `code`, `message` (Türkçe, oyuncuya gösterilebilir) |

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
`wrong_phase`, `not_participant`.
