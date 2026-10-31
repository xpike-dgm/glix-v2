import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { checkGameInvariants } from "../testing/invariants.js";
import { buildActions } from "../testing/simulate.js";
import { BOTS } from "./bots.js";
import { GAMES, getCatalog } from "./index.js";
import { isTaslakOyun, TASLAK_BOTLAR, TASLAK_OYUNLAR, taslakOyunlariAc } from "./taslak.js";

describe("taslak oyunlar kapalıdır", () => {
  it("üç taslak oyun tanımlı; kayıt defterinde, katalogda ve test botlarında YOK", () => {
    expect(Object.keys(TASLAK_OYUNLAR).sort()).toEqual(["ortak-nokta", "sessiz-sira", "tek-ve-kucuk"]);
    for (const id of Object.keys(TASLAK_OYUNLAR)) {
      expect(Object.hasOwn(GAMES, id)).toBe(false);
      expect(getCatalog().some((g) => g.id === id)).toBe(false);
      expect(Object.hasOwn(BOTS, id)).toBe(false);
      expect(isTaslakOyun(id)).toBe(true);
    }
    expect(isTaslakOyun("butona-bas")).toBe(false);
  });

  it("hepsi rastgele havuz dışıdır (açılsalar bile)", () => {
    for (const g of Object.values(TASLAK_OYUNLAR)) expect(g.randomPool).toBe(false);
  });

  it("taslakOyunlariAc() yalnız açık çağrıda kaydeder; katalogda randomPool:false ile görünür", () => {
    // Bu dosya kendi modül örneğinde çalışır; GAMES'i değiştirmek başka test dosyalarını etkilemez.
    const ids = taslakOyunlariAc();
    expect(ids.sort()).toEqual(["ortak-nokta", "sessiz-sira", "tek-ve-kucuk"]);
    for (const id of ids) {
      expect(getCatalog().find((g) => g.id === id)?.randomPool).toBe(false);
    }
    expect(taslakOyunlariAc().length).toBe(3); // tekrar çağrı zararsız
  });
});

describe.each(Object.values(TASLAK_OYUNLAR).map((g) => [g.id, g] as const))(
  "taslak değişmezler: %s",
  (id, game) => {
    const bot = TASLAK_BOTLAR[id];

    it("botu kayıtlı, meta veri tutarlı", () => {
      expect(bot).toBeDefined();
      expect(game.minPlayers).toBeGreaterThanOrEqual(3);
      expect(game.maxPlayers).toBeLessThanOrEqual(8);
      expect(game.briefing.steps.length).toBeLessThanOrEqual(3);
    });

    it('sonuç ekranı kancası (revealAt) tanımlı: sonuç ekranı "Devam et" kuralına bağlı', () => {
      expect(typeof game.revealAt).toBe("function");
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

    it("simülasyon: bitiş, saflık, belirlilik, tick bağımsızlığı, sızıntı, kopma, sonuç biçimi, replay", () => {
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
    }, 90_000);

    it("takvimde geçerli, çöp ve katılımcı olmayan eylemler birlikte bulunur", () => {
      if (!bot) throw new Error("bot yok");
      const kinds = new Set<string>();
      for (let seed = 1; seed <= 20; seed++) {
        for (const e of buildActions(bot, seed, ["p1", "p2", "p3"], 0)) kinds.add(e.kind);
      }
      expect([...kinds].sort()).toEqual(["garbage", "outsider", "valid"]);
    });
  },
);
