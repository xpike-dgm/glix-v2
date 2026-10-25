import type { ActionGenerator, GameBot } from "../../testing/simulate.js";
import { BORSA_DURATION_MS } from "./types.js";

/** Geçerli teklifler (arada 0, tüm jeton ve fazlası) üretir. */
export const generate: ActionGenerator = (rng, playerId, publicView) => {
  const coins = (publicView as { coins?: Record<string, number> } | null)?.coins?.[playerId] ?? 100;
  const roll = rng.int(10);
  if (roll === 0) return { kind: "bid", amount: 0 };
  if (roll === 1) return { kind: "bid", amount: Math.max(0, coins) };
  if (roll === 2) return { kind: "bid", amount: Math.max(0, coins) + 1 + rng.int(50) };
  return { kind: "bid", amount: rng.int(Math.max(1, Math.min(coins, 70)) + 1) };
};

export const karaBorsaBot: GameBot = {
  durationMs: BORSA_DURATION_MS,
  burstJitterMs: [100, 700, 2_000, 6_000],
  generate,
};
