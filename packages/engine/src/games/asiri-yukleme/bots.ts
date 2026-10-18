import type { ActionGenerator, GameBot } from "../../testing/simulate.js";
import { ASIRI_YUKLEME_MAX_BATCH, ASIRI_YUKLEME_TOTAL_MS } from "./types.js";

/** Çoğunlukla tek tık, bazen toplu tık (hızlı parmak) gönderir. */
const generate: ActionGenerator = (rng) =>
  rng.int(3) === 0
    ? { kind: "tap", count: 1 + rng.int(ASIRI_YUKLEME_MAX_BATCH) }
    : rng.int(2) === 0
      ? { kind: "tap" }
      : { kind: "tap", count: 1 };

export const asiriYuklemeBot: GameBot = {
  durationMs: ASIRI_YUKLEME_TOTAL_MS,
  burstJitterMs: [30, 150, 800, 4000],
  generate,
};
