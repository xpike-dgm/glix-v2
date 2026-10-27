import { describe, expect, it } from "vitest";
import { GAMES } from "./index.js";
import { SUMMARIES, summarizeRound } from "./summaries.js";
import { fit, names, nick, SUMMARY_MAX_LENGTH } from "./summary.js";

const result = { miniScores: { a: 3, b: 1 }, awards: { a: 2, b: 1 } };
const players = [
  { id: "a", nickname: "ÇokUzunBirTakmaAd" },
  { id: "b", nickname: "Can" },
];

describe("tur özeti kaydı", () => {
  it("her oyunun özeti kayıtlı, kayıtta fazladan oyun yok", () => {
    expect(Object.keys(SUMMARIES).sort()).toEqual(Object.keys(GAMES).sort());
  });

  it("bilinmeyen oyun ve bozuk görünüm cümle kurmaz, hata fırlatmaz", () => {
    expect(summarizeRound("yok", result, players)).toBeNull();
    for (const id of Object.keys(GAMES)) {
      for (const pv of [undefined, null, 5, "x", [], { reveal: 7, result: [], history: "x" }]) {
        const line = summarizeRound(id, result, players, pv);
        if (line !== null) expect(Array.from(line).length).toBeLessThanOrEqual(SUMMARY_MAX_LENGTH);
      }
    }
  });

  it("uzun takma ad kısaltılır, cümle sınırı aşılmaz", () => {
    expect(nick(players, "a")).toBe("ÇokUzunBi…");
    expect(nick(players, "yok")).toBe("Biri");
    expect(names(players, ["a", "b"])).toBe("ÇokUzunBi… ve Can");
    expect(names(players, ["a", "b", "x"])).toBe("ÇokUzunBi… ve 2 kişi");
    expect(Array.from(fit("x".repeat(100))).length).toBe(SUMMARY_MAX_LENGTH);
    const line = summarizeRound("sizma", result, players, { reveal: { infiltrator: "a", caught: true } });
    expect(line).toBe("ÇokUzunBi… sızmaydı ve yakalandı");
  });
});
