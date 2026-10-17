export interface Rng {
  /** [0, 1) aralığında sayı. */
  next(): number;
  /** [0, maxExclusive) aralığında tam sayı. */
  int(maxExclusive: number): number;
  /** Yeni karıştırılmış kopya döner. */
  shuffle<T>(items: readonly T[]): T[];
}

/** mulberry32 tohumlu rastgele sayı üreteci. */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (maxExclusive: number): number => Math.floor(next() * maxExclusive);
  const shuffle = <T>(items: readonly T[]): T[] => {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = int(i + 1);
      const a = out[i] as T;
      out[i] = out[j] as T;
      out[j] = a;
    }
    return out;
  };
  return { next, int, shuffle };
}
