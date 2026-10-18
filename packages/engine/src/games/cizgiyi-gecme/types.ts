/** Çizgiyi Geçme — istemci ile sunucu arasındaki sözleşme. Kurallar: docs/KURALLAR.md §18. */

/** Seçim süresi (ms). */
export const CIZGI_CHOOSE_MS = 30_000;
/** Seçimler açıldıktan sonra sonucun ekranda kaldığı süre (ms); çarpışma/fırlatma animasyonu için. */
export const CIZGI_REVEAL_MS = 7_000;
export const CIZGI_DURATION_MS = CIZGI_CHOOSE_MS + CIZGI_REVEAL_MS;

/** Seçilebilecek en küçük ve en büyük risk (tam sayı). */
export const CIZGI_MIN = 0;
export const CIZGI_MAX = 100;

/** Bölge numarası: 0–9 → 0, 10–19 → 1, … 90–99 → 9, 100 → 10 (tek elemanlı son bölge). */
export function cizgiZone(value: number): number {
  return Math.floor(value / 10);
}

export type CizgiAction = { kind: "choose"; value: number };

/**
 * Bir oyuncunun sonuçtaki durumu:
 * - `first`: tek kalanların en yükseği (+2)
 * - `second`: tek kalanların ikincisi (+1)
 * - `safe`: tek kaldı ama ilk ikide değil (0)
 * - `crashed`: aynı bölgede başkası var, pasif (0)
 * - `none`: seçim yapmadı, pasif (0)
 */
export type CizgiStatus = "first" | "second" | "safe" | "crashed" | "none";

/** Süre dolunca herkese açılan sonuç. */
export interface CizgiReveal {
  /** Her katılımcının son seçimi; seçmeyen null. */
  choices: Record<string, number | null>;
  status: Record<string, CizgiStatus>;
  /** Bu oyundan kazanılan puan (doğrudan genel skora eklenir). */
  points: Record<string, number>;
}

/** Herkese açık görünüm (oda başına bir kez). Seçimler süre dolana kadar burada yoktur. */
export interface CizgiPublicView {
  startedAt: number;
  /** Seçim süresinin bitişi; seçimler bu anda açılır. */
  endsAt: number;
  /** Sonuç ekranının bitişi (oyunun bitişi). */
  revealEndsAt: number;
  /** Süre dolmadan null. */
  reveal: CizgiReveal | null;
}

/** Kişiye özel görünüm: yalnız kendi seçimin. */
export interface CizgiView {
  /** Henüz seçmediysen ya da izleyiciysen null. */
  myChoice: number | null;
}
