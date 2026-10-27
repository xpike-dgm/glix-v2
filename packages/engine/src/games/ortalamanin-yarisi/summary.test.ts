import { describe, expect, it } from "vitest";
import { SUMMARY_MAX_LENGTH } from "../summary.js";
import { summarizeOrtalamaninYarisi } from "./summary.js";

const players = [
  { id: "a", nickname: "Elif" },
  { id: "b", nickname: "Can" },
  { id: "c", nickname: "Mert" },
  { id: "d", nickname: "Deniz" },
];
const result = { miniScores: { a: 4, b: 1, c: 0 }, awards: { a: 2, b: 1, c: 0 } };

describe("ortalamanin-yarisi tur özeti", () => {
  it("cümle kurar (1)", () => {
    const line = summarizeOrtalamaninYarisi(result, players, {"reveal": {"choices": {"a": 24, "b": 10}, "mean": 47, "target": 23.5, "distances": {}, "order": ["a", "b"], "ranks": {}, "points": {}}});
    expect(line).toBe("Hedef 23,5; en yakın Elif (24)");
    expect(Array.from(line ?? "").length).toBeLessThanOrEqual(SUMMARY_MAX_LENGTH);
  });
  it("veri yoksa ya da eksikse cümle kurmaz (2)", () => {
    expect(summarizeOrtalamaninYarisi(result, players, {"reveal": null})).toBeNull();
  });
});
