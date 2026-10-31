import type { ParsedRecap, ParsedStep } from "./view.js";

/** Sağlam zincirin karşılaştırılan iki cümlesi: ilk cümle ve son yazı adımı. */
export function robustPair(steps: readonly ParsedStep[]): [string, string] | null {
  const first = steps[0];
  if (first?.kind !== "write") return null;
  for (let i = steps.length - 1; i > 0; i--) {
    const s = steps[i];
    if (s?.kind === "write") return [first.text, s.text];
  }
  return null;
}

/** Galerideki kart: zincirin taçlı adımı; taç yoksa ilk cümle. */
export function galleryPick(recap: ParsedRecap): number {
  return recap.crowned[0] ?? 0;
}

const GAP = 24;

/** Kare hücrelerin en büyük çıktığı sütun düzeni (oylama/sonuç ızgarası). */
export function cellLayout(count: number, w: number, h: number): { cols: number; cell: number } {
  let best = { cols: 1, cell: 0 };
  if (count <= 0 || w <= 0 || h <= 0) return best;
  for (let cols = 1; cols <= count; cols++) {
    const rows = Math.ceil(count / cols);
    const cell = Math.floor(Math.min((w - (cols - 1) * GAP) / cols, (h - (rows - 1) * GAP) / rows));
    if (cell > best.cell) best = { cols, cell };
  }
  return { ...best, cell: Math.max(0, best.cell) };
}
