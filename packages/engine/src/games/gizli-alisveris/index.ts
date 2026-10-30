import type { GameContext, GameDefinition, Rejected } from "../../game.js";
import {
  ALISVERIS_BUDGET,
  ALISVERIS_CATALOG,
  ALISVERIS_DURATION_MS,
  ALISVERIS_LOCK_GRACE_MS,
  ALISVERIS_REVEAL_MS,
  ALISVERIS_SCALE,
  ALISVERIS_SHOP_MS,
  type AlisverisAction,
  type AlisverisPublicView,
  type AlisverisReveal,
  type AlisverisView,
} from "./types.js";

export * from "./types.js";

export interface AlisverisState {
  players: string[];
  startedAt: number;
  /** Alışveriş bitişi; herkes kilitleyince reduce'ta öne çekilir. */
  endsAt: number;
  revealEndsAt: number;
  /** "Tamam" diyenler (sepeti kesinleşmiş). */
  locked: string[];
  /** Herkes kilitlediyse true: bitiş anı `endsAt`'e yazılmıştır, yeni eylem kabul edilmez. */
  closing: boolean;
  /** Raf sırası: ürün numaraları. */
  order: number[];
  /** Her oyuncunun canlı sepeti; süre bittiğindeki hâli geçerlidir. */
  baskets: Record<string, number[]>;
  /** Yalnız sunucunun "durum değişti" sinyali içindir (görünümler `ctx.now`'dan türetilir). */
  revealed: boolean;
}

const priceOf = (id: number): number => ALISVERIS_CATALOG[id]?.price ?? 0;
const costOf = (basket: readonly number[]): number => basket.reduce((s, id) => s + priceOf(id), 0);

/**
 * Sonuç: ürün değeri = fiyat / alıcı sayısı. Kesirler yüzünden eşitlik hatası olmasın diye değerler 840 ile
 * çarpılmış tam sayıyla tutulur (1..8 alıcının hepsine tam bölünür). En yüksek değer > 0 olan sepetler +1.
 */
export function alisverisSettle(state: AlisverisState): AlisverisReveal {
  const buyers: Record<string, number> = {};
  for (const p of ALISVERIS_CATALOG) buyers[String(p.id)] = 0;
  const baskets: Record<string, number[]> = {};
  for (const id of state.players) {
    const b = [...(state.baskets[id] ?? [])].sort((a, c) => a - c);
    baskets[id] = b;
    for (const p of b) buyers[String(p)] = (buyers[String(p)] ?? 0) + 1;
  }
  const values: Record<string, number> = {};
  for (const id of state.players) {
    let v = 0;
    for (const p of baskets[id] ?? []) v += priceOf(p) * (ALISVERIS_SCALE / (buyers[String(p)] ?? 1));
    values[id] = v;
  }
  const top = Math.max(0, ...Object.values(values));
  const winners = top > 0 ? state.players.filter((id) => values[id] === top) : [];
  return { baskets, buyers, values, winners };
}

export const gizliAlisveris: GameDefinition<
  AlisverisState,
  AlisverisAction,
  AlisverisView,
  AlisverisPublicView
> = {
  id: "gizli-alisveris",
  name: "Gizli Alışveriş",
  minPlayers: 3,
  maxPlayers: 8,
  orientation: "portrait",
  briefing: {
    goal: "60 kredilik bütçenle en değerli sepeti kur!",
    steps: [
      "İstediğin ürünleri sepete koy, her üründen bir tane alabilirsin",
      "Bir ürünü kaç kişi aldıysa değeri o sayıya bölünür",
      "Sepetler süre bitince açılır; en değerli sepet +1 alır",
    ],
  },

  parseAction(raw: unknown): AlisverisAction | null {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
    const rec = raw as Record<string, unknown>;
    if (rec.kind === "lock") return Object.keys(rec).length === 1 ? { kind: "lock" } : null;
    if (Object.keys(rec).length !== 2) return null;
    if (rec.kind !== "add" && rec.kind !== "remove") return null;
    const product = rec.product;
    if (typeof product !== "number" || !Number.isInteger(product)) return null;
    if (product < 0 || product >= ALISVERIS_CATALOG.length) return null;
    return { kind: rec.kind, product };
  },

  setup(players: readonly string[], ctx: GameContext): AlisverisState {
    return {
      players: [...players],
      startedAt: ctx.now,
      endsAt: ctx.now + ALISVERIS_SHOP_MS,
      revealEndsAt: ctx.now + ALISVERIS_DURATION_MS,
      order: ctx.rng.shuffle(ALISVERIS_CATALOG.map((p) => p.id)),
      locked: [],
      closing: false,
      baskets: {},
      revealed: false,
    };
  },

  reduce(state, playerId, action, ctx): AlisverisState | Rejected {
    if (!state.players.includes(playerId)) return { rejected: "not_participant" };
    if (ctx.now >= state.endsAt) return { rejected: "ended" };
    if (ctx.now < state.startedAt) return { rejected: "not_started" };
    if (state.locked.includes(playerId)) return { rejected: "locked" };
    if (state.closing) return { rejected: "closed" };
    if (action.kind === "lock") {
      const locked = [...state.locked, playerId];
      const active = state.players.filter((id) => ctx.connected.includes(id));
      if (active.length === 0 || !active.every((id) => locked.includes(id))) return { ...state, locked };
      const endsAt = Math.min(state.endsAt, ctx.now + ALISVERIS_LOCK_GRACE_MS);
      return { ...state, locked, closing: true, endsAt, revealEndsAt: endsAt + ALISVERIS_REVEAL_MS };
    }
    const basket = state.baskets[playerId] ?? [];
    if (action.kind === "add") {
      if (basket.includes(action.product)) return { rejected: "already_in_basket" };
      if (costOf(basket) + priceOf(action.product) > ALISVERIS_BUDGET) return { rejected: "over_budget" };
      return { ...state, baskets: { ...state.baskets, [playerId]: [...basket, action.product] } };
    }
    if (!basket.includes(action.product)) return { rejected: "not_in_basket" };
    return {
      ...state,
      baskets: { ...state.baskets, [playerId]: basket.filter((p) => p !== action.product) },
    };
  },

  tick(state, ctx): AlisverisState {
    if (state.revealed || ctx.now < state.endsAt) return state;
    return { ...state, revealed: true };
  },

  publicView(state, ctx): AlisverisPublicView {
    return {
      startedAt: state.startedAt,
      endsAt: state.endsAt,
      revealEndsAt: state.revealEndsAt,
      ready: [...state.locked],
      budget: ALISVERIS_BUDGET,
      products: state.order.map((id) => ({ ...(ALISVERIS_CATALOG[id] ?? { id, name: "", price: 0 }) })),
      // Süre dolmadan kimsenin sepeti ve alıcı sayıları yoktur.
      reveal: ctx.now >= state.endsAt ? alisverisSettle(state) : null,
    };
  },

  view(state, playerId): AlisverisView {
    const basket = playerId === null ? [] : [...(state.baskets[playerId] ?? [])];
    const locked = playerId !== null && state.locked.includes(playerId);
    return { basket, remaining: ALISVERIS_BUDGET - costOf(basket), locked };
  },

  /** Sonuç açılışı (kepenk) alışveriş süresinin bittiği an başlar. */
  revealAt(state): number | null {
    return state.endsAt;
  },

  isFinished(state, ctx): boolean {
    return ctx.now >= state.revealEndsAt;
  },

  /**
   * Ürün numaraları ve adları herkese açık raf listesinde de bulunur; alt dizgi sızıntı denetimi sepetleri
   * koruyamaz. Gizlilik yapısal olarak sağlanır ve ayrıca test edilir (gizli-alisveris.test.ts, "gizlilik").
   */
  secrets() {
    return [];
  },

  result(state) {
    const { winners } = alisverisSettle(state);
    // Mini puan tam sayı olmak zorundadır; sepet değerleri (kesirli) sonuç görünümünde açılır.
    const awards: Record<string, number> = {};
    for (const id of state.players) awards[id] = winners.includes(id) ? 1 : 0;
    return { miniScores: { ...awards }, awards };
  },
};
