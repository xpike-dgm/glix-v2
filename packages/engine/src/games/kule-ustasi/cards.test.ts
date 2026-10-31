import { describe, expect, it } from "vitest";
import type { CardId } from "../../cards/catalog.js";
import { type PlayedCard, resolveCards } from "../../cards/resolve.js";
import { kuleAwards } from "./index.js";

describe("kule-ustasi maç kartlarıyla (sıralama usta puanına göre)", () => {
  const P = ["a", "b", "c", "d"];
  /** a birinci (9 usta, +2), b ikinci (6, +1), c (2) ve d (çıktı, 1) 0; sonuncu d. */
  const mini = { a: 9, b: 6, c: 2, d: 1 };
  const awards = kuleAwards(P, mini, ["d"]);
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

  it("ham sonuç: +2 / +1 / 0 / 0; eksi yok", () => {
    expect(awards).toEqual({ a: 2, b: 1, c: 0, d: 0 });
    expect(run([])).toEqual({ a: 2, b: 1, c: 0, d: 0 });
  });

  it("Kendine Güven: usta birincisi +2 daha; birinci olmayan −1", () => {
    expect(run([play("a", "kendine-guven")]).a).toBe(4);
    expect(run([play("b", "kendine-guven")]).b).toBe(0);
  });

  it("Sigorta: en düşük usta puanlı (sonuncu) +1 alır; diğerine etkisiz", () => {
    expect(run([play("d", "sigorta")]).d).toBe(1);
    expect(run([play("c", "sigorta")]).c).toBe(0);
  });

  it("Çift Puan ve Altın Dokunuş sıralama ödülünü katlar", () => {
    expect(run([play("a", "cift-puan")]).a).toBe(4);
    expect(run([play("a", "altin-dokunus")]).a).toBe(6);
  });

  it("herkes eşit usta puanında herkes +1 ve herkes birinci: Kendine Güven +2 daha", () => {
    const eq = { a: 3, b: 3, c: 3, d: 3 };
    expect(run([play("b", "kendine-guven")], kuleAwards(P, eq, []), eq).b).toBe(3);
  });
});
