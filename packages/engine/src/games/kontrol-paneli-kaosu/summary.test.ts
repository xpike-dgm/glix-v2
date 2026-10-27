import { describe, expect, it } from "vitest";
import { SUMMARY_MAX_LENGTH } from "../summary.js";
import { summarizeKontrolPaneliKaosu } from "./summary.js";

const players = [
  { id: "a", nickname: "Elif" },
  { id: "b", nickname: "Can" },
  { id: "c", nickname: "Mert" },
  { id: "d", nickname: "Deniz" },
];
const result = { miniScores: { a: 4, b: 1, c: 0 }, awards: { a: 2, b: 1, c: 0 } };

describe("kontrol-paneli-kaosu tur özeti", () => {
  it("cümle kurar (1)", () => {
    const line = summarizeKontrolPaneliKaosu(result, players, {
      reveal: { rows: { a: { correct: true }, b: { correct: false }, c: { correct: true } }, scores: {} },
    });
    expect(line).toBe("3 panelin 2 tanesi doğru kesildi");
    expect(Array.from(line ?? "").length).toBeLessThanOrEqual(SUMMARY_MAX_LENGTH);
  });
  it("veri yoksa ya da eksikse cümle kurmaz (2)", () => {
    expect(summarizeKontrolPaneliKaosu(result, players, { reveal: null })).toBeNull();
  });
});
