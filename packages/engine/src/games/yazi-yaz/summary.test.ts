import { describe, expect, it } from "vitest";
import { SUMMARY_MAX_LENGTH } from "../summary.js";
import { summarizeYaziYaz } from "./summary.js";

const players = [
  { id: "a", nickname: "Elif" },
  { id: "b", nickname: "Can" },
  { id: "c", nickname: "Mert" },
  { id: "d", nickname: "Deniz" },
];
const result = { miniScores: { a: 4, b: 1, c: 0 }, awards: { a: 2, b: 1, c: 0 } };

describe("yazi-yaz tur özeti", () => {
  it("cümle kurar (1)", () => {
    const line = summarizeYaziYaz(result, players, {"reveal": {"writers": ["a", "b"], "words": {}, "guesses": {"a": {"personOk": true}, "b": {"personOk": false}, "c": {"personOk": true}}, "scores": {}}});
    expect(line).toBe("3 kişiden 2 tanesi yazanı doğru tahmin etti");
    expect(Array.from(line ?? "").length).toBeLessThanOrEqual(SUMMARY_MAX_LENGTH);
  });
  it("veri yoksa ya da eksikse cümle kurmaz (2)", () => {
    expect(summarizeYaziYaz(result, players, {"reveal": null})).toBeNull();
  });
});
