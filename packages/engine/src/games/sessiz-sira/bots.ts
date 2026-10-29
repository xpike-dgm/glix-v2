import type { ActionGenerator, GameBot } from "../../testing/simulate.js";
import { SESSIZ_DURATION_MS } from "./types.js";

/** Her çağrıda OYNA yollar; zamanlama simülasyonun takvimine bağlıdır (hatalı hamleler de oluşur). */
const generate: ActionGenerator = () => ({ kind: "play" });

export const sessizSiraBot: GameBot = {
  durationMs: SESSIZ_DURATION_MS,
  burstJitterMs: [100, 800, 3_000],
  generate,
};
