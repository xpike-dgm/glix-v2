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
      presence: [],
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

describe("presence", () => {
  // Bağlı listesini her tick'te ve eylemde durumda biriktiren deneme oyunu.
  const probe = {
    ...butonaBas,
    id: "butona-bas",
    setup: (_p: readonly string[], ctx: { now: number; connected: readonly string[] }) => ({
      trail: [`setup:${ctx.connected.join(",")}`],
      end: ctx.now + 1_000,
    }),
    reduce: (
      s: { trail: string[]; end: number },
      id: string,
      _a: unknown,
      ctx: { connected: readonly string[] },
    ) => ({
      ...s,
      trail: [...s.trail, `${id}:${ctx.connected.join(",")}`],
    }),
    tick: (s: unknown) => s,
    parseAction: () => ({}),
    isFinished: () => false,
    result: (s: { trail: string[] }) => ({
      miniScores: Object.fromEntries(s.trail.map((t, i) => [`${i}:${t}`, i])),
      awards: {},
    }),
  };

  it("replay bağlı listesini presence'tan kurar (aynı anda presence önce)", () => {
    const rec = new GameRecorder("butona-bas", 1, ["a", "b", "c"], 100);
    rec.presence(100, "c", false);
    rec.record(150, "a", {});
    rec.presence(200, "b", false);
    rec.presence(200, "c", true);
    rec.record(200, "a", {});
    rec.presence(300, "b", true);
    const log = rec.finish(400);
    expect(log.presence).toHaveLength(4);
    // biome-ignore lint/suspicious/noExplicitAny: deneme oyunu
    const res = replay(probe as any, log);
    expect(Object.keys(res.miniScores)).toEqual(["0:setup:a,b", "1:a:a,b", "2:a:a,c"]);
    expect(() => rec.presence(10, "a", false)).toThrow();
  });

  it("simülasyon: kopmalar üretilir, herkes aynı anda kopuk kalmaz ve replay eşleşir", () => {
    const bot = BOTS["butona-bas"];
    if (!bot) throw new Error("bot yok");
    let events = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const players = ["p1", "p2", "p3"];
      const startedAt = 7_000;
      const out = runSimulation(butonaBas, {
        seed,
        players,
        startedAt,
        actions: buildActions(bot, seed, players, startedAt),
        ticks: buildTicks(seed, "irregular", startedAt, bot.durationMs),
        durationMs: bot.durationMs,
        disconnectProbability: 0.8,
      });
      const online = new Set(players);
      for (const p of out.log.presence) {
        events++;
        if (p.connected) online.add(p.playerId);
        else online.delete(p.playerId);
        expect(online.size).toBeGreaterThan(0);
      }
      expect(replay(butonaBas, out.log)).toEqual(out.result);
    }
    expect(events).toBeGreaterThan(0);
  });
});
