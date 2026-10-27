import { describe, expect, it } from "vitest";
import { SUMMARY_MAX_LENGTH } from "../summary.js";
import { summarizeKendim } from "./summary.js";

const players = [
  { id: "a", nickname: "Elif" },
  { id: "b", nickname: "Can" },
  { id: "c", nickname: "Mert" },
  { id: "d", nickname: "Deniz" },
];
const result = { miniScores: { a: 4, b: 1, c: 0 }, awards: { a: 2, b: 1, c: 0 } };

describe("kendim tur özeti", () => {
  it("cümle kurar (1)", () => {
    const line = summarizeKendim(result, players, {"reveal": {"scores": {"a": 1, "b": 4, "c": -1}}});
    expect(line).toBe("Can 4 puanla herkesi en iyi tanıdı");
    expect(Array.from(line ?? "").length).toBeLessThanOrEqual(SUMMARY_MAX_LENGTH);
  });
  it("cümle kurar (2)", () => {
    const line = summarizeKendim(result, players, undefined);
    expect(line).toBe("Elif 4 puanla herkesi en iyi tanıdı");
    expect(Array.from(line ?? "").length).toBeLessThanOrEqual(SUMMARY_MAX_LENGTH);
  });
});
