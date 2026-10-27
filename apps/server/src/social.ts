import { type FriendStatus, INVITE_TTL_MS, MAX_PLAYERS, type ServerMessage } from "@glix/engine";
import type { AccountStore } from "./accountStore.js";
import { log } from "./log.js";
import { invitePayload } from "./pushText.js";
import { TokenBucket } from "./ratelimit.js";
import { uniqueNickname } from "./rooms.js";
import type { Connection, Room, Runtime } from "./runtime.js";
import type { PushTarget } from "./webpush.js";

/** Durum taraması en sık bu aralıkla yapılır; yayın bu yüzden kendiliğinden kısılır (kısa dalgalanmalar tek mesaj olur). */
export const PRESENCE_SCAN_MS = 1000;
/** Aynı arkadaşa iki davet arasındaki en kısa süre. */
export const INVITE_PAIR_GAP_MS = 30_000;
/** Bir hesabın dakikada gönderebileceği davet sayısı. */
export const INVITE_PER_MINUTE = 20;

/** Davetin sonucu; `ok` dışındakiler işleyicide hata koduna çevrilir. */
export type InviteOutcome =
  | "ok"
  | "login_required"
  | "not_in_room"
  | "wrong_phase"
  | "rate_limited"
  | "failed";

export interface Presence {
  status: FriendStatus;
  /** Arkadaşın bulunduğu oda (yalnız sunucu içinde; hiçbir mesaja girmez). */
  room: Room | null;
}

/**
 * Arkadaş sistemi çalışma zamanı: hesaba bağlı canlı bağlantılar, durum (çevrimiçi/lobide/oyunda) türetmesi,
 * davetler ve hesaba bağlı web bildirimi abonelikleri. Hepsi bellekte; hiçbiri kalıcı değildir.
 */
export interface Social {
  /** Hesaplı bağlantıyı dizine ekler (WS yükseltmesinde çerezden çözülen hesapla). */
  attach(conn: Connection): void;
  detach(conn: Connection): void;
  /** Hesabın şu anki durumu ve odası; canlı bağlantıdan türetilir. */
  presence(accountId: number): Presence;
  /** Odaya hâlâ yeni biri girebilir mi (lobide yer var; maç sürüyorsa izleyiciye açık ve yer var). */
  joinable(room: Room): boolean;
  /** Hesabın canlı bağlantılarına mesaj yollar; kaç bağlantıya gittiğini döner. */
  sendTo(accountId: number, msg: ServerMessage): number;
  /** Davet gönderir (yalnız lobideki hesaplı oyuncu, yalnız kabul edilmiş arkadaş). */
  invite(conn: Connection, username: string): InviteOutcome;
  /** Arkadaşın katılınabilir odası; arkadaş değilse, odada değilse ya da katılım kapalıysa null (nedeni ayırt edilmez). */
  friendRoom(accountId: number, username: string): Room | null;
  /** Hesaba bağlı bildirim aboneliği (misafirde işlem yok). `null` siler. */
  setPush(accountId: number, target: PushTarget | null): void;
  /**
   * Hesabın kullanıcı adı değişti: canlı bağlantılardaki ad, odadaki oyuncu adı (yayınlanır), durum önbelleği
   * güncellenir; arkadaşlara (istek bekleyenler dahil) listelerini yenilemeleri bildirilir.
   */
  accountRenamed(accountId: number, username: string): void;
  /** Her sunucu turunda çağrılır; tarama aralığı dolduysa değişen durumları arkadaşlara yayar. */
  tick(now: number): void;
}

export const noopSocial: Social = {
  attach: () => undefined,
  detach: () => undefined,
  presence: () => ({ status: "offline", room: null }),
  joinable: () => false,
  sendTo: () => 0,
  invite: () => "failed",
  friendRoom: () => null,
  setPush: () => undefined,
  accountRenamed: () => undefined,
  tick: () => undefined,
};

export function createSocial(rt: Runtime, accounts: AccountStore): Social {
  const byAccount = new Map<number, Set<Connection>>();
  /** Son yayılan durum (çevrimdışı olanlar silinir); kullanıcı adı çevrimdışı mesajı için saklanır. */
  const lastSeen = new Map<number, { username: string; status: FriendStatus }>();
  const pushTargets = new Map<number, PushTarget>();
  const senderBuckets = new Map<number, TokenBucket>();
  const pairSentAt = new Map<string, number>();
  let lastScan = Number.NEGATIVE_INFINITY;

  function presence(accountId: number): Presence {
    const conns = byAccount.get(accountId);
    if (!conns || conns.size === 0) return { status: "offline", room: null };
    let status: FriendStatus = "online";
    let room: Room | null = null;
    for (const conn of conns) {
      const r = conn.player?.room;
      if (!r) continue;
      if (r.phase === "lobby") return { status: "lobby", room: r };
      status = "playing";
      room = r;
    }
    return { status, room };
  }

  function joinable(room: Room): boolean {
    if (room.players.size >= MAX_PLAYERS) return false;
    return room.phase === "lobby" || room.joinPolicy === "izleyici";
  }

  function sendTo(accountId: number, msg: ServerMessage): number {
    const conns = byAccount.get(accountId);
    if (!conns) return 0;
    const text = JSON.stringify(msg);
    let n = 0;
    for (const conn of conns) {
      // TV (sahne) bağlantısı davet/durum almaz.
      if (conn.stage) continue;
      conn.sendRaw(text);
      n += 1;
    }
    return n;
  }

  function broadcastStatus(accountId: number, username: string, status: FriendStatus): void {
    const msg: ServerMessage = { type: "friendStatus", username, status };
    for (const friendId of accounts.friendIds(accountId)) sendTo(friendId, msg);
  }

  function scan(): void {
    const ids = new Set<number>([...lastSeen.keys(), ...byAccount.keys()]);
    for (const id of ids) {
      const { status } = presence(id);
      const prev = lastSeen.get(id);
      if (status === (prev?.status ?? "offline")) continue;
      const first = byAccount.get(id)?.values().next().value;
      const username = first?.account?.username ?? prev?.username;
      if (!username) {
        lastSeen.delete(id);
        continue;
      }
      if (status === "offline") lastSeen.delete(id);
      else lastSeen.set(id, { username, status });
      broadcastStatus(id, username, status);
    }
  }

  function pruneInviteState(now: number): void {
    if (pairSentAt.size > 2000)
      for (const [key, at] of pairSentAt) if (now - at >= INVITE_PAIR_GAP_MS) pairSentAt.delete(key);
    if (senderBuckets.size > 2000)
      for (const [key, b] of senderBuckets) if (b.isFull()) senderBuckets.delete(key);
  }

  function pushInvite(accountId: number, from: string, code: string): boolean {
    const target = pushTargets.get(accountId);
    if (!target || !rt.push.enabled) return false;
    rt.push
      .send(target, invitePayload(from, code))
      .then((result) => {
        if (result === "gone" && pushTargets.get(accountId) === target) pushTargets.delete(accountId);
      })
      .catch(() => undefined);
    return true;
  }

  return {
    attach(conn) {
      const id = conn.account?.id;
      if (id === undefined) return;
      const set = byAccount.get(id) ?? new Set<Connection>();
      set.add(conn);
      byAccount.set(id, set);
    },
    detach(conn) {
      const id = conn.account?.id;
      if (id === undefined) return;
      const set = byAccount.get(id);
      if (!set) return;
      set.delete(conn);
      if (set.size === 0) byAccount.delete(id);
    },
    presence,
    joinable,
    sendTo,
    invite(conn, username) {
      const me = conn.account;
      if (!me) return "login_required";
      const room = conn.player?.room;
      if (!room) return "not_in_room";
      if (room.phase !== "lobby") return "wrong_phase";
      const now = rt.clock.now();
      pruneInviteState(now);
      let bucket = senderBuckets.get(me.id);
      if (!bucket) {
        bucket = new TokenBucket(rt.clock, INVITE_PER_MINUTE, INVITE_PER_MINUTE / 60);
        senderBuckets.set(me.id, bucket);
      }
      if (!bucket.take()) return "rate_limited";
      const target = accounts.findByUsername(username);
      if (!target || target.id === me.id) return "failed";
      if (!accounts.areFriends(me.id, target.id) || accounts.blockedBetween(me.id, target.id))
        return "failed";
      const key = `${me.id}:${target.id}`;
      const last = pairSentAt.get(key);
      if (last !== undefined && now - last < INVITE_PAIR_GAP_MS) return "rate_limited";
      // Zaten bu odadaysa davet anlamsız.
      for (const c of byAccount.get(target.id) ?? []) if (c.player?.room === room) return "failed";
      const msg: ServerMessage = {
        type: "invite",
        from: me.username,
        roomCode: room.code,
        expiresAt: now + INVITE_TTL_MS,
      };
      const delivered = sendTo(target.id, msg) > 0 || pushInvite(target.id, me.username, room.code);
      if (!delivered) return "failed";
      pairSentAt.set(key, now);
      return "ok";
    },
    friendRoom(accountId, username) {
      const target = accounts.findByUsername(username);
      if (!target || !accounts.areFriends(accountId, target.id)) return null;
      const { room } = presence(target.id);
      return room && joinable(room) ? room : null;
    },
    setPush(accountId, target) {
      if (target === null) {
        pushTargets.delete(accountId);
        return;
      }
      // Aynı cihaz başka hesaba geçtiyse eski eşleme düşer: davet yanlış hesaba gitmesin.
      for (const [id, t] of pushTargets) if (t.endpoint === target.endpoint) pushTargets.delete(id);
      pushTargets.set(accountId, target);
    },
    accountRenamed(accountId, username) {
      for (const conn of byAccount.get(accountId) ?? []) conn.account = { id: accountId, username };
      const seen = lastSeen.get(accountId);
      if (seen) lastSeen.set(accountId, { ...seen, username });
      // Bağlantısı o an kopuk (süre tanınan) oyuncu da dahil: odalardaki tüm kayıtlar gezilir.
      for (const room of rt.rooms.values()) {
        for (const player of room.players.values()) {
          if (player.accountId !== accountId) continue;
          const next = uniqueNickname(room, username, player);
          if (next === player.nickname) continue;
          player.nickname = next;
          rt.broadcaster.markDirty(room);
        }
      }
      const lists = accounts.friendLists(accountId);
      const msg: ServerMessage = { type: "friendsChanged" };
      for (const other of [...lists.friends, ...lists.incoming, ...lists.outgoing]) sendTo(other.id, msg);
    },
    tick(now) {
      if (now - lastScan < PRESENCE_SCAN_MS) return;
      lastScan = now;
      try {
        scan();
      } catch (err) {
        log.error("presence_failed", { error: String(err) });
      }
    },
  };
}
