import { MOODS, moodSrc } from "./avatars.js";
import { warmImage } from "./imageWarm.js";

/**
 * Odadaki oyuncuların dört ruh hâli görselini önden indirir; ekranlarda geçiş anında yanıp sönme olmaz.
 * Sonuç/final ekranlarında gerekir, maçın ilk ekranlarında değil: düşük öncelik, anlatım görselleriyle yarışmaz.
 */
export function preloadMoods(avatars: readonly number[]): void {
  for (const a of avatars) for (const m of MOODS) warmImage(moodSrc(a, m), true);
}
