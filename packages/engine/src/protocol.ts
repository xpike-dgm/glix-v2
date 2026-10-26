import { type ContentTone, type GameResult, isContentTone } from "./game.js";

export const PROTOCOL_VERSION = 2;
export const APP_VERSION = "0.1.0";

export const MAX_MESSAGE_LENGTH = 4096;
export const ROOM_CODE_LENGTH = 5;
export const MAX_PLAYERS = 8;
/** Seçilebilir karakter sayısı (avatar 0..AVATAR_COUNT-1); odadaki en çok oyuncu sayısıyla aynıdır. */
export const AVATAR_COUNT = MAX_PLAYERS;
export const MAX_NICKNAME_LENGTH = 16;
/** El ile seçimde en çok oyun (katalogdan büyük olmalı; `setRandom` sınırıyla aynı). */
export const MAX_SELECTED_GAMES = 64;

// Akış ayrıntıları: docs/PROTOKOL.md

export type ClientMessage =
  | { type: "hello"; clientVersion: string }
  | { type: "ping"; t: number }
  /** `avatar`: cihazın hatırladığı karakter; boşsa verilir, doluysa otomatik atanan kalır. */
  | { type: "createRoom"; nickname: string; avatar?: number }
  | { type: "joinRoom"; code: string; nickname: string; avatar?: number }
  /** Lobide karakter değiştir (yalnız lobi; odada benzersiz, ilk gelen alır). */
  | { type: "chooseAvatar"; avatar: number }
  | { type: "resume"; token: string }
  | { type: "leaveRoom" }
  | { type: "kick"; playerId: string }
  | { type: "setGames"; gameIds: string[] }
  /** Rastgele mod: maç başında uygun oyunlar arasından `count` tanesi seçilir (1..katalog). */
  | { type: "setRandom"; count: number }
  /** İçerik tonu (yalnız host, yalnız lobi). Oyunlar içerik havuzunu buna göre seçer. */
  | { type: "setTone"; tone: ContentTone }
  | { type: "startMatch" }
  | { type: "ready" }
  | { type: "action"; seq: number; payload: unknown }
  | { type: "returnToLobby" }
  /** İstemci elindeki snapshot'a yama uygulayamadığında tam snapshot ister. */
  | { type: "resync" }
  /** Maç sonu geri bildirimi: yalnız `final` aşamasında, maç başına oyuncu başına bir kez. */
  | { type: "feedback"; rating: 1 | 2 | 3 | 4 | 5; text?: string }
  /** Anonim oyun başı performans özeti: yalnız `results` aşamasında, oyun başına oyuncu başına bir kez. */
  | ({ type: "perf"; gameId: string } & PerfSample);

/** Bir oyun boyunca istemcide ölçülen gecikme özeti (ms ya da adet; hepsi küçük, negatif olmayan tam sayı). */
export interface PerfSample {
  rttMs: number;
  ackP50: number;
  ackP95: number;
  ackN: number;
  slowTaps: number;
  tapP95: number;
  longTasks: number;
  longTaskMs: number;
}

/** `perf` alanlarının üst sınırları; aşan mesaj geçersizdir. */
export const PERF_LIMITS: Readonly<Record<keyof PerfSample, number>> = {
  rttMs: 60_000,
  ackP50: 60_000,
  ackP95: 60_000,
  ackN: 10_000,
  slowTaps: 10_000,
  tapP95: 60_000,
  longTasks: 10_000,
  longTaskMs: 600_000,
};
export const PERF_KEYS = Object.keys(PERF_LIMITS) as (keyof PerfSample)[];

export const MAX_FEEDBACK_TEXT = 300;

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
  | "avatar_taken"
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
  /** Odanın içerik tonu; yeni oda: arkadaş. */
  tone: ContentTone;
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

/** Karakter sırası: 0..AVATAR_COUNT-1 tam sayı; değilse null. */
function parseAvatar(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value >= AVATAR_COUNT) return null;
  return value;
}

/** Anahtarlar `required` + isteğe bağlı `avatar` olmalıdır. */
function hasKeysWithOptionalAvatar(obj: Record<string, unknown>, required: readonly string[]): boolean {
  const own = Object.keys(obj);
  return required.every((k) => own.includes(k)) && own.every((k) => required.includes(k) || k === "avatar");
}

function parseCode(value: unknown): string | null {
  if (typeof value !== "string" || value.length !== ROOM_CODE_LENGTH) return null;
  const code = value.toUpperCase();
  return CODE_PATTERN.test(code) ? code : null;
}

/** Geri bildirim metnini temizler: denetim karakterleri atılır, kırpılır. Çok uzunsa ya da metin değilse null. */
export function sanitizeFeedbackText(value: unknown): string | null {
  if (typeof value !== "string" || value.length > MAX_FEEDBACK_TEXT * 4) return null;
  const clean = value
    .replace(/[\p{Cc}\p{Zl}\p{Zp}]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  return Array.from(clean).length > MAX_FEEDBACK_TEXT ? null : clean;
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
      if (!hasKeysWithOptionalAvatar(data, ["type", "nickname"])) return null;
      const nickname = normalizeNickname(data.nickname);
      if (nickname === null) return null;
      if (!Object.hasOwn(data, "avatar")) return { type: "createRoom", nickname };
      const avatar = parseAvatar(data.avatar);
      return avatar === null ? null : { type: "createRoom", nickname, avatar };
    }
    case "joinRoom": {
      if (!hasKeysWithOptionalAvatar(data, ["type", "code", "nickname"])) return null;
      const code = parseCode(data.code);
      const nickname = normalizeNickname(data.nickname);
      if (code === null || nickname === null) return null;
      if (!Object.hasOwn(data, "avatar")) return { type: "joinRoom", code, nickname };
      const avatar = parseAvatar(data.avatar);
      return avatar === null ? null : { type: "joinRoom", code, nickname, avatar };
    }
    case "chooseAvatar": {
      if (!hasExactKeys(data, ["type", "avatar"])) return null;
      const avatar = parseAvatar(data.avatar);
      return avatar === null ? null : { type: "chooseAvatar", avatar };
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
      if (!Array.isArray(ids) || ids.length < 1 || ids.length > MAX_SELECTED_GAMES) return null;
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
    case "setTone": {
      if (!hasExactKeys(data, ["type", "tone"])) return null;
      return isContentTone(data.tone) ? { type: "setTone", tone: data.tone } : null;
    }
    case "action": {
      if (!hasExactKeys(data, ["type", "seq", "payload"])) return null;
      const seq = data.seq;
      if (typeof seq !== "number" || !Number.isSafeInteger(seq) || seq < 0) return null;
      return { type: "action", seq, payload: data.payload };
    }
    case "feedback": {
      const keys = Object.keys(data);
      if (!keys.every((k) => k === "type" || k === "rating" || k === "text")) return null;
      const rating = data.rating;
      if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) return null;
      if (!Object.hasOwn(data, "text")) return { type: "feedback", rating: rating as 1 | 2 | 3 | 4 | 5 };
      const text = sanitizeFeedbackText(data.text);
      if (text === null) return null;
      const r = rating as 1 | 2 | 3 | 4 | 5;
      return text === "" ? { type: "feedback", rating: r } : { type: "feedback", rating: r, text };
    }
    case "perf": {
      if (!hasExactKeys(data, ["type", "gameId", ...PERF_KEYS])) return null;
      const gameId = data.gameId;
      if (typeof gameId !== "string" || gameId.length === 0 || gameId.length > 64) return null;
      const sample = {} as PerfSample;
      for (const key of PERF_KEYS) {
        const v = data[key];
        if (typeof v !== "number" || !Number.isSafeInteger(v) || v < 0 || v > PERF_LIMITS[key]) return null;
        sample[key] = v;
      }
      return { type: "perf", gameId, ...sample };
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
