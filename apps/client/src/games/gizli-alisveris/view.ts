import type { AlisverisProduct, AlisverisPublicView, AlisverisReveal, AlisverisView } from "@glix/engine";
import { ALISVERIS_CATALOG, ALISVERIS_SCALE, formatKredi } from "@glix/engine";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isInt = (v: unknown, min: number, max: number): v is number =>
  isNum(v) && Number.isInteger(v) && v >= min && v <= max;

const COUNT = ALISVERIS_CATALOG.length;

function parseProducts(v: unknown): AlisverisProduct[] | null {
  if (!Array.isArray(v) || v.length !== COUNT) return null;
  const out: AlisverisProduct[] = [];
  const seen = new Set<number>();
  for (const p of v) {
    if (!isRec(p) || !isInt(p.id, 0, COUNT - 1) || typeof p.name !== "string") return null;
    if (!isInt(p.price, 1, 1000) || p.name.length === 0 || p.name.length > 40 || seen.has(p.id)) return null;
    seen.add(p.id);
    out.push({ id: p.id, name: p.name, price: p.price });
  }
  return out;
}

function parseIdList(v: unknown): number[] | null {
  if (!Array.isArray(v) || v.length > COUNT) return null;
  const seen = new Set<number>();
  for (const x of v) {
    if (!isInt(x, 0, COUNT - 1) || seen.has(x)) return null;
    seen.add(x);
  }
  return v as number[];
}

function parseReveal(v: unknown): AlisverisReveal | null | undefined {
  if (v === null) return null;
  if (!isRec(v) || !isRec(v.baskets) || !isRec(v.buyers) || !isRec(v.values) || !Array.isArray(v.winners)) {
    return undefined;
  }
  const baskets: Record<string, number[]> = {};
  const values: Record<string, number> = {};
  for (const [id, b] of Object.entries(v.baskets)) {
    const list = parseIdList(b);
    const val = v.values[id];
    if (!list || !isInt(val, 0, 1_000_000)) return undefined;
    baskets[id] = list;
    values[id] = val;
  }
  if (Object.keys(v.values).length !== Object.keys(baskets).length) return undefined;
  const buyers: Record<string, number> = {};
  for (let i = 0; i < COUNT; i++) {
    const c = v.buyers[String(i)];
    if (!isInt(c, 0, 64)) return undefined;
    buyers[String(i)] = c;
  }
  if (!v.winners.every((w) => typeof w === "string" && w in baskets)) return undefined;
  return { baskets, buyers, values, winners: v.winners as string[] };
}

/** Ekranın okuduğu birleşik görünüm: ortak (`publicView`) + kişiye özel (`view`). */
export type AlisverisScreenView = AlisverisPublicView & AlisverisView;

export function parseAlisverisPublicView(v: unknown): AlisverisPublicView | null {
  if (!isRec(v)) return null;
  if (!isNum(v.startedAt) || !isNum(v.endsAt) || !isNum(v.revealEndsAt)) return null;
  if (!isInt(v.budget, 1, 1000)) return null;
  const products = parseProducts(v.products);
  const reveal = parseReveal(v.reveal);
  if (!products || reveal === undefined) return null;
  return {
    startedAt: v.startedAt,
    endsAt: v.endsAt,
    revealEndsAt: v.revealEndsAt,
    budget: v.budget,
    products,
    reveal,
  };
}

export function parseAlisverisPrivateView(v: unknown, budget: number): AlisverisView | null {
  if (!isRec(v)) return null;
  const basket = parseIdList(v.basket);
  if (!basket || !isInt(v.remaining, 0, budget)) return null;
  return { basket, remaining: v.remaining };
}

export function parseAlisverisView(publicView: unknown, view: unknown): AlisverisScreenView | null {
  const pub = parseAlisverisPublicView(publicView);
  if (!pub) return null;
  const priv = parseAlisverisPrivateView(view, pub.budget);
  return priv ? { ...pub, ...priv } : null;
}

/** Sepetin toplam fiyatı. */
export function basketCost(ids: readonly number[], products: readonly AlisverisProduct[]): number {
  const price = new Map(products.map((p) => [p.id, p.price]));
  return ids.reduce((s, id) => s + (price.get(id) ?? 0), 0);
}

/** Ürünün kişi başı değeri (alıcı sayısına bölünmüş, ölçekli tam sayı). Hiç alınmadıysa tam fiyat. */
export function productValueScaled(price: number, buyers: number): number {
  return price * (ALISVERIS_SCALE / Math.max(1, buyers));
}

export function productValueText(price: number, buyers: number): string {
  return formatKredi(productValueScaled(price, buyers));
}

/** Sonuç sıralaması: değeri yüksek olan üstte; eşitlikte katılım sırası korunur. */
export function ranking(reveal: AlisverisReveal, order: readonly string[]): string[] {
  return order
    .filter((id) => id in reveal.values)
    .map((id, i) => ({ id, i, v: reveal.values[id] ?? 0 }))
    .sort((a, b) => b.v - a.v || a.i - b.i)
    .map((x) => x.id);
}

/** Ürün görseli için renk/şekil (kimlikten sabit türetilir). */
const COLORS = ["#2ef2ff", "#ff2bd6", "#ffc23b", "#b6ff3b", "#8b5cff", "#ff8a3b", "#2bffa8", "#3b7bff"];
export const productColor = (id: number): string => COLORS[id % COLORS.length] ?? "#2ef2ff";
export const productShape = (id: number): number => id % 6;

/** Kısa ürün adı etiketi için ilk iki harf (Türkçe büyük harf). */
export function productInitials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? words.map((w) => w.charAt(0)).join("") : name.slice(0, 2);
  return letters.slice(0, 2).toLocaleUpperCase("tr-TR");
}
