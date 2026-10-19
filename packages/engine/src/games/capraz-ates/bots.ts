import type { GameBot } from "../../testing/simulate.js";
import { CAPRAZ_ATES_DURATION_MS } from "./types.js";

/** Çoğunlukla bağlı başka bir oyuncuyu hedefler; ara sıra kendini ya da bilinmeyen birini dener (reddedilir). */
export const caprazAtesBot: GameBot = {
  durationMs: CAPRAZ_ATES_DURATION_MS,
  burstJitterMs: [100, 1_000, 4_000],
  generate: (rng, playerId, _pub, _priv, connected) => {
    const roll = rng.int(100);
    if (roll >= 93) return { kind: "lock" };
    if (roll < 4) return { kind: "target", target: playerId };
    if (roll < 7) return { kind: "target", target: "ghost" };
    const others = connected.filter((id) => id !== playerId);
    const pick = others[rng.int(others.length)];
    return { kind: "target", target: pick ?? "ghost" };
  },
};
