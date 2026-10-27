import { describe, expect, it } from "vitest";
import { SUMMARY_MAX_LENGTH } from "../summary.js";
import { summarizeGizliHirsiz } from "./summary.js";

const players = [
  { id: "a", nickname: "Elif" },
  { id: "b", nickname: "Can" },
  { id: "c", nickname: "Mert" },
  { id: "d", nickname: "Deniz" },
];
const result = { miniScores: { a: 4, b: 1, c: 0 }, awards: { a: 2, b: 1, c: 0 } };

describe("gizli-hirsiz tur özeti", () => {
  it("cümle kurar (1)", () => {
    const line = summarizeGizliHirsiz(result, players, {"reveal": {"thieves": ["c"], "outcome": "solo", "scores": {}}});
    expect(line).toBe("Mert tek hırsız olarak sıyrıldı");
    expect(Array.from(line ?? "").length).toBeLessThanOrEqual(SUMMARY_MAX_LENGTH);
  });
  it("cümle kurar (2)", () => {
    const line = summarizeGizliHirsiz(result, players, {"reveal": {"thieves": ["a", "b"], "outcome": "multi", "scores": {}}});
    expect(line).toBe("2 hırsız birbirini yakalattı");
    expect(Array.from(line ?? "").length).toBeLessThanOrEqual(SUMMARY_MAX_LENGTH);
  });
  it("cümle kurar (3)", () => {
    const line = summarizeGizliHirsiz(result, players, {"reveal": {"thieves": [], "outcome": "none", "scores": {}}});
    expect(line).toBe("Kimse çalmaya cesaret edemedi");
    expect(Array.from(line ?? "").length).toBeLessThanOrEqual(SUMMARY_MAX_LENGTH);
  });
  it("veri yoksa ya da eksikse cümle kurmaz (4)", () => {
    expect(summarizeGizliHirsiz(result, players, {"reveal": null})).toBeNull();
  });
});
