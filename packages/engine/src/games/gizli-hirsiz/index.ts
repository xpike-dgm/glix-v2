import type { GameContext, GameDefinition, Rejected } from "../../game.js";
import { everyoneReady } from "../ready.js";
import {
  GIZLI_HIRSIZ_DURATION_MS,
  GIZLI_HIRSIZ_LOCK_GRACE_MS,
  GIZLI_HIRSIZ_REVEAL_MS,
  GIZLI_HIRSIZ_SIGNAL_MIN_PLAYERS,
  GIZLI_HIRSIZ_SIGNAL_MS,
  type GizliHirsizAction,
  type GizliHirsizPublicView,
  type GizliHirsizReveal,
  type GizliHirsizSignal,
  type GizliHirsizView,
} from "./types.js";

export * from "./types.js";

export interface GizliHirsizState {
  players: string[];
  startedAt: number;
  /** Bitiş; bağlı herkes karar verince öne çekilir (son karar + 1 sn; GH-M1). */
  endsAt: number;
  /** Her oyuncunun ÇAL kararı (sunucu zaman damgası), karar sırasıyla. */
  presses: { id: string; at: number }[];
  /** GH-M1: ÇALMA diyenler (karar sırasıyla). Hiç karar vermeyen de sonuçta ÇALMA sayılır. */
  passes: string[];
  /** GH-M1: bağlı herkesin karar verdiği an (erken bitiş); yoksa null. GH-M2 işaretini bastırır. */
  closedAt: number | null;
}

/** Puanlar: tek çalan +1, birden çok çalan her biri −1, çalmayan 0. */
export function gizliHirsizScores(
  players: readonly string[],
  thieves: readonly string[],
): Record<string, number> {
  const delta = thieves.length === 1 ? 1 : thieves.length >= 2 ? -1 : 0;
  const scores: Record<string, number> = {};
  for (const id of players) scores[id] = thieves.includes(id) ? delta : 0;
  return scores;
}

const decidedBy = (state: GizliHirsizState, id: string): boolean =>
  state.passes.includes(id) || state.presses.some((p) => p.id === id);

/** GH-M2: işaret anı (mutlak); 2 oyuncuda yok. */
export function gizliHirsizSignalAt(state: GizliHirsizState): number | null {
  return state.players.length >= GIZLI_HIRSIZ_SIGNAL_MIN_PLAYERS
    ? state.startedAt + GIZLI_HIRSIZ_SIGNAL_MS
    : null;
}

/**
 * GH-M2: `now` anında görünen işaret. Yalnız işaret anındaki durumu söyler (o andan önceki ÇAL'lar) ve sonra
 * değişmez; ÇALMA kararları etkilemez. Herkes işaretten önce karar verdiyse (erken bitiş) işaret hiç verilmez.
 */
export function gizliHirsizSignal(state: GizliHirsizState, now: number): GizliHirsizSignal | null {
  const at = gizliHirsizSignalAt(state);
  if (at === null || now < at) return null;
  if (state.closedAt !== null && state.closedAt < at) return null;
  if (state.endsAt <= at) return null;
  return state.presses.some((p) => p.at < at) ? "stir" : "quiet";
}

function revealOf(state: GizliHirsizState): GizliHirsizReveal {
  const thieves = state.presses.map((p) => p.id);
  return {
    thieves,
    pressedAt: state.presses.map((p) => p.at - state.startedAt),
    outcome: thieves.length === 1 ? "solo" : thieves.length >= 2 ? "multi" : "none",
    scores: gizliHirsizScores(state.players, thieves),
  };
}

/** GH-M1: bağlı herkes karar verdiyse aşama 1 sn sonra biter (kopan beklenmez). */
function closeIfReady(state: GizliHirsizState, ctx: GameContext): GizliHirsizState {
  if (state.closedAt !== null || ctx.now >= state.endsAt) return state;
  if (!everyoneReady(state.players, ctx.connected, (id) => decidedBy(state, id))) return state;
  return {
    ...state,
    closedAt: ctx.now,
    endsAt: Math.min(state.endsAt, ctx.now + GIZLI_HIRSIZ_LOCK_GRACE_MS),
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
      "Çal ya da çalma: bir kez karar ver, geri alamazsın",
      "15. saniyede kasa kıpırtıyı ele verir: erken çalan önce davranır",
      "Tek hırsız +1, iki ve daha çok hırsız −1",
    ],
  },

  parseAction(raw: unknown): GizliHirsizAction | null {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
    const keys = Object.keys(raw);
    const kind = (raw as Record<string, unknown>).kind;
    if (keys.length !== 1 || (kind !== "steal" && kind !== "pass")) return null;
    return { kind };
  },

  setup(players: readonly string[], ctx: GameContext): GizliHirsizState {
    return {
      players: [...players],
      startedAt: ctx.now,
      endsAt: ctx.now + GIZLI_HIRSIZ_DURATION_MS,
      presses: [],
      passes: [],
      closedAt: null,
    };
  },

  reduce(state, playerId, action, ctx): GizliHirsizState | Rejected {
    if (!state.players.includes(playerId)) return { rejected: "not_participant" };
    if (ctx.now >= state.endsAt) return { rejected: "ended" };
    if (ctx.now < state.startedAt) return { rejected: "not_started" };
    // Karar geri alınmaz; sonraki eylemler yok sayılır (hata değil: gizlilik için aynı cevap).
    if (decidedBy(state, playerId)) return state;
    const next: GizliHirsizState =
      action.kind === "steal"
        ? { ...state, presses: [...state.presses, { id: playerId, at: ctx.now }] }
        : { ...state, passes: [...state.passes, playerId] };
    return closeIfReady(next, ctx);
  },

  tick(state): GizliHirsizState {
    return state;
  },

  /** Son eksik oyuncu koparsa da bağlı herkes karar vermiş olur: aşama 1 sn sonra biter. */
  onPresence(state, ctx): GizliHirsizState {
    return closeIfReady(state, ctx);
  },

  nextWake(state, ctx): number | null {
    const signalAt = gizliHirsizSignalAt(state);
    const marks = [signalAt, state.endsAt, state.endsAt + GIZLI_HIRSIZ_REVEAL_MS];
    let next: number | null = null;
    for (const t of marks) if (t !== null && t > ctx.now && (next === null || t < next)) next = t;
    return next;
  },

  publicView(state, ctx): GizliHirsizPublicView {
    const finished = ctx.now >= state.endsAt;
    return {
      startedAt: state.startedAt,
      endsAt: state.endsAt,
      finished,
      decided: state.players.filter((id) => decidedBy(state, id)),
      signalAt: gizliHirsizSignalAt(state),
      signal: gizliHirsizSignal(state, ctx.now),
      reveal: finished ? revealOf(state) : null,
    };
  },

  view(state, playerId): GizliHirsizView {
    if (playerId === null) return { choice: null };
    if (state.presses.some((p) => p.id === playerId)) return { choice: "steal" };
    return { choice: state.passes.includes(playerId) ? "pass" : null };
  },

  /** Oyun içi kasa açılışı süre bittiği (ya da bağlı herkes karar verdiği) an başlar (GH-U5). */
  revealAt(state): number | null {
    return state.endsAt;
  },

  /** Açılış en az `GIZLI_HIRSIZ_REVEAL_MS` gösterilir; sonra "Devam et" kuralı geçerlidir. */
  isFinished(state, ctx): boolean {
    return ctx.now >= state.endsAt + GIZLI_HIRSIZ_REVEAL_MS;
  },

  /**
   * Gizli bilgi "kim ne seçti" oyuncu kimliğidir; kimlikler sızıntı denetimi için fazla kısa/ayırt edicisiz olduğundan
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
