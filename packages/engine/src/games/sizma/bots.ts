import type { GameBot } from "../../testing/simulate.js";
import { SIZMA_MAX_DURATION_MS } from "./types.js";

/** Çoğunlukla geçerli geçiş/oy/Tamam üretir; ara sıra bilinmeyen birine oy dener (reddedilir). */
export const sizmaBot: GameBot = {
  durationMs: SIZMA_MAX_DURATION_MS,
  burstJitterMs: [100, 1_000, 6_000],
  generate: (rng, playerId, pub, priv, connected) => {
    const roll = rng.int(100);
    if ((pub as { phase?: unknown } | null)?.phase === "notice")
      return { kind: "notice", yes: rng.int(2) === 0 };
    if (roll < 30) return { kind: "skip" };
    if (roll < 40) return { kind: "lock" };
    if (roll < 44) return { kind: "vote", target: "ghost" };
    const myVote = (priv as { myVote?: string | null } | null)?.myVote;
    if (roll < 52 && typeof myVote === "string") return { kind: "lock" };
    const pool = rng.int(4) === 0 ? [playerId] : connected;
    const pick = pool[rng.int(pool.length)];
    return { kind: "vote", target: pick ?? "ghost" };
  },
};
