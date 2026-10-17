import type { Clock } from "./clock.js";
import { log } from "./log.js";
import { matchViewFor, sharedMatchSnapshot } from "./match.js";
import type { Room, Runtime } from "./runtime.js";

export const BROADCAST_INTERVAL_MS = 50;

export interface Broadcaster {
  /** Odanın değiştiğini bildirir; en geç 50 ms içinde tek bir yayın yapılır. */
  markDirty(room: Room): void;
  /** Bekleyen yayını iptal eder (oda silinirken). */
  cancel(room: Room): void;
  /** Bekleyen yayını hemen yapar. */
  flush(room: Room): void;
}

export function createBroadcaster(clock: Clock, getRuntime: () => Runtime): Broadcaster {
  function flush(room: Room): void {
    if (room.flushCancel) {
      room.flushCancel();
      room.flushCancel = null;
    }
    room.lastFlushAt = clock.now();
    const connected = [...room.players.values()].filter((p) => p.conn !== null);
    if (connected.length === 0) return;
    const rt = getRuntime();
    // Ortak kısım bir kez hesaplanır; oyuncu başına yalnız selfId ve match.view eklenir.
    const shared = {
      rev: ++room.rev,
      serverNow: clock.now(),
      code: room.code,
      hostId: room.hostId,
      phase: room.phase,
      players: [...room.players.values()].map((p) => ({
        id: p.id,
        nickname: p.nickname,
        avatar: p.avatar,
        connected: p.conn !== null,
        score: p.score,
      })),
      gameIds: [...room.gameIds],
      catalog: rt.catalog,
    };
    const sharedMatch = sharedMatchSnapshot(room);
    for (const player of connected) {
      try {
        player.conn?.send({
          type: "room",
          snapshot: {
            ...shared,
            selfId: player.id,
            match: sharedMatch ? { ...sharedMatch, view: matchViewFor(rt, room, player.id) } : null,
          },
        });
      } catch (err) {
        log.warn("broadcast_failed", { room: room.code, error: String(err) });
      }
    }
  }

  return {
    markDirty(room) {
      if (room.flushCancel) return;
      const wait = Math.max(0, room.lastFlushAt + BROADCAST_INTERVAL_MS - clock.now());
      room.flushCancel = clock.setTimeout(() => {
        room.flushCancel = null;
        flush(room);
      }, wait);
    },
    cancel(room) {
      if (room.flushCancel) {
        room.flushCancel();
        room.flushCancel = null;
      }
    },
    flush,
  };
}
