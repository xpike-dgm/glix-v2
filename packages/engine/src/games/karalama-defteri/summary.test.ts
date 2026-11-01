import { describe, expect, it } from "vitest";
import { SUMMARY_MAX_LENGTH } from "../summary.js";
import { summarizeKaralamaDefteri } from "./summary.js";

const players = [
  { id: "a", nickname: "Elif" },
  { id: "b", nickname: "Can" },
  { id: "c", nickname: "Mert" },
  { id: "d", nickname: "Deniz" },
];
const result = { miniScores: { a: 4, b: 1, c: 0 }, awards: { a: 2, b: 1, c: 0 } };

describe("karalama-defteri tur özeti", () => {
  it("cümle kurar (1)", () => {
    const line = summarizeKaralamaDefteri(result, players, { reveal: { outsider: "c", caught: true } });
    expect(line).toBe("Mert bilgisizdi ve yakalandı");
    expect(Array.from(line ?? "").length).toBeLessThanOrEqual(SUMMARY_MAX_LENGTH);
  });
  it("cümle kurar (2)", () => {
    const line = summarizeKaralamaDefteri(result, players, { reveal: { outsider: "c", caught: false } });
    expect(line).toBe("Mert bilgisizdi, kimse anlamadı");
    expect(Array.from(line ?? "").length).toBeLessThanOrEqual(SUMMARY_MAX_LENGTH);
  });
  it("son şansta kelimeyi bildiyse söyler (KD-M1)", () => {
    const final = { mainWord: "elma", guess: "elma", guessed: true, scores: {} };
    expect(
      summarizeKaralamaDefteri(result, players, { reveal: { outsider: "c", caught: true, final } }),
    ).toBe("Mert yakalandı ama kelimeyi bildi");
    expect(
      summarizeKaralamaDefteri(result, players, { reveal: { outsider: "c", caught: false, final } }),
    ).toBe("Mert kurtuldu, kelimeyi de bildi");
  });
  it("veri yoksa ya da eksikse cümle kurmaz (3)", () => {
    expect(summarizeKaralamaDefteri(result, players, { reveal: null })).toBeNull();
  });
});
