/** Gizli Alışveriş — istemci ile sunucu arasındaki sözleşme. Kurallar: docs/KURALLAR.md §19, docs/A6-OYUNLAR.md. */

/** Alışveriş süresi (ms). */
export const ALISVERIS_SHOP_MS = 30_000;
/** Raf kepengi açıldıktan sonra sonucun ekranda kaldığı süre (ms); ürünlerin sepetlere ışınlanması için. */
export const ALISVERIS_REVEAL_MS = 8_000;
export const ALISVERIS_DURATION_MS = ALISVERIS_SHOP_MS + ALISVERIS_REVEAL_MS;
/** Her oyuncunun bütçesi (kredi; gerçek para değildir). */
export const ALISVERIS_BUDGET = 60;
/** Alıcı sayısı 1..8 olabilir; 840 hepsine tam bölünür, böylece değerler tam sayıyla (kesirsiz) tutulur. */
export const ALISVERIS_SCALE = 840;
/** Rafa her maçta gelen ürün sayısı (havuzdan). */
export const ALISVERIS_SHELF_SIZE = 12;
/** Maç başı fiyat oynaması: taban fiyatın ±%30'u (tam sayı), her zaman bu aralıkta. */
export const ALISVERIS_PRICE_SWING = 0.3;
export const ALISVERIS_PRICE_MIN = 6;
export const ALISVERIS_PRICE_MAX = 40;
/** Vitrin fısıltısı: alışverişin başından bu kadar sonra talep ateşi belirir ve o anki sepetlere göre donar. */
export const ALISVERIS_HEAT_AT_MS = 15_000;

export interface AlisverisPoolItem {
  /** Sabit ürün numarası (0..19). Raf sırası ve fiyat maç başına değişir, numara değişmez. */
  id: number;
  name: string;
  /** Taban fiyat; maçtaki fiyat bunun ±%30'u. */
  base: number;
}

/** Raftaki ürün: bu maçın fiyatıyla. */
export interface AlisverisProduct {
  id: number;
  name: string;
  price: number;
}

/** 20 ürünlük havuz (KURALLAR §19). İlk 12'si ilk sürümün ürünleridir. */
export const ALISVERIS_POOL: readonly AlisverisPoolItem[] = [
  { id: 0, name: "Hologram Sticker", base: 8 },
  { id: 1, name: "Enerji İçeceği", base: 10 },
  { id: 2, name: "Neon Rozet", base: 12 },
  { id: 3, name: "Retro Kartuş", base: 15 },
  { id: 4, name: "Mini Hoparlör", base: 18 },
  { id: 5, name: "Arcade Eldiveni", base: 20 },
  { id: 6, name: "Piksel Kamera", base: 22 },
  { id: 7, name: "Jet Çanta", base: 24 },
  { id: 8, name: "Kristal Kulaklık", base: 26 },
  { id: 9, name: "Holo Kask", base: 28 },
  { id: 10, name: "Mini Drone", base: 32 },
  { id: 11, name: "Gizli Sandık", base: 36 },
  { id: 12, name: "Lazer Kalem", base: 11 },
  { id: 13, name: "Ses Kartı", base: 13 },
  { id: 14, name: "Retro Joystick", base: 17 },
  { id: 15, name: "Plazma Lamba", base: 19 },
  { id: 16, name: "Mini Robot", base: 23 },
  { id: 17, name: "Hologram Saat", base: 25 },
  { id: 18, name: "Neon Kaykay", base: 30 },
  { id: 19, name: "VR Gözlük", base: 34 },
];

/** Havuzdaki ürün sayısı; ürün numarası 0..POOL_SIZE-1. */
export const ALISVERIS_POOL_SIZE = ALISVERIS_POOL.length;

/** Bir ürünün bu maçta alabileceği en düşük ve en yüksek fiyat (±%30, 6–40 içinde, tam sayı). */
export function alisverisPriceRange(base: number): { min: number; max: number } {
  const min = Math.max(ALISVERIS_PRICE_MIN, Math.ceil(base * (1 - ALISVERIS_PRICE_SWING) - 1e-9));
  const max = Math.min(ALISVERIS_PRICE_MAX, Math.floor(base * (1 + ALISVERIS_PRICE_SWING) + 1e-9));
  return { min, max: Math.max(min, max) };
}

/** Kuponlu ödeme: %50 indirim, tam sayıya YUKARI yuvarlanır (15 → 8). Değer yine tam fiyattan hesaplanır. */
export function couponPrice(price: number): number {
  return Math.ceil(price / 2);
}

/**
 * Talep ateşi seviyesi: o ürünü sepetinde tutan oyuncuların oranı. 0: kimse; ≤%25: 1; ≤%50: 2; >%50: 3.
 * Oran tam sayıyla karşılaştırılır (kayan nokta yok).
 */
export function heatLevel(holders: number, players: number): 0 | 1 | 2 | 3 {
  if (holders <= 0 || players <= 0) return 0;
  if (holders * 4 <= players) return 1;
  if (holders * 2 <= players) return 2;
  return 3;
}

export type AlisverisAction =
  | { kind: "add"; product: number }
  | { kind: "remove"; product: number }
  | { kind: "lock" };

/** Herkes "Tamam" deyince alışverişin bitişine kalan süre (ms). */
export const ALISVERIS_LOCK_GRACE_MS = 1_000;

/**
 * Ölçekli değeri (değer × 840) iki ondalıkla Türkçe biçimler: 12,50. Yarım yukarı yuvarlanır;
 * yalnız gösterim içindir, sıralama ölçekli tam sayıyla yapılır.
 */
export function formatKredi(scaled: number): string {
  const cents = Math.floor((scaled * 200 + ALISVERIS_SCALE) / (ALISVERIS_SCALE * 2));
  const whole = Math.floor(cents / 100);
  const frac = String(cents % 100).padStart(2, "0");
  return `${whole},${frac}`;
}

/** Süre dolunca herkese açılan sonuç. */
export interface AlisverisReveal {
  /** Her katılımcının sepeti (ürün numaraları, artan). */
  baskets: Record<string, number[]>;
  /** Raftaki ürün numarası → kaç kişi aldı (hiç alınmayan ürün 0). */
  buyers: Record<string, number>;
  /** Sepet değeri × 840 (tam sayı). Boş sepet 0. Kupon değeri değiştirmez (tam fiyat ÷ alıcı). */
  values: Record<string, number>;
  /** En değerli sepet(ler): +2 alanlar. */
  winners: string[];
  /** Herkesin bu oyundaki puanı: +2 / +1 / 0. */
  points: Record<string, number>;
  /** Herkesin kuponlu ürünü (sonuçta açılır). */
  coupons: Record<string, number>;
}

/** Herkese açık görünüm (oda başına bir kez). Sepetler ve alıcı sayıları süre dolana kadar burada yoktur. */
export interface AlisverisPublicView {
  startedAt: number;
  /** Alışveriş süresinin bitişi (herkes kilitlediyse erken); sepetler bu anda açılır. */
  endsAt: number;
  /** "Tamam" diyenler; sepetleri gizli kalır. */
  ready: string[];
  /** Sonuç ekranının bitişi (oyunun bitişi). */
  revealEndsAt: number;
  budget: number;
  /** Bu maçın rafı: 12 ürün, maç başına karışık sıra ve oynamış fiyatlar. */
  products: AlisverisProduct[];
  /** Vitrin fısıltısının anı. */
  heatAt: number;
  /** Ürün numarası → talep ateşi seviyesi (0..3); `heatAt`'ten önce null. Kim aldığı ve sayı yoktur. */
  heat: Record<string, number> | null;
  /** Süre dolmadan null. */
  reveal: AlisverisReveal | null;
}

/** Kişiye özel görünüm: yalnız kendi sepetin ve kendi kuponun. */
export interface AlisverisView {
  /** Sepetteki ürün numaraları (eklenme sırasıyla). İzleyici için boş. */
  basket: number[];
  /** Kalan bütçe (kuponlu ürün indirimli sayılır). İzleyici için bütçenin tamamı. */
  remaining: number;
  /** Sepetini kilitledin mi (boş sepet de kilitlenebilir). */
  locked: boolean;
  /** Kuponunun olduğu ürün numarası; izleyici için null. */
  coupon: number | null;
}
