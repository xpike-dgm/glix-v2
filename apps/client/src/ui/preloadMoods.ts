import { MOODS, moodSrc } from "./avatars.js";

const started = new Set<string>();
const keep: HTMLImageElement[] = [];

/** Odadaki oyuncuların dört ruh hâli görselini önden indirir; ekranlarda geçiş anında yanıp sönme olmaz. */
export function preloadMoods(avatars: readonly number[]): void {
  if (typeof Image === "undefined") return;
  for (const a of avatars) {
    for (const m of MOODS) {
      const src = moodSrc(a, m);
      if (started.has(src)) continue;
      started.add(src);
      const img = new Image();
      img.decoding = "async";
      img.src = src;
      keep.push(img);
    }
  }
}
