import { diffMerge, type RoomSnapshot } from "@glix/engine";
import type { Clock } from "./clock.js";
import { log } from "./log.js";
import { abortMatch, matchViewFor, sharedMatchSnapshot } from "./match.js";
import type { Connection, Player, Room, Runtime } from "./runtime.js";

export const BROADCAST_INTERVAL_MS = 50;

export interface Broadcaster {
  /** Odanın değiştiğini bildirir; en geç 50 ms içinde tek bir yayın yapılır. */
  markDirty(room: Room): void;
  /** Bekleyen yayını iptal eder (oda silinirken). */
  cancel(room: Room): void;
  /** Bekleyen yayını hemen yapar. */
  flush(room: Room): void;
  /** İstemci `resync` istedi: yalnız bu bağlantıya tam snapshot gönderir. */
  resync(room: Room, player: Player): void;
}

/**
 * Bağlantıya snapshot gönderir. Önceki gönderilenden fark küçükse `patch`, yoksa (ilk mesaj, fark ifade
 * edilemiyor ya da yama tam snapshot'tan büyük) tam `room`.
 */
export function deliver(conn: Connection, snapshot: RoomSnapshot): void {
  const full = JSON.stringify({ type: "room", snapshot });
  const last = conn.lastSent;
  conn.lastSent = snapshot;
  if (last && last.code === snapshot.code && last.selfId === snapshot.selfId) {
    const patch = diffMerge(last, snapshot);
    if (patch) {
      const text = JSON.stringify({ type: "patch", baseRev: last.rev, rev: snapshot.rev, patch });
      if (text.length < full.length) {
        conn.sendRaw(text);
        return;
      }
    }
  }
  conn.sendRaw(full);
}

export function createBroadcaster(clock: Clock, getRuntime: () => Runtime): Broadcaster {
  /** Odanın herkese ortak snapshot kısmı; `rev` burada artar. */
  function buildShared(rt: Runtime, room: Room) {
    return {
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
  }

  function snapshotFor(
    rt: Runtime,
    room: Room,
    shared: ReturnType<typeof buildShared>,
    sharedMatch: ReturnType<typeof sharedMatchSnapshot>,
    player: Player,
  ): RoomSnapshot {
    return {
      ...shared,
      selfId: player.id,
      match: sharedMatch ? { ...sharedMatch, view: matchViewFor(rt, room, player.id) } : null,
    };
  }

  /** Oyunun view'ı/maç görüntüsü çöktü: maç iptal edilir, oda lobi görüntüsüyle yeniden yayınlanır. */
  function fail(rt: Runtime, room: Room, err: unknown): void {
    if (room.match) abortMatch(rt, room, err);
    else log.error("snapshot_failed", { roomCode: room.code, error: String(err) });
  }

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
    const shared = buildShared(rt, room);
    let sharedMatch: ReturnType<typeof sharedMatchSnapshot>;
    try {
      sharedMatch = sharedMatchSnapshot(room);
    } catch (err) {
      fail(rt, room, err);
      return;
    }
    for (const player of connected) {
      const conn = player.conn;
      if (!conn) continue;
      let snapshot: RoomSnapshot;
      try {
        snapshot = snapshotFor(rt, room, shared, sharedMatch, player);
      } catch (err) {
        fail(rt, room, err);
        return;
      }
      try {
        deliver(conn, snapshot);
      } catch (err) {
        log.warn("broadcast_failed", { roomCode: room.code, error: String(err) });
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
    resync(room, player) {
      const conn = player.conn;
      if (!conn) return;
      const rt = getRuntime();
      conn.lastSent = null;
      try {
        const shared = buildShared(rt, room);
        deliver(conn, snapshotFor(rt, room, shared, sharedMatchSnapshot(room), player));
      } catch (err) {
        fail(rt, room, err);
      }
    },
  };
}
