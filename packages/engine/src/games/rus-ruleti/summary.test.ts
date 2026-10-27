import { describe, expect, it } from "vitest";
import { SUMMARY_MAX_LENGTH } from "../summary.js";
import { summarizeRusRuleti } from "./summary.js";

const players = [
  { id: "a", nickname: "Elif" },
  { id: "b", nickname: "Can" },
  { id: "c", nickname: "Mert" },
  { id: "d", nickname: "Deniz" },
];
const result = { miniScores: { a: 4, b: 1, c: 0 }, awards: { a: 2, b: 1, c: 0 } };

describe("rus-ruleti tur özeti", () => {
  it("cümle kurar (1)", () => {
    const line = summarizeRusRuleti(result, players, {"result": {"survivors": ["a"], "eliminated": ["b", "c"]}});
    expect(line).toBe("Elif son hayatta kalan oldu");
    expect(Array.from(line ?? "").length).toBeLessThanOrEqual(SUMMARY_MAX_LENGTH);
  });
  it("cümle kurar (2)", () => {
    const line = summarizeRusRuleti(result, players, {"result": {"survivors": ["a", "b"], "eliminated": ["c"]}});
    expect(line).toBe("1 kişi elendi, 2 kişi kurtuldu");
    expect(Array.from(line ?? "").length).toBeLessThanOrEqual(SUMMARY_MAX_LENGTH);
  });
  it("cümle kurar (3)", () => {
    const line = summarizeRusRuleti(result, players, {"result": {"survivors": ["a", "b", "c"], "eliminated": []}});
    expect(line).toBe("Kimse elenmedi");
    expect(Array.from(line ?? "").length).toBeLessThanOrEqual(SUMMARY_MAX_LENGTH);
  });
  it("veri yoksa ya da eksikse cümle kurmaz (4)", () => {
    expect(summarizeRusRuleti(result, players, {"result": null})).toBeNull();
  });
});
