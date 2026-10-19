import type { ActionGenerator, GameBot } from "../../testing/simulate.js";
import { ORTALAMA_CHOOSE_MS, ORTALAMA_DURATION_MS } from "./types.js";

/** Çoğunlukla 0–40 bandında (gerçekçi tahmin), bazen uçlarda, nadiren aralık dışı sayı seçer. */
const generate: ActionGenerator = (rng) => {
  if (rng.int(12) === 0) return { kind: "lock" };
  const roll = rng.int(12);
  let value: number;
  if (roll === 0) value = 0;
  else if (roll === 1) value = 100;
  else if (roll === 2)
    value = 101 + rng.int(5); // aralık dışı: reddedilmeli
  else if (roll === 3) value = rng.int(101);
  else value = 10 + rng.int(31);
  return { kind: "choose", value };
};

export const ortalamaninYarisiBot: GameBot = {
  durationMs: ORTALAMA_DURATION_MS,
  burstJitterMs: [60, 300, Math.round(ORTALAMA_CHOOSE_MS / 10)],
  generate,
};
