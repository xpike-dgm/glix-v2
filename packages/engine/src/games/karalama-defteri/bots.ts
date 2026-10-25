import type { ActionGenerator, GameBot } from "../../testing/simulate.js";
import { randomStroke } from "../drawing-bot.js";
import { KARALAMA_DURATION_MS } from "./types.js";

/** Çizim süresince darbe (arada geri al / temizle), oylamada bağlı başka bir oyuncuya oy. */
export const generate: ActionGenerator = (rng, playerId, publicView, _privateView, connected) => {
  const phase = (publicView as { phase?: unknown } | null)?.phase;
  if (rng.int(25) === 0) return { kind: "lock" };
  if (phase === "vote") {
    const targets = connected.filter((id) => id !== playerId);
    if (targets.length === 0) return { kind: "undo" };
    return { kind: "vote", target: targets[rng.int(targets.length)] as string };
  }
  const roll = rng.int(30);
  if (roll === 0) return { kind: "clear" };
  if (roll <= 3) return { kind: "undo" };
  return randomStroke(rng);
};

export const karalamaDefteriBot: GameBot = {
  durationMs: KARALAMA_DURATION_MS,
  burstJitterMs: [100, 700, 2_000],
  generate,
};
