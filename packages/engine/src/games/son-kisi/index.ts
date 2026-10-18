import type { GameContext, GameDefinition, Rejected } from "../../game.js";
import {
  SON_KISI_MAX_MS,
  SON_KISI_MIN_MS,
  type SonKisiAction,
  type SonKisiPublicView,
  type SonKisiResult,
  type SonKisiTension,
  type SonKisiView,
} from "./types.js";

export * from "./types.js";

export interface SonKisiState {
  players: string[];
  startedAt: number;
  /** GİZLİ: hiçbir görünüme girmez. */
  endsAt: number;
  /** Her oyuncunun ilk geçerli kaçışı (sunucu zaman damgası), kaçış sırasıyla. */
  escapes: { id: string; at: number }[];
  /**
   * Son tick'te görülen gerilim düzeyi. Yalnız sunucunun düzey değişince yayın yapması içindir
   * (görünüm süreden hesaplanır); sonuca etkisi yoktur.
   */
  tension: SonKisiTension;
}

/** Gerilim düzeyi: geçen/toplam oranına göre 0–3. */
export function sonKisiTension(startedAt: number, endsAt: number, now: number): SonKisiTension {
  const total = endsAt - startedAt;
  if (total <= 0) return 3;
  const ratio = (now - startedAt) / total;
  if (ratio >= 0.9) return 3;
  if (ratio >= 0.75) return 2;
  if (ratio >= 0.5) return 1;
  return 0;
}

/**
 * Puanlar: kaçanlar arasında en geç kaçan(lar) +1 (eşit zaman damgası: hepsi +1), diğer kaçanlar 0,
 * hiç kaçmayan −1; kimse kaçmazsa herkes −1.
 */
export function sonKisiScores(
  players: readonly string[],
  escapes: readonly { id: string; at: number }[],
): Record<string, number> {
  const latest = escapes.reduce((m, e) => Math.max(m, e.at), Number.NEGATIVE_INFINITY);
  const scores: Record<string, number> = {};
  for (const id of players) {
    const mine = escapes.find((e) => e.id === id);
    scores[id] = mine === undefined ? -1 : mine.at === latest ? 1 : 0;
  }
  return scores;
}

function resultOf(state: SonKisiState): SonKisiResult {
  const scores = sonKisiScores(state.players, state.escapes);
  return {
    escapes: state.escapes.map((e) => ({ id: e.id, ms: e.at - state.startedAt })),
    last: state.players.filter((id) => state.escapes.some((e) => e.id === id) && scores[id] === 1),
    missed: state.players.filter((id) => !state.escapes.some((e) => e.id === id)),
    scores,
  };
}

export const sonKisi: GameDefinition<SonKisiState, SonKisiAction, SonKisiView, SonKisiPublicView> = {
  id: "son-kisi",
  name: "Son Kişi",
  minPlayers: 2,
  maxPlayers: 8,
  orientation: "portrait",
  briefing: {
    goal: "Alarm çalmadan kaç, ama herkesten geç!",
    steps: [
      "Bitiş zamanı gizli; alarmı bekle",
      "İstediğin anda bir kez KAÇ'a bas",
      "Son kaçan +1 alır, hiç kaçmayan −1 alır",
    ],
  },

  parseAction(raw: unknown): SonKisiAction | null {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
    const keys = Object.keys(raw);
    if (keys.length !== 1 || (raw as Record<string, unknown>).kind !== "escape") return null;
    return { kind: "escape" };
  },

  setup(players: readonly string[], ctx: GameContext): SonKisiState {
    const span = SON_KISI_MAX_MS - SON_KISI_MIN_MS + 1;
    return {
      players: [...players],
      startedAt: ctx.now,
      endsAt: ctx.now + SON_KISI_MIN_MS + ctx.rng.int(span),
      escapes: [],
      tension: 0,
    };
  },

  reduce(state, playerId, _action, ctx): SonKisiState | Rejected {
    if (!state.players.includes(playerId)) return { rejected: "not_participant" };
    // Bitiş anı ve sonrası: basış kabul edilmez.
    if (ctx.now >= state.endsAt) return { rejected: "ended" };
    if (ctx.now < state.startedAt) return { rejected: "not_started" };
    if (state.escapes.some((e) => e.id === playerId)) return state;
    return { ...state, escapes: [...state.escapes, { id: playerId, at: ctx.now }] };
  },

  tick(state, ctx): SonKisiState {
    const tension = sonKisiTension(state.startedAt, state.endsAt, ctx.now);
    return tension > state.tension ? { ...state, tension } : state;
  },

  publicView(state, ctx): SonKisiPublicView {
    const finished = ctx.now >= state.endsAt;
    return {
      startedAt: state.startedAt,
      escaped: state.escapes.map((e) => e.id),
      tension: finished ? 3 : sonKisiTension(state.startedAt, state.endsAt, ctx.now),
      finished,
      result: finished ? resultOf(state) : null,
    };
  },

  view(state, playerId): SonKisiView {
    return { escaped: playerId !== null && state.escapes.some((e) => e.id === playerId) };
  },

  isFinished(state, ctx): boolean {
    return ctx.now >= state.endsAt;
  },

  /** Gizli bitiş zamanı (mutlak ms); bitişe kadar kimsenin görünümünde olamaz. */
  secrets(state) {
    return [{ ownerIds: [], value: String(state.endsAt), label: "gizli bitiş zamanı" }];
  },

  result(state) {
    const scores = resultOf(state).scores;
    return { miniScores: { ...scores }, awards: { ...scores } };
  },
};
