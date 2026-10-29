import type { ActionGenerator, GameBot } from "../../testing/simulate.js";
import { TEK_DURATION_MS } from "./types.js";

/** Küçük sayılara yatkın seçer; bazen kilitler, bazen aralık dışı sayı yollar. */
const generate: ActionGenerator = (rng) => {
  const roll = rng.int(10);
  if (roll === 0) return { kind: "lock" };
  if (roll === 1) return { kind: "choose", value: 11 + rng.int(3) };
  return { kind: "choose", value: 1 + rng.int(rng.int(2) === 0 ? 3 : 10) };
};

export const tekVeKucukBot: GameBot = {
  durationMs: TEK_DURATION_MS,
  burstJitterMs: [60, 300, 1_000],
  generate,
};
