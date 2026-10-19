import type { GameContext, GameDefinition, Rejected } from "../../game.js";
import {
  GIZLI_HIRSIZ_DURATION_MS,
  GIZLI_HIRSIZ_LOCK_GRACE_MS,
  type GizliHirsizAction,
  type GizliHirsizPublicView,
  type GizliHirsizReveal,
  type GizliHirsizView,
} from "./types.js";

export * from "./types.js";

export interface GizliHirsizState {
  players: string[];
  startedAt: number;
  /** Bitiş; herkes bastıysa reduce'ta öne çekilir (son basış + 1 sn). */
  endsAt: number;
  /** Her oyuncunun ilk geçerli basışı (sunucu zaman damgası), basış sırasıyla. */
  presses: { id: string; at: number }[];
}

/** Puanlar: tek basan +1, birden çok basan her biri −1, basmayan 0. */
export function gizliHirsizScores(
  players: readonly string[],
  thieves: readonly string[],
): Record<string, number> {
  const delta = thieves.length === 1 ? 1 : thieves.length >= 2 ? -1 : 0;
  const scores: Record<string, number> = {};
  for (const id of players) scores[id] = thieves.includes(id) ? delta : 0;
  return scores;
}

function revealOf(state: GizliHirsizState): GizliHirsizReveal {
  const thieves = state.presses.map((p) => p.id);
  return {
    thieves,
    outcome: thieves.length === 1 ? "solo" : thieves.length >= 2 ? "multi" : "none",
    scores: gizliHirsizScores(state.players, thieves),
  };
}

export const gizliHirsiz: GameDefinition<
  GizliHirsizState,
  GizliHirsizAction,
  GizliHirsizView,
  GizliHirsizPublicView
> = {
  id: "gizli-hirsiz",
  name: "Gizli Hırsız",
  minPlayers: 2,
  maxPlayers: 8,
  orientation: "portrait",
  briefing: {
    goal: "Kasayı yalnız bir kişi soyabilir!",
    steps: [
      "Doğru anı bekle, ÇAL'a yalnız bir kez bas",
      "Kimin bastığı süre bitene kadar belli olmaz",
      "Tek hırsız +1 alır, birden çok hırsız −1 alır",
    ],
  },

  parseAction(raw: unknown): GizliHirsizAction | null {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
    const keys = Object.keys(raw);
    if (keys.length !== 1 || (raw as Record<string, unknown>).kind !== "steal") return null;
    return { kind: "steal" };
  },

  setup(players: readonly string[], ctx: GameContext): GizliHirsizState {
    return {
      players: [...players],
      startedAt: ctx.now,
      endsAt: ctx.now + GIZLI_HIRSIZ_DURATION_MS,
      presses: [],
    };
  },

  reduce(state, playerId, _action, ctx): GizliHirsizState | Rejected {
    if (!state.players.includes(playerId)) return { rejected: "not_participant" };
    if (ctx.now >= state.endsAt) return { rejected: "ended" };
    if (ctx.now < state.startedAt) return { rejected: "not_started" };
    // İlk geçerli basış kaydedilir; sonrakiler yok sayılır (hata değil: gizlilik için aynı cevap).
    if (state.presses.some((p) => p.id === playerId)) return state;
    const presses = [...state.presses, { id: playerId, at: ctx.now }];
    // Herkes bastıysa sonuç kesindir (herkes −1): bütün katılımcılar basınca 1 sn sonra biter.
    if (!state.players.every((id) => presses.some((p) => p.id === id))) return { ...state, presses };
    return { ...state, presses, endsAt: Math.min(state.endsAt, ctx.now + GIZLI_HIRSIZ_LOCK_GRACE_MS) };
  },

  tick(state): GizliHirsizState {
    return state;
  },

  publicView(state, ctx): GizliHirsizPublicView {
    const finished = ctx.now >= state.endsAt;
    return {
      startedAt: state.startedAt,
      endsAt: state.endsAt,
      finished,
      reveal: finished ? revealOf(state) : null,
    };
  },

  view(state, playerId): GizliHirsizView {
    return { pressed: playerId !== null && state.presses.some((p) => p.id === playerId) };
  },

  isFinished(state, ctx): boolean {
    return ctx.now >= state.endsAt;
  },

  /**
   * Gizli bilgi "kim bastı" oyuncu kimliğidir; kimlikler sızıntı denetimi için fazla kısa/ayırt edicisiz olduğundan
   * burada bildirilmez, `gizli-hirsiz.test.ts` yapısal gizlilik testleriyle denetlenir.
   */
  secrets() {
    return [];
  },

  result(state) {
    const scores = revealOf(state).scores;
    return { miniScores: { ...scores }, awards: { ...scores } };
  },
};
