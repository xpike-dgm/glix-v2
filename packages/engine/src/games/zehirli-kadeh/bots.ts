import type { ActionGenerator, GameBot } from "../../testing/simulate.js";
import { ZEHIRLI_KADEH_BASE_MS, ZEHIRLI_KADEH_SWAP_BONUS_MS } from "./types.js";

/** Çoğunlukla bağlı biriyle takas; bazen kendiyle (reddedilir). Hak kullanılmışsa reddedilir. */
const generate: ActionGenerator = (rng, playerId, _pub, _priv, connected) => {
  const targets = connected.filter((id) => id !== playerId);
  if (targets.length === 0 || rng.next() < 0.08) return { kind: "swap", target: playerId };
  return { kind: "swap", target: targets[rng.int(targets.length)] };
};

export const zehirliKadehBot: GameBot = {
  durationMs: ZEHIRLI_KADEH_BASE_MS + 8 * ZEHIRLI_KADEH_SWAP_BONUS_MS,
  burstJitterMs: [40, 400, 2_000],
  generate,
};
