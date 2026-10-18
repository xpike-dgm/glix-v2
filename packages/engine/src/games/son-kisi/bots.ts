import type { GameBot } from "../../testing/simulate.js";
import { SON_KISI_MAX_MS } from "./types.js";

/** Rastgele anlarda KAÇ; tekrar basışlar yok sayılır, bitişten sonrakiler reddedilir. */
export const sonKisiBot: GameBot = {
  durationMs: SON_KISI_MAX_MS,
  burstJitterMs: [40, 400, 2_000],
  generate: () => ({ kind: "escape" }),
};
