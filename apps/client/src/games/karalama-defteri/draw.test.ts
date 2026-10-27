import { describe, expect, it } from "vitest";
import { simplify, strokesUpTo, toGrid, toStrokeChunks } from "./draw.js";
import { parseStroke } from "./view.js";

describe("çizim yardımcıları", () => {
  it("ekran koordinatı 0..1000 tam sayıya sıkışır", () => {
    expect(toGrid(150, 100, 200)).toBe(250);
    expect(toGrid(50, 100, 200)).toBe(0);
    expect(toGrid(900, 100, 200)).toBe(1000);
    expect(toGrid(10, 0, 0)).toBe(0);
    expect(Number.isInteger(toGrid(133.3, 10, 333))).toBe(true);
  });

  it("sadeleştirme düz çizgideki ara noktaları atar, köşeyi korur", () => {
    expect(simplify([0, 0, 10, 0, 20, 0, 30, 0], 1.6)).toEqual([0, 0, 30, 0]);
    expect(simplify([0, 0, 50, 0, 50, 50], 1.6)).toEqual([0, 0, 50, 0, 50, 50]);
    expect(simplify([5, 5], 1.6)).toEqual([5, 5]);
  });

  it("tek nokta iki kez yazılan nokta olur", () => {
    expect(toStrokeChunks([7, 9])).toEqual([[7, 9, 7, 9]]);
    expect(toStrokeChunks([])).toEqual([]);
  });

  it("120 noktadan uzun çizgi, paylaşılan uç noktayla en çok 120'lik parçalara bölünür", () => {
    const pts = Array.from({ length: 300 }, (_, i) => [i % 1000, (i * 3) % 1000]).flat();
    const chunks = toStrokeChunks(pts);
    expect(chunks.length).toBeGreaterThan(2);
    for (const c of chunks) {
      expect(c.length / 2).toBeLessThanOrEqual(120);
      expect(c.length / 2).toBeGreaterThanOrEqual(2);
    }
    for (let i = 1; i < chunks.length; i++) {
      const prev = chunks[i - 1] as number[];
      expect((chunks[i] as number[]).slice(0, 2)).toEqual(prev.slice(-2));
    }
    expect(chunks.at(-1)?.slice(-2)).toEqual(pts.slice(-2));
  });

  it("bölünen darbeler sunucunun kabul ettiği biçimde: sıkıştırılınca geçerli darbe", () => {
    const chunks = toStrokeChunks(Array.from({ length: 250 }, (_, i) => i % 1001));
    for (const c of chunks) expect(parseStroke([0, 2, ...c])).not.toBeNull();
  });
});

describe("çizim tekrarı", () => {
  const a = [0, 1, 0, 0, 10, 10, 20, 20, 30, 30];
  const b = [2, 2, 5, 5, 6, 6];
  it("kesir 0 boş, 1 tüm darbeler", () => {
    expect(strokesUpTo([a, b], 0)).toEqual([]);
    expect(strokesUpTo([a, b], 1)).toEqual([a, b]);
  });
  it("yarım kalan darbe kısalır ve en az iki nokta taşır", () => {
    // 4 + 2 = 6 nokta; %50 -> ilk 3 nokta
    expect(strokesUpTo([a, b], 0.5)).toEqual([[0, 1, 0, 0, 10, 10, 20, 20]]);
    expect(strokesUpTo([a, b], 0.01)).toEqual([[0, 1, 0, 0, 10, 10]]);
    expect(strokesUpTo([a, b], 0.9)).toEqual([a, b]);
  });
});
