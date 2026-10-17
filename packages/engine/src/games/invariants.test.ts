import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { BOTS } from "../testing/index.js";
import { checkGameInvariants } from "../testing/invariants.js";
import { buildActions } from "../testing/simulate.js";
import { GAMES } from "./index.js";

describe.each(Object.values(GAMES).map((g) => [g.id, g] as const))("genel değişmezler: %s", (id, game) => {
  const bot = BOTS[id];

  it("botu kayıtlı", () => {
    expect(bot, `${id} için src/games/${id}/bots.ts ve games/bots.ts kaydı gerekli`).toBeDefined();
  });

  it("meta veri tutarlı", () => {
    expect(game.minPlayers).toBeGreaterThanOrEqual(1);
    expect(game.maxPlayers).toBeGreaterThanOrEqual(game.minPlayers);
    expect(game.briefing.steps.length).toBeLessThanOrEqual(3);
  });

  it("parseAction çöp girdide null döner, hiç fırlatmaz", () => {
    fc.assert(
      fc.property(fc.anything(), fc.jsonValue(), (a, b) => {
        for (const raw of [a, b]) {
          const parsed = game.parseAction(raw);
          if (parsed !== null) expect(game.parseAction(raw)).toEqual(parsed);
        }
      }),
      { numRuns: 300 },
    );
    for (const raw of [null, undefined, 0, "", "x", [], {}, [[]], { kind: "__yok__" }, { kind: null }]) {
      expect(game.parseAction(raw)).toBeNull();
    }
  });

  it("simülasyon: bitiş, saflık, belirlilik, tick bağımsızlığı, sızıntı, sonuç biçimi", () => {
    if (!bot) throw new Error("bot yok");
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 2 ** 31 - 1 }),
        fc.integer({ min: game.minPlayers, max: game.maxPlayers }),
        (seed, playerCount) => {
          checkGameInvariants(game, bot, { seed, playerCount });
        },
      ),
      { numRuns: 100 },
    );
  });

  it("takvimde geçerli, çöp ve katılımcı olmayan eylemler birlikte bulunur", () => {
    if (!bot) throw new Error("bot yok");
    const kinds = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) {
      for (const e of buildActions(bot, seed, ["p1", "p2", "p3"], 0)) kinds.add(e.kind);
    }
    expect([...kinds].sort()).toEqual(["garbage", "outsider", "valid"]);
  });
});
