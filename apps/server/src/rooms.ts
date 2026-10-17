import { randomBytes, randomInt } from "node:crypto";
import { GAMES, getCatalog, MAX_NICKNAME_LENGTH, MAX_PLAYERS, ROOM_CODE_LENGTH } from "@glix/engine";
import { createBroadcaster } from "./broadcast.js";
import { type Clock, systemClock } from "./clock.js";
import { clearMatch, recordPresence } from "./match.js";
import { createMetrics } from "./metrics.js";
import { IpLimiter } from "./ratelimit.js";
import { type Connection, isConnected, type Player, type Room, type Runtime } from "./runtime.js";

export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const GRACE_MS = 120_000;
export const EMPTY_ROOM_MS = 120_000;
export const HOST_GRACE_MS = 20_000;

export function createRuntime(
  clock: Clock = systemClock,
  maxRooms = 1000,
  roomCreateBurst = 10,
  defaultGameIds: readonly string[] = Object.keys(GAMES),
): Runtime {
  const rt: Runtime = {
    clock,
    draining: false,
    maxRooms,
    ipLimiter: new IpLimiter(clock, roomCreateBurst),
    metrics: createMetrics(),
    recentLogs: [],
    rooms: new Map(),
    tokens: new Map(),
    active: new Set(),
    broadcaster: createBroadcaster(clock, () => rt),
    catalog: getCatalog(),
    defaultGameIds: [...defaultGameIds],
  };
  return rt;
}

export function generateCode(taken: ReadonlySet<string> | Map<string, unknown>): string {
  for (;;) {
    let code = "";
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
    if (!taken.has(code)) return code;
  }
}

export function generateToken(): string {
  return randomBytes(24).toString("base64url");
}

export function lowestFreeAvatar(room: Room): number {
  const used = new Set([...room.players.values()].map((p) => p.avatar));
  for (let i = 0; i < MAX_PLAYERS; i++) if (!used.has(i)) return i;
  return MAX_PLAYERS - 1;
}

/** Aynı takma ad varsa " 2", " 3" ... ekler (büyük/küçük harf duyarsız). 16 karakter sınırı korunur. */
export function uniqueNickname(room: Room, wanted: string): string {
  const taken = new Set([...room.players.values()].map((p) => p.nickname.toLowerCase()));
  if (!taken.has(wanted.toLowerCase())) return wanted;
  for (let n = 2; ; n++) {
    const suffix = ` ${n}`;
    const base = Array.from(wanted)
      .slice(0, MAX_NICKNAME_LENGTH - suffix.length)
      .join("")
      .trimEnd();
    const candidate = `${base}${suffix}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

export function createRoom(rt: Runtime): Room {
  const room: Room = {
    code: generateCode(rt.rooms),
    hostId: "",
    players: new Map(),
    phase: "lobby",
    gameIds: [...rt.defaultGameIds],
    match: null,
    rev: 0,
    nextJoinOrder: 0,
    lastFlushAt: Number.NEGATIVE_INFINITY,
    flushCancel: null,
    deleteCancel: null,
    hostGraceCancel: null,
  };
  rt.rooms.set(room.code, room);
  return room;
}

/** Odaya oyuncu ekler ve bağlantıya bağlar. İlk oyuncu host olur. */
export function addPlayer(rt: Runtime, room: Room, nickname: string, conn: Connection): Player {
  if (room.deleteCancel) {
    room.deleteCancel();
    room.deleteCancel = null;
  }
  let id = randomBytes(6).toString("hex");
  while (room.players.has(id)) id = randomBytes(6).toString("hex");
  const player: Player = {
    id,
    nickname: uniqueNickname(room, nickname),
    avatar: lowestFreeAvatar(room),
    token: generateToken(),
    score: 0,
    joinOrder: room.nextJoinOrder++,
    conn,
    room,
    graceCancel: null,
  };
  room.players.set(id, player);
  rt.tokens.set(player.token, player);
  conn.player = player;
  if (room.players.size === 1) room.hostId = id;
  return player;
}

function oldest(players: Iterable<Player>): Player | undefined {
  let best: Player | undefined;
  for (const p of players) if (!best || p.joinOrder < best.joinOrder) best = p;
  return best;
}

/** Bekleyen host devri zamanlayıcısını iptal eder. */
export function clearHostGrace(room: Room): void {
  if (room.hostGraceCancel) {
    room.hostGraceCancel();
    room.hostGraceCancel = null;
  }
}

/** Host gittiyse en eski bağlı oyuncuya (yoksa en eski oyuncuya) devreder. */
export function transferHost(room: Room): void {
  clearHostGrace(room);
  const players = [...room.players.values()];
  const next = oldest(players.filter(isConnected)) ?? oldest(players);
  if (next) room.hostId = next.id;
}

/** Oyuncuyu odadan çıkarır; bağlantısını odadan ayırır (soket açık kalır). */
export function removePlayer(rt: Runtime, room: Room, player: Player): void {
  if (!room.players.delete(player.id)) return;
  if (player.graceCancel) {
    player.graceCancel();
    player.graceCancel = null;
  }
  rt.tokens.delete(player.token);
  if (player.conn) {
    player.conn.player = null;
    player.conn = null;
    recordPresence(rt, room, player.id, false);
  }
  if (room.hostId === player.id) transferHost(room);
  if (room.players.size === 0) {
    if (room.phase !== "lobby") clearMatch(rt, room);
    scheduleEmptyDelete(rt, room);
  }
  rt.broadcaster.markDirty(room);
}

function scheduleEmptyDelete(rt: Runtime, room: Room): void {
  if (room.deleteCancel) return;
  room.deleteCancel = rt.clock.setTimeout(() => {
    room.deleteCancel = null;
    if (room.players.size === 0) deleteRoom(rt, room);
  }, EMPTY_ROOM_MS);
}

/** Bağlantı koptu: oyuncu 120 sn bekletilir, sonra çıkarılır. */
export function markDisconnected(rt: Runtime, player: Player): void {
  const room = player.room;
  if (room.players.get(player.id) !== player) return;
  const wasConnected = player.conn !== null;
  player.conn = null;
  if (wasConnected) recordPresence(rt, room, player.id, false);
  if (room.hostId === player.id) {
    // Host hemen değişmez: 20 sn içinde dönerse host olarak kalır.
    clearHostGrace(room);
    room.hostGraceCancel = rt.clock.setTimeout(() => {
      room.hostGraceCancel = null;
      if (room.hostId === player.id && !isConnected(player)) {
        transferHost(room);
        rt.broadcaster.markDirty(room);
      }
    }, HOST_GRACE_MS);
  }
  if (player.graceCancel) player.graceCancel();
  player.graceCancel = rt.clock.setTimeout(() => {
    player.graceCancel = null;
    removePlayer(rt, room, player);
  }, GRACE_MS);
  rt.broadcaster.markDirty(room);
}

export function deleteRoom(rt: Runtime, room: Room): void {
  rt.broadcaster.cancel(room);
  clearHostGrace(room);
  if (room.deleteCancel) {
    room.deleteCancel();
    room.deleteCancel = null;
  }
  for (const player of room.players.values()) {
    if (player.graceCancel) player.graceCancel();
    player.graceCancel = null;
    rt.tokens.delete(player.token);
    if (player.conn) {
      player.conn.send({ type: "left", reason: "closed" });
      player.conn.player = null;
      player.conn = null;
    }
  }
  room.players.clear();
  rt.active.delete(room);
  rt.rooms.delete(room.code);
}

/**
 * Tüm zamanlayıcıları iptal eder (sunucu kapanırken). `notify` false ise oyunculara "oda kapandı"
 * bildirilmez: soketler 1012 ile kapanır ve istemci resume dener (güncelleme yeniden başlatması).
 */
export function disposeRuntime(rt: Runtime, notify = true): void {
  for (const room of [...rt.rooms.values()]) {
    for (const p of room.players.values()) {
      if (p.graceCancel) p.graceCancel();
      p.graceCancel = null;
      if (!notify && p.conn) {
        p.conn.player = null;
        p.conn = null;
      }
    }
    deleteRoom(rt, room);
  }
}

/** Maçı olan (briefing..final) oda sayısı. */
export function countActiveMatches(rt: Runtime): number {
  let n = 0;
  // Final ekranındaki oda bitmiş sayılır; güncellemeyi bekletmez.
  for (const room of rt.rooms.values()) if (room.phase !== "lobby" && room.phase !== "final") n += 1;
  return n;
}

export function countPlayers(rt: Runtime): number {
  let n = 0;
  for (const room of rt.rooms.values()) n += room.players.size;
  return n;
}
