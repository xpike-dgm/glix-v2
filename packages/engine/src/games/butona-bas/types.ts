/** Butona Bas — istemci ile sunucu arasındaki sözleşme. Kurallar: docs/KURALLAR.md §6 (O8 değişikliği dahil). */

/** Tur sayısı; her turda pencere daralır. */
export const BUTONA_BAS_ROUNDS = 3;
/** Turlara göre eşleşme penceresi uzunluğu (ms): 1. tur 300, 2. tur 200, 3. tur 120. */
export const BUTONA_BAS_WINDOWS_MS: readonly number[] = [300, 200, 120];
/** Bir turun süresi (ms); 3 tur = 45 sn oyun. */
export const BUTONA_BAS_ROUND_MS = 15_000;
/** Turlar arasındaki ara (ms): basışlar sayılmaz, "Pencere daralıyor" gösterilir. */
export const BUTONA_BAS_GAP_MS = 3_000;
/** Oyunun tamamı (ms): 3 tur + 2 ara. */
export const BUTONA_BAS_DURATION_MS =
  BUTONA_BAS_ROUNDS * BUTONA_BAS_ROUND_MS + (BUTONA_BAS_ROUNDS - 1) * BUTONA_BAS_GAP_MS;
/** İlk turun pencere uzunluğu (ms); eski sabit. */
export const BUTONA_BAS_WINDOW_MS = BUTONA_BAS_WINDOWS_MS[0] ?? 300;

/** Tur `round` (0 tabanlı) için pencere uzunluğu (ms). */
export function butonaBasWindowMs(round: number): number {
  const i = Math.min(BUTONA_BAS_ROUNDS - 1, Math.max(0, Math.floor(round)));
  return BUTONA_BAS_WINDOWS_MS[i] ?? BUTONA_BAS_WINDOW_MS;
}

/** Tur `round` (0 tabanlı) başlangıcı: oyun başından ms. */
export function butonaBasRoundOffset(round: number): number {
  return round * (BUTONA_BAS_ROUND_MS + BUTONA_BAS_GAP_MS);
}

export type ButonaBasAction = { kind: "press" };

export interface ButonaBasWindowResult {
  /** Tur numarası (0 tabanlı). */
  round: number;
  /** Turun başından itibaren pencere sırası. */
  index: number;
  pressers: string[];
  outcome: "match" | "solo";
}

/** `play`: tur sürüyor · `gap`: turlar arası ara · `over`: oyun bitti. */
export type ButonaBasPhase = "play" | "gap" | "over";

/** Herkese açık görünüm (oda başına bir kez hesaplanır). */
export interface ButonaBasPublicView {
  startedAt: number;
  endsAt: number;
  /** Tur numarası (1 tabanlı); aradayken yaklaşan tur. */
  round: number;
  rounds: number;
  phase: ButonaBasPhase;
  /** Gösterilen turun pencere uzunluğu (ms); aradayken yaklaşan turunki. */
  windowMs: number;
  /** Tur oynanırken turun bitişi; aradayken yaklaşan turun başlangıcı; bitince oyunun bitişi. */
  phaseEndsAt: number;
  /** Canlı mini oyun puanları (turlar boyunca toplam). */
  scores: Record<string, number>;
  /** Son kapanan, en az bir basış olan pencereler; en yenisi sonda, en fazla 8. */
  recent: ButonaBasWindowResult[];
}

/** Kişiye özel görünüm. */
export interface ButonaBasView {
  /** İzleyicide null. */
  myScore: number | null;
  /** Bu oyuncu açık pencerede bastı mı. */
  pressedThisWindow: boolean;
}
