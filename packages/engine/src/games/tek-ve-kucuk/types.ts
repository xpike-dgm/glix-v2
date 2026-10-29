/** Tek ve Küçük (TASLAK) — istemci ile sunucu arasındaki sözleşme. Kurallar: docs/TASLAK-OYUNLAR.md §2. */

export const TEK_ROUNDS = 5;
export const TEK_CHOOSE_MS = 10_000;
export const TEK_REVEAL_MS = 4_000;
export const TEK_LAST_REVEAL_MS = 6_000;
export const TEK_LOCK_GRACE_MS = 1_000;
/** Turu tek başına kazanana verilen mini puan. */
export const TEK_WIN_POINTS = 3;
export const TEK_DURATION_MS =
  TEK_ROUNDS * TEK_CHOOSE_MS + (TEK_ROUNDS - 1) * TEK_REVEAL_MS + TEK_LAST_REVEAL_MS;

/** Seçilebilecek en büyük sayı: oyuncu sayısı + 2 (3 kişide 5, 8 kişide 10). Sayılar 1'den başlar. */
export function tekMax(playerCount: number): number {
  return playerCount + 2;
}

export type TekAction = { kind: "choose"; value: number } | { kind: "lock" };

/** Süre dolunca herkese açılan tur sonucu. */
export interface TekReveal {
  /** Seçim yapanların sayıları (yapmayan yok). */
  picks: Record<string, number>;
  /** counts[i] = (i+1) sayısını seçenlerin sayısı. */
  counts: number[];
  /** Turu kazanan (en küçük tek kalan sayıyı seçen); yoksa null. */
  winner: string | null;
  winningValue: number | null;
  points: Record<string, number>;
}

/** Önceki bir turun herkese açık özeti (sonraki turlarda ipucu olarak gösterilir). */
export interface TekRoundSummary {
  winningValue: number | null;
  winner: string | null;
}

export interface TekPublicView {
  startedAt: number;
  round: number;
  rounds: number;
  phase: "choose" | "reveal";
  phaseStartedAt: number;
  phaseEndsAt: number;
  /** Seçilebilecek en büyük sayı. */
  max: number;
  previous: TekRoundSummary[];
  totals: Record<string, number>;
  lockedIds: string[];
  reveal: TekReveal | null;
  final: Record<string, number> | null;
}

export interface TekView {
  myValue: number | null;
  locked: boolean;
}
