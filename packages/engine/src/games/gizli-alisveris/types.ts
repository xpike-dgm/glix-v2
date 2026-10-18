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

export interface AlisverisProduct {
  /** Sabit ürün numarası (0..11). Raf sırası maç başına karışır, numara değişmez. */
  id: number;
  name: string;
  price: number;
}

/** Sabit 12 ürünlük havuz (KURALLAR §19). */
export const ALISVERIS_CATALOG: readonly AlisverisProduct[] = [
  { id: 0, name: "Hologram Sticker", price: 8 },
  { id: 1, name: "Enerji İçeceği", price: 10 },
  { id: 2, name: "Neon Rozet", price: 12 },
  { id: 3, name: "Retro Kartuş", price: 15 },
  { id: 4, name: "Mini Hoparlör", price: 18 },
  { id: 5, name: "Arcade Eldiveni", price: 20 },
  { id: 6, name: "Piksel Kamera", price: 22 },
  { id: 7, name: "Jet Çanta", price: 24 },
  { id: 8, name: "Kristal Kulaklık", price: 26 },
  { id: 9, name: "Holo Kask", price: 28 },
  { id: 10, name: "Mini Drone", price: 32 },
  { id: 11, name: "Gizli Sandık", price: 36 },
];

export type AlisverisAction = { kind: "add"; product: number } | { kind: "remove"; product: number };

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
  /** Ürün numarası → kaç kişi aldı (hiç alınmayan ürün 0). */
  buyers: Record<string, number>;
  /** Sepet değeri × 840 (tam sayı). Boş sepet 0. */
  values: Record<string, number>;
  /** +1 alanlar (en yüksek değer > 0 olan sepetler). */
  winners: string[];
}

/** Herkese açık görünüm (oda başına bir kez). Sepetler ve alıcı sayıları süre dolana kadar burada yoktur. */
export interface AlisverisPublicView {
  startedAt: number;
  /** Alışveriş süresinin bitişi; sepetler bu anda açılır. */
  endsAt: number;
  /** Sonuç ekranının bitişi (oyunun bitişi). */
  revealEndsAt: number;
  budget: number;
  /** Raf sırası (maç başına karışık). */
  products: AlisverisProduct[];
  /** Süre dolmadan null. */
  reveal: AlisverisReveal | null;
}

/** Kişiye özel görünüm: yalnız kendi sepetin. */
export interface AlisverisView {
  /** Sepetteki ürün numaraları (eklenme sırasıyla). İzleyici için boş. */
  basket: number[];
  /** Kalan bütçe. İzleyici için bütçenin tamamı. */
  remaining: number;
}
