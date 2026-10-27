import type { GameContext, GameDefinition, Rejected } from "../../game.js";
import { rankAwards } from "../scoring.js";
import {
  BUTONA_BAS_DURATION_MS,
  BUTONA_BAS_GAP_MS,
  BUTONA_BAS_ROUND_MS,
  BUTONA_BAS_ROUNDS,
  type ButonaBasAction,
  type ButonaBasPhase,
  type ButonaBasPublicView,
  type ButonaBasView,
  type ButonaBasWindowResult,
  butonaBasRoundOffset,
  butonaBasWindowMs,
} from "./types.js";

export * from "./types.js";

const MAX_RECENT = 8;
/** Bekleyen pencere anahtarı: tur × 1000 + tur içi sıra (en uzun tur 125 pencere). */
const KEY_STRIDE = 1000;

export interface ButonaBasState {
  players: string[];
  startedAt: number;
  endsAt: number;
  /** Henüz puanlanmamış pencereler: anahtar (tur × 1000 + sıra) -> basan oyuncular (benzersiz, basış sırasıyla). */
  pending: Record<number, string[]>;
  /** Mini oyun puanları (turlar boyunca toplam). */
  scores: Record<string, number>;
  /** Kapanmış, en az bir basışı olan son pencereler (en yenisi sonda). */
  recent: ButonaBasWindowResult[];
}

/** `now` anındaki konum: oynanan tur ve tur içi sıra; aradaysa ya da oyun dışındaysa null. */
function slotAt(state: ButonaBasState, now: number): { round: number; index: number } | null {
  const t = now - state.startedAt;
  if (t < 0 || now >= state.endsAt) return null;
  const round = Math.floor(t / (BUTONA_BAS_ROUND_MS + BUTONA_BAS_GAP_MS));
  if (round >= BUTONA_BAS_ROUNDS) return null;
  const inRound = t - butonaBasRoundOffset(round);
  if (inRound >= BUTONA_BAS_ROUND_MS) return null; // ara
  return { round, index: Math.floor(inRound / butonaBasWindowMs(round)) };
}

/** Pencerenin kapandığı an (ms, mutlak). */
function windowClosesAt(state: ButonaBasState, key: number): number {
  const round = Math.floor(key / KEY_STRIDE);
  const index = key % KEY_STRIDE;
  const start = state.startedAt + butonaBasRoundOffset(round);
  return Math.min(start + (index + 1) * butonaBasWindowMs(round), start + BUTONA_BAS_ROUND_MS);
}

/** Gösterilecek tur ve evre: oynanıyorsa o tur, aradaysa yaklaşan tur, bittiyse son tur. */
function phaseAt(
  state: ButonaBasState,
  now: number,
): { round: number; phase: ButonaBasPhase; phaseEndsAt: number } {
  if (now >= state.endsAt) return { round: BUTONA_BAS_ROUNDS - 1, phase: "over", phaseEndsAt: state.endsAt };
  const t = Math.max(0, now - state.startedAt);
  const round = Math.min(BUTONA_BAS_ROUNDS - 1, Math.floor(t / (BUTONA_BAS_ROUND_MS + BUTONA_BAS_GAP_MS)));
  const roundEnd = state.startedAt + butonaBasRoundOffset(round) + BUTONA_BAS_ROUND_MS;
  if (now < roundEnd) return { round, phase: "play", phaseEndsAt: roundEnd };
  // Ara: yaklaşan tur.
  return {
    round: round + 1,
    phase: "gap",
    phaseEndsAt: state.startedAt + butonaBasRoundOffset(round + 1),
  };
}

/** Kapanmış (kapanış anı <= `now`) pencereleri puanlar. Değişiklik yoksa aynı nesneyi döner. */
function settle(state: ButonaBasState, now: number): ButonaBasState {
  const due = Object.keys(state.pending)
    .map(Number)
    .filter((key) => windowClosesAt(state, key) <= now)
    .sort((a, b) => a - b);
  if (due.length === 0) return state;
  const pending = { ...state.pending };
  const scores = { ...state.scores };
  let recent = state.recent;
  for (const key of due) {
    const pressers = pending[key] ?? [];
    delete pending[key];
    if (pressers.length === 0) continue;
    const outcome: ButonaBasWindowResult["outcome"] = pressers.length >= 2 ? "match" : "solo";
    const delta = outcome === "match" ? 1 : -1;
    for (const id of pressers) scores[id] = (scores[id] ?? 0) + delta;
    recent = [
      ...recent,
      { round: Math.floor(key / KEY_STRIDE), index: key % KEY_STRIDE, pressers: [...pressers], outcome },
    ].slice(-MAX_RECENT);
  }
  return { ...state, pending, scores, recent };
}

/**
 * Butona Bas aktarımı (mevcut dönüşüm, O8'de değişmedi): 3 turun mini toplamına göre sıralama ödülü, oyun sonunda
 * bir kez (tek lider +2, sıradaki +1; lider eşitse liderler +1; 0 puanlı eşit liderler dahil).
 */
export function butonaBasAwards(scores: Record<string, number>): Record<string, number> {
  return rankAwards(scores);
}

export const butonaBas: GameDefinition<ButonaBasState, ButonaBasAction, ButonaBasView, ButonaBasPublicView> =
  {
    id: "butona-bas",
    name: "Butona Bas",
    minPlayers: 2,
    maxPlayers: 8,
    orientation: "portrait",
    briefing: {
      goal: "Arkadaşlarınla aynı anda bas!",
      steps: [
        "Aynı anda basarsanız herkes +1",
        "Tek başına basarsan −1",
        "3 tur: pencere 300, 200, 120 ms diye daralır",
      ],
    },

    parseAction(raw: unknown): ButonaBasAction | null {
      if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
      const keys = Object.keys(raw);
      if (keys.length !== 1 || (raw as Record<string, unknown>).kind !== "press") return null;
      return { kind: "press" };
    },

    setup(players: readonly string[], ctx: GameContext): ButonaBasState {
      const scores: Record<string, number> = {};
      for (const id of players) scores[id] = 0;
      return {
        players: [...players],
        startedAt: ctx.now,
        endsAt: ctx.now + BUTONA_BAS_DURATION_MS,
        pending: {},
        scores,
        recent: [],
      };
    },

    reduce(state, playerId, _action, ctx): ButonaBasState | Rejected {
      if (!state.players.includes(playerId)) return { rejected: "not_participant" };
      if (ctx.now >= state.endsAt) return { rejected: "ended" };
      if (ctx.now < state.startedAt) return { rejected: "not_started" };
      const slot = slotAt(state, ctx.now);
      if (slot === null) return { rejected: "between_rounds" };
      const key = slot.round * KEY_STRIDE + slot.index;
      const current = state.pending[key];
      if (current?.includes(playerId)) return state;
      return { ...state, pending: { ...state.pending, [key]: [...(current ?? []), playerId] } };
    },

    tick(state, ctx): ButonaBasState {
      return settle(state, ctx.now);
    },

    publicView(state, ctx): ButonaBasPublicView {
      const { round, phase, phaseEndsAt } = phaseAt(state, ctx.now);
      return {
        startedAt: state.startedAt,
        endsAt: state.endsAt,
        round: round + 1,
        rounds: BUTONA_BAS_ROUNDS,
        phase,
        windowMs: butonaBasWindowMs(round),
        phaseEndsAt,
        scores: { ...state.scores },
        recent: state.recent.map((w) => ({ ...w, pressers: [...w.pressers] })),
      };
    },

    view(state, playerId, ctx): ButonaBasView {
      const slot = slotAt(state, ctx.now);
      const open = slot === null ? undefined : state.pending[slot.round * KEY_STRIDE + slot.index];
      return {
        myScore: playerId === null ? null : (state.scores[playerId] ?? 0),
        pressedThisWindow: playerId !== null && (open?.includes(playerId) ?? false),
      };
    },

    isFinished(state, ctx): boolean {
      return ctx.now >= state.endsAt;
    },

    secrets() {
      return [];
    },

    result(state) {
      const settled = settle(state, Number.POSITIVE_INFINITY);
      return { miniScores: { ...settled.scores }, awards: butonaBasAwards(settled.scores) };
    },
  };
