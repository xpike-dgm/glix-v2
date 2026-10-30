import type { GameContext, GameDefinition, Rejected } from "../../game.js";
import type { Rng } from "../../rng.js";
import { rankAwards } from "../scoring.js";
import {
  ORTAK_CHOOSE_MS,
  ORTAK_COLORS,
  ORTAK_LAST_REVEAL_MS,
  ORTAK_LOCK_GRACE_MS,
  ORTAK_REVEAL_MS,
  ORTAK_ROUNDS,
  ORTAK_SHAPES,
  ORTAK_TILES,
  type OrtakAction,
  type OrtakGroup,
  type OrtakPublicView,
  type OrtakReveal,
  type OrtakTile,
  type OrtakView,
} from "./types.js";

export * from "./types.js";

export interface OrtakState {
  players: string[];
  startedAt: number;
  /** Tur başına kutular ve oyuncu başına ekran sırası (kurulumda çekilir; gizli bilgi değildir). */
  boards: OrtakTile[][];
  layouts: Record<string, number[]>[];
  /** Gösterilen tur (0 tabanlı) ve aşaması. */
  round: number;
  phase: "choose" | "reveal";
  phaseStartedAt: number;
  phaseEndsAt: number;
  /** Bu turun gizli seçimleri ve kilitleyenler. */
  choices: Record<string, number>;
  locked: string[];
  /** Sonucu açılmış turlar. */
  results: OrtakReveal[];
}

const revealMs = (round: number): number =>
  round === ORTAK_ROUNDS - 1 ? ORTAK_LAST_REVEAL_MS : ORTAK_REVEAL_MS;

function drawBoard(rng: Rng): OrtakTile[] {
  const colors = rng.shuffle(Array.from({ length: ORTAK_COLORS }, (_, i) => i));
  const shapes = rng.shuffle(Array.from({ length: ORTAK_SHAPES }, (_, i) => i));
  return Array.from({ length: ORTAK_TILES }, (_, i) => ({
    color: colors[i] ?? 0,
    shape: shapes[i] ?? 0,
  }));
}

/** Bir turun puanı: eşleştiğin kişi sayısı kadar; tek en kalabalık grup (en az 2 kişi) +1 ekler. */
export function ortakSettle(players: readonly string[], choices: Record<string, number>): OrtakReveal {
  const byTile = new Map<number, string[]>();
  const picks: Record<string, number> = {};
  for (const id of players) {
    const t = choices[id];
    if (t === undefined) continue;
    picks[id] = t;
    byTile.set(t, [...(byTile.get(t) ?? []), id]);
  }
  const groups: OrtakGroup[] = [...byTile.entries()]
    .map(([tile, ids]) => ({ tile, ids }))
    .sort((a, b) => b.ids.length - a.ids.length || a.tile - b.tile);
  const points: Record<string, number> = {};
  for (const id of players) points[id] = 0;
  for (const g of groups) for (const id of g.ids) points[id] = g.ids.length - 1;
  const first = groups[0];
  const second = groups[1];
  let topTile: number | null = null;
  if (first && first.ids.length >= 2 && (!second || second.ids.length < first.ids.length)) {
    topTile = first.tile;
    for (const id of first.ids) points[id] = (points[id] ?? 0) + 1;
  }
  return { picks, groups, topTile, points };
}

function totalsOf(state: OrtakState, results: readonly OrtakReveal[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const id of state.players) totals[id] = 0;
  for (const r of results)
    for (const id of state.players) totals[id] = (totals[id] ?? 0) + (r.points[id] ?? 0);
  return totals;
}

/** Süresi dolan aşamaları sırayla ilerletir (tick takvimine bağlı değildir). Değişim yoksa aynı nesne. */
function advance(state: OrtakState, now: number): OrtakState {
  let s = state;
  while (now >= s.phaseEndsAt) {
    if (s.phase === "choose") {
      s = {
        ...s,
        phase: "reveal",
        phaseStartedAt: s.phaseEndsAt,
        phaseEndsAt: s.phaseEndsAt + revealMs(s.round),
        results: [...s.results, ortakSettle(s.players, s.choices)],
      };
    } else if (s.round < ORTAK_ROUNDS - 1) {
      s = {
        ...s,
        round: s.round + 1,
        phase: "choose",
        phaseStartedAt: s.phaseEndsAt,
        phaseEndsAt: s.phaseEndsAt + ORTAK_CHOOSE_MS,
        choices: {},
        locked: [],
      };
    } else break;
  }
  return s;
}

const isLastReveal = (s: OrtakState): boolean => s.phase === "reveal" && s.round === ORTAK_ROUNDS - 1;

export const ortakNokta: GameDefinition<OrtakState, OrtakAction, OrtakView, OrtakPublicView> = {
  id: "ortak-nokta",
  name: "Ortak Nokta",
  minPlayers: 3,
  maxPlayers: 8,
  orientation: "portrait",
  // TASLAK: sahip kuralları onaylayana dek rastgele havuza girmez (ve oyun zaten yalnız taslak yolundan açılır).
  randomPool: false,
  briefing: {
    goal: "Konuşmadan aynı kutuyu seç: ne kadar çok kişi seninle aynı kutuyu seçerse o kadar puan!",
    steps: [
      "Her tur 6 renkli şekil görürsün; kutular herkesin telefonunda farklı sırada durur",
      "Gizlice bir kutu seç; seninle aynı kutuyu seçen her kişi sana 1 puan getirir",
      "En kalabalık tek grup +1 bonus alır; 4 turun toplamı en yüksek +2, ikinci +1",
    ],
  },

  parseAction(raw: unknown): OrtakAction | null {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
    const rec = raw as Record<string, unknown>;
    if (rec.kind === "lock") return Object.keys(rec).length === 1 ? { kind: "lock" } : null;
    if (rec.kind !== "choose" || Object.keys(rec).length !== 2) return null;
    const tile = rec.tile;
    if (typeof tile !== "number" || !Number.isInteger(tile) || tile < 0 || tile >= ORTAK_TILES) return null;
    return { kind: "choose", tile };
  },

  setup(players: readonly string[], ctx: GameContext): OrtakState {
    const boards: OrtakTile[][] = [];
    const layouts: Record<string, number[]>[] = [];
    for (let r = 0; r < ORTAK_ROUNDS; r++) {
      boards.push(drawBoard(ctx.rng));
      const perPlayer: Record<string, number[]> = {};
      for (const id of players)
        perPlayer[id] = ctx.rng.shuffle(Array.from({ length: ORTAK_TILES }, (_, i) => i));
      layouts.push(perPlayer);
    }
    return {
      players: [...players],
      startedAt: ctx.now,
      boards,
      layouts,
      round: 0,
      phase: "choose",
      phaseStartedAt: ctx.now,
      phaseEndsAt: ctx.now + ORTAK_CHOOSE_MS,
      choices: {},
      locked: [],
      results: [],
    };
  },

  reduce(state, playerId, action, ctx): OrtakState | Rejected {
    if (!state.players.includes(playerId)) return { rejected: "not_participant" };
    if (ctx.now < state.startedAt) return { rejected: "not_started" };
    const s = advance(state, ctx.now);
    if (s.phase !== "choose") return { rejected: "ended" };
    if (s.locked.includes(playerId)) return { rejected: "locked" };
    if (action.kind === "choose") {
      if (action.tile < 0 || action.tile >= ORTAK_TILES) return { rejected: "out_of_range" };
      if (s.choices[playerId] === action.tile) return s;
      return { ...s, choices: { ...s.choices, [playerId]: action.tile } };
    }
    if (s.choices[playerId] === undefined) return { rejected: "nothing_to_lock" };
    const locked = [...s.locked, playerId];
    const waiting = s.players.some((id) => ctx.connected.includes(id) && !locked.includes(id));
    if (waiting) return { ...s, locked };
    // Bağlı herkes kilitledi: seçim 1 sn sonra biter; sonraki aşamalar aynı kadar öne gelir.
    return { ...s, locked, phaseEndsAt: Math.min(s.phaseEndsAt, ctx.now + ORTAK_LOCK_GRACE_MS) };
  },

  tick(state, ctx): OrtakState {
    return advance(state, ctx.now);
  },

  publicView(state, ctx): OrtakPublicView {
    const s = advance(state, ctx.now);
    const reveal = s.phase === "reveal" ? (s.results[s.round] ?? null) : null;
    const totals = totalsOf(s, s.results);
    return {
      startedAt: s.startedAt,
      round: s.round + 1,
      rounds: ORTAK_ROUNDS,
      phase: s.phase,
      phaseStartedAt: s.phaseStartedAt,
      phaseEndsAt: s.phaseEndsAt,
      board: s.boards[s.round] ?? [],
      totals,
      // Tur süresi dolmadan kimsenin seçimi yoktur; yalnız kimlerin kilitlediği bilinir.
      lockedIds: s.phase === "choose" ? [...s.locked] : [],
      reveal,
      final: isLastReveal(s) ? rankAwardsOf(totals) : null,
    };
  },

  view(state, playerId, ctx): OrtakView {
    const s = advance(state, ctx.now);
    const identity = Array.from({ length: ORTAK_TILES }, (_, i) => i);
    const layout = (playerId === null ? undefined : s.layouts[s.round]?.[playerId]) ?? identity;
    const mine = playerId === null ? undefined : s.choices[playerId];
    return {
      layout: [...layout],
      myTile: s.phase === "choose" ? (mine ?? null) : null,
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

  /**
   * Gizli değerler 0–5 arası kutu numaralarıdır; alt dizgi sızıntı denetimi onları koruyamaz. Gizlilik yapısal
   * sağlanır ve test edilir (ortak-nokta.test.ts, "gizlilik"): seçim ortak görünümde yalnız sonuç aşamasında bulunur.
   */
  secrets() {
    return [];
  },

  result(state) {
    const results =
      state.phase === "choose"
        ? [...state.results, ortakSettle(state.players, state.choices)]
        : state.results;
    const totals = totalsOf(state, results);
    return { miniScores: totals, awards: rankAwardsOf(totals) };
  },
};

function rankAwardsOf(totals: Record<string, number>): Record<string, number> {
  const awards = rankAwards(totals);
  const out: Record<string, number> = {};
  for (const id of Object.keys(totals)) out[id] = awards[id] ?? 0;
  return out;
}
