import type { GameBot } from "../../testing/simulate.js";
import { GIZLI_HIRSIZ_TOTAL_MS } from "./types.js";

/** Kimi ÇAL, kimi ÇALMA der; tekrar kararlar yok sayılır. */
export const gizliHirsizBot: GameBot = {
  durationMs: GIZLI_HIRSIZ_TOTAL_MS,
  burstJitterMs: [40, 400, 2_000],
  generate: (rng) => ({ kind: rng.int(3) === 0 ? "steal" : "pass" }),
};
