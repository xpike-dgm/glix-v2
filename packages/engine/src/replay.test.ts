import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { butonaBas } from "./games/butona-bas/index.js";
import { GameRecorder, MAX_RECORDED_ACTIONS, replay } from "./replay.js";
import { BOTS, buildActions, buildTicks, runSimulation } from "./testing/index.js";

describe("replay ve GameRecorder", () => {
  it("kayıt tutar ve kopyalar", () => {
    const rec = new GameRecorder("butona-bas", 5, ["a", "b"], 100);
    rec.record(150, "a", { kind: "press" });
    const log = rec.finish(200);
    rec.record(160, "b", { kind: "press" });
    expect(log).toEqual({
      gameId: "butona-bas",
      seed: 5,
      players: ["a", "b"],
      startedAt: 100,
      actions: [{ t: 150, playerId: "a", action: { kind: "press" } }],
      endedAt: 200,
    });
    expect(() => rec.record(10, "a", {})).toThrow();
  });

  it("eylem sınırında kaydı durdurur, truncated işaretler; replay reddeder", () => {
    const rec = new GameRecorder("butona-bas", 1, ["a", "b"], 0);
    for (let i = 0; i < MAX_RECORDED_ACTIONS + 5; i++) rec.record(i, "a", { kind: "press" });
    const log = rec.finish(MAX_RECORDED_ACTIONS + 10);
    expect(log.actions).toHaveLength(MAX_RECORDED_ACTIONS);
    expect(log.truncated).toBe(true);
    expect(() => replay(butonaBas, log)).toThrow(/eksik/);
    expect(new GameRecorder("butona-bas", 1, ["a"], 0).finish(1)).not.toHaveProperty("truncated");
  });

  it("yanlış oyun veya bozuk kayıt fırlatır", () => {
    const log = new GameRecorder("baska", 1, ["a", "b"], 0).finish(1);
    expect(() => replay(butonaBas, log)).toThrow();
    const bad = new GameRecorder("butona-bas", 1, ["a", "b"], 0);
    bad.record(5, "a", "çöp");
    expect(() => replay(butonaBas, bad.finish(10))).toThrow();
  });

  it("simülasyonda kaydedilen oyun tekrar oynatılınca aynı sonucu verir", () => {
    const bot = BOTS["butona-bas"];
    if (!bot) throw new Error("bot yok");
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 2 ** 31 - 1 }), fc.integer({ min: 2, max: 8 }), (seed, n) => {
        const players = Array.from({ length: n }, (_, i) => `p${i + 1}`);
        const startedAt = 5_000_000;
        const out = runSimulation(butonaBas, {
          seed,
          players,
          startedAt,
          actions: buildActions(bot, seed, players, startedAt),
          ticks: buildTicks(seed, "irregular", startedAt, bot.durationMs),
          durationMs: bot.durationMs,
        });
        expect(replay(butonaBas, out.log)).toEqual(out.result);
        expect(JSON.parse(JSON.stringify(out.log))).toEqual(out.log);
        expect(replay(butonaBas, JSON.parse(JSON.stringify(out.log)))).toEqual(out.result);
      }),
      { numRuns: 40 },
    );
  });
});
