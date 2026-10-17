import type { GameInfo, RoomPhase, ServerMessage } from "@glix/engine";
import type { Broadcaster } from "./broadcast.js";
import type { Cancel, Clock } from "./clock.js";
import type { Match } from "./match.js";

/** Bir WebSocket bağlantısının sunucudaki temsili. Oda/oyuncu bağı oturum açılınca dolar. */
export interface Connection {
  send(msg: ServerMessage): void;
  close(code: number, reason: string): void;
  player: Player | null;
}

export interface Player {
  id: string;
  nickname: string;
  avatar: number;
  token: string;
  score: number;
  /** Katılım sırası; "en eski" host seçimi için. */
  joinOrder: number;
  conn: Connection | null;
  room: Room;
  graceCancel: Cancel | null;
}

export interface Room {
  code: string;
  hostId: string;
  players: Map<string, Player>;
  phase: RoomPhase;
  gameIds: string[];
  match: Match | null;
  rev: number;
  nextJoinOrder: number;
  lastFlushAt: number;
  flushCancel: Cancel | null;
  deleteCancel: Cancel | null;
}

export interface Runtime {
  clock: Clock;
  rooms: Map<string, Room>;
  /** Oturum belirteci -> oyuncu. */
  tokens: Map<string, Player>;
  /** Etkin maçı olan odalar (tick yalnız bunlar için çalışır). */
  active: Set<Room>;
  broadcaster: Broadcaster;
  catalog: GameInfo[];
}

export function isConnected(player: Player): boolean {
  return player.conn !== null;
}
