import { describe, expect, it } from "vitest";
import { SUMMARY_MAX_LENGTH } from "../summary.js";
import { summarizeKuleUstasi } from "./summary.js";

const players = [
  { id: "a", nickname: "Elif" },
  { id: "b", nickname: "Can" },
  { id: "c", nickname: "Mert" },
];
const result = { miniScores: { a: 7, b: 4, c: 1 }, awards: { a: 2, b: 1, c: 0 } };

describe("kule-ustasi tur özeti", () => {
  it("görünümdeki puanlardan lideri yazar", () => {
    const line = summarizeKuleUstasi(result, players, { usta: { a: 1, b: 3, c: 0 } });
    expect(line).toBe("Can 3 usta puanıyla kulenin ustası");
    expect(Array.from(line ?? "").length).toBeLessThanOrEqual(SUMMARY_MAX_LENGTH);
  });

  it("görünüm yoksa sonuçtan yazar", () => {
    expect(summarizeKuleUstasi(result, players, undefined)).toBe("Elif 7 usta puanıyla kulenin ustası");
  });

  it("eşitlikte hepsini yazar", () => {
    const line = summarizeKuleUstasi(
      { miniScores: { a: 5, b: 5, c: 1 }, awards: { a: 2, b: 2, c: 0 } },
      players,
      undefined,
    );
    expect(line).toBe("Elif ve Can 5 usta puanıyla kuleyi paylaştı");
  });
});
