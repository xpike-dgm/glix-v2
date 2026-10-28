import { warmImage } from "./imageWarm.js";
import { worldAllowed } from "./world.js";

/** Anlatım çizgi romanı: /assets/briefing/<oyun>-<1|2|3>.webp (4:3, 720x540). */
export const BRIEFING_PANELS = 3;

export const briefingSrc = (gameId: string, n: number): string => `/assets/briefing/${gameId}-${n}.webp`;

/** Dünya arka planıyla aynı kural: düşük bellek / veri tasarrufunda çizgi roman hiç yüklenmez. */
export const briefingAllowed = worldAllowed;

/** Sıradaki oyunun 3 karesini önden indirir (engellemez). İlk kare her zaman önce istenir. */
export function preloadBriefing(gameId: string, low = false): void {
  if (!briefingAllowed()) return;
  for (let n = 1; n <= BRIEFING_PANELS; n++) warmImage(briefingSrc(gameId, n), low || n > 1);
}
