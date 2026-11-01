import type { GameBot } from "../../testing/simulate.js";
import { SON_KISI_TOTAL_MS } from "./types.js";

/** Rastgele anlarda KAÇ; tekrar basışlar yok sayılır, tur arası ve bitişten sonrakiler reddedilir. */
export const sonKisiBot: GameBot = {
  durationMs: SON_KISI_TOTAL_MS,
  burstJitterMs: [40, 400, 2_000],
  generate: () => ({ kind: "escape" }),
};
