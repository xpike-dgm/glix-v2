import { describe, expect, it } from "vitest";
import { SUMMARY_MAX_LENGTH } from "../summary.js";
import { summarizeZehirliKadeh } from "./summary.js";

const players = [
  { id: "a", nickname: "Elif" },
  { id: "b", nickname: "Can" },
  { id: "c", nickname: "Mert" },
  { id: "d", nickname: "Deniz" },
];
const result = { miniScores: { a: 4, b: 1, c: 0 }, awards: { a: 2, b: 1, c: 0 } };

describe("zehirli-kadeh tur özeti", () => {
  it("cümle kurar (1)", () => {
    const line = summarizeZehirliKadeh(result, players, {"result": {"clean": ["a"], "poisoned": ["b", "c"], "poisonedCups": [1, 2]}});
    expect(line).toBe("Can ve Mert zehirli kadehte kaldı");
    expect(Array.from(line ?? "").length).toBeLessThanOrEqual(SUMMARY_MAX_LENGTH);
  });
  it("cümle kurar (2)", () => {
    const line = summarizeZehirliKadeh(result, players, {"result": {"clean": ["a", "b", "c"], "poisoned": [], "poisonedCups": []}});
    expect(line).toBe("Kimse zehirli kadehte kalmadı");
    expect(Array.from(line ?? "").length).toBeLessThanOrEqual(SUMMARY_MAX_LENGTH);
  });
  it("veri yoksa ya da eksikse cümle kurmaz (3)", () => {
    expect(summarizeZehirliKadeh(result, players, {"result": null})).toBeNull();
  });
});
