import { describe, expect, it } from "vitest";
import { SUMMARY_MAX_LENGTH } from "../summary.js";
import { summarizeKorKronometre } from "./summary.js";

const players = [
  { id: "a", nickname: "Elif" },
  { id: "b", nickname: "Can" },
  { id: "c", nickname: "Mert" },
  { id: "d", nickname: "Deniz" },
];
const result = { miniScores: { a: 4, b: 1, c: 0 }, awards: { a: 2, b: 1, c: 0 } };

describe("kor-kronometre tur özeti", () => {
  it("cümle kurar (1)", () => {
    const line = summarizeKorKronometre(result, players, {
      reveal: {
        entries: [
          { playerId: "c", ms: 9880, pressed: true, distance: 120, rank: 1, points: 2 },
          { playerId: "a", ms: 0, pressed: false, distance: null, rank: null, points: 0 },
        ],
      },
    });
    expect(line).toBe("Mert hedefi 0,12 sn farkla tutturdu");
    expect(Array.from(line ?? "").length).toBeLessThanOrEqual(SUMMARY_MAX_LENGTH);
  });
  it("cümle kurar (2)", () => {
    const line = summarizeKorKronometre(result, players, {
      reveal: {
        entries: [{ playerId: "a", ms: null, pressed: false, distance: null, rank: null, points: 0 }],
      },
    });
    expect(line).toBe("Kimse basmadı");
    expect(Array.from(line ?? "").length).toBeLessThanOrEqual(SUMMARY_MAX_LENGTH);
  });
  it("veri yoksa ya da eksikse cümle kurmaz (3)", () => {
    expect(summarizeKorKronometre(result, players, { reveal: null })).toBeNull();
  });
});
