import type { ActionGenerator, GameBot } from "../../testing/simulate.js";
import { ZEHIRLI_KADEH_BASE_MS, ZEHIRLI_KADEH_SWAP_BONUS_MS } from "./types.js";

/**
 * Çoğunlukla bağlı biriyle takas; bazen birinin (kopuk olabilir) kadehini kontrol; bazen kendiyle (reddedilir).
 * Hak kullanılmışsa reddedilir.
 */
const generate: ActionGenerator = (rng, playerId, pub, _priv, connected) => {
  const kind = rng.next() < 0.35 ? "check" : "swap";
  const all =
    typeof pub === "object" && pub !== null && Array.isArray((pub as { players?: unknown }).players)
      ? ((pub as { players: unknown[] }).players.filter((x) => typeof x === "string") as string[])
      : [...connected];
  const pool = (kind === "check" ? all : connected).filter((id) => id !== playerId);
  if (pool.length === 0 || rng.next() < 0.08) return { kind, target: playerId };
  return { kind, target: pool[rng.int(pool.length)] };
};

export const zehirliKadehBot: GameBot = {
  durationMs: ZEHIRLI_KADEH_BASE_MS + 8 * ZEHIRLI_KADEH_SWAP_BONUS_MS,
  burstJitterMs: [40, 400, 2_000],
  generate,
};
