import { describe, expect, it } from "vitest";
import { maxWindowIndex, newWindows, parseButonaBasView } from "./view.js";

const pub = {
  startedAt: 100,
  endsAt: 45_100,
  windowMs: 300,
  scores: { a: 2, b: -1 },
  recent: [
    { index: 4, pressers: ["a", "b"], outcome: "match" },
    { index: 6, pressers: ["b"], outcome: "solo" },
  ],
};
const priv = { myScore: 2, pressedThisWindow: false };

describe("Butona Bas görünümü", () => {
  it("geçerli görünümleri birleştirir", () => {
    const v = parseButonaBasView(pub, priv);
    expect(v?.recent).toHaveLength(2);
    expect(v?.myScore).toBe(2);
    expect(v?.scores).toEqual({ a: 2, b: -1 });
  });
  it("izleyicide myScore null olabilir", () => {
    expect(parseButonaBasView(pub, { ...priv, myScore: null })?.myScore).toBeNull();
  });
  it("bozuk görünümü reddeder", () => {
    expect(parseButonaBasView(null, priv)).toBeNull();
    expect(parseButonaBasView(pub, null)).toBeNull();
    expect(parseButonaBasView({ ...pub, scores: { a: "x" } }, priv)).toBeNull();
    expect(
      parseButonaBasView({ ...pub, recent: [{ index: 1, pressers: [], outcome: "x" }] }, priv),
    ).toBeNull();
    expect(parseButonaBasView(pub, { ...priv, pressedThisWindow: 1 })).toBeNull();
  });
  it("yalnız yeni pencereleri verir; ilk görünümde hiçbiri tepki üretmez", () => {
    const v = parseButonaBasView(pub, priv);
    if (!v) throw new Error("görünüm okunamadı");
    expect(newWindows(v.recent, null)).toEqual([]);
    expect(newWindows(v.recent, 4).map((w) => w.index)).toEqual([6]);
    expect(newWindows(v.recent, 6)).toEqual([]);
    expect(maxWindowIndex(v.recent, null)).toBe(6);
    expect(maxWindowIndex([], 3)).toBe(3);
  });
});
