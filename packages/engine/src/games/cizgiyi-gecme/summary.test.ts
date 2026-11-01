import { describe, expect, it } from "vitest";
import { SUMMARY_MAX_LENGTH } from "../summary.js";
import { summarizeCizgiyiGecme } from "./summary.js";

const players = [
  { id: "a", nickname: "Elif" },
  { id: "b", nickname: "Can" },
  { id: "c", nickname: "Mert" },
  { id: "d", nickname: "Deniz" },
];
const result = { miniScores: { a: 3, b: 1, c: 0 }, awards: { a: 2, b: 1, c: 0 } };
const round1 = { choices: { a: 50, b: 87 }, status: { a: "second", b: "first" }, points: { a: 1, b: 2 } };

describe("cizgiyi-gecme tur özeti", () => {
  it("cümle kurar (1): toplamda önde olan ve son turun en yüksek tek kalanı", () => {
    const line = summarizeCizgiyiGecme(result, players, {
      history: [round1],
      reveal: { choices: { a: 87, b: 40 }, status: { a: "first", b: "second" }, points: {} },
      totals: { a: 3, b: 3, c: 0 },
      final: { a: 1, b: 1, c: 0 },
    });
    expect(line).toBe("Elif ve Can iki turda 3 puanla önde · son tur Elif 87");
    expect(Array.from(line ?? "").length).toBeLessThanOrEqual(SUMMARY_MAX_LENGTH);
  });
  it("cümle kurar (2): kimse puan almadı", () => {
    const line = summarizeCizgiyiGecme(result, players, {
      history: [{ choices: { a: 50, b: 55 }, status: { a: "crashed", b: "crashed" } }],
      reveal: { choices: { a: 50, b: 55 }, status: { a: "crashed", b: "crashed" }, points: {} },
      totals: { a: 0, b: 0 },
      final: { a: 0, b: 0 },
    });
    expect(line).toBe("Herkes çarpıştı; kimse puan alamadı");
    expect(Array.from(line ?? "").length).toBeLessThanOrEqual(SUMMARY_MAX_LENGTH);
  });
  it("veri yoksa ya da oyun bitmediyse cümle kurmaz (3)", () => {
    expect(summarizeCizgiyiGecme(result, players, { reveal: null, final: null })).toBeNull();
    expect(summarizeCizgiyiGecme(result, players, {})).toBeNull();
  });
});
