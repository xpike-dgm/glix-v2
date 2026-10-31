import type { GameContext, GameDefinition, Rejected } from "../../game.js";
import { rankAwards } from "../scoring.js";
import {
  TEK_CHOOSE_MS,
  TEK_LAST_REVEAL_MS,
  TEK_LOCK_GRACE_MS,
  TEK_REVEAL_MS,
  TEK_ROUNDS,
  TEK_WIN_POINTS,
  type TekAction,
  type TekPublicView,
  type TekReveal,
  type TekRoundSummary,
  type TekView,
  tekMax,
} from "./types.js";

export * from "./types.js";

export interface TekState {
  players: string[];
  startedAt: number;
  max: number;
  round: number;
  phase: "choose" | "reveal";
  phaseStartedAt: number;
  phaseEndsAt: number;
  choices: Record<string, number>;
  locked: string[];
  results: TekReveal[];
}

const revealMs = (round: number): number => (round === TEK_ROUNDS - 1 ? TEK_LAST_REVEAL_MS : TEK_REVEAL_MS);

/** Bir turun puanı: en küçük TEK kalan sayıyı seçen kazanır (+3); tek kalan sayı yoksa kimse puan almaz. */
export function tekSettle(
  players: readonly string[],
  max: number,
  choices: Record<string, number>,
): TekReveal {
  const picks: Record<string, number> = {};
  const counts: number[] = new Array(max).fill(0);
  for (const id of players) {
    const v = choices[id];
    if (v === undefined || v < 1 || v > max) continue;
    picks[id] = v;
    counts[v - 1] = (counts[v - 1] ?? 0) + 1;
  }
  const points: Record<string, number> = {};
  for (const id of players) points[id] = 0;
  const idx = counts.findIndex((c) => c === 1);
  let winner: string | null = null;
  let winningValue: number | null = null;
  if (idx >= 0) {
    winningValue = idx + 1;
    winner = players.find((id) => picks[id] === winningValue) ?? null;
    if (winner !== null) points[winner] = TEK_WIN_POINTS;
  }
  return { picks, counts, winner, winningValue, points };
}

function totalsOf(state: TekState, results: readonly TekReveal[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const id of state.players) totals[id] = 0;
  for (const r of results)
    for (const id of state.players) totals[id] = (totals[id] ?? 0) + (r.points[id] ?? 0);
  return totals;
}

function advance(state: TekState, now: number): TekState {
  let s = state;
  while (now >= s.phaseEndsAt) {
    if (s.phase === "choose") {
      s = {
        ...s,
        phase: "reveal",
        phaseStartedAt: s.phaseEndsAt,
        phaseEndsAt: s.phaseEndsAt + revealMs(s.round),
        results: [...s.results, tekSettle(s.players, s.max, s.choices)],
      };
    } else if (s.round < TEK_ROUNDS - 1) {
      s = {
        ...s,
        round: s.round + 1,
        phase: "choose",
        phaseStartedAt: s.phaseEndsAt,
        phaseEndsAt: s.phaseEndsAt + TEK_CHOOSE_MS,
        choices: {},
        locked: [],
      };
    } else break;
  }
  return s;
}

const isLastReveal = (s: TekState): boolean => s.phase === "reveal" && s.round === TEK_ROUNDS - 1;

function awardsOf(totals: Record<string, number>): Record<string, number> {
  const awards = rankAwards(totals, { positiveOnly: true });
  const out: Record<string, number> = {};
  for (const id of Object.keys(totals)) out[id] = awards[id] ?? 0;
  return out;
}

export const tekVeKucuk: GameDefinition<TekState, TekAction, TekView, TekPublicView> = {
  id: "tek-ve-kucuk",
  name: "Tek ve Küçük",
  minPlayers: 3,
  maxPlayers: 8,
  orientation: "portrait",
  // TASLAK: sahip kuralları onaylayana dek rastgele havuza girmez (ve oyun zaten yalnız taslak yolundan açılır).
  randomPool: false,
  briefing: {
    goal: "En küçük sayıyı seç ama kimse seninle aynı sayıyı seçmesin!",
    steps: [
      "Her tur gizlice 1 ile en fazla oyuncu sayısı + 2 arası bir sayı seç",
      "Tek kişinin seçtiği sayılar arasında en küçüğü kazanır: +3 puan",
      "5 turun toplamı en yüksek +2, ikinci +1",
    ],
  },

  parseAction(raw: unknown): TekAction | null {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
    const rec = raw as Record<string, unknown>;
    if (rec.kind === "lock") return Object.keys(rec).length === 1 ? { kind: "lock" } : null;
    if (rec.kind !== "choose" || Object.keys(rec).length !== 2) return null;
    const value = rec.value;
    if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 10) return null;
    return { kind: "choose", value };
  },

  setup(players: readonly string[], ctx: GameContext): TekState {
    return {
      players: [...players],
      startedAt: ctx.now,
      max: tekMax(players.length),
      round: 0,
      phase: "choose",
      phaseStartedAt: ctx.now,
      phaseEndsAt: ctx.now + TEK_CHOOSE_MS,
      choices: {},
      locked: [],
      results: [],
    };
  },

  reduce(state, playerId, action, ctx): TekState | Rejected {
    if (!state.players.includes(playerId)) return { rejected: "not_participant" };
    if (ctx.now < state.startedAt) return { rejected: "not_started" };
    const s = advance(state, ctx.now);
    if (s.phase !== "choose") return { rejected: "ended" };
    if (s.locked.includes(playerId)) return { rejected: "locked" };
    if (action.kind === "choose") {
      if (action.value < 1 || action.value > s.max) return { rejected: "out_of_range" };
      if (s.choices[playerId] === action.value) return s;
      return { ...s, choices: { ...s.choices, [playerId]: action.value } };
    }
    if (s.choices[playerId] === undefined) return { rejected: "nothing_to_lock" };
    const locked = [...s.locked, playerId];
    const waiting = s.players.some((id) => ctx.connected.includes(id) && !locked.includes(id));
    if (waiting) return { ...s, locked };
    return { ...s, locked, phaseEndsAt: Math.min(s.phaseEndsAt, ctx.now + TEK_LOCK_GRACE_MS) };
  },

  tick(state, ctx): TekState {
    return advance(state, ctx.now);
  },

  publicView(state, ctx): TekPublicView {
    const s = advance(state, ctx.now);
    const previous: TekRoundSummary[] = s.results
      .slice(0, s.round)
      .map((r) => ({ winningValue: r.winningValue, winner: r.winner }));
    const totals = totalsOf(s, s.results);
    return {
      startedAt: s.startedAt,
      round: s.round + 1,
      rounds: TEK_ROUNDS,
      phase: s.phase,
      phaseStartedAt: s.phaseStartedAt,
      phaseEndsAt: s.phaseEndsAt,
      max: s.max,
      previous,
      totals,
      lockedIds: s.phase === "choose" ? [...s.locked] : [],
      reveal: s.phase === "reveal" ? (s.results[s.round] ?? null) : null,
      final: isLastReveal(s) ? awardsOf(totals) : null,
    };
  },

  view(state, playerId, ctx): TekView {
    const s = advance(state, ctx.now);
    const mine = playerId === null ? undefined : s.choices[playerId];
    return {
      myValue: s.phase === "choose" ? (mine ?? null) : null,
      locked: playerId !== null && s.phase === "choose" && s.locked.includes(playerId),
    };
  },

  /** Sonuç açılışı son turun açılışıyla başlar. */
  revealAt(state, ctx): number | null {
    const s = advance(state, ctx.now);
    return isLastReveal(s) ? s.phaseStartedAt : null;
  },

  isFinished(state, ctx): boolean {
    const s = advance(state, ctx.now);
    return isLastReveal(s) && ctx.now >= s.phaseEndsAt;
  },

  /** Gizli sayılar kısadır; gizlilik yapısal sağlanır ve test edilir (tek-ve-kucuk.test.ts, "gizlilik"). */
  secrets() {
    return [];
  },

  result(state) {
    const results =
      state.phase === "choose"
        ? [...state.results, tekSettle(state.players, state.max, state.choices)]
        : state.results;
    const totals = totalsOf(state, results);
    return { miniScores: totals, awards: awardsOf(totals) };
  },
};
