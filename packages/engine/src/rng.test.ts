import { describe, expect, it } from "vitest";
import { createRng } from "./rng.js";

describe("createRng", () => {
  it("aynı tohum aynı diziyi üretir", () => {
    const a = createRng(42);
    const b = createRng(42);
    expect(Array.from({ length: 10 }, () => a.next())).toEqual(Array.from({ length: 10 }, () => b.next()));
  });
  it("farklı tohum farklı dizi üretir", () => {
    expect(createRng(1).next()).not.toBe(createRng(2).next());
  });
  it("değerler [0,1) aralığındadır", () => {
    const r = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
  it("shuffle deterministik ve permütasyondur", () => {
    const items = [1, 2, 3, 4, 5, 6];
    const s1 = createRng(9).shuffle(items);
    expect(s1).toEqual(createRng(9).shuffle(items));
    expect([...s1].sort()).toEqual(items);
    expect(items).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
