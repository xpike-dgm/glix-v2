import { describe, expect, it } from "vitest";
import { SUMMARY_MAX_LENGTH } from "../summary.js";
import { summarizeRusvetDarbe } from "./summary.js";

const players = [
  { id: "a", nickname: "Elif" },
  { id: "b", nickname: "Can" },
  { id: "c", nickname: "Mert" },
  { id: "d", nickname: "Deniz" },
];
const result = { miniScores: { a: 4, b: 1, c: 0 }, awards: { a: 2, b: 1, c: 0 } };

describe("rusvet-darbe tur özeti", () => {
  it("cümle kurar (1)", () => {
    const line = summarizeRusvetDarbe(result, players, { president: "b", reveal: { counts: { b: 3 } } });
    expect(line).toBe("Can 3 oyla başkan oldu");
    expect(Array.from(line ?? "").length).toBeLessThanOrEqual(SUMMARY_MAX_LENGTH);
  });
  it("cümle kurar (2)", () => {
    const line = summarizeRusvetDarbe(result, players, { president: "b", reveal: null });
    expect(line).toBe("Can başkan oldu");
    expect(Array.from(line ?? "").length).toBeLessThanOrEqual(SUMMARY_MAX_LENGTH);
  });
  it("veri yoksa ya da eksikse cümle kurmaz (3)", () => {
    expect(summarizeRusvetDarbe(result, players, { president: null })).toBeNull();
  });
});
