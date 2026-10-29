import type { ActionGenerator, GameBot } from "../../testing/simulate.js";
import { ORTAK_DURATION_MS, ORTAK_TILES } from "./types.js";

/** Çoğunlukla ilk iki kutudan birini seçer (odak noktası), bazen rastgele; arada kilitler, bazen aralık dışı yollar. */
const generate: ActionGenerator = (rng) => {
  const roll = rng.int(10);
  if (roll === 0) return { kind: "lock" };
  if (roll === 1) return { kind: "choose", tile: ORTAK_TILES + rng.int(3) };
  if (roll < 6) return { kind: "choose", tile: rng.int(2) };
  return { kind: "choose", tile: rng.int(ORTAK_TILES) };
};

export const ortakNoktaBot: GameBot = {
  durationMs: ORTAK_DURATION_MS,
  burstJitterMs: [60, 300, 1_200],
  generate,
};
