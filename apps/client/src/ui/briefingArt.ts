import { worldAllowed } from "./world.js";

/** Anlatım çizgi romanı: /assets/briefing/<oyun>-<1|2|3>.webp (4:3, 720x540). */
export const BRIEFING_PANELS = 3;

export const briefingSrc = (gameId: string, n: number): string => `/assets/briefing/${gameId}-${n}.webp`;

/** Dünya arka planıyla aynı kural: düşük bellek / veri tasarrufunda çizgi roman hiç yüklenmez. */
export const briefingAllowed = worldAllowed;

const started = new Set<string>();
const keep: HTMLImageElement[] = [];

/** Sıradaki oyunun 3 karesini önden indirir (engellemez). */
export function preloadBriefing(gameId: string): void {
  if (typeof Image === "undefined" || !briefingAllowed()) return;
  for (let n = 1; n <= BRIEFING_PANELS; n++) {
    const src = briefingSrc(gameId, n);
    if (started.has(src)) continue;
    started.add(src);
    const img = new Image();
    img.decoding = "async";
    img.src = src;
    keep.push(img);
  }
}
