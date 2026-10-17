import { randomInt } from "node:crypto";
import {
  type AnyGame,
  createRng,
  GAMES,
  type GameContext,
  GameRecorder,
  type GameResult,
  isRejected,
  type MatchSnapshot,
  type Rng,
} from "@glix/engine";
import { log } from "./log.js";
import { errorMessage } from "./messages.js";
import type { Player, Room, Runtime } from "./runtime.js";
import { isConnected } from "./runtime.js";

export const TICK_MS = 100;
export const BRIEFING_TIMEOUT_MS = 40_000;
export const COUNTDOWN_MS = 3_000;
export const RESULTS_MS = 7_000;
/** Bellekte tutulan son oyun kaydı sayısı (docs/PROTOKOL.md "Maç kaydı"). */
export const RECENT_LOGS = 20;

export interface Match {
  games: AnyGame[];
  /** 0 tabanlı geçerli oyun sırası. */
  index: number;
  /** Maç başında bağlı olanlar; sonradan odadan çıkanlar geçerli oyunda süzülür. */
  startParticipants: string[];
  /** Geçerli oyunun katılımcıları. */
  participants: string[];
  readyIds: Set<string>;
  phaseStartedAt: number;
  phaseEndsAt: number | null;
  state: unknown;
  rng: Rng | null;
  result: GameResult | null;
  /** Geçerli oyunun kaydı (playing aşamasında dolu). */
  recorder: GameRecorder | null;
}

/** Bir oyun fonksiyonu hata fırlattı; `fn` hangisi olduğunu söyler (setup, reduce, tick, view, result...). */
export class GameFault extends Error {
  constructor(
    readonly fn: string,
    readonly original: unknown,
  ) {
    super(`oyun fonksiyonu hata verdi: ${fn}`);
  }
}

function guard<T>(fn: string, call: () => T): T {
  try {
    return call();
  } catch (cause) {
    throw new GameFault(fn, cause);
  }
}

/**
 * Bir odadaki oyun hata verince maçı zarifçe bitirir: günlüğe yapılandırılmış kayıt, oyunculara hata
 * mesajı, oda lobiye döner (genel skorlar korunur). Diğer odalar etkilenmez.
 */
export function abortMatch(rt: Runtime, room: Room, err: unknown): void {
  const fault = err instanceof GameFault ? err : new GameFault("engine", err);
  const match = room.match;
  const gameId = match?.games[match.index]?.id ?? null;
  const cause = fault.original;
  let gameLog: unknown = null;
  try {
    gameLog = match?.recorder?.finish(rt.clock.now()) ?? null;
  } catch {
    // kayıt alınamadı; hata yine de günlüğe yazılır
  }
  log.error("game_failed", {
    roomCode: room.code,
    gameId,
    fn: fault.fn,
    phase: room.phase,
    error: cause instanceof Error ? cause.message : String(cause),
    stack: cause instanceof Error ? cause.stack : undefined,
    gameLog,
  });
  for (const player of room.players.values()) {
    player.conn?.send(errorMessage("game_failed"));
  }
  clearMatch(rt, room);
  rt.broadcaster.markDirty(room);
}

export function currentGame(match: Match): AnyGame {
  const game = match.games[match.index];
  if (!game) throw new Error("oyun yok");
  return game;
}

export function requiredPlayers(gameIds: readonly string[]): number {
  return Math.max(0, ...gameIds.map((id) => GAMES[id]?.minPlayers ?? 0));
}

function enterBriefing(rt: Runtime, room: Room, match: Match): void {
  const now = rt.clock.now();
  match.participants = match.startParticipants.filter((id) => room.players.has(id));
  match.readyIds = new Set();
  match.state = null;
  match.rng = null;
  match.result = null;
  match.recorder = null;
  match.phaseStartedAt = now;
  match.phaseEndsAt = now + BRIEFING_TIMEOUT_MS;
  room.phase = "briefing";
}

/** Maçı başlatır. Ön koşullar (host, lobi, oyuncu sayısı) çağıran tarafından denetlenir. */
export function beginMatch(rt: Runtime, room: Room): void {
  const games = room.gameIds.map((id) => GAMES[id]).filter((g): g is AnyGame => g !== undefined);
  const participants = [...room.players.values()].filter(isConnected).map((p) => p.id);
  const match: Match = {
    games,
    index: 0,
    startParticipants: participants,
    participants,
    readyIds: new Set(),
    phaseStartedAt: 0,
    phaseEndsAt: null,
    state: null,
    rng: null,
    result: null,
    recorder: null,
  };
  room.match = match;
  enterBriefing(rt, room, match);
  rt.active.add(room);
}

/** Maçı bırakıp lobiye döner (skorlara dokunmaz). */
export function clearMatch(rt: Runtime, room: Room): void {
  room.match = null;
  room.phase = "lobby";
  rt.active.delete(room);
}

export function markReady(room: Room, playerId: string): void {
  room.match?.readyIds.add(playerId);
}

function ctxFor(rt: Runtime, match: Match): GameContext {
  if (!match.rng) throw new Error("rng yok");
  return { now: rt.clock.now(), rng: match.rng };
}

function startPlaying(rt: Runtime, room: Room, match: Match): void {
  const now = rt.clock.now();
  const seed = randomInt(0, 2 ** 32);
  const game = currentGame(match);
  match.rng = createRng(seed);
  const rng = match.rng;
  match.recorder = new GameRecorder(game.id, seed, match.participants, now);
  match.state = guard("setup", () => game.setup(match.participants, { now, rng }));
  match.phaseStartedAt = now;
  match.phaseEndsAt = null;
  room.phase = "playing";
}

function finishGame(rt: Runtime, room: Room, match: Match): void {
  const now = rt.clock.now();
  const result = guard("result", () => currentGame(match).result(match.state));
  archiveLog(rt, match);
  for (const [id, points] of Object.entries(result.awards)) {
    const player = room.players.get(id);
    if (player) player.score += points;
  }
  match.result = result;
  match.phaseStartedAt = now;
  match.phaseEndsAt = now + RESULTS_MS;
  room.phase = "results";
}

/** Biten oyunun kaydını son-N listesine ekler. */
function archiveLog(rt: Runtime, match: Match): void {
  try {
    if (!match.recorder) return;
    rt.recentLogs.push(match.recorder.finish(rt.clock.now()));
    if (rt.recentLogs.length > RECENT_LOGS) rt.recentLogs.splice(0, rt.recentLogs.length - RECENT_LOGS);
  } catch (err) {
    log.warn("recorder_failed", { error: String(err) });
  }
}

function nextGameOrFinal(rt: Runtime, room: Room, match: Match): void {
  if (match.index + 1 < match.games.length) {
    match.index += 1;
    enterBriefing(rt, room, match);
    return;
  }
  match.phaseStartedAt = rt.clock.now();
  match.phaseEndsAt = null;
  room.phase = "final";
  rt.active.delete(room);
}

/**
 * Süreye bağlı ilerlemeyi işler. Görünür bir şey değiştiyse odayı yayına işaretler.
 * Oyun fonksiyonu (veya adım) hata verirse yalnız bu odanın maçı iptal edilir.
 */
export function stepMatch(rt: Runtime, room: Room): void {
  try {
    stepMatchUnsafe(rt, room);
  } catch (err) {
    abortMatch(rt, room, err);
  }
}

function stepMatchUnsafe(rt: Runtime, room: Room): void {
  const match = room.match;
  if (!match) return;
  const now = rt.clock.now();
  switch (room.phase) {
    case "briefing": {
      const waiting = match.participants
        .map((id) => room.players.get(id))
        .filter((p): p is Player => p !== undefined && isConnected(p));
      const allReady = waiting.length > 0 && waiting.every((p) => match.readyIds.has(p.id));
      if (allReady || (match.phaseEndsAt !== null && now >= match.phaseEndsAt)) {
        match.phaseStartedAt = now;
        match.phaseEndsAt = now + COUNTDOWN_MS;
        room.phase = "countdown";
        rt.broadcaster.markDirty(room);
      }
      return;
    }
    case "countdown": {
      if (match.phaseEndsAt !== null && now >= match.phaseEndsAt) {
        startPlaying(rt, room, match);
        rt.broadcaster.markDirty(room);
      }
      return;
    }
    case "playing": {
      const game = currentGame(match);
      const ctx = ctxFor(rt, match);
      const next = guard("tick", () => game.tick(match.state, ctx));
      const changed = next !== match.state;
      match.state = next;
      if (guard("isFinished", () => game.isFinished(match.state, ctx))) {
        finishGame(rt, room, match);
        rt.broadcaster.markDirty(room);
      } else if (changed) {
        rt.broadcaster.markDirty(room);
      }
      return;
    }
    case "results": {
      if (match.phaseEndsAt !== null && now >= match.phaseEndsAt) {
        nextGameOrFinal(rt, room, match);
        rt.broadcaster.markDirty(room);
      }
      return;
    }
    default:
      return;
  }
}

export type ActionOutcome = { ok: true } | { ok: false; reason: string };

export function applyAction(rt: Runtime, room: Room, playerId: string, payload: unknown): ActionOutcome {
  try {
    return applyActionUnsafe(rt, room, playerId, payload);
  } catch (err) {
    abortMatch(rt, room, err);
    return { ok: false, reason: "wrong_phase" };
  }
}

function applyActionUnsafe(rt: Runtime, room: Room, playerId: string, payload: unknown): ActionOutcome {
  const match = room.match;
  if (!match || room.phase !== "playing") return { ok: false, reason: "wrong_phase" };
  if (!match.participants.includes(playerId)) return { ok: false, reason: "not_participant" };
  const game = currentGame(match);
  const action = guard("parseAction", () => game.parseAction(payload));
  if (action === null) return { ok: false, reason: "invalid_action" };
  const ctx = ctxFor(rt, match);
  const next = guard("reduce", () => game.reduce(match.state, playerId, action, ctx));
  if (isRejected(next)) return { ok: false, reason: next.rejected };
  try {
    match.recorder?.record(ctx.now, playerId, action);
  } catch (err) {
    log.warn("recorder_failed", { room: room.code, error: String(err) });
  }
  if (next !== match.state) {
    match.state = next;
    rt.broadcaster.markDirty(room);
  }
  return { ok: true };
}

/** Maçın herkese ortak görünen kısmı (oyuncuya özel `view` hariç). */
export function sharedMatchSnapshot(room: Room): Omit<MatchSnapshot, "view"> | null {
  const match = room.match;
  if (!match) return null;
  const game = currentGame(match);
  return {
    round: match.index,
    total: match.games.length,
    gameId: game.id,
    gameName: game.name,
    briefing: { goal: game.briefing.goal, steps: [...game.briefing.steps] },
    orientation: game.orientation,
    participants: [...match.participants],
    readyIds: [...match.readyIds],
    phaseStartedAt: match.phaseStartedAt,
    phaseEndsAt: match.phaseEndsAt,
    result: room.phase === "results" || room.phase === "final" ? match.result : null,
  };
}

/** Oyuncuya özel oyun görünümü; katılımcı olmayan izleyici görünümü alır. */
export function matchViewFor(rt: Runtime, room: Room, playerId: string): unknown {
  const match = room.match;
  if (!match?.rng || (room.phase !== "playing" && room.phase !== "results")) return null;
  const who = match.participants.includes(playerId) ? playerId : null;
  const game = currentGame(match);
  const ctx = ctxFor(rt, match);
  return guard("view", () => game.view(match.state, who, ctx));
}

export function runTick(rt: Runtime): void {
  for (const room of [...rt.active]) {
    try {
      stepMatch(rt, room);
    } catch (err) {
      // abortMatch'in kendisi de hata verirse diğer odalar yine de ilerler.
      log.error("tick_failed", { roomCode: room.code, error: String(err) });
    }
  }
}
