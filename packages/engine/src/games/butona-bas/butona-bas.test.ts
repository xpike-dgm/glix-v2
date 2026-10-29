import { describe, expect, it } from "vitest";
import { isRejected } from "../../game.js";
import { createRng } from "../../rng.js";
import { type ButonaBasState, butonaBas, butonaBasAwards } from "./index.js";
import {
  BUTONA_BAS_DURATION_MS,
  BUTONA_BAS_GAP_MS,
  BUTONA_BAS_ROUND_MS,
  BUTONA_BAS_ROUNDS,
  BUTONA_BAS_WINDOWS_MS,
  butonaBasRoundOffset,
  butonaBasWindowMs,
} from "./types.js";

const T0 = 1_000_000;
const ctx = (now: number, connected: readonly string[] = ["a", "b", "c"]) => ({
  now,
  rng: createRng(1),
  connected,
});
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
    expect(s.endsAt).toBe(T0 + 51_000);
    expect(s.scores).toEqual({ a: 0, b: 0, c: 0 });
  });

  it("aynı pencerede iki farklı oyuncu: ikisi de +1", () => {
    let s = start();
    s = press(s, "a", 10);
    s = press(s, "b", 290);
    s = settleAt(s, 300);
    expect(s.scores).toEqual({ a: 1, b: 1, c: 0 });
    expect(s.recent).toEqual([{ round: 0, index: 0, pressers: ["a", "b"], outcome: "match" }]);
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

  it("bitiş sınırı: 50999 ms kabul, 51000 ms ret", () => {
    const s = start();
    const ok = butonaBas.reduce(s, "a", { kind: "press" }, ctx(T0 + 50_999));
    expect(isRejected(ok)).toBe(false);
    const late = butonaBas.reduce(s, "a", { kind: "press" }, ctx(T0 + BUTONA_BAS_DURATION_MS));
    expect(isRejected(late)).toBe(true);
    expect(isRejected(butonaBas.reduce(s, "a", { kind: "press" }, ctx(T0 + 70_000)))).toBe(true);
  });

  it("son pencere bitişte puanlanır ve oyun biter", () => {
    let s = start();
    s = press(s, "a", 50_900);
    s = press(s, "b", 50_999);
    expect(butonaBas.isFinished(s, ctx(T0 + 50_999))).toBe(false);
    expect(butonaBas.isFinished(s, ctx(T0 + 51_000))).toBe(true);
    s = settleAt(s, 51_000);
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
    expect(s.recent.every((w) => w.round === 0)).toBe(true);
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
    s = settleAt(s, 51_000);
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
    expect(JSON.stringify(spectator)).not.toContain("pending");
  });
  it("herkese açık görünüm herkes için aynıdır ve kişisel alan içermez", () => {
    let s = start();
    s = press(s, "a", 10);
    const pub = butonaBas.publicView(s, ctx(T0 + 20));
    expect(pub.windowMs).toBe(300);
    expect(pub.endsAt - pub.startedAt).toBe(51_000);
    expect([pub.round, pub.rounds, pub.phase]).toEqual([1, 3, "play"]);
    expect(pub.scores).toEqual({ a: 0, b: 0, c: 0 });
    expect(Object.keys(pub).sort()).toEqual([
      "endsAt",
      "phase",
      "phaseEndsAt",
      "recent",
      "round",
      "rounds",
      "scores",
      "startedAt",
      "windowMs",
    ]);
    expect(Object.keys(butonaBas.view(s, "a", ctx(T0 + 20))).sort()).toEqual([
      "myScore",
      "pressedThisWindow",
    ]);
    expect(JSON.stringify(pub)).not.toContain("pending");
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
    const v = butonaBas.publicView(s, ctx(T0 + 400));
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
      for (let t = 0; t < 51_000; t += 50) {
        const id = ids[rng.int(4)] as string;
        if (rng.next() < 0.5) {
          const r = butonaBas.reduce(s, id, { kind: "press" }, ctx(T0 + t));
          if (!isRejected(r)) s = r;
        }
        s = settleAt(s, t);
      }
      s = settleAt(s, 51_000);
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
      for (let t = 0; step > 0 && t <= 51_000; t += step) s = settleAt(s, t);
      return butonaBas.result(s).miniScores;
    };
    expect(play(100)).toEqual(play(0));
    expect(play(1)).toEqual(play(0));
  });
});

describe("butona-bas O8: 3 tur, daralan pencere", () => {
  const R2 = butonaBasRoundOffset(1); // 18_000
  const R3 = butonaBasRoundOffset(2); // 36_000

  it("sabitler: 3 tur, pencere 300/200/120, tur 15 sn, ara 3 sn, toplam 51 sn", () => {
    expect(BUTONA_BAS_ROUNDS).toBe(3);
    expect([...BUTONA_BAS_WINDOWS_MS]).toEqual([300, 200, 120]);
    expect([0, 1, 2].map(butonaBasWindowMs)).toEqual([300, 200, 120]);
    expect(BUTONA_BAS_ROUND_MS).toBe(15_000);
    expect(BUTONA_BAS_GAP_MS).toBe(3_000);
    expect(BUTONA_BAS_DURATION_MS).toBe(51_000);
    expect([R2, R3]).toEqual([18_000, 36_000]);
  });

  it("2. turda pencere 200 ms: 199 ms aynı pencere, 200 ms sonraki", () => {
    let same = start();
    same = press(same, "a", R2);
    same = press(same, "b", R2 + 199);
    same = settleAt(same, R2 + 400);
    expect(same.scores).toEqual({ a: 1, b: 1, c: 0 });
    let split = start();
    split = press(split, "a", R2);
    split = press(split, "b", R2 + 200);
    split = settleAt(split, R2 + 400);
    expect(split.scores).toEqual({ a: -1, b: -1, c: 0 });
    expect(split.recent.map((w) => [w.round, w.index])).toEqual([
      [1, 0],
      [1, 1],
    ]);
  });

  it("3. turda pencere 120 ms: 119 ms aynı pencere, 120 ms sonraki; 300 ms'lik aralık artık eşleşmez", () => {
    let same = start();
    same = press(same, "a", R3);
    same = press(same, "b", R3 + 119);
    same = settleAt(same, R3 + 300);
    expect(same.scores).toEqual({ a: 1, b: 1, c: 0 });
    let split = start();
    split = press(split, "a", R3);
    split = press(split, "b", R3 + 120);
    split = settleAt(split, R3 + 300);
    expect(split.scores).toEqual({ a: -1, b: -1, c: 0 });
    // 1. turda 250 ms arayla basış eşleşirdi (aynı 300 ms pencere); 3. turda eşleşmez.
    let wide = start();
    wide = press(wide, "a", R3 + 10);
    wide = press(wide, "b", R3 + 260);
    wide = settleAt(wide, R3 + 400);
    expect(wide.scores).toEqual({ a: -1, b: -1, c: 0 });
  });

  it("pencereler her turun başından sayılır (tur ortasındaki sapma taşınmaz)", () => {
    // 2. turun ilk 200 ms'si: oyun başından 18000..18200 (18000 / 200 tam bölünür ama tur başından sayılır).
    let s = start();
    s = press(s, "a", R2 + 1);
    s = press(s, "b", R2 + 199);
    s = settleAt(s, R2 + 200);
    expect(s.recent).toEqual([{ round: 1, index: 0, pressers: ["a", "b"], outcome: "match" }]);
  });

  it("turlar arası ara: basış reddedilir, pencere/ceza oluşmaz", () => {
    const s = start();
    for (const at of [15_000, 16_500, 17_999, 33_000, 34_999]) {
      expect(butonaBas.reduce(s, "a", { kind: "press" }, ctx(T0 + at))).toEqual({
        rejected: "between_rounds",
      });
    }
    expect(isRejected(butonaBas.reduce(s, "a", { kind: "press" }, ctx(T0 + 14_999)))).toBe(false);
    expect(isRejected(butonaBas.reduce(s, "a", { kind: "press" }, ctx(T0 + 18_000)))).toBe(false);
    expect(isRejected(butonaBas.reduce(s, "a", { kind: "press" }, ctx(T0 + 36_000)))).toBe(false);
    expect(butonaBas.view(s, "a", ctx(T0 + 16_000)).pressedThisWindow).toBe(false);
  });

  it("tur son penceresi tur bitince puanlanır", () => {
    let s = start();
    s = press(s, "a", 14_900);
    s = press(s, "b", 14_999);
    s = settleAt(s, 14_999);
    expect(s.scores).toEqual({ a: 0, b: 0, c: 0 });
    s = settleAt(s, 15_000);
    expect(s.scores).toEqual({ a: 1, b: 1, c: 0 });
  });

  it("mini puanlar 3 tur boyunca birikir (her tur kendi pencere mantığıyla)", () => {
    let s = start();
    // Tur 1: a+b eşleşir (+1 +1). Tur 2: a tek (-1). Tur 3: b+c eşleşir, a tek (-1 sonraki pencerede).
    s = press(s, "a", 100);
    s = press(s, "b", 200);
    s = press(s, "a", R2 + 50);
    s = press(s, "b", R3 + 10);
    s = press(s, "c", R3 + 100);
    s = press(s, "a", R3 + 500);
    s = settleAt(s, 51_000);
    expect(s.scores).toEqual({ a: 1 - 1 - 1, b: 2, c: 1 });
    const res = butonaBas.result(s);
    expect(res.miniScores).toEqual({ a: -1, b: 2, c: 1 });
  });

  it("genel skor yalnız sonda, toplama göre bir kez: tek lider +2, ikinci +1", () => {
    let s = start();
    for (const [at, ids] of [
      [100, ["a", "b", "c"]],
      [R2 + 50, ["a", "b"]],
      [R3 + 50, ["a"]],
      [R3 + 500, ["a", "b"]],
    ] as const) {
      for (const id of ids) s = press(s, id, at);
    }
    s = settleAt(s, 51_000);
    // a: +1 +1 -1 +1 = 2, b: +1 +1 +1 = 3, c: +1
    expect(butonaBas.result(s).miniScores).toEqual({ a: 2, b: 3, c: 1 });
    expect(butonaBas.result(s).awards).toEqual({ b: 2, a: 1 });
    // Tur sonlarında ara sonuç genel skora yazılmaz: tick yalnız mini puanı değiştirir.
    const mid = settleAt(start(), 20_000);
    expect(butonaBas.result(mid).awards).toEqual({ a: 1, b: 1, c: 1 });
  });

  it("toplamda eşitlik: lider eşitse liderler +1; ikincilik eşitse ikisi de +1", () => {
    let tie = start();
    tie = press(tie, "a", 100);
    tie = press(tie, "b", 100);
    tie = press(tie, "a", R2 + 50);
    tie = press(tie, "b", R2 + 50);
    tie = settleAt(tie, 51_000);
    expect(butonaBas.result(tie).miniScores).toEqual({ a: 2, b: 2, c: 0 });
    expect(butonaBas.result(tie).awards).toEqual({ a: 1, b: 1 });

    let second = start(["a", "b", "c", "d"]);
    for (const id of ["a", "b", "c", "d"]) second = press(second, id, 100);
    for (const id of ["a", "b", "c"]) second = press(second, id, R2 + 50);
    for (const id of ["a", "b"]) second = press(second, id, R3 + 50);
    second = settleAt(second, 51_000);
    expect(butonaBas.result(second).miniScores).toEqual({ a: 3, b: 3, c: 2, d: 1 });
    expect(butonaBas.result(second).awards).toEqual({ a: 1, b: 1 });
    let second2 = start(["a", "b", "c", "d"]);
    for (const id of ["a", "b", "c", "d"]) second2 = press(second2, id, 100);
    for (const id of ["a", "b", "c"]) second2 = press(second2, id, R2 + 50);
    for (const id of ["a", "d"]) second2 = press(second2, id, R3 + 50);
    second2 = settleAt(second2, 51_000);
    expect(butonaBas.result(second2).miniScores).toEqual({ a: 3, b: 2, c: 2, d: 2 });
    expect(butonaBas.result(second2).awards).toEqual({ a: 2, b: 1, c: 1, d: 1 });
  });

  it("görünüm: tur, evre, pencere ve süre bilgisi", () => {
    const s = start();
    const v = (at: number) => butonaBas.publicView(s, ctx(T0 + at));
    expect(v(0)).toMatchObject({
      round: 1,
      rounds: 3,
      phase: "play",
      windowMs: 300,
      phaseEndsAt: T0 + 15_000,
    });
    expect(v(14_999)).toMatchObject({ round: 1, phase: "play", windowMs: 300 });
    // Ara: yaklaşan tur ve daralan pencere.
    expect(v(15_000)).toMatchObject({ round: 2, phase: "gap", windowMs: 200, phaseEndsAt: T0 + 18_000 });
    expect(v(17_999)).toMatchObject({ round: 2, phase: "gap", windowMs: 200 });
    expect(v(18_000)).toMatchObject({ round: 2, phase: "play", windowMs: 200, phaseEndsAt: T0 + 33_000 });
    expect(v(33_000)).toMatchObject({ round: 3, phase: "gap", windowMs: 120, phaseEndsAt: T0 + 36_000 });
    expect(v(36_000)).toMatchObject({ round: 3, phase: "play", windowMs: 120, phaseEndsAt: T0 + 51_000 });
    expect(v(51_000)).toMatchObject({ round: 3, phase: "over", windowMs: 120 });
  });

  it("aynı seed ve girdi aynı sonucu verir; tick sıklığı sonucu değiştirmez (3 tur)", () => {
    const presses: [string, number][] = [
      ["a", 100],
      ["b", 250],
      ["a", R2 + 10],
      ["c", R2 + 150],
      ["b", R2 + 210],
      ["c", R3 + 5],
      ["a", R3 + 100],
      ["b", R3 + 4_000],
      ["c", 50_990],
    ];
    const play = (step: number) => {
      let s = start();
      for (const [id, at] of presses) {
        s = press(s, id, at);
        if (step > 0) s = settleAt(s, at);
      }
      for (let t = 0; step > 0 && t <= 51_000; t += step) s = settleAt(s, t);
      return butonaBas.result(s);
    };
    expect(play(0)).toEqual(play(0));
    expect(play(100)).toEqual(play(0));
    expect(play(7)).toEqual(play(0));
  });
});

describe("registry", () => {
  it("katalog butona-bas içerir", async () => {
    const { GAMES, getCatalog } = await import("../index.js");
    expect(GAMES["butona-bas"]).toBe(butonaBas);
    expect(getCatalog()).toContainEqual({
      id: "butona-bas",
      name: "Butona Bas",
      minPlayers: 2,
      maxPlayers: 8,
      orientation: "portrait",
    });
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

describe("rankAwards (ortak)", () => {
  it("positiveOnly: kimse puan almadıysa ödül yok; 0 puanlılar sıralamaya girmez", async () => {
    const { rankAwards } = await import("../scoring.js");
    expect(rankAwards({ a: 0, b: 0 })).toEqual({ a: 1, b: 1 });
    expect(rankAwards({ a: 0, b: 0 }, { positiveOnly: true })).toEqual({});
    expect(rankAwards({ a: 4, b: 2, c: 0 }, { positiveOnly: true })).toEqual({ a: 2, b: 1 });
    expect(rankAwards({ a: 4, b: 0, c: 0 }, { positiveOnly: true })).toEqual({ a: 2 });
  });
});

describe("butona-bas nextWake", () => {
  const wake = (s: ButonaBasState, at: number) => butonaBas.nextWake?.(s, ctx(T0 + at)) ?? null;

  it("basış yokken evre sonunu (tur bitişi) bildirir", () => {
    expect(wake(start(), 0)).toBe(T0 + BUTONA_BAS_ROUND_MS);
  });

  it("bekleyen pencerenin kapanışı evre sonundan önceyse onu bildirir", () => {
    const s = press(start(), "a", 10);
    expect(wake(s, 10)).toBe(T0 + butonaBasWindowMs(0));
  });

  it("her zaman şimdiden sonra: vadesi gelen pencere puanlanınca bir sonraki an döner", () => {
    let s = press(start(), "a", 10);
    const closes = butonaBasWindowMs(0);
    s = settleAt(s, closes);
    const next = wake(s, closes);
    expect(next).not.toBeNull();
    expect(next as number).toBeGreaterThan(T0 + closes);
  });

  it("tur arasında bir sonraki turun başını, oyun sonunda null bildirir", () => {
    const s = start();
    const gapAt = BUTONA_BAS_ROUND_MS + 1;
    expect(wake(s, gapAt)).toBe(T0 + butonaBasRoundOffset(1));
    expect(wake(s, BUTONA_BAS_DURATION_MS)).toBeNull();
  });

  it("uyandırma anında tick görünür bir şeyi gerçekten değiştirir (bekleyen pencere puanlanır)", () => {
    const s = press(start(), "a", 10);
    const at = wake(s, 10) as number;
    const before = butonaBas.tick(s, ctx(at - 1));
    const after = butonaBas.tick(s, ctx(at));
    expect(before.scores.a).toBe(0);
    expect(after.scores.a).toBe(-1);
  });
});
