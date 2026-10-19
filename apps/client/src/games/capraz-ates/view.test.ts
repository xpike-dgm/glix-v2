import { describe, expect, it } from "vitest";
import { gridColumns, outcomeOf, parseCaprazAtesView, ringPosition, tracersOf } from "./view.js";

const reveal = {
  targets: { a: "b", b: "a", c: "a", d: null },
  scores: { a: 0, b: 0, c: 1, d: 0 },
  mutual: [["a", "b"]],
};
const pub = { startedAt: 100, endsAt: 25_100, finishAt: 32_100, reveal: null, lockedIds: ["a"] };
const priv = { myTarget: null, locked: false };

describe("Çapraz Ateş görünümü", () => {
  it("süre bitmeden görünümü okur", () => {
    const v = parseCaprazAtesView(pub, { myTarget: "b", locked: true });
    expect(v?.reveal).toBeNull();
    expect(v?.myTarget).toBe("b");
    expect(v?.locked).toBe(true);
    expect(v?.lockedIds).toEqual(["a"]);
  });
  it("açılmış görünümü okur", () => {
    const v = parseCaprazAtesView({ ...pub, reveal }, priv);
    expect(v?.reveal?.scores.c).toBe(1);
    expect(v?.reveal?.mutual).toEqual([["a", "b"]]);
  });
  it("reveal alanı yoksa kapalı sayılır", () => {
    const { reveal: _drop, ...rest } = pub;
    expect(parseCaprazAtesView(rest, priv)?.reveal).toBeNull();
  });
  it("kilit alanları eksik ya da bozuksa reddeder", () => {
    const { lockedIds: _drop, ...rest } = pub;
    expect(parseCaprazAtesView(rest, priv)).toBeNull();
    expect(parseCaprazAtesView({ ...pub, lockedIds: [1] }, priv)).toBeNull();
    expect(parseCaprazAtesView(pub, { myTarget: null })).toBeNull();
  });
  it("bozuk görünümü reddeder", () => {
    expect(parseCaprazAtesView(null, priv)).toBeNull();
    expect(parseCaprazAtesView(pub, null)).toBeNull();
    expect(parseCaprazAtesView({ ...pub, endsAt: "x" }, priv)).toBeNull();
    expect(parseCaprazAtesView(pub, { myTarget: 3 })).toBeNull();
    expect(parseCaprazAtesView({ ...pub, reveal: { ...reveal, scores: { a: "x" } } }, priv)).toBeNull();
    expect(parseCaprazAtesView({ ...pub, reveal: { ...reveal, mutual: [["a"]] } }, priv)).toBeNull();
    expect(parseCaprazAtesView({ ...pub, reveal: { ...reveal, targets: { a: 5 } } }, priv)).toBeNull();
  });
  it("izleyicide myTarget null", () => {
    expect(parseCaprazAtesView(pub, priv)?.myTarget).toBeNull();
  });
});

describe("Çapraz Ateş izleri", () => {
  const parsed = parseCaprazAtesView({ ...pub, reveal }, priv)?.reveal;
  if (!parsed) throw new Error("reveal okunamadı");
  const order = ["a", "b", "c", "d"];

  it("hedefi olan herkes için iz üretir, karşılıklıları işaretler", () => {
    expect(tracersOf(parsed, order)).toEqual([
      { from: "a", to: "b", mutual: true },
      { from: "b", to: "a", mutual: true },
      { from: "c", to: "a", mutual: false },
    ]);
  });
  it("bilinmeyen ya da kendine olan hedefi atar", () => {
    const odd = { ...parsed, targets: { a: "zzz", b: "b", c: "a", d: null } };
    expect(tracersOf(odd, order)).toEqual([{ from: "c", to: "a", mutual: false }]);
  });
  it("sonuç türleri", () => {
    expect(outcomeOf(parsed, "a")).toBe("clash");
    expect(outcomeOf(parsed, "c")).toBe("free");
    expect(outcomeOf(parsed, "d")).toBe("idle");
    expect(outcomeOf({ ...parsed, scores: { ...parsed.scores, d: -1 } }, "d")).toBe("hit");
  });
  it("daire yerleşimi: ilk oyuncu üstte", () => {
    const p = ringPosition(0, 4);
    expect(p.x).toBeCloseTo(50);
    expect(p.y).toBeLessThan(50);
    expect(ringPosition(1, 4).x).toBeGreaterThan(50);
  });
  it("sütun sayısı", () => {
    expect([2, 3, 4, 5, 6, 7].map((n) => gridColumns(n))).toEqual([2, 2, 2, 3, 3, 3]);
    expect(gridColumns(7, true)).toBe(4);
  });
});
