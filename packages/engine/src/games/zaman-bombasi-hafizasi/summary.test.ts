import { describe, expect, it } from "vitest";
import { SUMMARY_MAX_LENGTH } from "../summary.js";
import { summarizeZamanBombasiHafizasi } from "./summary.js";

const players = [
  { id: "a", nickname: "Elif" },
  { id: "b", nickname: "Can" },
  { id: "c", nickname: "Mert" },
  { id: "d", nickname: "Deniz" },
];
const result = { miniScores: { a: 4, b: 1, c: 0 }, awards: { a: 2, b: 1, c: 0 } };

describe("zaman-bombasi-hafizasi tur özeti", () => {
  it("cümle kurar (1)", () => {
    const line = summarizeZamanBombasiHafizasi(result, players, {"scores": {"a": 1, "b": 2, "c": 0}});
    expect(line).toBe("Can 2 puanla hafızada önde");
    expect(Array.from(line ?? "").length).toBeLessThanOrEqual(SUMMARY_MAX_LENGTH);
  });
  it("cümle kurar (2)", () => {
    const line = summarizeZamanBombasiHafizasi(result, players, undefined);
    expect(line).toBe("Elif 4 puanla hafızada önde");
    expect(Array.from(line ?? "").length).toBeLessThanOrEqual(SUMMARY_MAX_LENGTH);
  });
});
