import { describe, expect, it } from "vitest";
import { SUMMARY_MAX_LENGTH } from "../summary.js";
import { summarizeAsiriYukleme } from "./summary.js";

const players = [
  { id: "a", nickname: "Elif" },
  { id: "b", nickname: "Can" },
  { id: "c", nickname: "Mert" },
  { id: "d", nickname: "Deniz" },
];
const result = { miniScores: { a: 4, b: 1, c: 0 }, awards: { a: 2, b: 1, c: 0 } };

describe("asiri-yukleme tur özeti", () => {
  it("cümle kurar (1)", () => {
    const line = summarizeAsiriYukleme(result, players, {
      reveal: { total: 101, exploder: "b", clicks: {}, points: {} },
    });
    expect(line).toBe("Can barı patlattı");
    expect(Array.from(line ?? "").length).toBeLessThanOrEqual(SUMMARY_MAX_LENGTH);
  });
  it("cümle kurar (2)", () => {
    const line = summarizeAsiriYukleme(result, players, {
      reveal: { total: 100, exploder: null, clicks: {}, points: {} },
    });
    expect(line).toBe("Bar patlamadan 100'e ulaştı");
    expect(Array.from(line ?? "").length).toBeLessThanOrEqual(SUMMARY_MAX_LENGTH);
  });
  it("cümle kurar (3)", () => {
    const line = summarizeAsiriYukleme(result, players, {
      reveal: { total: 60, exploder: null, clicks: {}, points: {} },
    });
    expect(line).toBe("Bar dolmadan süre bitti");
    expect(Array.from(line ?? "").length).toBeLessThanOrEqual(SUMMARY_MAX_LENGTH);
  });
  it("veri yoksa ya da eksikse cümle kurmaz (4)", () => {
    expect(summarizeAsiriYukleme(result, players, { reveal: null })).toBeNull();
  });
});
