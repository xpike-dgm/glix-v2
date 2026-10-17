import type { GameResult } from "./game.js";

export const PROTOCOL_VERSION = 2;
export const APP_VERSION = "0.1.0";

export const MAX_MESSAGE_LENGTH = 4096;
export const ROOM_CODE_LENGTH = 5;
export const MAX_PLAYERS = 8;
export const MAX_NICKNAME_LENGTH = 16;

// Akış ayrıntıları: docs/PROTOKOL.md

export type ClientMessage =
  | { type: "hello"; clientVersion: string }
  | { type: "ping"; t: number }
  | { type: "createRoom"; nickname: string }
  | { type: "joinRoom"; code: string; nickname: string }
  | { type: "resume"; token: string }
  | { type: "leaveRoom" }
  | { type: "kick"; playerId: string }
  | { type: "setGames"; gameIds: string[] }
  /** Rastgele mod: maç başında uygun oyunlar arasından `count` tanesi seçilir (1..katalog). */
  | { type: "setRandom"; count: number }
  | { type: "startMatch" }
  | { type: "ready" }
  | { type: "action"; seq: number; payload: unknown }
  | { type: "returnToLobby" }
  /** İstemci elindeki snapshot'a yama uygulayamadığında tam snapshot ister. */
  | { type: "resync" };

/**
 * JSON Merge Patch (RFC 7386): nesne alanları birleşir, `null` alanı siler,
 * diziler ve ilkel değerler bütün olarak değişir.
 */
export type MergePatch = { [key: string]: unknown };

export type ErrorCode =
  | "invalid_message"
  | "rate_limited"
  | "nickname_invalid"
  | "room_not_found"
  | "room_full"
  | "match_in_progress"
  | "resume_failed"
  | "not_host"
  | "not_in_room"
  | "already_in_room"
  | "invalid_games"
  | "not_enough_players"
  | "wrong_phase"
  | "not_participant"
  | "game_failed"
  | "draining"
  | "server_busy";

export type RoomPhase = "lobby" | "briefing" | "countdown" | "playing" | "results" | "final";

export interface PlayerInfo {
  id: string;
  nickname: string;
  /** 0–7, odaya girişte atanır ve odada benzersizdir; avatar rengi/simgesi. */
  avatar: number;
  connected: boolean;
  /** Genel skor. */
  score: number;
}

export interface GameInfo {
  id: string;
  name: string;
  minPlayers: number;
  maxPlayers: number;
  orientation: "portrait" | "landscape";
}

export interface MatchSnapshot {
  /** 0 tabanlı oyun sırası ve toplam oyun sayısı. */
  round: number;
  total: number;
  gameId: string;
  gameName: string;
  briefing: { goal: string; steps: string[] };
  orientation: "portrait" | "landscape";
  /** Bu oyunun katılımcıları (maç başında bağlı olanlar). */
  participants: string[];
  /** briefing aşamasında hazır olanlar. */
  readyIds: string[];
  phaseStartedAt: number;
  phaseEndsAt: number | null;
  /** Oyunun herkese açık görünümü (playing/results); odadaki herkes için aynı. */
  publicView: unknown;
  /** Oyunun bu oyuncuya özel görünümü (playing/results); izleyicide izleyici görünümü. */
  view: unknown;
  /** results ve final aşamasında dolu. */
  result: GameResult | null;
}

export interface RoomSnapshot {
  /** Her değişimde artar; istemci eski snapshot'ı yok sayar. */
  rev: number;
  serverNow: number;
  code: string;
  hostId: string;
  selfId: string;
  phase: RoomPhase;
  players: PlayerInfo[];
  /** Host'un seçtiği oyunlar (sıralı). Rastgele modda lobide boştur; maç başında seçilenler gelir. */
  gameIds: string[];
  /** Oyun seçim modu. Yeni oda: rastgele 5. */
  selection: { mode: "manual" } | { mode: "random"; count: number };
  /** Sunucudaki tüm oyunlar (Minigame Seçimi için). */
  catalog: GameInfo[];
  match: MatchSnapshot | null;
}

export type LeftReason = "left" | "kicked" | "closed";

export type ServerMessage =
  | { type: "welcome"; protocolVersion: number; serverVersion: string }
  | { type: "pong"; t: number; serverTime: number }
  | { type: "session"; token: string; playerId: string; roomCode: string }
  | { type: "room"; snapshot: RoomSnapshot }
  /** `baseRev` istemcinin son snapshot'ı ile aynıysa uygulanır; değilse istemci `resync` gönderir. */
  | { type: "patch"; baseRev: number; rev: number; patch: MergePatch }
  | { type: "actionAck"; seq: number; ok: boolean; reason?: string }
  | { type: "left"; reason: LeftReason }
  | { type: "error"; code: ErrorCode; message: string };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function hasExactKeys(obj: Record<string, unknown>, keys: readonly string[]): boolean {
  const own = Object.keys(obj);
  return own.length === keys.length && keys.every((k) => own.includes(k));
}

const CONTROL_CHARS = /\p{Cc}/u;
/** Görünmez/yön değiştiren biçim karakterleri (RLO, sıfır genişlik, ZWJ), satır/paragraf ayırıcı, özel kullanım, yetim vekil. */
const FORBIDDEN_CHARS = /[\p{Cf}\p{Zl}\p{Zp}\p{Co}\p{Cs}]/u;
/** Zalgo benzeri yığılmayı önler: en çok 2 ardışık birleştirici işaret. */
const MARK_STACK = /\p{M}{3,}/u;
const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;
const WHITESPACE_RUN = /\s+/gu;
const CODE_PATTERN = /^[A-Z0-9]{5}$/;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

/** Takma adı temizler (kırp, iç boşlukları tek boşluğa indir). Geçersizse null. */
export function normalizeNickname(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 256 || CONTROL_CHARS.test(value)) return null;
  if (FORBIDDEN_CHARS.test(value)) return null;
  const clean = value.replace(WHITESPACE_RUN, " ").trim();
  if (MARK_STACK.test(clean) || !LETTER_OR_DIGIT.test(clean)) return null;
  const length = Array.from(clean).length;
  if (length < 1 || length > MAX_NICKNAME_LENGTH) return null;
  return clean;
}

function parseCode(value: unknown): string | null {
  if (typeof value !== "string" || value.length !== ROOM_CODE_LENGTH) return null;
  const code = value.toUpperCase();
  return CODE_PATTERN.test(code) ? code : null;
}

/** Ağdan gelen ham metni doğrular; geçersizse null döner. */
export function parseClientMessage(raw: string): ClientMessage | null {
  if (typeof raw !== "string" || raw.length > MAX_MESSAGE_LENGTH) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(data)) return null;
  switch (data.type) {
    case "hello": {
      if (!hasExactKeys(data, ["type", "clientVersion"])) return null;
      const v = data.clientVersion;
      if (typeof v !== "string" || v.length === 0 || v.length > 64) return null;
      return { type: "hello", clientVersion: v };
    }
    case "ping": {
      if (!hasExactKeys(data, ["type", "t"])) return null;
      const t = data.t;
      if (typeof t !== "number" || !Number.isFinite(t)) return null;
      return { type: "ping", t };
    }
    case "createRoom": {
      if (!hasExactKeys(data, ["type", "nickname"])) return null;
      const nickname = normalizeNickname(data.nickname);
      return nickname === null ? null : { type: "createRoom", nickname };
    }
    case "joinRoom": {
      if (!hasExactKeys(data, ["type", "code", "nickname"])) return null;
      const code = parseCode(data.code);
      const nickname = normalizeNickname(data.nickname);
      if (code === null || nickname === null) return null;
      return { type: "joinRoom", code, nickname };
    }
    case "resume": {
      if (!hasExactKeys(data, ["type", "token"])) return null;
      const token = data.token;
      if (typeof token !== "string" || !TOKEN_PATTERN.test(token)) return null;
      return { type: "resume", token };
    }
    case "kick": {
      if (!hasExactKeys(data, ["type", "playerId"])) return null;
      const id = data.playerId;
      if (typeof id !== "string" || id.length === 0 || id.length > 64) return null;
      return { type: "kick", playerId: id };
    }
    case "setGames": {
      if (!hasExactKeys(data, ["type", "gameIds"])) return null;
      const ids = data.gameIds;
      if (!Array.isArray(ids) || ids.length < 1 || ids.length > 24) return null;
      const out: string[] = [];
      for (const id of ids) {
        if (typeof id !== "string" || id.length === 0 || id.length > 64 || out.includes(id)) return null;
        out.push(id);
      }
      return { type: "setGames", gameIds: out };
    }
    case "setRandom": {
      if (!hasExactKeys(data, ["type", "count"])) return null;
      const count = data.count;
      if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 1 || count > 64) return null;
      return { type: "setRandom", count };
    }
    case "action": {
      if (!hasExactKeys(data, ["type", "seq", "payload"])) return null;
      const seq = data.seq;
      if (typeof seq !== "number" || !Number.isSafeInteger(seq) || seq < 0) return null;
      return { type: "action", seq, payload: data.payload };
    }
    case "leaveRoom":
    case "resync":
    case "startMatch":
    case "ready":
    case "returnToLobby": {
      if (!hasExactKeys(data, ["type"])) return null;
      return { type: data.type };
    }
    default:
      return null;
  }
}
