import { describe, expect, it } from "vitest";
import { GLIX_DAILY_MATCH_CAP, matchAward, matchBase, placeBonus } from "./glix.js";

const award = (place: number, earnedToday = 0, firstToday = false) =>
  matchAward({ place, earnedToday, firstToday });

describe("Glix maç ödülü", () => {
  it("sıralama ekleri: 1. +15, 2. +10, 3. +5, 4+ yok", () => {
    expect([1, 2, 3, 4, 8].map(placeBonus)).toEqual([15, 10, 5, 0, 0]);
    expect([1, 2, 3, 4].map(matchBase)).toEqual([25, 20, 15, 10]);
  });

  it("4. ve sonrası yalnız tamamlama alır", () => {
    expect(award(4)).toEqual({ parts: [{ kind: "mac", amount: 10 }], total: 10, capped: false });
  });

  it("eşit puanda paylaşılan sıra (1, 1, 3) aynı eki alır", () => {
    // İki birinci de 1. sıra eki alır; sonraki oyuncu 3. sayılır.
    expect([1, 1, 3].map((p) => award(p).total)).toEqual([25, 25, 15]);
  });

  it("günün ilk maçı: tamamlama + sıralama ikiye katlanır", () => {
    const a = award(2, 0, true);
    expect(a.parts).toEqual([
      { kind: "mac", amount: 10 },
      { kind: "sira", amount: 10 },
      { kind: "gununIlki", amount: 20 },
    ]);
    expect(a.total).toBe(40);
    expect(award(5, 0, true).total).toBe(20);
  });

  it("sınıra takılan maç kısmen ödenir", () => {
    const a = award(1, 290, false);
    expect(a.total).toBe(10);
    expect(a.capped).toBe(true);
    expect(a.parts).toEqual([{ kind: "mac", amount: 10 }]);
    const b = award(1, 280, true);
    expect(b.total).toBe(20);
    expect(b.parts.map((p) => p.kind)).toEqual(["mac", "sira"]);
  });

  it("sınıra tam varınca ya da aşınca 0", () => {
    expect(award(1, GLIX_DAILY_MATCH_CAP)).toEqual({ parts: [], total: 0, capped: true });
    expect(award(1, GLIX_DAILY_MATCH_CAP + 50, true).total).toBe(0);
  });

  it("tam sınıra denk gelen maç kırpılmış sayılmaz", () => {
    const a = award(1, 275);
    expect(a.total).toBe(25);
    expect(a.capped).toBe(false);
  });
});
