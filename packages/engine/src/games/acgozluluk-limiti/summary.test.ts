import { describe, expect, it } from "vitest";
import { SUMMARY_MAX_LENGTH } from "../summary.js";
import { summarizeAcgozlulukLimiti } from "./summary.js";

const players = [
  { id: "a", nickname: "Elif" },
  { id: "b", nickname: "Can" },
  { id: "c", nickname: "Mert" },
  { id: "d", nickname: "Deniz" },
];
const result = { miniScores: { a: 4, b: 1, c: 0 }, awards: { a: 2, b: 1, c: 0 } };

describe("acgozluluk-limiti tur özeti", () => {
  it("cümle kurar (1)", () => {
    const line = summarizeAcgozlulukLimiti(result, players, {"limit": 17, "reveal": {"choices": {}, "total": 12, "over": false}});
    expect(line).toBe("Toplam 12/17: herkes seçtiği kadar aldı");
    expect(Array.from(line ?? "").length).toBeLessThanOrEqual(SUMMARY_MAX_LENGTH);
  });
  it("cümle kurar (2)", () => {
    const line = summarizeAcgozlulukLimiti(result, players, {"limit": 17, "reveal": {"choices": {}, "total": 25, "over": true}});
    expect(line).toBe("Toplam 25, limit 17 aşıldı; kimse puan alamadı");
    expect(Array.from(line ?? "").length).toBeLessThanOrEqual(SUMMARY_MAX_LENGTH);
  });
  it("veri yoksa ya da eksikse cümle kurmaz (3)", () => {
    expect(summarizeAcgozlulukLimiti(result, players, undefined)).toBeNull();
  });
});
