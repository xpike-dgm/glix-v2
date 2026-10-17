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
  | { type: "startMatch" }
  | { type: "ready" }
  | { type: "action"; seq: number; payload: unknown }
  | { type: "returnToLobby" };

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
  | "not_participant";

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
  /** Host'un seçtiği oyunlar (sıralı). */
  gameIds: string[];
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
  | { type: "actionAck"; seq: number; ok: boolean; reason?: string }
  | { type: "left"; reason: LeftReason }
  | { type: "error"; code: ErrorCode; message: string };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function hasOnlyKeys(obj: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(obj).every((k) => keys.includes(k));
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
      if (!hasOnlyKeys(data, ["type", "clientVersion"])) return null;
      const v = data.clientVersion;
      if (typeof v !== "string" || v.length === 0 || v.length > 64) return null;
      return { type: "hello", clientVersion: v };
    }
    case "ping": {
      if (!hasOnlyKeys(data, ["type", "t"])) return null;
      const t = data.t;
      if (typeof t !== "number" || !Number.isFinite(t)) return null;
      return { type: "ping", t };
    }
    default:
      return null;
  }
}
