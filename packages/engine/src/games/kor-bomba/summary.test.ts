import { describe, expect, it } from "vitest";
import { SUMMARY_MAX_LENGTH } from "../summary.js";
import { summarizeKorBomba } from "./summary.js";

const players = [
  { id: "a", nickname: "Elif" },
  { id: "b", nickname: "Can" },
  { id: "c", nickname: "Mert" },
  { id: "d", nickname: "Deniz" },
];
const result = { miniScores: { a: 4, b: 1, c: 0 }, awards: { a: 2, b: 1, c: 0 } };

describe("kor-bomba tur özeti", () => {
  it("cümle kurar (1)", () => {
    const line = summarizeKorBomba(result, players, {"holder": "b", "passes": 7, "exploded": true});
    expect(line).toBe("Bomba Can elinde, 7 pasın ardından patladı");
    expect(Array.from(line ?? "").length).toBeLessThanOrEqual(SUMMARY_MAX_LENGTH);
  });
  it("cümle kurar (2)", () => {
    const line = summarizeKorBomba(result, players, {"holder": "b", "passes": 0, "exploded": true});
    expect(line).toBe("Bomba Can elinde patladı");
    expect(Array.from(line ?? "").length).toBeLessThanOrEqual(SUMMARY_MAX_LENGTH);
  });
  it("veri yoksa ya da eksikse cümle kurmaz (3)", () => {
    expect(summarizeKorBomba(result, players, {"holder": "b", "passes": 2, "exploded": false})).toBeNull();
  });
});
