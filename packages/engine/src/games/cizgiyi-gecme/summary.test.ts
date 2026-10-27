import { describe, expect, it } from "vitest";
import { SUMMARY_MAX_LENGTH } from "../summary.js";
import { summarizeCizgiyiGecme } from "./summary.js";

const players = [
  { id: "a", nickname: "Elif" },
  { id: "b", nickname: "Can" },
  { id: "c", nickname: "Mert" },
  { id: "d", nickname: "Deniz" },
];
const result = { miniScores: { a: 4, b: 1, c: 0 }, awards: { a: 2, b: 1, c: 0 } };

describe("cizgiyi-gecme tur özeti", () => {
  it("cümle kurar (1)", () => {
    const line = summarizeCizgiyiGecme(result, players, {"reveal": {"choices": {"a": 87, "b": 40}, "status": {"a": "first", "b": "second"}, "points": {}}});
    expect(line).toBe("Elif 87 ile çizgiyi en yüksekten geçti");
    expect(Array.from(line ?? "").length).toBeLessThanOrEqual(SUMMARY_MAX_LENGTH);
  });
  it("cümle kurar (2)", () => {
    const line = summarizeCizgiyiGecme(result, players, {"reveal": {"choices": {"a": 50, "b": 55}, "status": {"a": "crashed", "b": "crashed"}, "points": {}}});
    expect(line).toBe("Tek kalan olmadı; kimse puan almadı");
    expect(Array.from(line ?? "").length).toBeLessThanOrEqual(SUMMARY_MAX_LENGTH);
  });
  it("veri yoksa ya da eksikse cümle kurmaz (3)", () => {
    expect(summarizeCizgiyiGecme(result, players, {"reveal": null})).toBeNull();
  });
});
