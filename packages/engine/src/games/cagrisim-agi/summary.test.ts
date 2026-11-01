import { describe, expect, it } from "vitest";
import { SUMMARY_MAX_LENGTH } from "../summary.js";
import { summarizeCagrisimAgi } from "./summary.js";

const players = [
  { id: "a", nickname: "Elif" },
  { id: "b", nickname: "Can" },
  { id: "c", nickname: "Mert" },
  { id: "d", nickname: "Deniz" },
];
const result = { miniScores: { a: 4, b: 1, c: 0 }, awards: { a: 2, b: 1, c: 0 } };
const round = (groups: { text: string; members: string[] }[]) => ({
  word: "DENİZ",
  reveal: {
    groups: groups.map((g) => ({ ...g, points: g.members.length, variants: [] })),
    singles: [],
    silent: [],
  },
});

describe("cagrisim-agi tur özeti", () => {
  it("üç kelimenin en kalabalık ağını anar (1)", () => {
    const line = summarizeCagrisimAgi(result, players, {
      results: [
        round([{ text: "kış", members: ["a", "b"] }]),
        round([{ text: "Deniz", members: ["a", "b", "c"] }]),
        round([]),
      ],
    });
    expect(line).toBe("“Deniz” cevabında 3 kişi buluştu");
    expect(Array.from(line ?? "").length).toBeLessThanOrEqual(SUMMARY_MAX_LENGTH);
  });
  it("hiç ağ yoksa (2)", () => {
    const line = summarizeCagrisimAgi(result, players, { results: [round([]), round([])] });
    expect(line).toBe("Kimse aynı cevabı vermedi");
  });
  it("veri yoksa ya da eksikse cümle kurmaz (3)", () => {
    expect(summarizeCagrisimAgi(result, players, { results: [] })).toBeNull();
    expect(summarizeCagrisimAgi(result, players, { reveal: null })).toBeNull();
  });
});
