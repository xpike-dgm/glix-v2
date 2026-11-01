import { describe, expect, it } from "vitest";
import { SUMMARY_MAX_LENGTH } from "../summary.js";
import { summarizeAcgozlulukLimiti } from "./summary.js";

const players = [
  { id: "a", nickname: "Elif" },
  { id: "b", nickname: "Can" },
  { id: "c", nickname: "Mert" },
];
const result = { miniScores: { a: 7, b: 5, c: 0 }, awards: { a: 2, b: 1, c: 0 } };
const pv = (totals: Record<string, number>, overs: boolean[]) => ({
  totals,
  history: overs.slice(0, -1).map((over) => ({ scoutId: null, reveal: { over } })),
  reveal: { over: overs.at(-1) },
  final: { a: 2, b: 1, c: 0 },
});

describe("acgozluluk-limiti tur özeti", () => {
  it("önde olan ve taşma sayısı (1)", () => {
    const line = summarizeAcgozlulukLimiti(result, players, pv({ a: 7, b: 5, c: 0 }, [false, true, false]));
    expect(line).toBe("Elif 7 jetonla önde · kasa 1 kez taştı");
    expect(Array.from(line ?? "").length).toBeLessThanOrEqual(SUMMARY_MAX_LENGTH);
  });
  it("eşit liderler, hiç taşmadı (2)", () => {
    const line = summarizeAcgozlulukLimiti(result, players, pv({ a: 6, b: 6, c: 2 }, [false, false, false]));
    expect(line).toBe("Elif ve Can 6 jetonla önde · kasa hiç taşmadı");
  });
  it("hep taştı (3)", () => {
    const line = summarizeAcgozlulukLimiti(result, players, pv({ a: 0, b: 0, c: 0 }, [true, true, true]));
    expect(line).toBe("Kimse puan alamadı; kasa 3 kez taştı");
  });
  it("son açılış yoksa ya da veri eksikse cümle kurmaz (4)", () => {
    expect(summarizeAcgozlulukLimiti(result, players, undefined)).toBeNull();
    expect(summarizeAcgozlulukLimiti(result, players, { totals: {}, final: null })).toBeNull();
  });
});
