import { describe, expect, it } from "vitest";
import { canPredict, myPrediction, myResult, parseKorBombaPrivateView, parseKorBombaView } from "./view.js";

const pub = {
  startedAt: 1,
  holder: "a",
  passes: 2,
  lastPass: null,
  exploded: false,
  explodedAt: null,
  correctPredictors: [],
};
const watcher = {
  role: "watcher",
  explodeAt: 99,
  lastBonusMs: null,
  prediction: { turn: 2, explodes: true },
  lastResult: { turn: 1, correct: false },
};

describe("kor-bomba tahmin görünümü", () => {
  it("tahmin ve sonucu doğrular", () => {
    const v = parseKorBombaView(pub, watcher);
    expect(v).not.toBeNull();
    if (!v) return;
    expect(myPrediction(v)).toBe(true);
    expect(myResult(v)).toEqual({ turn: 1, correct: false });
  });
  it("eski elin tahmini bu elde sayılmaz", () => {
    const v = parseKorBombaView({ ...pub, passes: 3 }, watcher);
    expect(v && myPrediction(v)).toBeNull();
  });
  it("tahmin satırı yalnız taşıyıcı olmayan katılımcıya", () => {
    const v = parseKorBombaView(pub, watcher);
    if (!v) throw new Error("görünüm");
    expect(canPredict(v, "b", false)).toBe(true);
    expect(canPredict(v, "a", false)).toBe(false);
    expect(canPredict(v, "b", true)).toBe(false);
    expect(canPredict({ ...v, pub: { ...v.pub, exploded: true } }, "b", false)).toBe(false);
    const h = parseKorBombaView(pub, { role: "holder", lastResult: null });
    expect(h && canPredict(h, "b", false)).toBe(false);
  });
  it("bozuk tahmin alanı reddedilir", () => {
    expect(parseKorBombaPrivateView({ ...watcher, prediction: { turn: "x", explodes: true } })).toBeNull();
    expect(parseKorBombaPrivateView({ role: "holder", lastResult: { turn: 1 } })).toBeNull();
  });
});
