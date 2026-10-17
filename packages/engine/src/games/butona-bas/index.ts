import type { GameContext, GameDefinition, Rejected } from "../../game.js";
import {
  BUTONA_BAS_DURATION_MS,
  BUTONA_BAS_WINDOW_MS,
  type ButonaBasAction,
  type ButonaBasView,
  type ButonaBasWindowResult,
} from "./types.js";

export * from "./types.js";

const MAX_RECENT = 8;

export interface ButonaBasState {
  players: string[];
  startedAt: number;
  endsAt: number;
  /** Henüz puanlanmamış pencereler: pencere sırası -> basan oyuncular (benzersiz, basış sırasıyla). */
  pending: Record<number, string[]>;
  /** Mini oyun puanları. */
  scores: Record<string, number>;
  /** Kapanmış, en az bir basışı olan son pencereler (en yenisi sonda). */
  recent: ButonaBasWindowResult[];
}

function windowIndex(state: ButonaBasState, now: number): number {
  return Math.floor((now - state.startedAt) / BUTONA_BAS_WINDOW_MS);
}

/** `now` anında tamamen kapanmış pencere sayısı (sıralar 0..n-1). */
function closedWindowCount(state: ButonaBasState, now: number): number {
  const total = Math.ceil((state.endsAt - state.startedAt) / BUTONA_BAS_WINDOW_MS);
  if (now >= state.endsAt) return total;
  return Math.max(0, Math.min(total, windowIndex(state, now)));
}

/** Kapanmış pencereleri puanlar. Değişiklik yoksa aynı nesneyi döner. */
function settle(state: ButonaBasState, closedCount: number): ButonaBasState {
  const due = Object.keys(state.pending)
    .map(Number)
    .filter((i) => i < closedCount)
    .sort((a, b) => a - b);
  if (due.length === 0) return state;
  const pending = { ...state.pending };
  const scores = { ...state.scores };
  let recent = state.recent;
  for (const index of due) {
    const pressers = pending[index] ?? [];
    delete pending[index];
    if (pressers.length === 0) continue;
    const outcome: ButonaBasWindowResult["outcome"] = pressers.length >= 2 ? "match" : "solo";
    const delta = outcome === "match" ? 1 : -1;
    for (const id of pressers) scores[id] = (scores[id] ?? 0) + delta;
    recent = [...recent, { index, pressers: [...pressers], outcome }].slice(-MAX_RECENT);
  }
  return { ...state, pending, scores, recent };
}

/** Eski sürümdeki createRankAwards ile aynı: tek lider +2 ve sıradaki puanı paylaşanların hepsi +1; lider eşitse liderler +1. */
export function butonaBasAwards(scores: Record<string, number>): Record<string, number> {
  const entries = Object.entries(scores);
  if (entries.length === 0) return {};
  const top = Math.max(...entries.map(([, s]) => s));
  const leaders = entries.filter(([, s]) => s === top).map(([id]) => id);
  const awards: Record<string, number> = {};
  if (leaders.length > 1) {
    for (const id of leaders) awards[id] = 1;
    return awards;
  }
  const leader = leaders[0];
  if (leader === undefined) return awards;
  awards[leader] = 2;
  const below = entries.filter(([, s]) => s < top).map(([, s]) => s);
  if (below.length === 0) return awards;
  const next = Math.max(...below);
  for (const [id, s] of entries) if (s === next) awards[id] = 1;
  return awards;
}

export const butonaBas: GameDefinition<ButonaBasState, ButonaBasAction, ButonaBasView> = {
  id: "butona-bas",
  name: "Butona Bas",
  minPlayers: 2,
  maxPlayers: 8,
  orientation: "portrait",
  briefing: {
    goal: "Arkadaşlarınla aynı anda bas!",
    steps: ["Aynı anda basarsanız herkes +1", "Tek başına basarsan −1", "45 saniye boyunca ritmi yakalayın"],
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
    const index = windowIndex(state, ctx.now);
    const current = state.pending[index];
    if (current?.includes(playerId)) return state;
    return { ...state, pending: { ...state.pending, [index]: [...(current ?? []), playerId] } };
  },

  tick(state, ctx): ButonaBasState {
    return settle(state, closedWindowCount(state, ctx.now));
  },

  view(state, playerId, ctx): ButonaBasView {
    const open = ctx.now < state.endsAt ? state.pending[windowIndex(state, ctx.now)] : undefined;
    return {
      startedAt: state.startedAt,
      endsAt: state.endsAt,
      windowMs: BUTONA_BAS_WINDOW_MS,
      myScore: playerId === null ? null : (state.scores[playerId] ?? 0),
      scores: { ...state.scores },
      pressedThisWindow: playerId !== null && (open?.includes(playerId) ?? false),
      recent: state.recent.map((w) => ({ ...w, pressers: [...w.pressers] })),
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
