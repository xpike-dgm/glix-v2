import type { Rng } from "../../rng.js";
import { BORSA_MAX_VALUE, type BorsaHint } from "./types.js";

/** Bir ipucunun gerçek değer için doğru olup olmadığı (lanetli: değer −20). */
export function hintHolds(hint: BorsaHint, value: number): boolean {
  const cursed = value < 0;
  const mod = (n: number): number => ((value % n) + n) % n;
  switch (hint.kind) {
    case "gt":
      return value > hint.n;
    case "lt":
      return value < hint.n;
    case "between":
      return value >= hint.lo && value <= hint.hi;
    case "even":
      return mod(2) === 0;
    case "odd":
      return mod(2) === 1;
    case "multiple":
      return mod(hint.n) === 0;
    case "notMultiple":
      return mod(hint.n) !== 0;
    case "cursed":
      return cursed;
    case "notCursed":
      return !cursed;
  }
}

const signature = (h: BorsaHint): string => JSON.stringify(h);

/** Gerçek değer için doğru olan bütün aday ipuçları (rastgele eşikler `rng` ile). */
function candidates(value: number, rng: Rng): BorsaHint[] {
  const out: BorsaHint[] = [];
  const cursed = value < 0;
  const mod = (n: number): number => ((value % n) + n) % n;
  if (cursed) {
    out.push({ kind: "cursed" }, { kind: "cursed" });
    out.push({ kind: "lt", n: 1 + rng.int(40) });
    out.push({ kind: "lt", n: 1 + rng.int(40) });
  } else {
    out.push({ kind: "notCursed" });
    if (value >= 1) {
      out.push({ kind: "gt", n: Math.max(0, value - 1 - rng.int(25)) });
      out.push({ kind: "gt", n: Math.max(0, value - 1 - rng.int(25)) });
    }
    if (value < BORSA_MAX_VALUE) {
      const n = Math.min(BORSA_MAX_VALUE, value + 1 + rng.int(25));
      out.push({ kind: "lt", n });
      out.push({ kind: "lt", n: Math.min(BORSA_MAX_VALUE, value + 1 + rng.int(25)) });
    }
    const lo = Math.max(0, value - (3 + rng.int(12)));
    const hi = Math.min(BORSA_MAX_VALUE, value + (3 + rng.int(12)));
    out.push({ kind: "between", lo, hi });
  }
  out.push({ kind: mod(2) === 0 ? "even" : "odd" });
  for (const n of [3, 5, 10]) {
    out.push(mod(n) === 0 ? { kind: "multiple", n } : { kind: "notMultiple", n });
  }
  return out.filter((h) => hintHolds(h, value));
}

/**
 * Her oyuncu için, gerçek değere göre her zaman doğru bir ipucu üretir. Mümkün olduğunca farklı oyunculara farklı
 * ipuçları verilir (aynı ipucu yalnız seçenek kalmadığında tekrarlanır).
 */
export function makeHints(value: number, players: readonly string[], rng: Rng): Record<string, BorsaHint> {
  const used = new Set<string>();
  const hints: Record<string, BorsaHint> = {};
  for (const id of players) {
    const pool = candidates(value, rng);
    let pick = pool[rng.int(pool.length)] as BorsaHint;
    for (let i = 0; i < 6 && used.has(signature(pick)); i++) pick = pool[rng.int(pool.length)] as BorsaHint;
    used.add(signature(pick));
    hints[id] = pick;
  }
  return hints;
}
