import { describe, expect, it } from "vitest";
import { SUMMARY_MAX_LENGTH } from "../summary.js";
import { summarizeCaprazAtes } from "./summary.js";

const players = [
  { id: "a", nickname: "Elif" },
  { id: "b", nickname: "Can" },
  { id: "c", nickname: "Mert" },
  { id: "d", nickname: "Deniz" },
];
const result = { miniScores: { a: 4, b: 1, c: 0 }, awards: { a: 2, b: 1, c: 0 } };

describe("capraz-ates tur özeti", () => {
  it("cümle kurar (1)", () => {
    const line = summarizeCaprazAtes(result, players, {"reveal": {"targets": {}, "scores": {}, "mutual": [["a", "b"]]}});
    expect(line).toBe("Elif ile Can birbirini hedef aldı");
    expect(Array.from(line ?? "").length).toBeLessThanOrEqual(SUMMARY_MAX_LENGTH);
  });
  it("cümle kurar (2)", () => {
    const line = summarizeCaprazAtes(result, players, {"reveal": {"targets": {}, "scores": {}, "mutual": [["a", "b"], ["c", "d"]]}});
    expect(line).toBe("2 çift birbirini hedef aldı");
    expect(Array.from(line ?? "").length).toBeLessThanOrEqual(SUMMARY_MAX_LENGTH);
  });
  it("cümle kurar (3)", () => {
    const line = summarizeCaprazAtes(result, players, {"reveal": {"targets": {}, "scores": {}, "mutual": []}});
    expect(line).toBe("Karşılıklı hedefleşme olmadı");
    expect(Array.from(line ?? "").length).toBeLessThanOrEqual(SUMMARY_MAX_LENGTH);
  });
  it("veri yoksa ya da eksikse cümle kurmaz (4)", () => {
    expect(summarizeCaprazAtes(result, players, {"reveal": null})).toBeNull();
  });
});
