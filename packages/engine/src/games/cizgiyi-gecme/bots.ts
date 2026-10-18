import type { ActionGenerator, GameBot } from "../../testing/simulate.js";
import { CIZGI_CHOOSE_MS, CIZGI_DURATION_MS } from "./types.js";

/** Çoğunlukla yüksek riskli sayılar (50–99), bazen 100, bazen düşük, nadiren aralık dışı. */
const generate: ActionGenerator = (rng) => {
  const roll = rng.int(12);
  let value: number;
  if (roll === 0) value = 100;
  else if (roll === 1) value = rng.int(30);
  else if (roll === 2)
    value = -1 - rng.int(3); // aralık dışı: reddedilmeli
  else if (roll === 3) value = 101 + rng.int(5);
  else value = 50 + rng.int(50);
  return { kind: "choose", value };
};

export const cizgiyiGecmeBot: GameBot = {
  durationMs: CIZGI_DURATION_MS,
  burstJitterMs: [60, 300, Math.round(CIZGI_CHOOSE_MS / 10)],
  generate,
};
