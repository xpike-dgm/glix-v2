import { describe, expect, it } from "vitest";
import { SUMMARY_MAX_LENGTH } from "../summary.js";
import { summarizeSozlukBlofu } from "./summary.js";

const players = [
  { id: "a", nickname: "Elif" },
  { id: "b", nickname: "Can" },
  { id: "c", nickname: "Mert" },
  { id: "d", nickname: "Deniz" },
];
const result = { miniScores: { a: 4, b: 1, c: 0 }, awards: { a: 2, b: 1, c: 0 } };

describe("sozluk-blofu tur özeti", () => {
  it("cümle kurar (1)", () => {
    const line = summarizeSozlukBlofu(result, players, {"reveal": {"realCard": "k1", "authors": {"k2": "b", "k3": "c"}, "picks": {"a": "k2", "c": "k2", "b": "k1"}, "scores": {}}});
    expect(line).toBe("Can 2 kişiyi kandırdı");
    expect(Array.from(line ?? "").length).toBeLessThanOrEqual(SUMMARY_MAX_LENGTH);
  });
  it("cümle kurar (2)", () => {
    const line = summarizeSozlukBlofu(result, players, {"reveal": {"realCard": "k1", "authors": {"k2": "b"}, "picks": {"a": "k1", "c": "k1"}, "scores": {}}});
    expect(line).toBe("2 kişi gerçek tanımı buldu");
    expect(Array.from(line ?? "").length).toBeLessThanOrEqual(SUMMARY_MAX_LENGTH);
  });
  it("cümle kurar (3)", () => {
    const line = summarizeSozlukBlofu(result, players, {"reveal": {"realCard": "k1", "authors": {}, "picks": {}, "scores": {}}});
    expect(line).toBe("Kimse kimseyi kandıramadı");
    expect(Array.from(line ?? "").length).toBeLessThanOrEqual(SUMMARY_MAX_LENGTH);
  });
  it("veri yoksa ya da eksikse cümle kurmaz (4)", () => {
    expect(summarizeSozlukBlofu(result, players, {"reveal": null})).toBeNull();
  });
});
