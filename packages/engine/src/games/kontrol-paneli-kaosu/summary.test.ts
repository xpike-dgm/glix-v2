import { describe, expect, it } from "vitest";
import { SUMMARY_MAX_LENGTH } from "../summary.js";
import { summarizeKontrolPaneliKaosu } from "./summary.js";

const players = [
  { id: "a", nickname: "Elif" },
  { id: "b", nickname: "Can" },
  { id: "c", nickname: "Mert" },
  { id: "d", nickname: "Deniz" },
];
const result = { miniScores: { a: 2, b: 1, c: 0 }, awards: { a: 2, b: 1, c: 0 } };
const wave = (a: boolean, b: boolean, c: boolean) => ({
  rows: { a: { correct: a }, b: { correct: b }, c: { correct: c } },
  scores: {},
});

describe("kontrol-paneli-kaosu tur özeti", () => {
  it("cümle kurar (1)", () => {
    const line = summarizeKontrolPaneliKaosu(result, players, {
      results: [wave(true, false, true), wave(true, true, true), wave(false, false, false)],
    });
    expect(line).toBe("3 dalgada 9 panelin 5 tanesi doğru kesildi");
    expect(Array.from(line ?? "").length).toBeLessThanOrEqual(SUMMARY_MAX_LENGTH);
  });
  it("veri yoksa ya da eksikse cümle kurmaz (2)", () => {
    expect(summarizeKontrolPaneliKaosu(result, players, { results: [] })).toBeNull();
    expect(summarizeKontrolPaneliKaosu(result, players, { reveal: null })).toBeNull();
  });
});
