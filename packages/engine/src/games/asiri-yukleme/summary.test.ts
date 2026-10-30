import { describe, expect, it } from "vitest";
import { SUMMARY_MAX_LENGTH } from "../summary.js";
import { summarizeAsiriYukleme } from "./summary.js";

const players = [
  { id: "a", nickname: "Elif" },
  { id: "b", nickname: "Can" },
  { id: "c", nickname: "Mert" },
  { id: "d", nickname: "Deniz" },
];
const result = { miniScores: { a: 4, b: 1, c: 0 }, awards: { a: 2, b: 1, c: 0 } };
const reveal = (total: number, exploders: string[]) => ({
  reveal: { total, before: {}, after: {}, exploders, points: {} },
});
const short = (line: string | null) =>
  expect(Array.from(line ?? "").length).toBeLessThanOrEqual(SUMMARY_MAX_LENGTH);

describe("asiri-yukleme tur özeti", () => {
  it("tek patlayan", () => {
    const line = summarizeAsiriYukleme(result, players, reveal(101, ["b"]));
    expect(line).toBe("Can barı patlattı");
    short(line);
  });
  it("iki patlayan", () => {
    const line = summarizeAsiriYukleme(result, players, reveal(104, ["b", "d"]));
    expect(line).toBe("Can ve Deniz barı patlattı");
    short(line);
  });
  it("üç ve daha çok patlayan", () => {
    const line = summarizeAsiriYukleme(result, players, reveal(110, ["a", "b", "d"]));
    expect(line).toBe("Elif ve 2 kişi barı patlattı");
    short(line);
  });
  it("patlama yok, bar doldu", () => {
    const line = summarizeAsiriYukleme(result, players, reveal(100, []));
    expect(line).toBe("Bar patlamadan 100'e ulaştı");
    short(line);
  });
  it("bar dolmadan süre bitti", () => {
    const line = summarizeAsiriYukleme(result, players, reveal(60, []));
    expect(line).toBe("Bar dolmadan süre bitti");
    short(line);
  });
  it("veri yoksa ya da eksikse cümle kurmaz", () => {
    expect(summarizeAsiriYukleme(result, players, { reveal: null })).toBeNull();
  });
});
