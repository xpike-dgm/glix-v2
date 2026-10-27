import { describe, expect, it } from "vitest";
import { SUMMARY_MAX_LENGTH } from "../summary.js";
import { summarizeGizliKareler } from "./summary.js";

const players = [
  { id: "a", nickname: "Elif" },
  { id: "b", nickname: "Can" },
  { id: "c", nickname: "Mert" },
  { id: "d", nickname: "Deniz" },
];
const result = { miniScores: { a: 4, b: 1, c: 0 }, awards: { a: 2, b: 1, c: 0 } };

describe("gizli-kareler tur özeti", () => {
  it("cümle kurar (1)", () => {
    const line = summarizeGizliKareler(result, players, { points: { a: 2, b: 1, c: 0 } });
    expect(line).toBe("Elif 2 puanla karelerde önde");
    expect(Array.from(line ?? "").length).toBeLessThanOrEqual(SUMMARY_MAX_LENGTH);
  });
  it("cümle kurar (2)", () => {
    const line = summarizeGizliKareler(result, players, { points: { a: 0, b: 0 } });
    expect(line).toBe("Kimse tek başına kare tutamadı");
    expect(Array.from(line ?? "").length).toBeLessThanOrEqual(SUMMARY_MAX_LENGTH);
  });
  it("cümle kurar (3)", () => {
    const line = summarizeGizliKareler(result, players, undefined);
    expect(line).toBe("Elif 4 puanla karelerde önde");
    expect(Array.from(line ?? "").length).toBeLessThanOrEqual(SUMMARY_MAX_LENGTH);
  });
});
