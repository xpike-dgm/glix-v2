/** Butona Bas — istemci ile sunucu arasındaki sözleşme. Kurallar: docs/KURALLAR.md §6. */

export const BUTONA_BAS_DURATION_MS = 45_000;
export const BUTONA_BAS_WINDOW_MS = 300;

export type ButonaBasAction = { kind: "press" };

export interface ButonaBasWindowResult {
  /** Oyun başından itibaren pencere sırası. */
  index: number;
  pressers: string[];
  outcome: "match" | "solo";
}

export interface ButonaBasView {
  startedAt: number;
  endsAt: number;
  windowMs: number;
  /** İzleyicide null. */
  myScore: number | null;
  /** Canlı mini oyun puanları (herkese açık). */
  scores: Record<string, number>;
  /** Bu oyuncu açık pencerede bastı mı. */
  pressedThisWindow: boolean;
  /** Son kapanan, en az bir basış olan pencereler; en yenisi sonda, en fazla 8. */
  recent: ButonaBasWindowResult[];
}
