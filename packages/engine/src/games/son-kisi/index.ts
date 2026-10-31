import type { GameContext, GameDefinition, Rejected } from "../../game.js";
import {
  SON_KISI_LOCK_GRACE_MS,
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
  /**
   * GİZLİ: hiçbir görünüme girmez. Herkes kaçtıysa reduce'ta öne çekilir (son kaçış + 1 sn);
   * bu bilgi de görünümlere girmez.
   */
  endsAt: number;
  /** Her oyuncunun ilk geçerli kaçışı (sunucu zaman damgası), kaçış sırasıyla. */
  escapes: { id: string; at: number }[];
  /**
   * Son tick'te görülen gerilim düzeyi. Yalnız sunucunun düzey değişince yayın yapması içindir
   * (görünüm süreden hesaplanır); sonuca etkisi yoktur.
   */
  tension: SonKisiTension;
  /** GİZLİ: gerilim düzeylerinin başladığı mutlak anlar (artan). Hiçbir görünüme girmez. */
  thresholds: number[];
}

/** Gerilim düzeyi: geçilen gizli eşik sayısı (0–3). */
export function sonKisiTension(thresholds: readonly number[], now: number): SonKisiTension {
  let level = 0;
  for (const t of thresholds) if (now >= t) level++;
  return Math.min(3, level) as SonKisiTension;
}

/**
 * Bitişe göre rastgele, gizli eşikler (mutlak ms): düzey 1 bitişten 5–8 sn, düzey 2 2,5–4,5 sn, düzey 3 0,8–2,2 sn önce.
 * Başlangıçtan en az 1 sn sonra ve artan sırada; böylece eşik zamanı bitişin deterministik bir işlevi olmaz.
 */
function makeThresholds(startedAt: number, endsAt: number, rng: GameContext["rng"]): number[] {
  const pick = (lo: number, hi: number) => lo + rng.int(hi - lo + 1);
  const floor = startedAt + 1_000;
  const t1 = Math.max(floor, endsAt - pick(5_000, 8_000));
  const t2 = Math.max(t1, floor, endsAt - pick(2_500, 4_500));
  const t3 = Math.max(t2, floor, endsAt - pick(800, 2_200));
  return [t1, t2, t3];
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
    const endsAt = ctx.now + SON_KISI_MIN_MS + ctx.rng.int(span);
    return {
      players: [...players],
      startedAt: ctx.now,
      endsAt,
      thresholds: makeThresholds(ctx.now, endsAt, ctx.rng),
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
    const escapes = [...state.escapes, { id: playerId, at: ctx.now }];
    // Herkes kaçtıysa sonuç kesindir (kaçanlar zaten açık): 1 sn sonra biter.
    if (!state.players.every((id) => escapes.some((e) => e.id === id))) return { ...state, escapes };
    return { ...state, escapes, endsAt: Math.min(state.endsAt, ctx.now + SON_KISI_LOCK_GRACE_MS) };
  },

  tick(state, ctx): SonKisiState {
    const tension = sonKisiTension(state.thresholds, ctx.now);
    return tension > state.tension ? { ...state, tension } : state;
  },

  publicView(state, ctx): SonKisiPublicView {
    const finished = ctx.now >= state.endsAt;
    return {
      startedAt: state.startedAt,
      escaped: state.escapes.map((e) => e.id),
      tension: finished ? 3 : sonKisiTension(state.thresholds, ctx.now),
      finished,
      result: finished ? resultOf(state) : null,
    };
  },

  view(state, playerId): SonKisiView {
    return { escaped: playerId !== null && state.escapes.some((e) => e.id === playerId) };
  },

  /** Sonuç ekranı gizli bitiş anında başlar (o ana kadar sunucu bu anı okumaz, görünüme girmez). */
  revealAt(state): number | null {
    return state.endsAt;
  },

  isFinished(state, ctx): boolean {
    return ctx.now >= state.endsAt;
  },

  /** Gizli bitiş zamanı (mutlak ms); bitişe kadar kimsenin görünümünde olamaz. */
  secrets(state) {
    return [
      { ownerIds: [], value: String(state.endsAt), label: "gizli bitiş zamanı" },
      ...state.thresholds.map((t, i) => ({
        ownerIds: [] as string[],
        value: String(t),
        label: `gizli gerilim eşiği ${i + 1}`,
      })),
    ];
  },

  result(state) {
    const scores = resultOf(state).scores;
    return { miniScores: { ...scores }, awards: { ...scores } };
  },
};
