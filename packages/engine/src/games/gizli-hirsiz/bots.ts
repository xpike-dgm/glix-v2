import type { GameBot } from "../../testing/simulate.js";
import { GIZLI_HIRSIZ_DURATION_MS } from "./types.js";

/** Çoğu zaman geçerli ÇAL; bazen tekrar basış (yok sayılır). */
export const gizliHirsizBot: GameBot = {
  durationMs: GIZLI_HIRSIZ_DURATION_MS,
  burstJitterMs: [40, 400, 2_000],
  generate: () => ({ kind: "steal" }),
};
