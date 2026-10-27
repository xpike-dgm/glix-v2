import { describe, expect, it } from "vitest";
import { SUMMARY_MAX_LENGTH } from "../summary.js";
import { summarizeGizliAlisveris } from "./summary.js";

const players = [
  { id: "a", nickname: "Elif" },
  { id: "b", nickname: "Can" },
  { id: "c", nickname: "Mert" },
  { id: "d", nickname: "Deniz" },
];
const result = { miniScores: { a: 4, b: 1, c: 0 }, awards: { a: 2, b: 1, c: 0 } };

describe("gizli-alisveris tur özeti", () => {
  it("cümle kurar (1)", () => {
    const line = summarizeGizliAlisveris(result, players, {"reveal": {"baskets": {}, "buyers": {}, "values": {"a": 21000}, "winners": ["a"]}});
    expect(line).toBe("Elif 25,00 kredilik sepetle önde");
    expect(Array.from(line ?? "").length).toBeLessThanOrEqual(SUMMARY_MAX_LENGTH);
  });
  it("cümle kurar (2)", () => {
    const line = summarizeGizliAlisveris(result, players, {"reveal": {"baskets": {}, "buyers": {}, "values": {}, "winners": []}});
    expect(line).toBe("Kimse değerli bir sepet kuramadı");
    expect(Array.from(line ?? "").length).toBeLessThanOrEqual(SUMMARY_MAX_LENGTH);
  });
  it("veri yoksa ya da eksikse cümle kurmaz (3)", () => {
    expect(summarizeGizliAlisveris(result, players, {"reveal": null})).toBeNull();
  });
});
