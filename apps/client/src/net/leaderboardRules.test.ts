import { describe, expect, it } from "vitest";
import {
  allZero,
  isAlone,
  parseGameLeaders,
  parseLeaderboard,
  rowLabel,
  showsCrown,
  valueText,
} from "./leaderboardRules.js";

const row = { username: "ali_1", value: 3, rank: 1, you: true };

describe("parseLeaderboard", () => {
  it("geçerli satırları okur, bozukları atar", () => {
    const rows = parseLeaderboard({
      ok: true,
      rows: [row, { ...row, username: "x" }, { ...row, rank: 0 }, { ...row, value: 1.5 }, { ...row, you: 1 }],
    });
    expect(rows).toEqual([row]);
  });
  it("geçersiz gövdede null", () => {
    expect(parseLeaderboard(null)).toBeNull();
    expect(parseLeaderboard({ ok: false, rows: [] })).toBeNull();
    expect(parseLeaderboard({ ok: true })).toBeNull();
  });
  it("negatif puan kabul edilir", () => {
    expect(parseLeaderboard({ ok: true, rows: [{ ...row, value: -4 }] })?.[0]?.value).toBe(-4);
  });
});

describe("parseGameLeaders", () => {
  const g = {
    gameId: "butona-bas",
    name: "Butona Bas",
    leader: { username: "mert_34", wins: 3 },
    you: { wins: 1 },
  };
  it("geçerli oyunu okur, bozuğu atar", () => {
    expect(
      parseGameLeaders({ ok: true, games: [g, { ...g, name: "" }, { ...g, you: { wins: -1 } }] }),
    ).toEqual([g]);
    expect(parseGameLeaders({ ok: true, games: "x" })).toBeNull();
  });
});

describe("yardımcılar", () => {
  it("yalnız sen varsa boş durum", () => {
    expect(isAlone([row])).toBe(true);
    expect(isAlone([])).toBe(true);
    expect(isAlone([row, { ...row, username: "veli_2", you: false }])).toBe(false);
  });
  it("hepsi sıfır", () => {
    expect(allZero([{ ...row, value: 0 }])).toBe(true);
    expect(allZero([row])).toBe(false);
  });
  it("taç yalnız değeri olan birinciye", () => {
    expect(showsCrown(row)).toBe(true);
    expect(showsCrown({ ...row, value: 0 })).toBe(false);
    expect(showsCrown({ ...row, rank: 2 })).toBe(false);
  });
  it("değer ve satır metni", () => {
    expect(valueText("score", -4)).toBe("−4");
    expect(valueText("wins", 7)).toBe("7");
    expect(rowLabel("wins", row)).toBe("1. sıra, ali_1 (sen), 3 galibiyet");
    expect(rowLabel("matches", { ...row, you: false, rank: 3 })).toBe("3. sıra, ali_1, 3 maç");
  });
});
