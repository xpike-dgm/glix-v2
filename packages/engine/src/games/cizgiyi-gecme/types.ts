/** Çizgiyi Geçme — istemci ile sunucu arasındaki sözleşme. Kurallar: docs/KURALLAR.md §18. */

/** Seçim süresi (ms). */
export const CIZGI_CHOOSE_MS = 30_000;
/** Seçimler açıldıktan sonra sonucun ekranda kaldığı süre (ms); çarpışma/fırlatma animasyonu için. */
export const CIZGI_REVEAL_MS = 7_000;
export const CIZGI_DURATION_MS = CIZGI_CHOOSE_MS + CIZGI_REVEAL_MS;

/** Seçilebilecek en küçük ve en büyük risk (tam sayı). */
export const CIZGI_MIN = 0;
export const CIZGI_MAX = 100;

/**
 * Bölge genişliği (O12, docs/KURALLAR.md §18 değişikliği): oyuncu sayısına göre.
 *
 * Gerekçe: seçimler 0–100 üzerinde dağılırken bir oyuncunun başkasıyla aynı bölgeye düşme olasılığı oyuncu
 * sayısından bağımsız olarak kabaca %25'te kalsın (çarpışma anlamlı ama kesin değil). Oyuncu arttıkça çarpışma
 * ihtimali büyüyeceğinden bölge daralır; az oyuncuda çarpışma neredeyse hiç olmayacağından genişler. 4 oyuncuda
 * eski değer (10) korunur. Düzgün dağılımda olasılık tablodaki her sayı için %24,5–%26,4 aralığındadır
 * (cizgiyi-gecme.test.ts bunu denetler).
 */
export const CIZGI_ZONE_WIDTH: Readonly<Record<number, number>> = {
  2: 25,
  3: 14,
  4: 10,
  5: 7,
  6: 6,
  7: 5,
  8: 4,
};

/** Oyuncu sayısına göre bölge genişliği; tablo dışı sayılar en yakın uca bağlanır (2–8). */
export function cizgiZoneWidth(playerCount: number): number {
  const n = Math.min(8, Math.max(2, Math.floor(playerCount)));
  return CIZGI_ZONE_WIDTH[n] ?? 10;
}

/** Bölge numarası: `⌊değer ÷ genişlik⌋` (100 son bölgeye düşer; genişlik 5'in katıysa tek başına bir bölgedir). */
export function cizgiZone(value: number, width = 10): number {
  return Math.floor(value / width);
}

/** Bölgenin ilk ve son sayısı (aralık 0–100 ile sınırlı). */
export function cizgiZoneRange(zone: number, width: number): { from: number; to: number } {
  return { from: zone * width, to: Math.min(CIZGI_MAX, zone * width + width - 1) };
}

/** Kilit ("Tamam"): seçim kesinleşir; bağlı herkes kilitlerse seçim aşaması 1 sn sonra biter. */
export type CizgiAction = { kind: "choose"; value: number } | { kind: "lock" };

/** Son kilitten sonra seçimlerin açılmasına kalan süre (ms). */
export const CIZGI_LOCK_GRACE_MS = 1_000;

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
  /** Bölge genişliği (sonuçta görünürlük için tekrar). */
  zoneWidth: number;
  /** Her katılımcının son seçimi; seçmeyen null. */
  choices: Record<string, number | null>;
  status: Record<string, CizgiStatus>;
  /** Bu oyundan kazanılan puan (doğrudan genel skora eklenir). */
  points: Record<string, number>;
}

/** Herkese açık görünüm (oda başına bir kez). Seçimler süre dolana kadar burada yoktur. */
export interface CizgiPublicView {
  startedAt: number;
  /** Bölge genişliği (oyuncu sayısına göre; herkese açık kural bilgisi). */
  zoneWidth: number;
  /** Seçim süresinin bitişi; seçimler bu anda açılır. */
  endsAt: number;
  /** Sonuç ekranının bitişi (oyunun bitişi). */
  revealEndsAt: number;
  /** Süre dolmadan null. */
  reveal: CizgiReveal | null;
  /** Seçimini kilitleyenler (yalnız kimler; seçimin kendisi değil). */
  lockedIds: string[];
}

/** Kişiye özel görünüm: yalnız kendi seçimin. */
export interface CizgiView {
  /** Henüz seçmediysen ya da izleyiciysen null. */
  myChoice: number | null;
  /** Seçimini kilitledin mi. */
  locked: boolean;
}
