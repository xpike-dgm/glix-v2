import type { AlisverisProduct, AlisverisPublicView, AlisverisReveal, AlisverisView } from "@glix/engine";
import {
  ALISVERIS_POOL_SIZE,
  ALISVERIS_PRICE_MAX,
  ALISVERIS_PRICE_MIN,
  ALISVERIS_SCALE,
  ALISVERIS_SHELF_SIZE,
  couponPrice,
  formatKredi,
} from "@glix/engine";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isInt = (v: unknown, min: number, max: number): v is number =>
  isNum(v) && Number.isInteger(v) && v >= min && v <= max;

const POOL = ALISVERIS_POOL_SIZE;

function parseProducts(v: unknown): AlisverisProduct[] | null {
  if (!Array.isArray(v) || v.length !== ALISVERIS_SHELF_SIZE) return null;
  const out: AlisverisProduct[] = [];
  const seen = new Set<number>();
  for (const p of v) {
    if (!isRec(p) || !isInt(p.id, 0, POOL - 1) || typeof p.name !== "string") return null;
    if (!isInt(p.price, ALISVERIS_PRICE_MIN, ALISVERIS_PRICE_MAX)) return null;
    if (p.name.length === 0 || p.name.length > 40 || seen.has(p.id)) return null;
    seen.add(p.id);
    out.push({ id: p.id, name: p.name, price: p.price });
  }
  return out;
}

/** Raftaki ürünlerden oluşan, tekrarsız numara listesi. */
function parseIdList(v: unknown, shelf: ReadonlySet<number>): number[] | null {
  if (!Array.isArray(v) || v.length > shelf.size) return null;
  const seen = new Set<number>();
  for (const x of v) {
    if (!isInt(x, 0, POOL - 1) || !shelf.has(x) || seen.has(x)) return null;
    seen.add(x);
  }
  return v as number[];
}

/** Raftaki her ürün için 0..3 talep ateşi seviyesi. */
function parseHeat(v: unknown, shelf: ReadonlySet<number>): Record<string, number> | null | undefined {
  if (v === null) return null;
  if (!isRec(v) || Object.keys(v).length !== shelf.size) return undefined;
  const out: Record<string, number> = {};
  for (const id of shelf) {
    const level = v[String(id)];
    if (!isInt(level, 0, 3)) return undefined;
    out[String(id)] = level;
  }
  return out;
}

function parseReveal(v: unknown, shelf: ReadonlySet<number>): AlisverisReveal | null | undefined {
  if (v === null) return null;
  if (
    !isRec(v) ||
    !isRec(v.baskets) ||
    !isRec(v.buyers) ||
    !isRec(v.values) ||
    !isRec(v.points) ||
    !isRec(v.coupons) ||
    !Array.isArray(v.winners)
  ) {
    return undefined;
  }
  const baskets: Record<string, number[]> = {};
  const values: Record<string, number> = {};
  const points: Record<string, number> = {};
  const coupons: Record<string, number> = {};
  for (const [id, b] of Object.entries(v.baskets)) {
    const list = parseIdList(b, shelf);
    const val = v.values[id];
    const pts = v.points[id];
    if (!list || !isInt(val, 0, 1_000_000) || !isInt(pts, 0, 2)) return undefined;
    baskets[id] = list;
    values[id] = val;
    points[id] = pts;
  }
  const n = Object.keys(baskets).length;
  if (Object.keys(v.values).length !== n || Object.keys(v.points).length !== n) return undefined;
  for (const [id, c] of Object.entries(v.coupons)) {
    if (!(id in baskets) || !isInt(c, 0, POOL - 1) || !shelf.has(c)) return undefined;
    coupons[id] = c;
  }
  const buyers: Record<string, number> = {};
  for (const id of shelf) {
    const c = v.buyers[String(id)];
    if (!isInt(c, 0, 64)) return undefined;
    buyers[String(id)] = c;
  }
  if (!v.winners.every((w) => typeof w === "string" && w in baskets)) return undefined;
  return { baskets, buyers, values, winners: v.winners as string[], points, coupons };
}

/** Ekranın okuduğu birleşik görünüm: ortak (`publicView`) + kişiye özel (`view`). */
export type AlisverisScreenView = AlisverisPublicView & AlisverisView;

export function parseAlisverisPublicView(v: unknown): AlisverisPublicView | null {
  if (!isRec(v)) return null;
  if (!isNum(v.startedAt) || !isNum(v.endsAt) || !isNum(v.revealEndsAt) || !isNum(v.heatAt)) return null;
  if (!isInt(v.budget, 1, 1000)) return null;
  const products = parseProducts(v.products);
  if (!products) return null;
  const shelf = new Set(products.map((p) => p.id));
  const reveal = parseReveal(v.reveal, shelf);
  const heat = parseHeat(v.heat, shelf);
  if (reveal === undefined || heat === undefined) return null;
  if (!Array.isArray(v.ready) || !v.ready.every((p) => typeof p === "string")) return null;
  return {
    startedAt: v.startedAt,
    endsAt: v.endsAt,
    ready: v.ready as string[],
    revealEndsAt: v.revealEndsAt,
    budget: v.budget,
    products,
    heatAt: v.heatAt,
    heat,
    reveal,
  };
}

export function parseAlisverisPrivateView(v: unknown, pub: AlisverisPublicView): AlisverisView | null {
  if (!isRec(v)) return null;
  const shelf = new Set(pub.products.map((p) => p.id));
  const basket = parseIdList(v.basket, shelf);
  if (!basket || !isInt(v.remaining, 0, pub.budget) || typeof v.locked !== "boolean") return null;
  const coupon = v.coupon;
  if (coupon !== null && !(isInt(coupon, 0, POOL - 1) && shelf.has(coupon))) return null;
  return { basket, remaining: v.remaining, locked: v.locked, coupon };
}

export function parseAlisverisView(publicView: unknown, view: unknown): AlisverisScreenView | null {
  const pub = parseAlisverisPublicView(publicView);
  if (!pub) return null;
  const priv = parseAlisverisPrivateView(view, pub);
  return priv ? { ...pub, ...priv } : null;
}

/** Bu oyuncunun ödediği fiyat: kuponlu ürün yarı fiyat (yukarı yuvarlı). */
export function paidPrice(p: AlisverisProduct, coupon: number | null): number {
  return coupon === p.id ? couponPrice(p.price) : p.price;
}

/** Sepetin ödenen toplamı (kupon dahil). */
export function basketCost(
  ids: readonly number[],
  products: readonly AlisverisProduct[],
  coupon: number | null = null,
): number {
  const byId = new Map(products.map((p) => [p.id, p]));
  return ids.reduce((s, id) => {
    const p = byId.get(id);
    return s + (p ? paidPrice(p, coupon) : 0);
  }, 0);
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

/** Talep ateşi seviyesinin okunur adı (ekran okuyucu ve renk körlüğü için; sayı içermez). */
export function heatLabel(level: number): string {
  if (level >= 3) return "Kapış kapış";
  if (level === 2) return "İlgi görüyor";
  if (level === 1) return "Biraz ilgi";
  return "İlgi yok";
}

/** Kısa ürün adı etiketi için ilk iki harf (Türkçe büyük harf). */
export function productInitials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? words.map((w) => w.charAt(0)).join("") : name.slice(0, 2);
  return letters.slice(0, 2).toLocaleUpperCase("tr-TR");
}

/**
 * Sonuç açılışının zaman çizelgesi (ms, alışveriş bitişinden itibaren). Tek yerde durur: sonuç süresi uzarsa
 * yalnız bu sabitler büyütülür. Bugün hepsi oyunun 8 sn'lik sonuç süresine (`ALISVERIS_REVEAL_MS`) sığar.
 */
export const SONUC_ZAMANI = {
  /** Kepenk kalkmaya başlar. */
  kepenk: 0,
  /** Ürün ürün çakışma: alıcı avatarları, bölünme ya da "TEK BAŞINA!". */
  cakisma: 900,
  /** Sepetler en değersizden en değerliye açılır. */
  sepetler: 4_300,
  /** Puanlar üstteki puan yazısına uçar. */
  puanlar: 7_000,
  /** Açılışın sonu (her şey yerinde). */
  son: 7_800,
} as const;

export type SonucSahne = 0 | 1 | 2 | 3;

/** Geçen süreye göre sahne: 0 kepenk, 1 çakışma, 2 sepetler, 3 puanlar. */
export function sonucSahne(ms: number): SonucSahne {
  if (ms >= SONUC_ZAMANI.puanlar) return 3;
  if (ms >= SONUC_ZAMANI.sepetler) return 2;
  if (ms >= SONUC_ZAMANI.cakisma) return 1;
  return 0;
}

/** Çakışma sahnesinde i. ürünün açılma anı (raf sırası; hepsi sepetler sahnesinden önce biter). */
export function urunAcilis(i: number, count: number): number {
  const span = SONUC_ZAMANI.sepetler - SONUC_ZAMANI.cakisma - 500;
  return SONUC_ZAMANI.cakisma + Math.round((span / Math.max(1, count)) * i);
}

/** Sepetler sahnesinde, değer sırası en düşükten `k`. açılan satırın anı (son açılan en değerli). */
export function sepetAcilis(k: number, count: number): number {
  const span = SONUC_ZAMANI.puanlar - SONUC_ZAMANI.sepetler - 400;
  return SONUC_ZAMANI.sepetler + Math.round((span / Math.max(1, count)) * k);
}

/** Her ürünü alanlar (raf numarası → oyuncu kimlikleri, katılım sırasıyla). */
export function buyersOf(reveal: AlisverisReveal, order: readonly string[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const id of order) {
    for (const p of reveal.baskets[id] ?? []) {
      const list = out[String(p)] ?? [];
      list.push(id);
      out[String(p)] = list;
    }
  }
  return out;
}
