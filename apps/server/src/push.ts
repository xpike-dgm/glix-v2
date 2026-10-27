import type { PushKind } from "./pushText.js";
import { pushPayload } from "./pushText.js";
import type { Player, Room, Runtime } from "./runtime.js";
import { isConnected } from "./runtime.js";

/** Aynı oyuncuya iki bildirim arasındaki en kısa süre (ms). */
export const PUSH_MIN_GAP_MS = 20_000;

/** Oyuncu şu an uygulamaya bakmıyor mu: sayfa gizli ya da bağlantı koptu (yeniden bağlanabilir). */
export function isBackgrounded(player: Player): boolean {
  return player.hidden || !isConnected(player);
}

/** Odada bildirim isteyen en az bir oyuncu var mı (yoksa oyun kancası hiç çağrılmaz). */
export function roomHasPush(rt: Runtime, room: Room): boolean {
  if (!rt.push.enabled) return false;
  for (const p of room.players.values()) if (p.push) return true;
  return false;
}

/**
 * Seçilen oyunculardan yalnız arka plandakilere, 20 sn sınırıyla bildirim yollar. Metin geneldir ve yalnız
 * oda kodunu içerir. Gönderim beklenmez; hata oyunu etkilemez. 404/410 gelirse abonelik silinir.
 */
export function notifyPlayers(rt: Runtime, room: Room, kind: PushKind, playerIds: Iterable<string>): void {
  if (!rt.push.enabled) return;
  const now = rt.clock.now();
  const payload = pushPayload(kind, room.code);
  for (const id of playerIds) {
    const player = room.players.get(id);
    const target = player?.push;
    if (!player || !target || !isBackgrounded(player)) continue;
    if (now - player.lastPushAt < PUSH_MIN_GAP_MS) continue;
    player.lastPushAt = now;
    rt.push
      .send(target, payload)
      .then((result) => {
        if (result === "gone" && player.push === target) player.push = null;
      })
      .catch(() => undefined);
  }
}
