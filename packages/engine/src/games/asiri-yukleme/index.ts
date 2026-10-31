import type { GameContext, GameDefinition, Rejected } from "../../game.js";
import { rankAwards } from "../scoring.js";
import {
  ASIRI_YUKLEME_CAP_MS,
  ASIRI_YUKLEME_CAPACITY,
  ASIRI_YUKLEME_DANGER_MS,
  ASIRI_YUKLEME_MAX_BATCH,
  ASIRI_YUKLEME_OUTRO_MS,
  type AsiriYuklemeAction,
  type AsiriYuklemePublicView,
  type AsiriYuklemeReveal,
  type AsiriYuklemeView,
} from "./types.js";

export * from "./types.js";

export interface AsiriYuklemeState {
  players: string[];
  startedAt: number;
  /** Oyuncu → bar 100'e ulaşana kadar yaptığı tıklamalar (sıralamada sayılan). */
  before: Record<string, number>;
  /** Oyuncu → bar 100'ü geçtikten sonra yaptığı tıklamalar (> 0 ise patladı). */
  after: Record<string, number>;
  /** Ortak bar toplamı: bütün tıklamalar (100'ü aşanlar dahil). */
  total: number;
  /** Bar 100'e ulaştığı an (gizli pencerenin başı); ulaşmadıysa null. */
  dangerAt: number | null;
  /** Tur bitti mi. Görünümler bundan değil `ctx.now`'dan türetilir; bayrak yalnız "durum değişti" sinyalidir. */
  over: boolean;
}

/**
 * Turun bittiği an. Bar dolduysa tehlike penceresi her zaman tam 3 sn sürer (90 sn sınırından bağımsız; sahip
 * kararı); bar dolmadıysa teknik üst sınır (90 sn). Patlama turu bitirmez.
 */
export function asiriYuklemeEndAt(state: AsiriYuklemeState): number {
  return state.dangerAt === null
    ? state.startedAt + ASIRI_YUKLEME_CAP_MS
    : state.dangerAt + ASIRI_YUKLEME_DANGER_MS;
}

/** Patlayanlar: bar 100'ü geçtikten sonra en az bir kez basanlar, katılım sırasıyla. */
export function asiriYuklemeExploders(players: readonly string[], after: Record<string, number>): string[] {
  return players.filter((id) => (after[id] ?? 0) > 0);
}

/**
 * Genel skor (KURALLAR §20, sahip kararı Ekim 2026):
 * - Patlayanlar (100'den sonra basanlar) sıralamaya girmez, yalnız ceza alır: 100'den sonra en çok basan TEK kişi
 *   −2, diğer patlayanlar −1. Tek patlayan −1; en çok basanlar eşitse hepsi −1 (kimse −2 almaz).
 * - Patlamayanlar 100'e kadar yaptıkları tıklamalara göre sıralanır: tek lider +2, ikinci (en yüksek ikinci değer)
 *   +1; liderler eşitse hepsi +1 ve +2/ikinci sıra yok. Hiç tıklamayan ödül almaz. Başka eksi puan yoktur.
 */
export function asiriYuklemePoints(
  players: readonly string[],
  before: Record<string, number>,
  after: Record<string, number>,
): Record<string, number> {
  const exploders = asiriYuklemeExploders(players, after);
  const most = Math.max(0, ...exploders.map((id) => after[id] ?? 0));
  const atMost = exploders.filter((id) => (after[id] ?? 0) === most);
  const heavy = exploders.length > 1 && atMost.length === 1 ? atMost[0] : undefined;
  const ranked: Record<string, number> = {};
  for (const id of players) if (!exploders.includes(id)) ranked[id] = before[id] ?? 0;
  const awards = rankAwards(ranked, { positiveOnly: true });
  const points: Record<string, number> = {};
  for (const id of players) {
    if (id === heavy) points[id] = -2;
    else if (exploders.includes(id)) points[id] = -1;
    else points[id] = awards[id] ?? 0;
  }
  return points;
}

function settle(state: AsiriYuklemeState): AsiriYuklemeReveal {
  const before: Record<string, number> = {};
  const after: Record<string, number> = {};
  for (const id of state.players) {
    before[id] = state.before[id] ?? 0;
    after[id] = state.after[id] ?? 0;
  }
  return {
    total: state.total,
    before,
    after,
    exploders: asiriYuklemeExploders(state.players, after),
    points: asiriYuklemePoints(state.players, before, after),
  };
}

export const asiriYukleme: GameDefinition<
  AsiriYuklemeState,
  AsiriYuklemeAction,
  AsiriYuklemeView,
  AsiriYuklemePublicView
> = {
  id: "asiri-yukleme",
  name: "Aşırı Yükleme",
  minPlayers: 2,
  maxPlayers: 8,
  orientation: "portrait",
  briefing: {
    goal: "Reaktörü doldur ama sen patlatma!",
    steps: [
      "Ortak çekirdeği hızlıca tıkla; sayılar gizli",
      "Kenarlar kızarınca tehlike başladı; sakın taşırma",
      "100'ü aşınca basan herkes patlar (en çok basan −2, diğerleri −1); kalanlarda en çok tıklayan +2, ikinci +1",
    ],
  },

  parseAction(raw: unknown): AsiriYuklemeAction | null {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
    const rec = raw as Record<string, unknown>;
    const keys = Object.keys(rec);
    if (rec.kind !== "tap") return null;
    if (keys.length === 1) return { kind: "tap", count: 1 };
    if (keys.length !== 2) return null;
    const count = rec.count;
    if (typeof count !== "number" || !Number.isInteger(count)) return null;
    if (count < 1 || count > ASIRI_YUKLEME_MAX_BATCH) return null;
    return { kind: "tap", count };
  },

  setup(players: readonly string[], ctx: GameContext): AsiriYuklemeState {
    const before: Record<string, number> = {};
    const after: Record<string, number> = {};
    for (const id of players) {
      before[id] = 0;
      after[id] = 0;
    }
    return {
      players: [...players],
      startedAt: ctx.now,
      before,
      after,
      total: 0,
      dangerAt: null,
      over: false,
    };
  },

  reduce(state, playerId, action, ctx): AsiriYuklemeState | Rejected {
    if (!state.players.includes(playerId)) return { rejected: "not_participant" };
    // Pencerenin sonu ve üst sınır `ctx.now`'a göre denetlenir (tick'e bağlı değil).
    if (ctx.now >= asiriYuklemeEndAt(state)) return { rejected: "ended" };
    if (ctx.now < state.startedAt) return { rejected: "not_started" };
    // Toplu mesaj: 100'e kadar olan kısım "önce", aşan kısım "sonra" sayılır. Aşan tık turu bitirmez.
    const room = Math.max(0, ASIRI_YUKLEME_CAPACITY - state.total);
    const fill = Math.min(action.count, room);
    const over = action.count - fill;
    const reachedCapacity = state.dangerAt === null && state.total + fill >= ASIRI_YUKLEME_CAPACITY;
    return {
      ...state,
      before: { ...state.before, [playerId]: (state.before[playerId] ?? 0) + fill },
      after: over > 0 ? { ...state.after, [playerId]: (state.after[playerId] ?? 0) + over } : state.after,
      total: state.total + action.count,
      dangerAt: reachedCapacity ? ctx.now : state.dangerAt,
    };
  },

  tick(state, ctx): AsiriYuklemeState {
    if (state.over || ctx.now < asiriYuklemeEndAt(state)) return state;
    return { ...state, over: true };
  },

  publicView(state, ctx): AsiriYuklemePublicView {
    return {
      startedAt: state.startedAt,
      // Tehlike bayrağı dışında hiçbir sayı yok; toplam ve tıklamalar tur bitince açılır.
      danger: state.dangerAt !== null,
      reveal: ctx.now >= asiriYuklemeEndAt(state) ? settle(state) : null,
    };
  },

  view(state, playerId): AsiriYuklemeView {
    return { participant: playerId !== null && state.players.includes(playerId) };
  },

  /** Sonuç açılışı (patlama ya da süre sonu) turun bittiği an başlar. */
  revealAt(state): number | null {
    return asiriYuklemeEndAt(state);
  },

  isFinished(state, ctx): boolean {
    return ctx.now >= asiriYuklemeEndAt(state) + ASIRI_YUKLEME_OUTRO_MS;
  },

  /**
   * Gizli değerler (bar toplamı, önce/sonra tıklama sayıları, patlayanlar, pencere bitişi) kısa sayılardır; alt
   * dizgi sızıntı denetimi bunları koruyamaz. Gizlilik yapısal olarak sağlanır: `publicView` tur bitmeden yalnız
   * `danger` taşır, `view` yalnız katılımcı olup olmadığını söyler (bkz. asiri-yukleme.test.ts, "gizlilik").
   */
  secrets() {
    return [];
  },

  result(state) {
    const points = asiriYuklemePoints(state.players, state.before, state.after);
    return { miniScores: { ...points }, awards: { ...points } };
  },
};
