import { describe, expect, it } from "vitest";
import { SUMMARY_MAX_LENGTH } from "../summary.js";
import { summarizeOrtalamaninYarisi } from "./summary.js";

const players = [
  { id: "a", nickname: "Elif" },
  { id: "b", nickname: "Can" },
  { id: "c", nickname: "Mert" },
  { id: "d", nickname: "Deniz" },
];
const result = { miniScores: { a: 4, b: 1, c: 0 }, awards: { a: 2, b: 1, c: 0 } };

describe("ortalamanin-yarisi tur özeti", () => {
  it("cümle kurar (1)", () => {
    const line = summarizeOrtalamaninYarisi(result, players, {
      reveal: {
        choices: { a: 24, b: 10 },
        mean: 47,
        target: 23.5,
        distances: {},
        order: ["a", "b"],
        ranks: {},
        points: { a: 2, b: 1 },
        random: [],
        burned: [],
      },
    });
    expect(line).toBe("Hedef 23,5; en yakın Elif (24)");
    expect(Array.from(line ?? "").length).toBeLessThanOrEqual(SUMMARY_MAX_LENGTH);
  });
  it("yanan ya da rastgele en yakın atlanır; puan alan ilk kişi yazılır (OY-M1, OY-M2)", () => {
    const line = summarizeOrtalamaninYarisi(result, players, {
      reveal: {
        choices: { a: 24, b: 10, c: 5 },
        mean: 47,
        target: 23.5,
        distances: {},
        order: ["a", "b", "c"],
        ranks: { a: 0, b: 1, c: 2 },
        points: { a: 0, b: 2, c: 1 },
        random: ["a"],
        burned: [],
      },
    });
    expect(line).toBe("Hedef 23,5; en yakın Can (10)");
  });
  it("herkes yandıysa kimsenin puan almadığı söylenir", () => {
    const line = summarizeOrtalamaninYarisi(result, players, {
      reveal: {
        choices: { a: 0, b: 0, c: 0 },
        mean: 0,
        target: 0,
        distances: {},
        order: ["a", "b", "c"],
        ranks: { a: 0, b: 0, c: 0 },
        points: { a: 0, b: 0, c: 0 },
        random: [],
        burned: ["a", "b", "c"],
      },
    });
    expect(line).toBe("Hedef 0; kimse puan alamadı");
  });
  it("veri yoksa ya da eksikse cümle kurmaz (2)", () => {
    expect(summarizeOrtalamaninYarisi(result, players, { reveal: null })).toBeNull();
  });
});
