import { describe, expect, it } from "vitest";
import type { CardId } from "../../cards/catalog.js";
import { type PlayedCard, resolveCards } from "../../cards/resolve.js";
import { lafAwards } from "./index.js";

describe("laf-sokma: kahkaha puanından mini puan (+2 / +1 / 0)", () => {
  it("en yüksek +2, sonraki farklı toplam +1, diğerleri 0", () => {
    expect(lafAwards({ a: 7, b: 4, c: 2, d: 0 })).toEqual({ a: 2, b: 1, c: 0, d: 0 });
  });

  it("birincide eşitlik: hepsi +2, sonraki farklı toplam +1", () => {
    expect(lafAwards({ a: 5, b: 5, c: 3, d: 1 })).toEqual({ a: 2, b: 2, c: 1, d: 0 });
  });

  it("ikincide eşitlik: hepsi +1", () => {
    expect(lafAwards({ a: 6, b: 3, c: 3, d: 2 })).toEqual({ a: 2, b: 1, c: 1, d: 0 });
  });

  it("toplamı 0 olan ödül almaz (ikinci sıra 0 ise +1 yok)", () => {
    expect(lafAwards({ a: 4, b: 0, c: 0 })).toEqual({ a: 2, b: 0, c: 0 });
    expect(lafAwards({ a: 2, b: 2, c: 0 })).toEqual({ a: 2, b: 2, c: 0 });
  });

  it("kimse kahkaha toplamadıysa kimse ödül almaz", () => {
    expect(lafAwards({ a: 0, b: 0, c: 0 })).toEqual({ a: 0, b: 0, c: 0 });
  });

  it("herkesin toplamı aynı ve 0'dan büyükse herkes +1", () => {
    expect(lafAwards({ a: 3, b: 3, c: 3 })).toEqual({ a: 1, b: 1, c: 1 });
  });

  it("eksi yok; ödül her zaman 0, 1 ya da 2", () => {
    const out = lafAwards({ a: 9, b: 8, c: 7, d: 6, e: 5, f: 4, g: 3, h: 2 });
    expect(out).toEqual({ a: 2, b: 1, c: 0, d: 0, e: 0, f: 0, g: 0, h: 0 });
  });
});

describe("laf-sokma maç kartlarıyla (sıralama kahkaha puanına göre)", () => {
  const P = ["a", "b", "c", "d"];
  /** a birinci (9 kahkaha, +2), b ikinci (5, +1), c ve d sonuncular (0). */
  const mini = { a: 9, b: 5, c: 0, d: 0 };
  const awards = lafAwards(mini);
  const play = (playerId: string, cardId: CardId, target?: string): PlayedCard =>
    target ? { playerId, cardId, target } : { playerId, cardId };
  const run = (plays: PlayedCard[], aw = awards, ms: Record<string, number> = mini) =>
    resolveCards({
      participants: P,
      present: P,
      miniScores: ms,
      awards: aw,
      plays,
      pending: {},
      hands: {},
      seed: 1,
      gameIndex: 0,
    }).awards;

  it("ham sonuç: +2 / +1 / 0 / 0; kartlar kahkaha sıralamasını kullanır", () => {
    expect(awards).toEqual({ a: 2, b: 1, c: 0, d: 0 });
  });

  it("Kendine Güven: kahkaha birincisi +2 daha; ikinci −1", () => {
    expect(run([play("a", "kendine-guven")]).a).toBe(4);
    expect(run([play("b", "kendine-guven")]).b).toBe(0);
  });

  it("Çift Puan ve Altın Dokunuş sıralama ödülünü katlar (en çok +4 / +6)", () => {
    expect(run([play("a", "cift-puan")]).a).toBe(4);
    expect(run([play("a", "altin-dokunus")]).a).toBe(6);
  });

  it("Sigorta: kahkaha toplamı en düşük olan sonuncudur (+1)", () => {
    expect(run([play("c", "sigorta")]).c).toBe(1);
    expect(run([play("b", "sigorta")]).b).toBe(1);
  });

  it("Ters Köşe: 0 kahkahalılar +2 ve +1'i paylaşır, birinci 0", () => {
    const out = run([play("c", "ters-kose")]);
    expect(out.a).toBe(0);
    expect(out.b).toBe(0);
    expect((out.c ?? 0) + (out.d ?? 0)).toBe(3);
  });

  it("Hırsız kahkaha birincisinden 1 puan alır; Kalkan gerekirse 0'a çeker", () => {
    expect(run([play("d", "hirsiz")])).toMatchObject({ a: 1, d: 1 });
    expect(run([play("c", "kalkan"), play("a", "celme", "c")]).c).toBe(0);
  });

  it("herkes eşit kahkahada herkes +1 ve herkes birinci: Kendine Güven +2 daha", () => {
    const eq = { a: 3, b: 3, c: 3, d: 3 };
    expect(run([play("b", "kendine-guven")], lafAwards(eq), eq).b).toBe(3);
  });
});
