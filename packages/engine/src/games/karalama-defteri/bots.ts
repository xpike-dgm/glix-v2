import type { Rng } from "../../rng.js";
import type { ActionGenerator, GameBot } from "../../testing/simulate.js";
import {
  KARALAMA_COLORS,
  KARALAMA_DURATION_MS,
  KARALAMA_GRID,
  KARALAMA_MAX_POINTS,
  type KaralamaAction,
  type KaralamaPen,
} from "./types.js";

function randomStroke(rng: Rng): KaralamaAction {
  const roll = rng.int(20);
  // Bazen sınır uzunluklar: en az ve en çok nokta.
  const count = roll === 0 ? 2 : roll === 1 ? KARALAMA_MAX_POINTS : 2 + rng.int(40);
  const points: number[] = [];
  let x = rng.int(KARALAMA_GRID + 1);
  let y = rng.int(KARALAMA_GRID + 1);
  for (let i = 0; i < count; i++) {
    points.push(x, y);
    x = Math.max(0, Math.min(KARALAMA_GRID, x + rng.int(61) - 30));
    y = Math.max(0, Math.min(KARALAMA_GRID, y + rng.int(61) - 30));
  }
  const pens: KaralamaPen[] = [...KARALAMA_COLORS, "eraser"];
  const size = (1 + rng.int(3)) as 1 | 2 | 3;
  return { kind: "stroke", color: pens[rng.int(pens.length)] as KaralamaPen, size, points };
}

/** Çizim süresince darbe (arada geri al / temizle), oylamada bağlı başka bir oyuncuya oy. */
export const generate: ActionGenerator = (rng, playerId, publicView, _privateView, connected) => {
  const phase = (publicView as { phase?: unknown } | null)?.phase;
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
