import type { ActionGenerator, GameBot } from "../../testing/simulate.js";
import { KOR_KRONOMETRE_TOTAL_MS } from "./types.js";

const generate: ActionGenerator = (): { kind: "press" } => ({ kind: "press" });

/**
 * Basışlar oyun boyunca (3 el) dağılır; "Hazır ol" ve el arasındaki basışlar, aynı eldeki tekrar basışlar ve süre
 * sonrası basışlar reddedilir.
 */
export const korKronometreBot: GameBot = {
  durationMs: KOR_KRONOMETRE_TOTAL_MS,
  burstJitterMs: [1, 40, 400, 3000],
  generate,
};
