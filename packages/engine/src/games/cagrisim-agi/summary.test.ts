import { describe, expect, it } from "vitest";
import { SUMMARY_MAX_LENGTH } from "../summary.js";
import { summarizeCagrisimAgi } from "./summary.js";

const players = [
  { id: "a", nickname: "Elif" },
  { id: "b", nickname: "Can" },
  { id: "c", nickname: "Mert" },
  { id: "d", nickname: "Deniz" },
];
const result = { miniScores: { a: 4, b: 1, c: 0 }, awards: { a: 2, b: 1, c: 0 } };

describe("cagrisim-agi tur özeti", () => {
  it("cümle kurar (1)", () => {
    const line = summarizeCagrisimAgi(result, players, {"reveal": {"groups": [{"text": "deniz", "members": ["a", "b", "c"], "points": 3}], "singles": [], "silent": []}});
    expect(line).toBe("“deniz” cevabında 3 kişi buluştu");
    expect(Array.from(line ?? "").length).toBeLessThanOrEqual(SUMMARY_MAX_LENGTH);
  });
  it("cümle kurar (2)", () => {
    const line = summarizeCagrisimAgi(result, players, {"reveal": {"groups": [], "singles": [], "silent": []}});
    expect(line).toBe("Kimse aynı cevabı vermedi");
    expect(Array.from(line ?? "").length).toBeLessThanOrEqual(SUMMARY_MAX_LENGTH);
  });
  it("veri yoksa ya da eksikse cümle kurmaz (3)", () => {
    expect(summarizeCagrisimAgi(result, players, {"reveal": null})).toBeNull();
  });
});
