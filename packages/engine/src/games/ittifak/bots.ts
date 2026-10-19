import type { GameBot } from "../../testing/simulate.js";
import { ITTIFAK_DURATION_MS } from "./types.js";

/** Çoğunlukla bağlı başka bir oyuncuya oy verir; ara sıra kendine ya da bilinmeyen birine oy dener (reddedilir). */
export const ittifakBot: GameBot = {
  durationMs: ITTIFAK_DURATION_MS,
  burstJitterMs: [100, 1_000, 4_000],
  generate: (rng, playerId, _pub, _priv, connected) => {
    const roll = rng.int(100);
    if (roll >= 93) return { kind: rng.int(2) === 0 ? "skip" : "lock" };
    if (roll < 4) return { kind: "vote", target: playerId };
    if (roll < 7) return { kind: "vote", target: "ghost" };
    const others = connected.filter((id) => id !== playerId);
    const pick = others[rng.int(others.length)];
    return { kind: "vote", target: pick ?? "ghost" };
  },
};
