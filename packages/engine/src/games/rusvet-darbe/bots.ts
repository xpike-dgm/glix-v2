import type { GameBot } from "../../testing/simulate.js";
import { RUSVET_MAX_DURATION_MS, SIGNS } from "./types.js";

interface PubLike {
  phase?: string;
  budget?: number | null;
  president?: string | null;
}

/** Aşamaya uygun eylem üretir; ara sıra geçersiz hedef (kendine, bilinmeyen) ya da sınır aşan dağıtım dener. */
export const rusvetDarbeBot: GameBot = {
  durationMs: RUSVET_MAX_DURATION_MS,
  burstJitterMs: [100, 1_000, 4_000],
  generate: (rng, playerId, publicView, _priv, connected) => {
    const pub = (publicView ?? {}) as PubLike;
    const others = connected.filter((id) => id !== playerId);
    const roll = rng.int(100);
    if (roll >= 94 && pub.phase !== "duel") return { kind: "lock" };
    if (pub.phase === "duel") {
      if (roll < 5) return { kind: "sign", sign: "kagit_" };
      return { kind: "sign", sign: SIGNS[rng.int(SIGNS.length)] };
    }
    if (pub.phase === "give") {
      if (roll < 8) return { kind: "give", tokens: [{ to: playerId, n: 1 }] };
      if (roll < 14) return { kind: "give", tokens: others.map((to) => ({ to, n: 2 })).slice(0, 8) };
      const budget = pub.budget ?? 0;
      const pool = rng.shuffle(others);
      const tokens: { to: string; n: number }[] = [];
      let left = rng.int(budget + 1);
      for (const to of pool) {
        if (left <= 0) break;
        const n = Math.min(left, 1 + rng.int(2));
        tokens.push({ to, n });
        left -= n;
      }
      return { kind: "give", tokens };
    }
    if (roll < 4) return { kind: "vote", target: playerId };
    if (roll < 7) return { kind: "vote", target: "ghost" };
    return { kind: "vote", target: others[rng.int(others.length)] ?? "ghost" };
  },
};
