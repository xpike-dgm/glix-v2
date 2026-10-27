import { describe, expect, it } from "vitest";
import { SUMMARY_MAX_LENGTH } from "../summary.js";
import { summarizeIttifak } from "./summary.js";

const players = [
  { id: "a", nickname: "Elif" },
  { id: "b", nickname: "Can" },
  { id: "c", nickname: "Mert" },
  { id: "d", nickname: "Deniz" },
];
const result = { miniScores: { a: 4, b: 1, c: 0 }, awards: { a: 2, b: 1, c: 0 } };

describe("ittifak tur özeti", () => {
  it("cümle kurar (1)", () => {
    const line = summarizeIttifak(result, players, { reveal: { votes: {}, scores: { a: 1, b: 3, c: 0 } } });
    expect(line).toBe("Can 3 oyla en çok seçilen oldu");
    expect(Array.from(line ?? "").length).toBeLessThanOrEqual(SUMMARY_MAX_LENGTH);
  });
  it("cümle kurar (2)", () => {
    const line = summarizeIttifak(result, players, { reveal: { votes: {}, scores: { a: 2, b: 2, c: 0 } } });
    expect(line).toBe("Elif ve Can 2 oyla oyları paylaştı");
    expect(Array.from(line ?? "").length).toBeLessThanOrEqual(SUMMARY_MAX_LENGTH);
  });
});
