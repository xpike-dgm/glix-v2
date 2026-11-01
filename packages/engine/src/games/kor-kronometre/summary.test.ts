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
const entry = (playerId: string, distance: number | null) => ({
  playerId,
  ms: distance === null ? null : 10_000 + distance,
  pressed: distance !== null,
  distance,
  rank: distance === null ? null : 1,
  bullseye: false,
  points: 0,
});
const standing = (playerId: string, total: number, rank: number) => ({
  playerId,
  total,
  handPoints: [null, null, null],
  pressedHands: 0,
  avgDistance: null,
  rank,
  award: 0,
});

describe("kor-kronometre tur özeti", () => {
  it("üç elin kazananı ve en yakın basış (1)", () => {
    const line = summarizeKorKronometre(result, players, {
      played: [
        { reveal: { entries: [entry("c", 120), entry("a", 400)] } },
        { reveal: { entries: [entry("a", 40), entry("c", null)] } },
      ],
      final: { standings: [standing("a", 5, 1), standing("c", 3, 2)] },
    });
    expect(line).toBe("Elif 5 el puanıyla kazandı · en yakın 0,04 sn");
    expect(Array.from(line ?? "").length).toBeLessThanOrEqual(SUMMARY_MAX_LENGTH);
  });
  it("eşit birinciler ve kimse basmadıysa (2)", () => {
    const tie = summarizeKorKronometre(result, players, {
      played: [{ reveal: { entries: [entry("a", 300), entry("b", 300)] } }],
      final: { standings: [standing("a", 2, 1), standing("b", 2, 1)] },
    });
    expect(tie).toBe("Elif ve Can 2 el puanıyla kazandı · en yakın 0,3 sn");
    const none = summarizeKorKronometre(result, players, {
      played: [{ reveal: { entries: [entry("a", null)] } }],
      final: { standings: [standing("a", 0, 1), standing("b", 0, 1)] },
    });
    expect(none).toBe("Kimse basmadı");
  });
  it("veri yoksa ya da eksikse cümle kurmaz (3)", () => {
    expect(summarizeKorKronometre(result, players, { final: null })).toBeNull();
    expect(summarizeKorKronometre(result, players, null)).toBeNull();
  });
});
