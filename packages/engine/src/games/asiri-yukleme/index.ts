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
  /** Oyuncu → tıklama sayısı (patlatan tık dahil). */
  clicks: Record<string, number>;
  /** Ortak bar toplamı (patlamada 101). */
  total: number;
  /** Bar 100'e ulaştığı an (gizli pencerenin başı); ulaşmadıysa null. */
  dangerAt: number | null;
  exploder: string | null;
  /** Patlamanın sunucu anı. */
  explodedAt: number | null;
  /** Tur bitti mi. Görünümler bundan değil `ctx.now`'dan türetilir; bayrak yalnız "durum değişti" sinyalidir. */
  over: boolean;
}

/** Turun bittiği an: patlama anı, gizli pencerenin sonu ya da teknik üst sınır (hangisi önce). */
export function asiriYuklemeEndAt(state: AsiriYuklemeState): number {
  if (state.explodedAt !== null) return state.explodedAt;
  const cap = state.startedAt + ASIRI_YUKLEME_CAP_MS;
  return state.dangerAt === null ? cap : Math.min(cap, state.dangerAt + ASIRI_YUKLEME_DANGER_MS);
}

/**
 * Genel skor: patlayan −1 ve sıralamaya girmez; patlamayanlar tıklama sayısına göre (tek lider +2, sıradaki +1;
 * liderler eşitse hepsi +1, +2 yok). Hiç tıklamayan sıralamaya girmez.
 *
 * O7: patlamayanlar arasında en az tıklayan(lar) ayrıca −1 alır (hiç tıklamayan da en az sayılır). Eşitlikte en azı
 * yapanların hepsi −1 alır; patlamayanların hepsinin sayısı aynıysa kimse almaz. Patlayan bu cezaya girmez, yani
 * ikinci bir −1 almaz. Ceza sıralama ödülüne eklenir (ikinci sırada +1 alan en az tıklayan net 0 alır).
 */
export function asiriYuklemePoints(
  players: readonly string[],
  clicks: Record<string, number>,
  exploder: string | null,
): Record<string, number> {
  const ranked: Record<string, number> = {};
  for (const id of players) if (id !== exploder) ranked[id] = clicks[id] ?? 0;
  const awards = rankAwards(ranked, { positiveOnly: true });
  const counts = Object.values(ranked);
  const fewest = Math.min(...counts);
  const allEqual = counts.every((c) => c === fewest);
  const points: Record<string, number> = {};
  for (const id of players) {
    if (id === exploder) points[id] = -1;
    else points[id] = (awards[id] ?? 0) + (!allEqual && ranked[id] === fewest ? -1 : 0);
  }
  return points;
}

function settle(state: AsiriYuklemeState): AsiriYuklemeReveal {
  const clicks: Record<string, number> = {};
  for (const id of state.players) clicks[id] = state.clicks[id] ?? 0;
  return {
    total: state.total,
    exploder: state.exploder,
    clicks,
    points: asiriYuklemePoints(state.players, clicks, state.exploder),
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
      "100'ü aşan patlar (−1); diğerlerinde en çok tıklayan +2, ikinci +1, en az tıklayan −1",
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
    const clicks: Record<string, number> = {};
    for (const id of players) clicks[id] = 0;
    return {
      players: [...players],
      startedAt: ctx.now,
      clicks,
      total: 0,
      dangerAt: null,
      exploder: null,
      explodedAt: null,
      over: false,
    };
  },

  reduce(state, playerId, action, ctx): AsiriYuklemeState | Rejected {
    if (!state.players.includes(playerId)) return { rejected: "not_participant" };
    // Patlama, gizli pencerenin sonu ve üst sınır `ctx.now`'a göre denetlenir (tick'e bağlı değil).
    if (ctx.now >= asiriYuklemeEndAt(state)) return { rejected: "ended" };
    if (ctx.now < state.startedAt) return { rejected: "not_started" };
    // Toplu mesaj sunucu sırasıyla tek tek işlenir: kapasiteyi aşan ilk tık patlamayı belirler.
    const room = Math.max(0, ASIRI_YUKLEME_CAPACITY - state.total);
    const fill = Math.min(action.count, room);
    const boom = action.count > room;
    const total = state.total + fill + (boom ? 1 : 0);
    const mine = (state.clicks[playerId] ?? 0) + fill + (boom ? 1 : 0);
    const reachedCapacity = state.dangerAt === null && state.total + fill >= ASIRI_YUKLEME_CAPACITY;
    return {
      ...state,
      clicks: { ...state.clicks, [playerId]: mine },
      total,
      dangerAt: reachedCapacity ? ctx.now : state.dangerAt,
      exploder: boom ? playerId : null,
      explodedAt: boom ? ctx.now : null,
      over: boom,
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

  isFinished(state, ctx): boolean {
    return ctx.now >= asiriYuklemeEndAt(state) + ASIRI_YUKLEME_OUTRO_MS;
  },

  /**
   * Gizli değerler (bar toplamı, tıklama sayıları, pencere bitişi) kısa sayılardır; alt dizgi sızıntı denetimi
   * bunları koruyamaz. Gizlilik yapısal olarak sağlanır: `publicView` tur bitmeden yalnız `danger` taşır, `view`
   * yalnız katılımcı olup olmadığını söyler (bkz. asiri-yukleme.test.ts, "gizlilik").
   */
  secrets() {
    return [];
  },

  result(state) {
    const points = asiriYuklemePoints(state.players, state.clicks, state.exploder);
    return { miniScores: { ...points }, awards: { ...points } };
  },
};
