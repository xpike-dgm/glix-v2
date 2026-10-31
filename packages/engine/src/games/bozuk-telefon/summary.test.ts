import { describe, expect, it } from "vitest";
import { SUMMARY_MAX_LENGTH } from "../summary.js";
import { summarizeBozukTelefon } from "./summary.js";

const players = [
  { id: "a", nickname: "Elif" },
  { id: "b", nickname: "Can" },
  { id: "c", nickname: "Mert" },
  { id: "d", nickname: "Deniz" },
];
const result = { miniScores: { a: 4, b: 1, c: 0 }, awards: { a: 2, b: 1, c: 0 } };

describe("bozuk-telefon tur özeti", () => {
  it("cümle kurar (1)", () => {
    const line = summarizeBozukTelefon(result, players, { scores: { a: 3, b: 1, c: 0 } });
    expect(line).toBe("Elif 3 kahkahayla en komik zincirlerin sahibi");
    expect(Array.from(line ?? "").length).toBeLessThanOrEqual(SUMMARY_MAX_LENGTH);
  });
  it("cümle kurar (2)", () => {
    const line = summarizeBozukTelefon(result, players, { scores: { a: 2, b: 2, c: 0 } });
    expect(line).toBe("Elif ve Can 2 kahkahayla zincir oylarını paylaştı");
    expect(Array.from(line ?? "").length).toBeLessThanOrEqual(SUMMARY_MAX_LENGTH);
  });
  it("cümle kurar (3)", () => {
    const line = summarizeBozukTelefon(result, players, { scores: null });
    expect(line).toBe("Elif 4 kahkahayla en komik zincirlerin sahibi");
    expect(Array.from(line ?? "").length).toBeLessThanOrEqual(SUMMARY_MAX_LENGTH);
  });
  it("veri yoksa ya da eksikse cümle kurmaz (4)", () => {
    expect(summarizeBozukTelefon(result, players, { scores: { a: 0 } })).toBeNull();
  });
});
