import type { GameBot } from "../../testing/simulate.js";
import { SIZMA_MAX_DURATION_MS } from "./types.js";

type Pub = { phase?: unknown; turn?: unknown; runoff?: unknown } | null;

/** Çoğunlukla geçerli söyledim/geçiş/oy/kilit/cevap/tahmin üretir; ara sıra geçersiz hamle dener (reddedilir). */
export const sizmaBot: GameBot = {
  durationMs: SIZMA_MAX_DURATION_MS,
  burstJitterMs: [100, 1_000, 6_000],
  generate: (rng, playerId, pub, priv, connected) => {
    const p = pub as Pub;
    const roll = rng.int(100);
    if (p?.phase === "notice") return { kind: "notice", yes: rng.int(2) === 0 };
    if (p?.phase === "guess") return { kind: "guess", text: rng.int(2) === 0 ? "çay" : "kahve" };
    if (p?.phase === "clue") {
      if (roll < 60) return { kind: "said", turn: typeof p.turn === "number" ? p.turn : 0 };
      if (roll < 80) return { kind: "skip" };
    }
    if (roll < 10) return { kind: "lock" };
    if (roll < 14) return { kind: "vote", target: "ghost" };
    const myVote = (priv as { myVote?: string | null } | null)?.myVote;
    if (roll < 30 && typeof myVote === "string") return { kind: "lock" };
    const candidates = Array.isArray(p?.runoff) ? (p.runoff as string[]) : null;
    const pool = candidates ?? (rng.int(4) === 0 ? [playerId] : connected);
    const pick = pool[rng.int(pool.length)];
    return { kind: "vote", target: pick ?? "ghost" };
  },
};
