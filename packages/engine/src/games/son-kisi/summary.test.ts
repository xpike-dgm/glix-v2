import { describe, expect, it } from "vitest";
import { SUMMARY_MAX_LENGTH } from "../summary.js";
import { summarizeSonKisi } from "./summary.js";

const players = [
  { id: "a", nickname: "Elif" },
  { id: "b", nickname: "Can" },
  { id: "c", nickname: "Mert" },
];
const result = { miniScores: { a: 5, b: 3, c: 0 }, awards: { a: 2, b: 1, c: 0 } };
const row = (playerId: string, total: number, rank: number) => ({
  playerId,
  total,
  rank,
  roundPoints: [],
  award: 0,
});

describe("son-kisi tur özeti", () => {
  it("toplamda birinciyi yazar (1)", () => {
    const line = summarizeSonKisi(result, players, {
      final: [row("a", 5, 1), row("b", 3, 2), row("c", 0, 3)],
    });
    expect(line).toBe("Elif 5 puanla en cesur kaçan");
    expect(Array.from(line ?? "").length).toBeLessThanOrEqual(SUMMARY_MAX_LENGTH);
  });
  it("eşit birincileri yazar (2)", () => {
    const line = summarizeSonKisi(result, players, {
      final: [row("a", 4, 1), row("c", 4, 1), row("b", 0, 3)],
    });
    expect(line).toBe("Elif ve Mert 4 puanla en cesur kaçan");
  });
  it("kimse puan almadıysa (3)", () => {
    expect(summarizeSonKisi(result, players, { final: [row("a", 0, 1), row("b", 0, 1)] })).toBe(
      "Kimse kurtulamadı",
    );
  });
  it("veri yoksa ya da eksikse cümle kurmaz (4)", () => {
    expect(summarizeSonKisi(result, players, { final: null })).toBeNull();
    expect(summarizeSonKisi(result, players, {})).toBeNull();
  });
});
