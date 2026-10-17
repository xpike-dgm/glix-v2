import type { GameBot } from "../../testing/simulate.js";
import { BUTONA_BAS_DURATION_MS, type ButonaBasAction } from "./types.js";

/** Takvim kümeli basışlar üretir; kümeler eşleşme, dağınık basışlar tek başına basış verir. */
export const butonaBasBot: GameBot = {
  durationMs: BUTONA_BAS_DURATION_MS,
  burstJitterMs: [30, 120, 280, 700],
  generate: (): ButonaBasAction => ({ kind: "press" }),
};
