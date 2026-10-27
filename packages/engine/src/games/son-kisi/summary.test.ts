import { describe, expect, it } from "vitest";
import { SUMMARY_MAX_LENGTH } from "../summary.js";
import { summarizeSonKisi } from "./summary.js";

const players = [
  { id: "a", nickname: "Elif" },
  { id: "b", nickname: "Can" },
  { id: "c", nickname: "Mert" },
  { id: "d", nickname: "Deniz" },
];
const result = { miniScores: { a: 4, b: 1, c: 0 }, awards: { a: 2, b: 1, c: 0 } };

describe("son-kisi tur özeti", () => {
  it("cümle kurar (1)", () => {
    const line = summarizeSonKisi(result, players, {
      result: { escapes: [], last: ["c"], missed: [], scores: {} },
    });
    expect(line).toBe("Mert en son kaçtı");
    expect(Array.from(line ?? "").length).toBeLessThanOrEqual(SUMMARY_MAX_LENGTH);
  });
  it("cümle kurar (2)", () => {
    const line = summarizeSonKisi(result, players, {
      result: { escapes: [], last: ["c"], missed: ["a"], scores: {} },
    });
    expect(line).toBe("Mert en son kaçtı, 1 kişi kaçamadı");
    expect(Array.from(line ?? "").length).toBeLessThanOrEqual(SUMMARY_MAX_LENGTH);
  });
  it("cümle kurar (3)", () => {
    const line = summarizeSonKisi(result, players, {
      result: { escapes: [], last: [], missed: ["a", "b"], scores: {} },
    });
    expect(line).toBe("Kimse kaçamadı");
    expect(Array.from(line ?? "").length).toBeLessThanOrEqual(SUMMARY_MAX_LENGTH);
  });
  it("veri yoksa ya da eksikse cümle kurmaz (4)", () => {
    expect(summarizeSonKisi(result, players, { result: null })).toBeNull();
  });
});
