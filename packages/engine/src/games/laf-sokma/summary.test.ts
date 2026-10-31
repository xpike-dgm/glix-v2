import { describe, expect, it } from "vitest";
import { SUMMARY_MAX_LENGTH } from "../summary.js";
import { summarizeLafSokma } from "./summary.js";

const players = [
  { id: "a", nickname: "Elif" },
  { id: "b", nickname: "Can" },
  { id: "c", nickname: "Mert" },
  { id: "d", nickname: "Deniz" },
];
const result = { miniScores: { a: 4, b: 1, c: 0 }, awards: { a: 2, b: 1, c: 0 } };

describe("laf-sokma tur özeti", () => {
  it("cümle kurar (1)", () => {
    const line = summarizeLafSokma(result, players, {
      history: [{ cards: [{ author: "b", master: true }] }],
      reveal: { cards: [{ author: "a", master: false }] },
      scores: { a: 3, b: 2 },
    });
    expect(line).toBe("Can Laf Ustası oldu");
    expect(Array.from(line ?? "").length).toBeLessThanOrEqual(SUMMARY_MAX_LENGTH);
  });
  it("cümle kurar (2)", () => {
    const line = summarizeLafSokma(result, players, { history: [], reveal: null, scores: { a: 3, b: 2 } });
    expect(line).toBe("Elif 3 kahkahayla lafı gediğine koydu");
    expect(Array.from(line ?? "").length).toBeLessThanOrEqual(SUMMARY_MAX_LENGTH);
  });
  it("cümle kurar (3)", () => {
    const line = summarizeLafSokma(result, players, undefined);
    expect(line).toBe("Elif 4 kahkahayla lafı gediğine koydu");
    expect(Array.from(line ?? "").length).toBeLessThanOrEqual(SUMMARY_MAX_LENGTH);
  });
});
