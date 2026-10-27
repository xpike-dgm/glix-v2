import { describe, expect, it } from "vitest";
import { maxWindowIndex, newWindows, parseButonaBasView, roundClockAt, windowKey } from "./view.js";

const pub = {
  startedAt: 100,
  endsAt: 51_100,
  round: 1,
  rounds: 3,
  phase: "play",
  windowMs: 300,
  phaseEndsAt: 15_100,
  scores: { a: 2, b: -1 },
  recent: [
    { round: 0, index: 4, pressers: ["a", "b"], outcome: "match" },
    { round: 0, index: 6, pressers: ["b"], outcome: "solo" },
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
      parseButonaBasView({ ...pub, recent: [{ round: 0, index: 1, pressers: [], outcome: "x" }] }, priv),
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
  it("pencere anahtarı turlar arasında artar (2. turun 0. penceresi 1. turun sonuncusundan yenidir)", () => {
    const w = (round: number, index: number) => ({ round, index, pressers: ["a"], outcome: "solo" as const });
    expect(windowKey(w(1, 0))).toBeGreaterThan(windowKey(w(0, 49)));
    expect(newWindows([w(0, 49), w(1, 0)], windowKey(w(0, 49))).map((x) => x.round)).toEqual([1]);
  });
  it("tur ve evre bilgisi yerel saatten türetilir (3 tur, 2 ara)", () => {
    const at = (t: number) => roundClockAt(1_000, 52_000, 1_000 + t);
    expect(at(0)).toMatchObject({ round: 0, phase: "play", windowMs: 300, phaseEndsAt: 16_000 });
    expect(at(14_999)).toMatchObject({ round: 0, phase: "play" });
    expect(at(15_000)).toMatchObject({
      round: 1,
      phase: "gap",
      windowMs: 200,
      phaseStartsAt: 16_000,
      phaseEndsAt: 19_000,
    });
    expect(at(18_000)).toMatchObject({ round: 1, phase: "play", windowMs: 200, phaseEndsAt: 34_000 });
    expect(at(33_000)).toMatchObject({ round: 2, phase: "gap", windowMs: 120 });
    expect(at(36_000)).toMatchObject({ round: 2, phase: "play", windowMs: 120, phaseEndsAt: 52_000 });
    expect(at(51_000)).toMatchObject({ round: 2, phase: "over" });
  });
  it("tur alanı eksik ya da evre bozuksa görünümü reddeder", () => {
    const { round: _r, ...noRound } = pub;
    expect(parseButonaBasView(noRound, priv)).toBeNull();
    expect(parseButonaBasView({ ...pub, phase: "x" }, priv)).toBeNull();
  });
});
