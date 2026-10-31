import { diffMerge, type MergePatch, type RoomSnapshot } from "@glix/engine";
import type { Clock } from "./clock.js";
import { catalogFor } from "./gameSwitches.js";
import { log } from "./log.js";
import {
  abortMatch,
  GameFault,
  matchInspireFor,
  matchMineFor,
  matchViewFor,
  sharedMatchSnapshot,
} from "./match.js";
import type { Connection, Player, Room, Runtime } from "./runtime.js";

/** Birleştirme penceresi: bir eylemin yayını en çok bu kadar gecikir (tick 100 ms olduğundan tick yayınları zaten seyrek). */
export const BROADCAST_INTERVAL_MS = 16;

export interface Broadcaster {
  /** Odanın değiştiğini bildirir; en geç BROADCAST_INTERVAL_MS içinde tek bir yayın yapılır. */
  markDirty(room: Room): void;
  /** Bekleyen yayını iptal eder (oda silinirken). */
  cancel(room: Room): void;
  /** Bekleyen yayını hemen yapar. */
  flush(room: Room): void;
  /** İstemci `resync` istedi: yalnız bu bağlantıya tam snapshot gönderir. */
  resync(room: Room, player: Player): void;
  /** Sahne `resync` istedi: yalnız bu sahne bağlantısına tam snapshot gönderir. */
  resyncStage(room: Room, conn: Connection): void;
}

/**
 * Bağlantıya snapshot gönderir. Önceki gönderilenden fark küçükse `patch`, yoksa (ilk mesaj, fark ifade
 * edilemiyor ya da yama tam snapshot'tan büyük) tam `room`.
 */
export function deliver(conn: Connection, snapshot: RoomSnapshot): void {
  const last = conn.lastSent;
  conn.lastSent = snapshot;
  if (last && last.code === snapshot.code && last.selfId === snapshot.selfId) {
    const patch = diffMerge(last, snapshot);
    if (patch) {
      sendPatchOrRoom(conn, last.rev, snapshot, patch);
      return;
    }
  }
  const full = JSON.stringify({ type: "room", snapshot });
  conn.fullLenHint = full.length;
  conn.sendRaw(full);
}

/** Bu uzunluğun altındaki yama tam snapshot'tan (katalog dahil kilobaytlar) kesin küçüktür; karşılaştırılmaz. */
const PATCH_COMPARE_FROM = 256;

/**
 * Yama bağlantının bilinen tam metin uzunluğunun bu oranının altındaysa karşılaştırma yapılmaz: yama kesin
 * küçüktür (ölçüm: yayınların %43'ü ~5 KB'lık tam metni yalnız karşılaştırmak için kodluyordu).
 */
const PATCH_CLEARLY_SMALLER = 0.5;

/** Yama tam snapshot'tan küçükse yama, değilse tam `room` gönderir. Tam metin yalnız gerekirse üretilir. */
function sendPatchOrRoom(conn: Connection, baseRev: number, snapshot: RoomSnapshot, patch: MergePatch): void {
  const text = JSON.stringify({ type: "patch", baseRev, rev: snapshot.rev, patch });
  const hint = conn.fullLenHint;
  if (
    text.length >= PATCH_COMPARE_FROM &&
    (hint === undefined || text.length >= hint * PATCH_CLEARLY_SMALLER)
  ) {
    const full = JSON.stringify({ type: "room", snapshot });
    conn.fullLenHint = full.length;
    if (text.length >= full.length) {
      conn.sendRaw(full);
      return;
    }
  }
  conn.sendRaw(text);
}

/** Hazır işaretli, bağlı, host olmayan oyuncular (katılım sırasıyla). */
function lobbyReadyIds(room: Room): string[] {
  return [...room.players.values()]
    .filter((p) => p.lobbyReady && p.id !== room.hostId && p.conn !== null)
    .map((p) => p.id);
}

type Shared = Omit<RoomSnapshot, "rev" | "serverNow" | "selfId" | "match"> & {
  match: Omit<NonNullable<RoomSnapshot["match"]>, "view" | "mine"> | null;
};

/**
 * Odanın ortak kısmının son hesaplanan hali ve bir önceki sürümden farkı. Ortak fark yayın başına bir kez
 * hesaplanır; her bağlantı yalnız kendi `match.view` farkını ekler. `rev`/`serverNow` ortak içeriğe girmez:
 * yalnız içerik değişince (ya da oyuncunun görünümü değişince) gönderilen mesajlara yazılır.
 */
interface SharedCache {
  /** İçerik her değiştiğinde artar; bağlantılar en son gönderdikleri sürümü `conn.sentVer`'de tutar. */
  ver: number;
  content: Shared | null;
  /** `ver - 1` -> `ver` yaması; ifade edilemiyorsa null (herkese tam hesap). */
  patch: MergePatch | null;
}

export function createBroadcaster(clock: Clock, getRuntime: () => Runtime): Broadcaster {
  const caches = new WeakMap<Room, SharedCache>();

  function sharedContent(rt: Runtime, room: Room, sharedMatch: Shared["match"]): Shared {
    return {
      code: room.code,
      hostId: room.hostId,
      phase: room.phase,
      players: [...room.players.values()].map((p) => ({
        id: p.id,
        nickname: p.nickname,
        avatar: p.avatar,
        connected: p.conn !== null,
        score: p.score,
        spectator: p.spectator,
        ...(p.username !== null ? { username: p.username } : {}),
        ...(p.cosmetics ? { cosmetics: p.cosmetics } : {}),
      })),
      gameIds: [...room.gameIds],
      selection: { ...room.selection },
      // Eski istemciler alanı zorunlu okur (docs/PROTOKOL.md); ton kaldırıldı, sabit değer.
      tone: "arkadas",
      joinPolicy: room.joinPolicy,
      cardSettings: { enabled: room.cardSettings.enabled, off: [...room.cardSettings.off] },
      stageCount: room.stages.size,
      lobbyReady: room.phase === "lobby" ? lobbyReadyIds(room) : [],
      catalog: catalogFor(rt, room),
      match: sharedMatch,
    };
  }

  /** Ortak içeriği yeniler; öncekinden farklıysa sürümü artırıp farkı saklar. */
  function refreshShared(rt: Runtime, room: Room): { cache: SharedCache; content: Shared } {
    const content = sharedContent(rt, room, sharedMatchSnapshot(rt, room));
    let cache = caches.get(room);
    if (!cache) {
      cache = { ver: 0, content: null, patch: null };
      caches.set(room, cache);
    }
    if (cache.content === null) {
      cache.ver++;
      cache.patch = null;
    } else {
      const patch = diffMerge(cache.content, content);
      if (patch === null || Object.keys(patch).length > 0) {
        cache.ver++;
        cache.patch = patch;
      }
    }
    cache.content = content;
    return { cache, content };
  }

  function snapshotFor(
    rt: Runtime,
    room: Room,
    rev: number,
    serverNow: number,
    content: Shared,
    player: Player,
  ): RoomSnapshot {
    return {
      ...content,
      rev,
      serverNow,
      selfId: player.id,
      match: content.match
        ? {
            ...content.match,
            view: matchViewFor(rt, room, player.id),
            mine: matchMineFor(rt, room, player.id),
            inspire: matchInspireFor(rt, room, player.id),
          }
        : null,
    };
  }

  /**
   * Sahne (TV) görünümü: oyuncu kimliği yok (`selfId` boş), `match.view` = `view(durum, null)` (izleyiciyle aynı).
   * Sahne hiçbir oyuncuya bağlı değildir; oyuna kimliği hiç verilmez.
   */
  function snapshotForStage(
    rt: Runtime,
    room: Room,
    rev: number,
    serverNow: number,
    content: Shared,
  ): RoomSnapshot {
    return {
      ...content,
      rev,
      serverNow,
      selfId: "",
      match: content.match
        ? { ...content.match, view: matchViewFor(rt, room, null), mine: null, inspire: null }
        : null,
    };
  }

  /**
   * Sahneye bu yayında yeni bir şey yok (ortak içerik ve `view(durum, null)` aynı): mesaj gönderilmez. Böylece
   * yalnız bir oyuncunun kişisel görünümünü değiştiren gizli eylem (ör. Zehirli Kadeh kontrolü) sahnede boş bir
   * yamayla bile iz bırakmaz; oyuncuların hızlı yolundaki "değişiklik yoksa gönderme" kuralının sahne eşi.
   */
  function stageUnchanged(
    rt: Runtime,
    room: Room,
    conn: Connection,
    cache: SharedCache,
    prevVer: number,
  ): boolean {
    const last = conn.lastSent;
    if (!last || conn.sentVer !== prevVer || cache.ver !== prevVer) return false;
    const view = last.match ? matchViewFor(rt, room, null) : null;
    return JSON.stringify(last.match?.view ?? null) === JSON.stringify(view ?? null);
  }

  /** Oyunun view'ı/maç görüntüsü çöktü: maç iptal edilir, oda lobi görüntüsüyle yeniden yayınlanır. */
  function fail(rt: Runtime, room: Room, err: unknown): void {
    if (room.match) abortMatch(rt, room, err);
    else log.error("snapshot_failed", { roomCode: room.code, error: String(err) });
  }

  /**
   * Hızlı yol: bağlantı odanın bir önceki ortak sürümündeyse ortak yama + kendi `view` yaması birleştirilir.
   * Hiçbir şey değişmediyse mesaj gitmez (bağlantının `lastSent`'i ve sürümü olduğu gibi kalır, sonraki
   * yama hâlâ onun son rev'ine dayanır). Hızlı yol uygulanamıyorsa false döner.
   */
  function sendFast(
    rt: Runtime,
    room: Room,
    conn: Connection,
    player: Player,
    cache: SharedCache,
    content: Shared,
    prevVer: number,
    rev: number,
    serverNow: number,
  ): boolean {
    const last = conn.lastSent;
    if (!last || conn.sentVer !== prevVer || (cache.ver !== prevVer && cache.patch === null)) return false;
    if ((last.match === null) !== (content.match === null)) return false;
    let viewPatch: MergePatch | null = null;
    let view: unknown = null;
    let mine: ReturnType<typeof matchMineFor> = null;
    let inspire: ReturnType<typeof matchInspireFor> = null;
    if (content.match && last.match) {
      view = matchViewFor(rt, room, player.id);
      mine = matchMineFor(rt, room, player.id);
      inspire = matchInspireFor(rt, room, player.id);
      viewPatch = diffMerge(
        { view: last.match.view, mine: last.match.mine ?? null, inspire: last.match.inspire ?? null },
        { view, mine, inspire },
      );
      if (viewPatch === null) return false;
    }
    const sharedChanged = cache.ver !== prevVer;
    const viewChanged =
      viewPatch !== null && ("view" in viewPatch || "mine" in viewPatch || "inspire" in viewPatch);
    if (!sharedChanged && !viewChanged) return true; // yalnız rev/serverNow değişti: gönderilmez
    const patch: MergePatch = { rev, serverNow, ...(sharedChanged ? cache.patch : null) };
    if (viewChanged && content.match && viewPatch) {
      const m = patch.match;
      const own: MergePatch = {};
      if ("view" in viewPatch) own.view = viewPatch.view;
      if ("mine" in viewPatch) own.mine = viewPatch.mine;
      if ("inspire" in viewPatch) own.inspire = viewPatch.inspire;
      patch.match = { ...(typeof m === "object" && m !== null ? m : null), ...own };
    }
    const snapshot: RoomSnapshot = {
      ...content,
      rev,
      serverNow,
      selfId: player.id,
      match: content.match ? { ...content.match, view, mine, inspire } : null,
    };
    conn.lastSent = snapshot;
    conn.sentVer = cache.ver;
    sendPatchOrRoom(conn, last.rev, snapshot, patch);
    return true;
  }

  function flush(room: Room): void {
    if (room.flushCancel) {
      room.flushCancel();
      room.flushCancel = null;
    }
    room.lastFlushAt = clock.now();
    const connected = [...room.players.values()].filter((p) => p.conn !== null);
    if (connected.length === 0 && room.stages.size === 0) return;
    const rt = getRuntime();
    // Ortak kısım bir kez hesaplanır ve bir kez farklanır; oyuncu başına yalnız selfId ve match.view eklenir.
    let refreshed: ReturnType<typeof refreshShared>;
    const prevVer = caches.get(room)?.ver ?? 0;
    try {
      refreshed = refreshShared(rt, room);
    } catch (err) {
      fail(rt, room, err);
      return;
    }
    const { cache, content } = refreshed;
    const rev = ++room.rev;
    const serverNow = clock.now();
    for (const player of connected) {
      const conn = player.conn;
      if (!conn) continue;
      try {
        if (sendFast(rt, room, conn, player, cache, content, prevVer, rev, serverNow)) continue;
        deliver(conn, snapshotFor(rt, room, rev, serverNow, content, player));
        conn.sentVer = cache.ver;
      } catch (err) {
        if (err instanceof GameFault) {
          fail(rt, room, err);
          return;
        }
        log.warn("broadcast_failed", { roomCode: room.code, error: String(err) });
      }
    }
    for (const conn of [...room.stages]) {
      try {
        if (stageUnchanged(rt, room, conn, cache, prevVer)) continue;
        deliver(conn, snapshotForStage(rt, room, rev, serverNow, content));
        conn.sentVer = cache.ver;
      } catch (err) {
        if (err instanceof GameFault) {
          fail(rt, room, err);
          return;
        }
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
        const { cache, content } = refreshShared(rt, room);
        deliver(conn, snapshotFor(rt, room, ++room.rev, clock.now(), content, player));
        conn.sentVer = cache.ver;
      } catch (err) {
        fail(rt, room, err);
      }
    },
    resyncStage(room, conn) {
      const rt = getRuntime();
      conn.lastSent = null;
      try {
        const { cache, content } = refreshShared(rt, room);
        deliver(conn, snapshotForStage(rt, room, ++room.rev, clock.now(), content));
        conn.sentVer = cache.ver;
      } catch (err) {
        fail(rt, room, err);
      }
    },
  };
}
