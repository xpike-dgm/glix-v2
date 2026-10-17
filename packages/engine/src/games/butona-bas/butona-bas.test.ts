import { describe, expect, it } from "vitest";
import { isRejected } from "../../game.js";
import { createRng } from "../../rng.js";
import { type ButonaBasState, butonaBas, butonaBasAwards } from "./index.js";
import { BUTONA_BAS_DURATION_MS } from "./types.js";

const T0 = 1_000_000;
const ctx = (now: number) => ({ now, rng: createRng(1) });
const start = (players = ["a", "b", "c"]): ButonaBasState => butonaBas.setup(players, ctx(T0));

function press(state: ButonaBasState, id: string, at: number): ButonaBasState {
  const r = butonaBas.reduce(state, id, { kind: "press" }, ctx(T0 + at));
  if (isRejected(r)) throw new Error(`reddedildi: ${r.rejected}`);
  return r;
}
const settleAt = (s: ButonaBasState, at: number) => butonaBas.tick(s, ctx(T0 + at));

describe("butona-bas kuralları", () => {
  it("setup süreyi ve sıfır puanları kurar", () => {
    const s = start();
    expect(s.startedAt).toBe(T0);
    expect(s.endsAt).toBe(T0 + 45_000);
    expect(s.scores).toEqual({ a: 0, b: 0, c: 0 });
  });

  it("aynı pencerede iki farklı oyuncu: ikisi de +1", () => {
    let s = start();
    s = press(s, "a", 10);
    s = press(s, "b", 290);
    s = settleAt(s, 300);
    expect(s.scores).toEqual({ a: 1, b: 1, c: 0 });
    expect(s.recent).toEqual([{ index: 0, pressers: ["a", "b"], outcome: "match" }]);
  });

  it("üç oyuncu eşleşirse üçü de +1", () => {
    let s = start();
    for (const id of ["a", "b", "c"]) s = press(s, id, 5_000);
    s = settleAt(s, 6_000);
    expect(s.scores).toEqual({ a: 1, b: 1, c: 1 });
  });

  it("tek basan -1 alır", () => {
    let s = start();
    s = press(s, "a", 100);
    s = settleAt(s, 300);
    expect(s.scores).toEqual({ a: -1, b: 0, c: 0 });
    expect(s.recent[0]?.outcome).toBe("solo");
  });

  it("kimse basmazsa puan ve geçmiş değişmez", () => {
    const s = settleAt(start(), 10_000);
    expect(s.scores).toEqual({ a: 0, b: 0, c: 0 });
    expect(s.recent).toEqual([]);
  });

  it("aynı oyuncunun aynı penceredeki tekrar basışı tek sayılır", () => {
    let s = start();
    s = press(s, "a", 10);
    s = press(s, "a", 100);
    s = press(s, "a", 299);
    s = settleAt(s, 300);
    expect(s.scores.a).toBe(-1);
    expect(s.recent[0]?.pressers).toEqual(["a"]);
  });

  it("tekrar basış eşleşme yaratmaz", () => {
    let s = start();
    s = press(s, "a", 10);
    s = press(s, "a", 20);
    s = settleAt(s, 300);
    expect(s.scores).toEqual({ a: -1, b: 0, c: 0 });
  });

  it("pencere sınırı: 299 ms aynı pencere, 300 ms sonraki pencere", () => {
    let same = start();
    same = press(same, "a", 0);
    same = press(same, "b", 299);
    same = settleAt(same, 600);
    expect(same.scores).toEqual({ a: 1, b: 1, c: 0 });

    let split = start();
    split = press(split, "a", 0);
    split = press(split, "b", 300);
    split = settleAt(split, 600);
    expect(split.scores).toEqual({ a: -1, b: -1, c: 0 });
    expect(split.recent.map((w) => w.index)).toEqual([0, 1]);
  });

  it("pencere kapanmadan puanlanmaz", () => {
    let s = start();
    s = press(s, "a", 10);
    s = settleAt(s, 299);
    expect(s.scores.a).toBe(0);
    s = settleAt(s, 300);
    expect(s.scores.a).toBe(-1);
  });

  it("tick değişiklik yoksa aynı nesneyi döner", () => {
    const s = start();
    expect(settleAt(s, 1_000)).toBe(s);
  });

  it("bitiş sınırı: 44999 ms kabul, 45000 ms ret", () => {
    const s = start();
    const ok = butonaBas.reduce(s, "a", { kind: "press" }, ctx(T0 + 44_999));
    expect(isRejected(ok)).toBe(false);
    const late = butonaBas.reduce(s, "a", { kind: "press" }, ctx(T0 + BUTONA_BAS_DURATION_MS));
    expect(isRejected(late)).toBe(true);
    expect(isRejected(butonaBas.reduce(s, "a", { kind: "press" }, ctx(T0 + 60_000)))).toBe(true);
  });

  it("son pencere bitişte puanlanır ve oyun biter", () => {
    let s = start();
    s = press(s, "a", 44_900);
    s = press(s, "b", 44_999);
    expect(butonaBas.isFinished(s, ctx(T0 + 44_999))).toBe(false);
    expect(butonaBas.isFinished(s, ctx(T0 + 45_000))).toBe(true);
    s = settleAt(s, 45_000);
    expect(s.scores).toEqual({ a: 1, b: 1, c: 0 });
  });

  it("result tick çağrılmamış pencereleri de sayar", () => {
    let s = start();
    s = press(s, "a", 100);
    s = press(s, "b", 200);
    expect(butonaBas.result(s).miniScores).toEqual({ a: 1, b: 1, c: 0 });
  });

  it("oyuncu olmayan basamaz", () => {
    const r = butonaBas.reduce(start(), "x", { kind: "press" }, ctx(T0 + 10));
    expect(isRejected(r)).toBe(true);
  });

  it("girdi durumu değiştirilmez", () => {
    const s = start();
    const snapshot = JSON.stringify(s);
    press(s, "a", 10);
    expect(JSON.stringify(s)).toBe(snapshot);
  });

  it("recent en fazla 8 kayıt tutar, en yenisi sonda, boş pencereler yok", () => {
    let s = start();
    for (let i = 0; i < 12; i++) s = press(s, "a", i * 600);
    s = settleAt(s, 12 * 600);
    expect(s.recent).toHaveLength(8);
    expect(s.recent.map((w) => w.index)).toEqual([8, 10, 12, 14, 16, 18, 20, 22]);
  });

  it("parseAction yalnız press kabul eder", () => {
    expect(butonaBas.parseAction({ kind: "press" })).toEqual({ kind: "press" });
    for (const bad of [null, 1, "press", [], {}, { kind: "x" }, { kind: "press", extra: 1 }]) {
      expect(butonaBas.parseAction(bad)).toBeNull();
    }
  });
});

describe("butona-bas ödüller", () => {
  it("tek lider +2, ikinci +1, diğerleri 0", () => {
    expect(butonaBasAwards({ a: 5, b: 3, c: 1 })).toEqual({ a: 2, b: 1 });
  });
  it("ikincilik eşitse eşitlerin hepsi +1", () => {
    expect(butonaBasAwards({ a: 5, b: 3, c: 3, d: 1 })).toEqual({ a: 2, b: 1, c: 1 });
  });
  it("lider eşitse liderler yalnız +1", () => {
    expect(butonaBasAwards({ a: 5, b: 5, c: 3 })).toEqual({ a: 1, b: 1 });
  });
  it("herkes eşitse herkes +1", () => {
    expect(butonaBasAwards({ a: 5, b: 5, c: 5, d: 5 })).toEqual({ a: 1, b: 1, c: 1, d: 1 });
  });
  it("negatif puanlar da sıralanır", () => {
    expect(butonaBasAwards({ a: 0, b: -2, c: -2 })).toEqual({ a: 2, b: 1, c: 1 });
  });
  it("result ödülleri mini puanlardan üretir", () => {
    let s = start(["a", "b", "c"]);
    s = press(s, "a", 0);
    s = press(s, "b", 0);
    s = press(s, "a", 600);
    s = press(s, "b", 600);
    s = press(s, "c", 1200);
    s = settleAt(s, 45_000);
    const r = butonaBas.result(s);
    expect(r.miniScores).toEqual({ a: 2, b: 2, c: -1 });
    expect(r.awards).toEqual({ a: 1, b: 1 });
  });
});

describe("butona-bas görünüm", () => {
  it("oyuncu ve izleyici görünümü", () => {
    let s = start();
    s = press(s, "a", 10);
    const mine = butonaBas.view(s, "a", ctx(T0 + 20));
    expect(mine.myScore).toBe(0);
    expect(mine.pressedThisWindow).toBe(true);
    expect(butonaBas.view(s, "b", ctx(T0 + 20)).pressedThisWindow).toBe(false);
    const spectator = butonaBas.view(s, null, ctx(T0 + 20));
    expect(spectator.myScore).toBeNull();
    expect(spectator.pressedThisWindow).toBe(false);
    expect(spectator.windowMs).toBe(300);
    expect(spectator.endsAt - spectator.startedAt).toBe(45_000);
    expect(JSON.stringify(spectator)).not.toContain("pending");
  });
  it("pencere değişince pressedThisWindow sıfırlanır", () => {
    let s = start();
    s = press(s, "a", 10);
    expect(butonaBas.view(s, "a", ctx(T0 + 300)).pressedThisWindow).toBe(false);
  });
  it("görünümü değiştirmek durumu etkilemez", () => {
    let s = start();
    s = press(s, "a", 10);
    s = press(s, "b", 20);
    s = settleAt(s, 300);
    const v = butonaBas.view(s, "a", ctx(T0 + 400));
    v.scores.a = 99;
    v.recent[0]?.pressers.push("z");
    expect(s.scores.a).toBe(1);
    expect(s.recent[0]?.pressers).toEqual(["a", "b"]);
  });
});

describe("butona-bas determinizm", () => {
  it("aynı girdiler aynı sonucu verir", () => {
    const run = () => {
      const rng = createRng(77);
      let s = start(["a", "b", "c", "d"]);
      const ids = ["a", "b", "c", "d"];
      for (let t = 0; t < 45_000; t += 50) {
        const id = ids[rng.int(4)] as string;
        if (rng.next() < 0.5) {
          const r = butonaBas.reduce(s, id, { kind: "press" }, ctx(T0 + t));
          if (!isRejected(r)) s = r;
        }
        s = settleAt(s, t);
      }
      s = settleAt(s, 45_000);
      return butonaBas.result(s);
    };
    expect(run()).toEqual(run());
  });
  it("tick sıklığı sonucu değiştirmez", () => {
    const presses: [string, number][] = [
      ["a", 10],
      ["b", 250],
      ["c", 700],
      ["a", 1_000],
      ["b", 1_100],
      ["c", 44_990],
    ];
    const play = (step: number) => {
      let s = start();
      for (const [id, at] of presses) {
        s = press(s, id, at);
        if (step > 0) s = settleAt(s, at);
      }
      for (let t = 0; step > 0 && t <= 45_000; t += step) s = settleAt(s, t);
      return butonaBas.result(s).miniScores;
    };
    expect(play(100)).toEqual(play(0));
    expect(play(1)).toEqual(play(0));
  });
});

describe("registry", () => {
  it("katalog butona-bas içerir", async () => {
    const { GAMES, getCatalog } = await import("../index.js");
    expect(GAMES["butona-bas"]).toBe(butonaBas);
    expect(getCatalog()).toEqual([
      { id: "butona-bas", name: "Butona Bas", minPlayers: 2, maxPlayers: 8, orientation: "portrait" },
    ]);
  });
  it("briefing en fazla 3 madde", () => {
    expect(butonaBas.briefing.steps.length).toBeLessThanOrEqual(3);
  });
});

describe("butona-bas bot takvimi", () => {
  it("hem eşleşme hem tek başına basış üretir", async () => {
    const { BOTS, buildActions, buildTicks, runSimulation } = await import("../../testing/index.js");
    const bot = BOTS["butona-bas"];
    if (!bot) throw new Error("bot yok");
    let positive = 0;
    let negative = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const players = ["p1", "p2", "p3", "p4"];
      const out = runSimulation(butonaBas, {
        seed,
        players,
        startedAt: T0,
        actions: buildActions(bot, seed, players, T0),
        ticks: buildTicks(seed, "irregular", T0, bot.durationMs),
        durationMs: bot.durationMs,
      });
      for (const v of Object.values(out.result.miniScores)) {
        if (v > 0) positive++;
        if (v < 0) negative++;
      }
    }
    expect(positive).toBeGreaterThan(0);
    expect(negative).toBeGreaterThan(0);
  });
});
