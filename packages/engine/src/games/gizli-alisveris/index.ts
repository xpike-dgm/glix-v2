import type { GameContext, GameDefinition, Rejected } from "../../game.js";
import type { Rng } from "../../rng.js";
import {
  ALISVERIS_BUDGET,
  ALISVERIS_DURATION_MS,
  ALISVERIS_HEAT_AT_MS,
  ALISVERIS_LOCK_GRACE_MS,
  ALISVERIS_POOL,
  ALISVERIS_POOL_SIZE,
  ALISVERIS_REVEAL_MS,
  ALISVERIS_SCALE,
  ALISVERIS_SHELF_SIZE,
  ALISVERIS_SHOP_MS,
  type AlisverisAction,
  type AlisverisProduct,
  type AlisverisPublicView,
  type AlisverisReveal,
  type AlisverisView,
  alisverisPriceRange,
  couponPrice,
  heatLevel,
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
  /** Herkesin Tamam dediği an (erken kapanış); yoksa null. Vitrin fısıltısı bu andan önceyse hiç gösterilmez. */
  closedAt: number | null;
  /** Bu maçın rafı (raf sırasıyla, maçın fiyatlarıyla); herkes için aynı. */
  shelf: AlisverisProduct[];
  /** Oyuncu → kuponlu ürün numarası (herkesinki farklı). Gizli: yalnız sahibinin `view`'ında, sonuçta açılır. */
  coupons: Record<string, number>;
  /** Her oyuncunun canlı sepeti; süre bittiğindeki hâli geçerlidir. */
  baskets: Record<string, number[]>;
  /** Vitrin fısıltısı: `startedAt + 15 sn` anındaki sepetlerden donmuş talep ateşi; o andan önce null. */
  heat: Record<string, number> | null;
  /** Yalnız sunucunun "durum değişti" sinyali içindir (görünümler `ctx.now`'dan türetilir). */
  revealed: boolean;
}

/**
 * Maçın rafı: 20 ürünlük havuzdan 12'si, fiyatlar ±%30 (tam sayı, 6–40). Ürün sayısı sınırı yoktur (tek sınır
 * bütçe); yalnız sunucu rng'si kullanılır (aynı tohum aynı raf).
 */
export function rollShelf(rng: Rng): AlisverisProduct[] {
  const picked = rng.shuffle(ALISVERIS_POOL).slice(0, ALISVERIS_SHELF_SIZE);
  return picked.map((p) => {
    const { min, max } = alisverisPriceRange(p.base);
    return { id: p.id, name: p.name, price: min + rng.int(max - min + 1) };
  });
}

const priceIn = (state: AlisverisState, id: number): number =>
  state.shelf.find((p) => p.id === id)?.price ?? 0;
/** Oyuncunun ödediği fiyat: kuponlu ürün yarı fiyat (yukarı yuvarlı). */
const paidIn = (state: AlisverisState, playerId: string, id: number): number => {
  const price = priceIn(state, id);
  return state.coupons[playerId] === id ? couponPrice(price) : price;
};
const costOf = (state: AlisverisState, playerId: string, basket: readonly number[]): number =>
  basket.reduce((s, id) => s + paidIn(state, playerId, id), 0);

/**
 * Vitrin fısıltısı gösterilir mi: an alışveriş bitmeden önceyse ve herkes o andan önce Tamam dememişse
 * (14,9. saniyede kapanan alışverişte, kapanış penceresi 15. saniyeyi geçse bile ateş çıkmaz).
 */
const heatShown = (state: AlisverisState): boolean => {
  const heatAt = state.startedAt + ALISVERIS_HEAT_AT_MS;
  return heatAt < state.endsAt && (state.closedAt === null || state.closedAt >= heatAt);
};

/** Talep ateşi: raftaki her ürün için o anki sepetlerden seviye (kimin aldığı ve sayı yok). */
export function alisverisHeat(state: AlisverisState): Record<string, number> {
  const heat: Record<string, number> = {};
  for (const p of state.shelf) {
    let holders = 0;
    for (const id of state.players) if ((state.baskets[id] ?? []).includes(p.id)) holders++;
    heat[String(p.id)] = heatLevel(holders, state.players.length);
  }
  return heat;
}

/**
 * Isıyı `heatAt` anında dondurur: o andan sonra gelen ilk eylemden ya da tick'ten ÖNCE, o ana kadarki sepetlerle.
 * Böylece sonuç tick zamanlamasından bağımsızdır (tekrar oynatma birebir).
 */
function freezeHeat(state: AlisverisState, now: number): AlisverisState {
  if (state.heat !== null || !heatShown(state) || now < state.startedAt + ALISVERIS_HEAT_AT_MS) return state;
  return { ...state, heat: alisverisHeat(state) };
}

/**
 * Puan: en değerli sepet(ler) +2, sonraki farklı değer +1, diğerleri 0; eksi puan yok. Değeri 0 olan ödül
 * almaz; herkesin değeri aynıysa kimse almaz.
 */
export function alisverisPoints(
  players: readonly string[],
  values: Record<string, number>,
): Record<string, number> {
  const points: Record<string, number> = {};
  for (const id of players) points[id] = 0;
  const all = players.map((id) => values[id] ?? 0);
  if (all.length === 0 || all.every((v) => v === all[0])) return points;
  const distinct = [...new Set(all.filter((v) => v > 0))].sort((a, b) => b - a);
  const [first, second] = distinct;
  for (const id of players) {
    const v = values[id] ?? 0;
    if (first !== undefined && v === first) points[id] = 2;
    else if (second !== undefined && v === second) points[id] = 1;
  }
  return points;
}

/**
 * Sonuç: ürün değeri = tam fiyat / alıcı sayısı (kupon değeri değiştirmez). Kesirler yüzünden eşitlik hatası
 * olmasın diye değerler 840 ile çarpılmış tam sayıyla tutulur (1..8 alıcının hepsine tam bölünür).
 */
export function alisverisSettle(state: AlisverisState): AlisverisReveal {
  const buyers: Record<string, number> = {};
  for (const p of state.shelf) buyers[String(p.id)] = 0;
  const baskets: Record<string, number[]> = {};
  for (const id of state.players) {
    const b = [...(state.baskets[id] ?? [])].sort((a, c) => a - c);
    baskets[id] = b;
    for (const p of b) buyers[String(p)] = (buyers[String(p)] ?? 0) + 1;
  }
  const values: Record<string, number> = {};
  for (const id of state.players) {
    let v = 0;
    for (const p of baskets[id] ?? []) v += priceIn(state, p) * (ALISVERIS_SCALE / (buyers[String(p)] ?? 1));
    values[id] = v;
  }
  const points = alisverisPoints(state.players, values);
  const winners = state.players.filter((id) => points[id] === 2);
  const coupons: Record<string, number> = {};
  for (const id of state.players) {
    const c = state.coupons[id];
    if (c !== undefined) coupons[id] = c;
  }
  return { baskets, buyers, values, winners, points, coupons };
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
      "Raf ve fiyatlar her maç değişir; gizli kuponunla bir ürün yarı fiyat",
      "Bir ürünü kaç kişi aldıysa değeri o sayıya bölünür; 15. saniyede vitrin fısıldar",
      "En değerli sepet +2, ikinci +1 alır",
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
    if (product < 0 || product >= ALISVERIS_POOL_SIZE) return null;
    return { kind: rec.kind, product };
  },

  setup(players: readonly string[], ctx: GameContext): AlisverisState {
    const shelf = rollShelf(ctx.rng);
    // Kuponlar: rafın karışık sırasından her oyuncuya farklı bir ürün (en çok 8 oyuncu ≤ 12 ürün).
    const deck = ctx.rng.shuffle(shelf.map((p) => p.id));
    const coupons: Record<string, number> = {};
    players.forEach((id, i) => {
      const c = deck[i % deck.length];
      if (c !== undefined) coupons[id] = c;
    });
    return {
      players: [...players],
      startedAt: ctx.now,
      endsAt: ctx.now + ALISVERIS_SHOP_MS,
      revealEndsAt: ctx.now + ALISVERIS_DURATION_MS,
      shelf,
      coupons,
      locked: [],
      closing: false,
      closedAt: null,
      baskets: {},
      heat: null,
      revealed: false,
    };
  },

  reduce(state, playerId, action, ctx): AlisverisState | Rejected {
    if (!state.players.includes(playerId)) return { rejected: "not_participant" };
    if (ctx.now >= state.endsAt) return { rejected: "ended" };
    if (ctx.now < state.startedAt) return { rejected: "not_started" };
    if (state.locked.includes(playerId)) return { rejected: "locked" };
    if (state.closing) return { rejected: "closed" };
    if (action.kind !== "lock" && !state.shelf.some((p) => p.id === action.product)) {
      return { rejected: "not_on_shelf" };
    }
    // Vitrin anı geçtiyse ısı, bu eylemden ÖNCEKİ sepetlerle donar.
    const base = freezeHeat(state, ctx.now);
    if (action.kind === "lock") {
      const locked = [...base.locked, playerId];
      const active = base.players.filter((id) => ctx.connected.includes(id));
      if (active.length === 0 || !active.every((id) => locked.includes(id))) return { ...base, locked };
      const endsAt = Math.min(base.endsAt, ctx.now + ALISVERIS_LOCK_GRACE_MS);
      return {
        ...base,
        locked,
        closing: true,
        closedAt: ctx.now,
        endsAt,
        revealEndsAt: endsAt + ALISVERIS_REVEAL_MS,
      };
    }
    const basket = base.baskets[playerId] ?? [];
    if (action.kind === "add") {
      if (basket.includes(action.product)) return { rejected: "already_in_basket" };
      if (costOf(base, playerId, basket) + paidIn(base, playerId, action.product) > ALISVERIS_BUDGET) {
        return { rejected: "over_budget" };
      }
      return { ...base, baskets: { ...base.baskets, [playerId]: [...basket, action.product] } };
    }
    if (!basket.includes(action.product)) return { rejected: "not_in_basket" };
    return {
      ...base,
      baskets: { ...base.baskets, [playerId]: basket.filter((p) => p !== action.product) },
    };
  },

  tick(state, ctx): AlisverisState {
    const next = freezeHeat(state, ctx.now);
    if (next.revealed || ctx.now < next.endsAt) return next;
    return { ...next, revealed: true };
  },

  nextWake(state, ctx): number | null {
    const candidates = [state.endsAt, state.revealEndsAt];
    if (state.heat === null && heatShown(state)) candidates.push(state.startedAt + ALISVERIS_HEAT_AT_MS);
    let best: number | null = null;
    for (const at of candidates) if (at > ctx.now && (best === null || at < best)) best = at;
    return best;
  },

  publicView(state, ctx): AlisverisPublicView {
    const heatAt = state.startedAt + ALISVERIS_HEAT_AT_MS;
    const frozen = freezeHeat(state, ctx.now).heat;
    return {
      startedAt: state.startedAt,
      endsAt: state.endsAt,
      revealEndsAt: state.revealEndsAt,
      ready: [...state.locked],
      budget: ALISVERIS_BUDGET,
      products: state.shelf.map((p) => ({ id: p.id, name: p.name, price: p.price })),
      heatAt,
      // Yalnız seviye: kim aldığı ve tam sayı yoktur.
      heat: frozen === null ? null : { ...frozen },
      // Süre dolmadan kimsenin sepeti, alıcı sayıları ve kuponu yoktur.
      reveal: ctx.now >= state.endsAt ? alisverisSettle(state) : null,
    };
  },

  view(state, playerId): AlisverisView {
    if (playerId === null) return { basket: [], remaining: ALISVERIS_BUDGET, locked: false, coupon: null };
    const basket = [...(state.baskets[playerId] ?? [])];
    const locked = state.locked.includes(playerId);
    const coupon = state.coupons[playerId] ?? null;
    return { basket, remaining: ALISVERIS_BUDGET - costOf(state, playerId, basket), locked, coupon };
  },

  /** Sonuç açılışı (kepenk) alışveriş süresinin bittiği an başlar. */
  revealAt(state): number | null {
    return state.endsAt;
  },

  isFinished(state, ctx): boolean {
    return ctx.now >= state.revealEndsAt;
  },

  /**
   * Ürün numaraları ve adları herkese açık raf listesinde de bulunur; alt dizgi sızıntı denetimi sepetleri ve
   * kuponları koruyamaz. Gizlilik yapısal olarak sağlanır ve ayrıca test edilir (gizli-alisveris.test.ts, "gizlilik").
   */
  secrets() {
    return [];
  },

  result(state) {
    const { points } = alisverisSettle(state);
    // Mini puan = ham genel puan (+2 / +1 / 0); kartlar "birinci/sonuncu"yu buna göre okur (KURALLAR §19).
    const awards: Record<string, number> = {};
    for (const id of state.players) awards[id] = points[id] ?? 0;
    return { miniScores: { ...awards }, awards };
  },
};
