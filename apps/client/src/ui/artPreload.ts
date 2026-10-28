import { briefingAllowed, preloadBriefing } from "./briefingArt.js";
import { warmImage } from "./imageWarm.js";
import { preloadProps } from "./props.js";
import { preloadWorld } from "./world.js";

/** Sonuç ekranındaki "sıradaki oyun" kapağı (800x450). */
export const coverSrc = (gameId: string): string => `/assets/cards/${gameId}.webp`;

/**
 * Bir oyunun ekran görsellerini önden indirir: dünya arka planı, anlatım çizgi romanı, nesne görselleri ve
 * sonuç ekranındaki kapak. `low`: sıradaki oyun için; şu anki oyunun görselleriyle yarışmaz.
 */
export function preloadGameArt(gameId: string, low = false): void {
  preloadWorld(gameId, low);
  preloadBriefing(gameId, low);
  preloadProps(gameId, low);
  if (briefingAllowed()) warmImage(coverSrc(gameId), true);
}
