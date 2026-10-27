import { describe, expect, it } from "vitest";
import { CB_COUNT, CB_SHAPES, cbIndex, cbIndexIn, cbShape } from "./cbShapes.js";

describe("renk körlüğü işaretleri", () => {
  it("sekiz oyuncu rengi kadar şekil var", () => {
    expect(CB_COUNT).toBe(8);
    expect(CB_SHAPES).toHaveLength(8);
  });

  it("her renk sırası ayrı bir şekle düşer (ad ve çizim yinelenmez)", () => {
    const names = new Set(CB_SHAPES.map((s) => s.name));
    const paths = new Set(CB_SHAPES.map((s) => s.path));
    expect(names.size).toBe(CB_COUNT);
    expect(paths.size).toBe(CB_COUNT);
    const seen = new Set<string>();
    for (let i = 0; i < CB_COUNT; i++) seen.add(cbShape(i).name);
    expect(seen.size).toBe(CB_COUNT);
  });

  it("sıra dışı sayılar sarılır, negatifler de", () => {
    expect(cbIndex(8)).toBe(0);
    expect(cbIndex(9)).toBe(1);
    expect(cbIndex(-1)).toBe(7);
    expect(cbShape(-1)).toBe(cbShape(7));
    expect(cbShape(3.9)).toBe(cbShape(3));
  });

  it("listedeki yerden sıra bulur, yoksa 0", () => {
    expect(cbIndexIn(["a", "b", "c"], "c")).toBe(2);
    expect(cbIndexIn(["a", "b", "c"], "z")).toBe(0);
  });

  it("zaman bombası tuşlarıyla aynı dört şekil: daire, kare, üçgen, yıldız", () => {
    expect([0, 1, 2, 3].map((i) => cbShape(i).name)).toEqual(["daire", "kare", "üçgen", "yıldız"]);
  });
});
