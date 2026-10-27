import { describe, expect, it } from "vitest";
import { SUMMARY_MAX_LENGTH } from "../summary.js";
import { summarizeKaraBorsa } from "./summary.js";

const players = [
  { id: "a", nickname: "Elif" },
  { id: "b", nickname: "Can" },
  { id: "c", nickname: "Mert" },
  { id: "d", nickname: "Deniz" },
];
const result = { miniScores: { a: 4, b: 1, c: 0 }, awards: { a: 2, b: 1, c: 0 } };

describe("kara-borsa tur özeti", () => {
  it("cümle kurar (1)", () => {
    const line = summarizeKaraBorsa(result, players, {"history": [{"value": 30, "winner": "a", "price": 5, "bids": {}}, {"value": 10, "winner": "a", "price": 5, "bids": {}}, {"value": 0, "winner": "b", "price": 5, "bids": {}}]});
    expect(line).toBe("Elif 2 kutu alarak turun yıldızı");
    expect(Array.from(line ?? "").length).toBeLessThanOrEqual(SUMMARY_MAX_LENGTH);
  });
  it("cümle kurar (2)", () => {
    const line = summarizeKaraBorsa(result, players, {"history": [{"value": 0, "winner": null, "price": 0, "bids": {}}]});
    expect(line).toBe("Kimse kutu alamadı");
    expect(Array.from(line ?? "").length).toBeLessThanOrEqual(SUMMARY_MAX_LENGTH);
  });
  it("veri yoksa ya da eksikse cümle kurmaz (3)", () => {
    expect(summarizeKaraBorsa(result, players, undefined)).toBeNull();
  });
});
