import { describe, expect, it } from "vitest";
import { maxWindowIndex, newWindows, parseButonaBasView } from "./view.js";

const view = {
  startedAt: 100,
  endsAt: 45_100,
  windowMs: 300,
  myScore: 2,
  scores: { a: 2, b: -1 },
  pressedThisWindow: false,
  recent: [
    { index: 4, pressers: ["a", "b"], outcome: "match" },
    { index: 6, pressers: ["b"], outcome: "solo" },
  ],
};

describe("Butona Bas görünümü", () => {
  it("geçerli görünümü okur", () => {
    expect(parseButonaBasView(view)?.recent).toHaveLength(2);
  });
  it("izleyicide myScore null olabilir", () => {
    expect(parseButonaBasView({ ...view, myScore: null })?.myScore).toBeNull();
  });
  it("bozuk görünümü reddeder", () => {
    expect(parseButonaBasView(null)).toBeNull();
    expect(parseButonaBasView({ ...view, scores: { a: "x" } })).toBeNull();
    expect(parseButonaBasView({ ...view, recent: [{ index: 1, pressers: [], outcome: "x" }] })).toBeNull();
  });
  it("yalnız yeni pencereleri verir; ilk görünümde hiçbiri tepki üretmez", () => {
    const v = parseButonaBasView(view);
    if (!v) throw new Error("görünüm okunamadı");
    expect(newWindows(v.recent, null)).toEqual([]);
    expect(newWindows(v.recent, 4).map((w) => w.index)).toEqual([6]);
    expect(newWindows(v.recent, 6)).toEqual([]);
    expect(maxWindowIndex(v.recent, null)).toBe(6);
    expect(maxWindowIndex([], 3)).toBe(3);
  });
});
