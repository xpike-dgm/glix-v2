import type { Rng } from "../rng.js";
import { DRAW_COLORS, DRAW_GRID, DRAW_MAX_POINTS, type DrawPen, type DrawSize } from "./drawing.js";

export interface RandomStroke {
  kind: "stroke";
  color: DrawPen;
  size: DrawSize;
  points: number[];
}

/** Test botları için rastgele geçerli darbe (arada en az ve en çok nokta sınırları). */
export function randomStroke(rng: Rng): RandomStroke {
  const roll = rng.int(20);
  const count = roll === 0 ? 2 : roll === 1 ? DRAW_MAX_POINTS : 2 + rng.int(40);
  const points: number[] = [];
  let x = rng.int(DRAW_GRID + 1);
  let y = rng.int(DRAW_GRID + 1);
  for (let i = 0; i < count; i++) {
    points.push(x, y);
    x = Math.max(0, Math.min(DRAW_GRID, x + rng.int(61) - 30));
    y = Math.max(0, Math.min(DRAW_GRID, y + rng.int(61) - 30));
  }
  const pens: DrawPen[] = [...DRAW_COLORS, "eraser"];
  const size = (1 + rng.int(3)) as DrawSize;
  return { kind: "stroke", color: pens[rng.int(pens.length)] as DrawPen, size, points };
}
