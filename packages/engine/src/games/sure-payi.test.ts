import { describe, expect, it } from "vitest";
import { gameClock, LATE_ACTION_GRACE_MS } from "../game.js";
import { replay } from "../replay.js";
import { BOTS, checkGameInvariants } from "../testing/index.js";
import { GAMES } from "./index.js";

/** docs/KURALLAR.md "Geç gelen eylem payı": yalnız bu oyunlar payı kullanır; zamanlama oyunları dışarıdadır. */
const PAYLI = ["zehirli-kadeh", "yazi-yaz", "sozluk-blofu"];

describe("geç gelen eylem payı", () => {
  it("yalnız seçilen oyunlar graceMs taşır", () => {
    const withGrace = Object.values(GAMES)
      .filter((g) => g.graceMs !== undefined)
      .map((g) => g.id)
      .sort();
    expect(withGrace).toEqual([...PAYLI].sort());
    for (const id of PAYLI) expect(GAMES[id]?.graceMs).toBe(LATE_ACTION_GRACE_MS);
  });

  it("oyun saati: başlangıçta donar, sonra payı kadar geridedir; paysızda gerçek saat", () => {
    expect(gameClock(1000, 1000, 250)).toBe(1000);
    expect(gameClock(1000, 1200, 250)).toBe(1000);
    expect(gameClock(1000, 1250, 250)).toBe(1000);
    expect(gameClock(1000, 5000, 250)).toBe(4750);
    expect(gameClock(1000, 5000, undefined)).toBe(5000);
    expect(gameClock(1000, 5000, 0)).toBe(5000);
  });

  describe.each(PAYLI)("%s: oyun saatiyle değişmezler", (id) => {
    it("tick bağımsızlığı, sızıntı yok, replay birebir, belirlilik (çok tohum)", () => {
      const game = GAMES[id];
      const bot = BOTS[id];
      if (!game || !bot) throw new Error("oyun/bot yok");
      for (const seed of [1, 2, 3, 17, 99, 12345]) {
        for (const playerCount of [game.minPlayers, Math.min(game.maxPlayers, 5)]) {
          const { primary } = checkGameInvariants(game, bot, { seed, playerCount });
          // Kayıt oyun saatinde: son an özgün bitişten gerçek bitişe kadar geriden gelir.
          expect(primary.log.endedAt).toBeLessThanOrEqual(primary.endedAt);
          expect(replay(game, primary.log)).toEqual(primary.result);
        }
      }
    });
  });
});
