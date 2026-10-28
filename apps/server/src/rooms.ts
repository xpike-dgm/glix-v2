import { randomBytes, randomInt } from "node:crypto";
import {
  DEFAULT_CONTENT_TONE,
  DEFAULT_JOIN_POLICY,
  getCatalog,
  type LeftReason,
  MAX_NICKNAME_LENGTH,
  MAX_PLAYERS,
  ROOM_CODE_LENGTH,
} from "@glix/engine";
import { type AccountStatsRecorder, noopAccountStats } from "./accountStats.js";
import { createBroadcaster } from "./broadcast.js";
import { type Clock, systemClock } from "./clock.js";
import { noContent } from "./contentStore.js";
import { clearMatch, endMatchStats, recordPresence } from "./match.js";
import { createMetrics } from "./metrics.js";
import { noBannedWords, noReportDesk, RoomKicks } from "./moderation.js";
import { IpLimiter } from "./ratelimit.js";
import { type Connection, isConnected, type Player, type Room, type Runtime } from "./runtime.js";
import { noopSocial } from "./social.js";
import { noopStats, type StatsStore } from "./statsStore.js";
import { disabledPush, type PushGateway } from "./webpush.js";

export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const GRACE_MS = 120_000;
export const EMPTY_ROOM_MS = 120_000;
export const HOST_GRACE_MS = 20_000;
export const DEFAULT_RANDOM_COUNT = 5;

export function createRuntime(
  clock: Clock = systemClock,
  maxRooms = 1000,
  roomCreateBurst = 10,
  defaultGameIds?: readonly string[],
  pickInt: (max: number) => number = randomInt,
  stats: StatsStore = noopStats,
  push: PushGateway = disabledPush,
  accountStats: AccountStatsRecorder = noopAccountStats,
): Runtime {
  const rt: Runtime = {
    clock,
    draining: false,
    maxRooms,
    ipLimiter: new IpLimiter(clock, roomCreateBurst),
    metrics: createMetrics(),
    stats,
    accountStats,
    push,
    social: noopSocial,
    recentLogs: [],
    rooms: new Map(),
    tokens: new Map(),
    active: new Set(),
    broadcaster: createBroadcaster(clock, () => rt),
    catalog: getCatalog(),
    maintenance: false,
    announcement: null,
    bannedWords: noBannedWords,
    content: noContent,
    reports: noReportDesk,
    roomKicks: new RoomKicks(clock),
    defaultGameIds: defaultGameIds ? [...defaultGameIds] : null,
    randomInt: pickInt,
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

/** Bu karakteri odadaki kimse (isteyen dışında) kullanmıyor mu. */
export function isAvatarFree(room: Room, avatar: number, except?: Player): boolean {
  for (const p of room.players.values()) if (p !== except && p.avatar === avatar) return false;
  return true;
}

export function lowestFreeAvatar(room: Room): number {
  const used = new Set([...room.players.values()].map((p) => p.avatar));
  for (let i = 0; i < MAX_PLAYERS; i++) if (!used.has(i)) return i;
  return MAX_PLAYERS - 1;
}

/** Aynı takma ad varsa " 2", " 3" ... ekler (büyük/küçük harf duyarsız). 16 karakter sınırı korunur. */
export function uniqueNickname(room: Room, wanted: string, except?: Player): string {
  const taken = new Set(
    [...room.players.values()].filter((p) => p !== except).map((p) => p.nickname.toLowerCase()),
  );
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
  // Varsayılan seçim (yalnız testlerde/yapılandırmada) kapalı oyunları taşımaz.
  const open = new Set(rt.catalog.map((g) => g.id));
  const defaults = rt.defaultGameIds ? rt.defaultGameIds.filter((id) => open.has(id)) : null;
  const room: Room = {
    code: generateCode(rt.rooms),
    hostId: "",
    players: new Map(),
    stages: new Set(),
    phase: "lobby",
    gameIds: defaults ? [...defaults] : [],
    selection: rt.defaultGameIds ? { mode: "manual" } : { mode: "random", count: DEFAULT_RANDOM_COUNT },
    tone: DEFAULT_CONTENT_TONE,
    joinPolicy: DEFAULT_JOIN_POLICY,
    match: null,
    rev: 0,
    nextJoinOrder: 0,
    lastFlushAt: Number.NEGATIVE_INFINITY,
    flushCancel: null,
    deleteCancel: null,
    hostGraceCancel: null,
    createdAt: rt.clock.now(),
    evidence: null,
  };
  rt.rooms.set(room.code, room);
  return room;
}

/** Odaya oyuncu ekler ve bağlantıya bağlar. İlk oyuncu host olur. `spectator`: maç sürerken giren izleyici. */
export function addPlayer(
  rt: Runtime,
  room: Room,
  nickname: string,
  conn: Connection,
  preferredAvatar?: number,
  spectator = false,
): Player {
  if (room.deleteCancel) {
    room.deleteCancel();
    room.deleteCancel = null;
  }
  let id = randomBytes(6).toString("hex");
  while (room.players.has(id)) id = randomBytes(6).toString("hex");
  const player: Player = {
    id,
    accountId: conn.account?.id ?? null,
    nickname: uniqueNickname(room, nickname),
    avatar:
      preferredAvatar !== undefined && isAvatarFree(room, preferredAvatar)
        ? preferredAvatar
        : lowestFreeAvatar(room),
    token: generateToken(),
    score: 0,
    spectator,
    joinOrder: room.nextJoinOrder++,
    conn,
    room,
    graceCancel: null,
    lobbyReady: false,
    lastReactAt: Number.NEGATIVE_INFINITY,
    lastRenameAt: Number.NEGATIVE_INFINITY,
    lastContinueAt: Number.NEGATIVE_INFINITY,
    hidden: false,
    push: null,
    lastPushAt: Number.NEGATIVE_INFINITY,
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
  // Önce oyuncular (izleyiciler değil); kimse yoksa en eski bağlı, o da yoksa en eski kişi.
  const playing = players.filter((p) => !p.spectator);
  const next =
    oldest(playing.filter(isConnected)) ??
    oldest(players.filter(isConnected)) ??
    oldest(playing) ??
    oldest(players);
  if (next) {
    room.hostId = next.id;
    next.lobbyReady = false;
  }
}

/** Başka oyuncuyu host yapar (host kendi isteğiyle devreder). */
export function setHost(room: Room, next: Player): void {
  clearHostGrace(room);
  room.hostId = next.id;
  next.lobbyReady = false;
}

/** Odadaki herkesin lobi hazır işaretini kaldırır. */
export function resetLobbyReady(room: Room): void {
  for (const p of room.players.values()) p.lobbyReady = false;
}

/** Adı başka biri kullanıyor mu (büyük/küçük harf duyarsız). */
export function isNicknameTaken(room: Room, nickname: string, except?: Player): boolean {
  const wanted = nickname.toLowerCase();
  for (const p of room.players.values()) if (p !== except && p.nickname.toLowerCase() === wanted) return true;
  return false;
}

/** Oyuncuyu odadan çıkarır; bağlantısını odadan ayırır (soket açık kalır). */
export function removePlayer(rt: Runtime, room: Room, player: Player): void {
  if (!room.players.delete(player.id)) return;
  if (player.graceCancel) {
    player.graceCancel();
    player.graceCancel = null;
  }
  rt.tokens.delete(player.token);
  player.push = null;
  if (player.conn) {
    player.conn.player = null;
    player.conn = null;
    recordPresence(rt, room, player.id, false);
  }
  if (room.hostId === player.id) transferHost(room);
  // Maçta oyuncu kalmadıysa (yalnız izleyiciler varsa) maç biter, izleyiciler oyuncu olarak lobiye döner.
  if (room.phase !== "lobby" && ![...room.players.values()].some((p) => !p.spectator)) clearMatch(rt, room);
  if (room.players.size === 0) scheduleEmptyDelete(rt, room);
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

/**
 * Odayı kapatır. `reason`: oyunculara giden sebep (varsayılan "closed"; yönetici kapatırsa "adminClosed").
 * Süren maç yarıda kalmış sayılır (hesap istatistiği ve rozet yazılmaz).
 */
export function deleteRoom(rt: Runtime, room: Room, reason: LeftReason = "closed"): void {
  // Sunucu kapanırken / oda silinirken süren maç yarıda kalmış sayılır.
  if (room.match) endMatchStats(rt, room.match, "aborted");
  rt.broadcaster.cancel(room);
  clearHostGrace(room);
  if (room.deleteCancel) {
    room.deleteCancel();
    room.deleteCancel = null;
  }
  for (const player of room.players.values()) {
    if (player.graceCancel) player.graceCancel();
    player.graceCancel = null;
    player.push = null;
    rt.tokens.delete(player.token);
    if (player.conn) {
      player.conn.send({ type: "left", reason });
      player.conn.player = null;
      player.conn = null;
    }
  }
  for (const stage of room.stages) {
    stage.send({ type: "left", reason });
    stage.stage = null;
    stage.lastSent = null;
  }
  room.stages.clear();
  room.players.clear();
  rt.active.delete(room);
  rt.rooms.delete(room.code);
  rt.roomKicks.clearRoom(room.code);
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
