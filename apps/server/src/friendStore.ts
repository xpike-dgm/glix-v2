import type { DatabaseSync } from "node:sqlite";

/** Bir hesabın en çok kaç arkadaşı olabilir. */
export const MAX_FRIENDS = 200;
/** Bir hesabın aynı anda bekleyen en çok kaç giden isteği olabilir. */
export const MAX_OUTGOING = 50;
/** Bir hesaba aynı anda bekleyen en çok kaç gelen istek yığılabilir (istek yağmurunu keser). */
export const MAX_INCOMING = 100;

/** Liste satırı: karşı tarafın hesabı ve zamanı (kabul zamanı ya da istek zamanı). */
export interface FriendEdge {
  id: number;
  username: string;
  at: number;
}

export interface FriendLists {
  friends: FriendEdge[];
  incoming: FriendEdge[];
  outgoing: FriendEdge[];
  blocked: FriendEdge[];
}

/**
 * `sent`: istek gitti. `accepted`: karşı taraf zaten istemişti, arkadaş oldunuz.
 * `blockedByMe`: karşıyı sen engellemişsin. `limit`: senin arkadaş ya da giden istek kotan dolu.
 * `failed`: karşı taraf seni engellemiş ya da karşının kotası dolu; neden bilerek söylenmez.
 */
export type RequestResult =
  | "sent"
  | "accepted"
  | "already"
  | "pending"
  | "self"
  | "blockedByMe"
  | "limit"
  | "failed";

/** Arkadaşlık ve engelleme tabloları (`friends`, `blocks`). Kimlikler hesap kimliğidir. */
export interface FriendStore {
  /** `from` kullanıcısından `to` kullanıcısına istek; karşı taraf zaten istemişse kendiliğinden kabul olur. */
  requestFriend(from: number, to: number, now: number): RequestResult;
  /** `me`, `other`'ın isteğini kabul eder. İstek yoksa "none"; kota dolduysa "limit". */
  acceptFriend(me: number, other: number, now: number): "ok" | "none" | "limit";
  /** `me`, `other`'ın bekleyen isteğini siler. Silinen varsa true. */
  declineFriend(me: number, other: number): boolean;
  /** `me`, kendi bekleyen isteğini geri çeker. Silinen varsa true. */
  cancelFriend(me: number, other: number): boolean;
  /** Kabul edilmiş arkadaşlığı siler. Silinen varsa true. */
  removeFriend(me: number, other: number): boolean;
  /** `me`, `other`'ı engeller (varsa arkadaşlık ya da istek de silinir). Kendini engellemek false. */
  blockAccount(me: number, other: number, now: number): boolean;
  /** Engeli kaldırır. Silinen varsa true. */
  unblockAccount(me: number, other: number): boolean;
  /** Listeler: arkadaşlar (kabul zamanı), gelen/giden istekler ve engellenenler. */
  friendLists(me: number): FriendLists;
  /** Kabul edilmiş arkadaşların kimlikleri. */
  friendIds(me: number): number[];
  areFriends(a: number, b: number): boolean;
  /** İki yönden biri diğerini engellemiş mi. */
  blockedBetween(a: number, b: number): boolean;
  /** Bekleyen gelen istek sayısı (ana sayfadaki rozet). */
  incomingCount(me: number): number;
}

/** Göçte kullanılan şema (accountStore.ts MIGRATIONS). `a < b` kanonik çifttir; satır tek, yön `requested_by`de. */
export const FRIENDS_SCHEMA = `CREATE TABLE friends (
     a INTEGER NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
     b INTEGER NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
     state TEXT NOT NULL CHECK (state IN ('pending', 'accepted')),
     requested_by INTEGER NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
     created_at INTEGER NOT NULL,
     updated_at INTEGER NOT NULL,
     PRIMARY KEY (a, b),
     CHECK (a < b)
   );
   CREATE INDEX friends_b ON friends (b);
   CREATE TABLE blocks (
     blocker INTEGER NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
     blocked INTEGER NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
     created_at INTEGER NOT NULL,
     PRIMARY KEY (blocker, blocked)
   );
   CREATE INDEX blocks_blocked ON blocks (blocked);`;

interface PairRow {
  state: "pending" | "accepted";
  requested_by: number;
}

const lo = (x: number, y: number): number => Math.min(x, y);
const hi = (x: number, y: number): number => Math.max(x, y);

export function createFriendStore(db: DatabaseSync, inTransaction: (work: () => void) => void): FriendStore {
  const pair = db.prepare("SELECT state, requested_by FROM friends WHERE a = ? AND b = ?");
  const insert = db.prepare(
    "INSERT INTO friends (a, b, state, requested_by, created_at, updated_at) VALUES (?, ?, 'pending', ?, ?, ?)",
  );
  const accept = db.prepare("UPDATE friends SET state = 'accepted', updated_at = ? WHERE a = ? AND b = ?");
  const dropPair = db.prepare("DELETE FROM friends WHERE a = ? AND b = ?");
  const dropPending = db.prepare(
    "DELETE FROM friends WHERE a = ? AND b = ? AND state = 'pending' AND requested_by = ?",
  );
  const dropAccepted = db.prepare("DELETE FROM friends WHERE a = ? AND b = ? AND state = 'accepted'");
  const friendCount = db.prepare(
    "SELECT COUNT(*) AS n FROM friends WHERE state = 'accepted' AND (a = ? OR b = ?)",
  );
  const outgoingCount = db.prepare(
    "SELECT COUNT(*) AS n FROM friends WHERE state = 'pending' AND requested_by = ?",
  );
  const incomingNumber = db.prepare(
    "SELECT COUNT(*) AS n FROM friends WHERE state = 'pending' AND requested_by != ? AND (a = ? OR b = ?)",
  );
  const insertBlock = db.prepare(
    "INSERT OR IGNORE INTO blocks (blocker, blocked, created_at) VALUES (?, ?, ?)",
  );
  const dropBlock = db.prepare("DELETE FROM blocks WHERE blocker = ? AND blocked = ?");
  const blockOf = db.prepare("SELECT 1 AS x FROM blocks WHERE blocker = ? AND blocked = ?");
  const rows = db.prepare(
    `SELECT acc.id AS id, acc.username AS username, f.state AS state, f.requested_by AS requested_by,
            f.created_at AS created_at, f.updated_at AS updated_at
       FROM friends f JOIN accounts acc ON acc.id = CASE WHEN f.a = ? THEN f.b ELSE f.a END
      WHERE f.a = ? OR f.b = ?`,
  );
  const blockedRows = db.prepare(
    `SELECT acc.id AS id, acc.username AS username, b.created_at AS created_at
       FROM blocks b JOIN accounts acc ON acc.id = b.blocked WHERE b.blocker = ?`,
  );
  const acceptedIds = db.prepare(
    `SELECT CASE WHEN a = ? THEN b ELSE a END AS id FROM friends
      WHERE state = 'accepted' AND (a = ? OR b = ?)`,
  );

  const count = (stmt: ReturnType<DatabaseSync["prepare"]>, ...args: number[]): number =>
    (stmt.get(...args) as { n: number }).n;
  const isBlocked = (x: number, y: number): boolean => blockOf.get(x, y) !== undefined;
  const byName = (x: FriendEdge, y: FriendEdge): number =>
    x.username.toLowerCase().localeCompare(y.username.toLowerCase());

  return {
    requestFriend(from, to, now) {
      if (from === to) return "self";
      let result: RequestResult = "failed";
      inTransaction(() => {
        if (isBlocked(from, to)) {
          result = "blockedByMe";
          return;
        }
        if (isBlocked(to, from)) return;
        const row = pair.get(lo(from, to), hi(from, to)) as PairRow | undefined;
        if (row?.state === "accepted") {
          result = "already";
          return;
        }
        if (row) {
          if (row.requested_by === from) {
            result = "pending";
            return;
          }
          // Karşı taraf seni zaten eklemiş: istek çakışması kabul demektir.
          if (count(friendCount, from, from) >= MAX_FRIENDS) {
            result = "limit";
            return;
          }
          if (count(friendCount, to, to) >= MAX_FRIENDS) return;
          accept.run(now, lo(from, to), hi(from, to));
          result = "accepted";
          return;
        }
        if (count(friendCount, from, from) >= MAX_FRIENDS || count(outgoingCount, from) >= MAX_OUTGOING) {
          result = "limit";
          return;
        }
        if (count(friendCount, to, to) >= MAX_FRIENDS) return;
        if (count(incomingNumber, to, to, to) >= MAX_INCOMING) return;
        insert.run(lo(from, to), hi(from, to), from, now, now);
        result = "sent";
      });
      return result;
    },
    acceptFriend(me, other, now) {
      let result: "ok" | "none" | "limit" = "none";
      inTransaction(() => {
        const row = pair.get(lo(me, other), hi(me, other)) as PairRow | undefined;
        if (!row || row.state !== "pending" || row.requested_by !== other) return;
        if (count(friendCount, me, me) >= MAX_FRIENDS || count(friendCount, other, other) >= MAX_FRIENDS) {
          result = "limit";
          return;
        }
        accept.run(now, lo(me, other), hi(me, other));
        result = "ok";
      });
      return result;
    },
    declineFriend(me, other) {
      return Number(dropPending.run(lo(me, other), hi(me, other), other).changes) === 1;
    },
    cancelFriend(me, other) {
      return Number(dropPending.run(lo(me, other), hi(me, other), me).changes) === 1;
    },
    removeFriend(me, other) {
      return Number(dropAccepted.run(lo(me, other), hi(me, other)).changes) === 1;
    },
    blockAccount(me, other, now) {
      if (me === other) return false;
      inTransaction(() => {
        insertBlock.run(me, other, now);
        dropPair.run(lo(me, other), hi(me, other));
      });
      return true;
    },
    unblockAccount(me, other) {
      return Number(dropBlock.run(me, other).changes) === 1;
    },
    friendLists(me) {
      const out: FriendLists = { friends: [], incoming: [], outgoing: [], blocked: [] };
      const all = rows.all(me, me, me) as {
        id: number;
        username: string;
        state: "pending" | "accepted";
        requested_by: number;
        created_at: number;
        updated_at: number;
      }[];
      for (const r of all) {
        if (r.state === "accepted") out.friends.push({ id: r.id, username: r.username, at: r.updated_at });
        else if (r.requested_by === me)
          out.outgoing.push({ id: r.id, username: r.username, at: r.created_at });
        else out.incoming.push({ id: r.id, username: r.username, at: r.created_at });
      }
      for (const r of blockedRows.all(me) as { id: number; username: string; created_at: number }[])
        out.blocked.push({ id: r.id, username: r.username, at: r.created_at });
      out.friends.sort(byName);
      out.blocked.sort(byName);
      // Gelen/giden istekler en yeni üstte.
      out.incoming.sort((x, y) => y.at - x.at);
      out.outgoing.sort((x, y) => y.at - x.at);
      return out;
    },
    friendIds(me) {
      return (acceptedIds.all(me, me, me) as { id: number }[]).map((r) => r.id);
    },
    areFriends(a, b) {
      if (a === b) return false;
      return (pair.get(lo(a, b), hi(a, b)) as PairRow | undefined)?.state === "accepted";
    },
    blockedBetween(a, b) {
      return isBlocked(a, b) || isBlocked(b, a);
    },
    incomingCount(me) {
      return count(incomingNumber, me, me, me);
    },
  };
}
