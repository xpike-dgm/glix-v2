import { describe, expect, it } from "vitest";
import { isRejected } from "../../game.js";
import { createRng } from "../../rng.js";
import { BOTS, buildActions, buildTicks, findLeaks, runSimulation } from "../../testing/index.js";
import { karalamaDefteri as game, KARALAMA_PAIRS, type KaralamaState, karalamaScores } from "./index.js";
import {
  KARALAMA_DRAW_MS,
  KARALAMA_DURATION_MS,
  KARALAMA_MAX_DRAW_ACTIONS,
  KARALAMA_MAX_STROKES,
  KARALAMA_MAX_TOTAL_POINTS,
  KARALAMA_VOTE_MS,
  type KaralamaAction,
} from "./types.js";
import { DRAWING_PAIRS } from "./words.js";

const T0 = 1_000_000;
const PLAYERS = ["a", "b", "c", "d"];
const ctx = (at: number, connected: readonly string[] = PLAYERS) => ({
  now: T0 + at,
  rng: createRng(1),
  connected,
});
const VOTE_AT = KARALAMA_DRAW_MS + 1_000;
const END_AT = KARALAMA_DURATION_MS;

/** Bilgisiz oyuncusu "c" ve kelime çifti belli bir oyun. */
function start(players: string[] = PLAYERS, outsider = "c"): KaralamaState {
  const s = game.setup(players, ctx(0));
  return { ...s, outsider, mainWord: "elma", nearWord: "armut" };
}

function act(
  s: KaralamaState,
  id: string,
  action: KaralamaAction,
  at: number,
  connected?: readonly string[],
) {
  const r = game.reduce(s, id, action, ctx(at, connected));
  if (isRejected(r)) throw new Error(`reddedildi: ${r.rejected}`);
  return r;
}
const reasonOf = (
  s: KaralamaState,
  id: string,
  action: KaralamaAction,
  at: number,
  connected?: readonly string[],
) => {
  const r = game.reduce(s, id, action, ctx(at, connected));
  return isRejected(r) ? r.rejected : null;
};
const stroke = (n = 2, color: "beyaz" | "eraser" = "beyaz"): KaralamaAction => ({
  kind: "stroke",
  color,
  size: 2,
  points: Array.from({ length: n * 2 }, (_, i) => (i * 7) % 1001),
});
const vote = (target: string): KaralamaAction => ({ kind: "vote", target });
const end = (s: KaralamaState) => game.tick(s, ctx(END_AT));
const voting = (s: KaralamaState) => game.tick(s, ctx(VOTE_AT));
const scoresOf = (votes: Record<string, string>, players = PLAYERS, outsider = "c") =>
  game.result(end({ ...start(players, outsider), votes })).awards;

describe("karalama-defteri kurulum", () => {
  it("3-8 oyuncu, çizim 75 sn + oylama 20 sn", () => {
    expect(game.minPlayers).toBe(3);
    expect(game.maxPlayers).toBe(8);
    const s = game.setup(PLAYERS, ctx(0));
    expect(s.drawEndsAt).toBe(T0 + 75_000);
    expect(s.voteEndsAt).toBe(T0 + 95_000);
    expect(KARALAMA_DRAW_MS).toBe(75_000);
    expect(KARALAMA_VOTE_MS).toBe(20_000);
  });

  it("tam olarak bir bilgisiz oyuncu, katılımcılardan rastgele seçilir", () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) {
      const s = game.setup(PLAYERS, { now: T0, rng: createRng(seed), connected: PLAYERS });
      expect(PLAYERS).toContain(s.outsider);
      seen.add(s.outsider);
      let outsiders = 0;
      for (const id of PLAYERS) if (game.view(s, id, ctx(0)).near) outsiders++;
      expect(outsiders).toBe(1);
    }
    expect(seen.size).toBe(PLAYERS.length);
  });

  it("kelime çifti havuzdan gelir; aynı tohum aynı kurulumu verir", () => {
    const rngCtx = () => ({ now: T0, rng: createRng(77), connected: PLAYERS });
    const a = game.setup(PLAYERS, rngCtx());
    expect(game.setup(PLAYERS, rngCtx())).toEqual(a);
    expect(KARALAMA_PAIRS.some((p) => p.main === a.mainWord && p.near === a.nearWord)).toBe(true);
  });

  it("farklı tohumlarda farklı çiftler çıkar", () => {
    const words = new Set<string>();
    for (let seed = 1; seed <= 60; seed++) {
      words.add(game.setup(PLAYERS, { now: T0, rng: createRng(seed), connected: PLAYERS }).mainWord);
    }
    expect(words.size).toBeGreaterThan(20);
  });

  it("oynanabilir havuz: kelimeler >= 3 karakter, biri ötekini içermez, havuzun çoğu korunur", () => {
    expect(KARALAMA_PAIRS.length).toBeGreaterThanOrEqual(DRAWING_PAIRS.length - 20);
    for (const p of KARALAMA_PAIRS) {
      expect([...p.main].length).toBeGreaterThanOrEqual(3);
      expect([...p.near].length).toBeGreaterThanOrEqual(3);
      expect(p.main.includes(p.near) || p.near.includes(p.main), `${p.main}/${p.near}`).toBe(false);
    }
  });

  it("hiçbir havuz kelimesi görünümlerin alan adlarında geçmez (sızıntı denetimi yanlış alarm vermez)", () => {
    const s: KaralamaState = { ...start(), mainWord: "ZZZ", nearWord: "YYY" };
    const voting = act(s, "a", vote("b"), VOTE_AT);
    const done = end(voting);
    const blobs: string[] = [];
    for (const [st, at] of [
      [s, 0],
      [voting, VOTE_AT],
      [done, END_AT],
    ] as const) {
      blobs.push(JSON.stringify(game.publicView(st, ctx(at))));
      for (const id of [...PLAYERS, null]) blobs.push(JSON.stringify(game.view(st, id, ctx(at))));
    }
    const all = blobs
      .join("\n")
      .replace(/"(?:a|b|c|d)"/g, "")
      .replace(/ZZZ|YYY/g, "");
    for (const p of KARALAMA_PAIRS) {
      expect(all.includes(p.main), p.main).toBe(false);
      expect(all.includes(p.near), p.near).toBe(false);
    }
  });

  it("briefing kısa: amaç + en çok 3 madde", () => {
    expect(game.briefing.steps.length).toBeLessThanOrEqual(3);
    expect(game.briefing.goal.length).toBeGreaterThan(0);
  });

  it("katalogda ve kayıtta bulunur", async () => {
    const { GAMES, getCatalog } = await import("../index.js");
    expect(GAMES["karalama-defteri"]).toBe(game);
    expect(getCatalog().some((g) => g.id === "karalama-defteri")).toBe(true);
    expect(BOTS["karalama-defteri"]).toBeDefined();
  });
});

describe("karalama-defteri eylem doğrulama", () => {
  const ok = { kind: "stroke", color: "mavi", size: 3, points: [0, 0, 1000, 1000] };

  it("geçerli darbe, geri al, temizle, oy kabul edilir", () => {
    expect(game.parseAction(ok)).toEqual(ok);
    expect(game.parseAction({ kind: "undo" })).toEqual({ kind: "undo" });
    expect(game.parseAction({ kind: "clear" })).toEqual({ kind: "clear" });
    expect(game.parseAction({ kind: "vote", target: "p2" })).toEqual({ kind: "vote", target: "p2" });
  });

  it("6 palet rengi ve silgi geçerli, başka renk geçersiz", () => {
    for (const color of ["beyaz", "pembe", "sari", "yesil", "mavi", "turuncu", "eraser"]) {
      expect(game.parseAction({ ...ok, color })).not.toBeNull();
    }
    for (const color of ["kirmizi", "", "#fff", 1, null, "Eraser", "__proto__"]) {
      expect(game.parseAction({ ...ok, color })).toBeNull();
    }
  });

  it("kalınlık yalnız 1, 2, 3", () => {
    for (const size of [1, 2, 3]) expect(game.parseAction({ ...ok, size })).not.toBeNull();
    for (const size of [0, 4, 1.5, "2", null, -1, Number.NaN])
      expect(game.parseAction({ ...ok, size })).toBeNull();
  });

  it("nokta sayısı 2..120; tek sayıda sayı, boş ve fazlası geçersiz", () => {
    expect(game.parseAction({ ...ok, points: Array(4).fill(5) })).not.toBeNull();
    expect(game.parseAction({ ...ok, points: Array(240).fill(5) })).not.toBeNull();
    for (const n of [0, 1, 2, 3, 5, 241, 242, 480]) {
      expect(game.parseAction({ ...ok, points: Array(n).fill(5) }), `n=${n}`).toBeNull();
    }
  });

  it("noktalar 0..1000 tam sayı olmak zorunda", () => {
    for (const bad of [-1, 1001, 1.5, Number.NaN, Number.POSITIVE_INFINITY, "5", null, undefined, 1e9]) {
      expect(game.parseAction({ ...ok, points: [0, 0, 5, bad] })).toBeNull();
    }
    expect(game.parseAction({ ...ok, points: "0,0,1,1" })).toBeNull();
    expect(game.parseAction({ ...ok, points: { length: 4 } })).toBeNull();
  });

  it("fazladan veya eksik alan, bilinmeyen tür geçersiz", () => {
    expect(game.parseAction({ ...ok, extra: 1 })).toBeNull();
    expect(game.parseAction({ kind: "stroke", color: "mavi", size: 1 })).toBeNull();
    expect(game.parseAction({ kind: "undo", n: 1 })).toBeNull();
    expect(game.parseAction({ kind: "clear", all: true })).toBeNull();
    expect(game.parseAction({ kind: "vote" })).toBeNull();
    expect(game.parseAction({ kind: "vote", target: 3 })).toBeNull();
    expect(game.parseAction({ kind: "vote", target: "" })).toBeNull();
    expect(game.parseAction({ kind: "vote", target: "x".repeat(65) })).toBeNull();
    expect(game.parseAction({ kind: "press" })).toBeNull();
    expect(game.parseAction([ok])).toBeNull();
  });

  it("en kötü durum darbe mesajı 4 KB altında (protokol zarfıyla)", () => {
    const worst = {
      type: "action",
      seq: 9_999_999,
      payload: {
        kind: "stroke",
        color: "turuncu",
        size: 3,
        points: Array.from({ length: 240 }, () => 1000),
      },
    };
    const bytes = JSON.stringify(worst).length;
    expect(bytes).toBeLessThan(4096);
    expect(game.parseAction(worst.payload)).not.toBeNull();
  });
});

describe("karalama-defteri çizim aşaması", () => {
  it("darbe kaydedilir ve yalnız sahibinin özel görünümünde görünür", () => {
    const s = act(start(), "a", stroke(3), 1_000);
    const mine = game.view(s, "a", ctx(2_000));
    expect(Object.values(mine.strokes)).toHaveLength(1);
    expect(Object.values(mine.strokes)[0]).toEqual([0, 2, 0, 7, 14, 21, 28, 35]);
    expect(game.view(s, "b", ctx(2_000)).strokes).toEqual({});
    expect(game.view(s, null, ctx(2_000)).strokes).toEqual({});
  });

  it("silgi darbesi renk dizini 6 olarak saklanır", () => {
    const s = act(start(), "a", stroke(2, "eraser"), 1_000);
    expect(Object.values(game.view(s, "a", ctx(2_000)).strokes)[0]?.[0]).toBe(6);
  });

  it("çizim süresince çizimler herkese kapalı (publicView.drawings null)", () => {
    const s = act(start(), "a", stroke(), 1_000);
    expect(game.publicView(s, ctx(2_000)).drawings).toBeNull();
    expect(game.publicView(s, ctx(KARALAMA_DRAW_MS - 1)).drawings).toBeNull();
    expect(JSON.stringify(game.publicView(s, ctx(2_000)))).not.toContain("28,35");
  });

  it("geri al son darbeyi siler; sonraki darbe numarası tekrar kullanılmaz", () => {
    let s = act(start(), "a", stroke(2), 1_000);
    s = act(s, "a", stroke(3), 1_100);
    s = act(s, "a", { kind: "undo" }, 1_200);
    expect(Object.keys(game.view(s, "a", ctx(1_300)).strokes)).toEqual(["0"]);
    s = act(s, "a", stroke(4), 1_400);
    expect(Object.keys(game.view(s, "a", ctx(1_500)).strokes)).toEqual(["0", "2"]);
  });

  it("temizle bütün darbeleri siler ve nokta kotasını geri verir", () => {
    let s = act(start(), "a", stroke(50), 1_000);
    s = act(s, "a", stroke(50), 1_100);
    expect(game.view(s, "a", ctx(1_200)).pointsLeft).toBe(KARALAMA_MAX_TOTAL_POINTS - 100);
    s = act(s, "a", { kind: "clear" }, 1_300);
    const v = game.view(s, "a", ctx(1_400));
    expect(v.strokes).toEqual({});
    expect(v.pointsLeft).toBe(KARALAMA_MAX_TOTAL_POINTS);
  });

  it("boş çizimde geri al ve temizle reddedilir", () => {
    expect(reasonOf(start(), "a", { kind: "undo" }, 1_000)).toBe("empty");
    expect(reasonOf(start(), "a", { kind: "clear" }, 1_000)).toBe("empty");
  });

  it("süre bitene kadar düzenlenebilir: son milisaniyede kabul, 75. saniyede çizim reddedilir", () => {
    const s = act(start(), "a", stroke(), 1_000);
    expect(isRejected(game.reduce(s, "a", stroke(), ctx(KARALAMA_DRAW_MS - 1)))).toBe(false);
    expect(isRejected(game.reduce(s, "a", { kind: "undo" }, ctx(KARALAMA_DRAW_MS - 1)))).toBe(false);
    expect(reasonOf(s, "a", stroke(), KARALAMA_DRAW_MS)).toBe("wrong_phase");
    expect(reasonOf(s, "a", { kind: "undo" }, KARALAMA_DRAW_MS + 5_000)).toBe("wrong_phase");
    expect(reasonOf(s, "a", { kind: "clear" }, KARALAMA_DRAW_MS + 5_000)).toBe("wrong_phase");
  });

  it("oyun başlamadan gelen eylem reddedilir", () => {
    expect(reasonOf(start(), "a", stroke(), -1)).toBe("not_started");
  });

  it("katılımcı olmayan çizemez ve oy veremez", () => {
    for (const id of ["ghost", "", "__proto__", "constructor"]) {
      expect(reasonOf(start(), id, stroke(), 1_000)).toBe("not_participant");
      expect(reasonOf(start(), id, vote("a"), VOTE_AT)).toBe("not_participant");
    }
  });

  it("oyuncu başına en çok 400 darbe; geri alınca yer açılır", () => {
    let s = start();
    for (let i = 0; i < KARALAMA_MAX_STROKES; i++) s = act(s, "a", stroke(2), 1_000 + i);
    expect(reasonOf(s, "a", stroke(2), 9_000)).toBe("too_many_strokes");
    expect(isRejected(game.reduce(s, "b", stroke(2), ctx(9_000)))).toBe(false);
    s = act(s, "a", { kind: "undo" }, 9_100);
    expect(isRejected(game.reduce(s, "a", stroke(2), ctx(9_200)))).toBe(false);
  });

  it("toplam nokta kotası aşılamaz", () => {
    let s = start();
    for (let i = 0; i < KARALAMA_MAX_TOTAL_POINTS / 120; i++) s = act(s, "a", stroke(120), 1_000 + i);
    expect(game.view(s, "a", ctx(9_000)).pointsLeft).toBe(0);
    expect(reasonOf(s, "a", stroke(2), 9_000)).toBe("too_many_points");
    s = act(s, "a", { kind: "undo" }, 9_100);
    expect(isRejected(game.reduce(s, "a", stroke(120), ctx(9_200)))).toBe(false);
  });

  it("toplam çizim eylemi sınırı kaydın şişmesini önler", () => {
    let s = start();
    for (let i = 0; i < KARALAMA_MAX_DRAW_ACTIONS / 2; i++) {
      s = act(s, "a", stroke(2), 1_000 + i);
      s = act(s, "a", { kind: "undo" }, 1_000 + i);
    }
    expect(reasonOf(s, "a", stroke(2), 50_000)).toBe("too_many_actions");
    expect(reasonOf(s, "a", { kind: "clear" }, 50_000)).toBe("too_many_actions");
    expect(isRejected(game.reduce(s, "b", stroke(2), ctx(50_000)))).toBe(false);
  });

  it("oyuncuların çizimleri birbirinden bağımsız", () => {
    let s = act(start(), "a", stroke(2), 1_000);
    s = act(s, "b", stroke(3), 1_100);
    s = act(s, "b", { kind: "clear" }, 1_200);
    expect(Object.keys(game.view(s, "a", ctx(2_000)).strokes)).toHaveLength(1);
    expect(game.view(s, "b", ctx(2_000)).strokes).toEqual({});
  });
});

describe("karalama-defteri oylama aşaması", () => {
  it("oylamada çizimler publicView'da açılır (sahipleriyle), özel görünümde darbe kalmaz", () => {
    let s = act(start(), "a", stroke(2), 1_000);
    s = act(s, "b", stroke(3), 1_100);
    const pub = game.publicView(voting(s), ctx(VOTE_AT));
    expect(pub.phase).toBe("vote");
    expect(pub.drawings?.a).toHaveLength(1);
    expect(pub.drawings?.b).toHaveLength(1);
    expect(pub.drawings?.c).toEqual([]);
    expect(pub.drawings?.a?.[0]).toEqual([0, 2, 0, 7, 14, 21]);
    expect(game.view(voting(s), "a", ctx(VOTE_AT)).strokes).toEqual({});
  });

  it("çizim süresince oy reddedilir", () => {
    expect(reasonOf(start(), "a", vote("b"), 10_000)).toBe("wrong_phase");
  });

  it("oy kabul edilir, özel görünümde sahibine görünür", () => {
    const s = act(start(), "a", vote("b"), VOTE_AT);
    expect(game.view(s, "a", ctx(VOTE_AT)).myVote).toBe("b");
    expect(game.view(s, "b", ctx(VOTE_AT)).myVote).toBeNull();
    expect(game.publicView(s, ctx(VOTE_AT)).voted).toEqual(["a"]);
  });

  it("kendine oy verilemez", () => {
    expect(reasonOf(start(), "a", vote("a"), VOTE_AT)).toBe("self_vote");
  });

  it("hedef katılımcı olmalı", () => {
    for (const t of ["ghost", "__proto__", "constructor", "toString"]) {
      expect(reasonOf(start(), "a", vote(t), VOTE_AT)).toBe("bad_target");
    }
  });

  it("hedef bağlı olmalı: kopuk oyuncuya oy reddedilir, bağlıya kabul", () => {
    expect(reasonOf(start(), "a", vote("d"), VOTE_AT, ["a", "b", "c"])).toBe("not_connected");
    expect(isRejected(game.reduce(start(), "a", vote("b"), ctx(VOTE_AT, ["a", "b", "c"])))).toBe(false);
  });

  it("bilgisiz oyuncu da başkasına oy verebilir", () => {
    const s = act(start(), "c", vote("a"), VOTE_AT);
    expect(game.view(s, "c", ctx(VOTE_AT)).myVote).toBe("a");
  });

  it("oy değiştirilebilir: son oy geçerli, oy sayısı tek", () => {
    let s = act(start(), "a", vote("b"), VOTE_AT);
    s = act(s, "a", vote("c"), VOTE_AT + 1_000);
    s = act(s, "a", vote("c"), VOTE_AT + 1_500);
    expect(s.votes).toEqual({ a: "c" });
    expect(game.publicView(s, ctx(VOTE_AT)).voted).toEqual(["a"]);
  });

  it("aynı oyu tekrarlamak durumu değiştirmez", () => {
    const s = act(start(), "a", vote("b"), VOTE_AT);
    expect(act(s, "a", vote("b"), VOTE_AT + 10)).toBe(s);
  });

  it("oylama bitiminden sonra (tick gelmeden de) oy ve çizim reddedilir", () => {
    const s = start();
    expect(reasonOf(s, "a", vote("b"), END_AT)).toBe("ended");
    expect(reasonOf(s, "a", vote("b"), END_AT + 5_000)).toBe("ended");
    expect(reasonOf(s, "a", stroke(), END_AT)).toBe("ended");
    expect(reasonOf(end(s), "a", vote("b"), END_AT - 1)).toBe("ended");
  });

  it("son milisaniyede verilen oy sayılır", () => {
    const s = act(start(), "a", vote("c"), END_AT - 1);
    expect(game.result(end(s)).awards.a).toBe(1);
    expect(s.votes.a).toBe("c");
  });

  it("oyun yalnız oylama bitince biter", () => {
    const s = start();
    expect(game.isFinished(s, ctx(KARALAMA_DRAW_MS))).toBe(false);
    expect(game.isFinished(s, ctx(END_AT - 1))).toBe(false);
    expect(game.isFinished(s, ctx(END_AT))).toBe(true);
  });
});

describe("karalama-defteri puanlama", () => {
  it("bilgisiz tek başına en çok oyu alırsa diğer herkes +1, bilgisiz 0", () => {
    expect(scoresOf({ a: "c", b: "c", d: "a" })).toEqual({ a: 1, b: 1, c: 0, d: 1 });
  });

  it("tek oyla bile tek başına en çoksa yakalanır", () => {
    expect(scoresOf({ a: "c" })).toEqual({ a: 1, b: 1, c: 0, d: 1 });
  });

  it("eşitlikte (bilgisiz + başka oyuncu) bilgisiz kurtulur: yalnız bilgisiz +1", () => {
    expect(scoresOf({ a: "c", b: "d" })).toEqual({ a: 0, b: 0, c: 1, d: 0 });
    expect(scoresOf({ a: "c", b: "c", d: "a", c: "a" })).toEqual({ a: 0, b: 0, c: 1, d: 0 });
  });

  it("başkası daha çok oy alırsa bilgisiz +1", () => {
    expect(scoresOf({ a: "b", c: "b", d: "b", b: "c" })).toEqual({ a: 0, b: 0, c: 1, d: 0 });
  });

  it("hiç oy yoksa herkes eşit sayılır: bilgisiz +1", () => {
    expect(scoresOf({})).toEqual({ a: 0, b: 0, c: 1, d: 0 });
  });

  it("oy vermeyenler sayılmaz, eksik oy kura ile doldurulmaz", () => {
    const s = act(start(), "a", vote("c"), VOTE_AT);
    expect(Object.keys(s.votes)).toEqual(["a"]);
    expect(game.result(end(s)).awards).toEqual({ a: 1, b: 1, c: 0, d: 1 });
  });

  it("bilgisiz yakalansa bile bilgisizin kendi oyu sonucu değiştirmez", () => {
    expect(scoresOf({ a: "c", c: "a" })).toEqual({ a: 0, b: 0, c: 1, d: 0 });
    expect(scoresOf({ a: "c", b: "c", c: "d" })).toEqual({ a: 1, b: 1, c: 0, d: 1 });
  });

  it("bağlantısı kopan oyuncu da puanlanır (katılımcı kalır)", () => {
    const s = act(start(), "a", vote("c"), VOTE_AT, ["a", "b", "c"]);
    const r = game.result(end(s));
    expect(r.awards.d).toBe(1);
  });

  it("bağlantısı kopan bilgisiz oyuncuya oy verilemez; oy hakkı olanlar başkasına verir", () => {
    expect(reasonOf(start(), "a", vote("c"), VOTE_AT, ["a", "b", "d"])).toBe("not_connected");
  });

  it("awards = miniScores, her katılımcı için tam sayı", () => {
    const r = game.result(end({ ...start(), votes: { a: "c", b: "c" } }));
    expect(r.awards).toEqual(r.miniScores);
    expect(Object.keys(r.awards).sort()).toEqual(PLAYERS);
  });

  it("karalamaScores: katılımcı olmayan veya kendine verilen oyları yok sayar", () => {
    const r = karalamaScores(PLAYERS, "c", { a: "a", ghost: "c", b: "ghost", d: "c" });
    expect(r.tally).toEqual({ a: 0, b: 0, c: 1, d: 0 });
    expect(r.caught).toBe(true);
  });

  it("3 ve 8 oyuncuyla puanlama", () => {
    const three = ["a", "b", "c"];
    expect(scoresOf({ a: "c", b: "c" }, three)).toEqual({ a: 1, b: 1, c: 0 });
    const eight = ["a", "b", "c", "d", "e", "f", "g", "h"];
    expect(scoresOf({ a: "c", b: "c", d: "e", f: "e" }, eight)).toEqual({
      a: 0,
      b: 0,
      c: 1,
      d: 0,
      e: 0,
      f: 0,
      g: 0,
      h: 0,
    });
    expect(scoresOf({ a: "c", b: "c", h: "c", d: "e", f: "e" }, eight).c).toBe(0);
  });
});

describe("karalama-defteri zaman ve açılış", () => {
  it("tick süre bitmeden değişiklik yapmaz (aynı nesne)", () => {
    const s = start();
    expect(game.tick(s, ctx(1_000))).toBe(s);
    expect(game.tick(s, ctx(KARALAMA_DRAW_MS - 1))).toBe(s);
    const v = voting(s);
    expect(v.stage).toBe("vote");
    expect(game.tick(v, ctx(END_AT - 1))).toBe(v);
  });

  it("tick bitiş anında açar ve tekrarında aynı nesneyi döner", () => {
    const done = end(start());
    expect(done.stage).toBe("done");
    expect(game.tick(done, ctx(END_AT + 1))).toBe(done);
  });

  it("aşamalar: çizim -> oylama -> bitti", () => {
    const s = start();
    expect(game.publicView(s, ctx(0)).phase).toBe("draw");
    expect(game.publicView(s, ctx(KARALAMA_DRAW_MS - 1)).phase).toBe("draw");
    expect(game.publicView(game.tick(s, ctx(KARALAMA_DRAW_MS)), ctx(KARALAMA_DRAW_MS)).phase).toBe("vote");
    expect(game.publicView(game.tick(s, ctx(END_AT - 1)), ctx(END_AT - 1)).phase).toBe("vote");
    expect(game.publicView(end(s), ctx(END_AT)).phase).toBe("done");
  });

  it("sonuçta bilgisiz oyuncu ve iki kelime açılır, oylar ve sayım görünür", () => {
    const s = end({ ...start(), votes: { a: "c", b: "c", d: "a" } });
    const reveal = game.publicView(s, ctx(END_AT)).reveal;
    expect(reveal).toEqual({
      outsider: "c",
      mainWord: "elma",
      nearWord: "armut",
      votes: { a: "c", b: "c", d: "a" },
      tally: { a: 1, b: 0, c: 2, d: 0 },
      caught: true,
    });
  });

  it("oylama sürerken açılış yok", () => {
    const s = act(start(), "a", vote("c"), VOTE_AT);
    expect(game.publicView(s, ctx(VOTE_AT)).reveal).toBeNull();
    expect(game.publicView(s, ctx(END_AT - 1)).reveal).toBeNull();
  });

  it("açılıştan sonra gizli bilgi kalmaz", () => {
    expect(game.secrets(end(start()))).toEqual([]);
  });

  it("izleyici sonuçta da kelimeyi kendi görünümünde görmez ama publicView'dan öğrenir", () => {
    const v = game.view(end(start()), null, ctx(END_AT));
    expect(v.word).toBeNull();
    expect(game.publicView(end(start()), ctx(END_AT)).reveal?.mainWord).toBe("elma");
  });
});

describe("karalama-defteri gizlilik", () => {
  it("herkes yalnız kendi kelimesini görür: bilgisiz yakın kelimeyi, diğerleri ana kelimeyi", () => {
    const s = start();
    expect(game.view(s, "a", ctx(0))).toMatchObject({ word: "elma", near: false });
    expect(game.view(s, "b", ctx(0))).toMatchObject({ word: "elma", near: false });
    expect(game.view(s, "d", ctx(0))).toMatchObject({ word: "elma", near: false });
    expect(game.view(s, "c", ctx(0))).toMatchObject({ word: "armut", near: true });
    expect(game.view(s, null, ctx(0))).toMatchObject({ word: null, near: false });
  });

  it("secrets: ana kelimenin sahipleri bilgisiz olmayanlar, yakın kelimenin sahibi bilgisiz", () => {
    const entries = game.secrets(start());
    const main = entries.find((e) => e.value === "elma");
    const near = entries.find((e) => e.value === "armut");
    expect(main?.ownerIds).toEqual(["a", "b", "d"]);
    expect(near?.ownerIds).toEqual(["c"]);
    expect(entries).toHaveLength(2);
  });

  it("kelimeler publicView'a ve başkalarının görünümüne sızmaz", () => {
    const s = start();
    expect(findLeaks(game, s, PLAYERS, T0)).toEqual([]);
    expect(findLeaks(game, s, PLAYERS, T0 + VOTE_AT)).toEqual([]);
    const pub = JSON.stringify(game.publicView(s, ctx(0)));
    expect(pub).not.toContain("elma");
    expect(pub).not.toContain("armut");
    expect(JSON.stringify(game.view(s, "a", ctx(0)))).not.toContain("armut");
    expect(JSON.stringify(game.view(s, "c", ctx(0)))).not.toContain("elma");
  });

  it("YAPISAL: bilgisiz oyuncunun kimliği oyun bitene kadar hiçbir görünümde farklılık yaratmaz", () => {
    // Aynı kelimeler, farklı bilgisiz oyuncu: herkese açık görünüm özdeş.
    const withC = start(PLAYERS, "c");
    const withD = start(PLAYERS, "d");
    for (const at of [0, 30_000, VOTE_AT, END_AT - 1]) {
      expect(game.publicView(withC, ctx(at))).toEqual(game.publicView(withD, ctx(at)));
      // Bilgisiz olmayan oyuncuların özel görünümü iki durumda da aynı.
      for (const id of ["a", "b"])
        expect(game.view(withC, id, ctx(at))).toEqual(game.view(withD, id, ctx(at)));
      expect(game.view(withC, null, ctx(at))).toEqual(game.view(withD, null, ctx(at)));
    }
  });

  it("YAPISAL: bilgisiz olmayan iki oyuncunun görünümü (kendi alanları hariç) özdeştir", () => {
    const s = start();
    expect(game.view(s, "a", ctx(0))).toEqual(game.view(s, "b", ctx(0)));
    expect(game.view(s, "a", ctx(VOTE_AT))).toEqual(game.view(s, "d", ctx(VOTE_AT)));
  });

  it("YAPISAL: çizimler, oylar ve oy dağılımı bilgisiz oyuncuyu ele vermez (oylama sürerken)", () => {
    // Aynı eylemler (herkes aynı şeyi çizip oylar) ama bilgisiz farklı: publicView özdeş olmalı.
    const play = (outsider: string) => {
      let s = start(PLAYERS, outsider);
      for (const id of PLAYERS) s = act(s, id, stroke(3), 1_000);
      s = act(s, "a", vote("b"), VOTE_AT);
      s = act(s, "b", vote("a"), VOTE_AT);
      return s;
    };
    const x = play("c");
    const y = play("d");
    expect(game.publicView(x, ctx(VOTE_AT + 100))).toEqual(game.publicView(y, ctx(VOTE_AT + 100)));
    expect(game.publicView(x, ctx(VOTE_AT + 100)).reveal).toBeNull();
  });

  it("YAPISAL: başkasının oyu oylama sürerken hiçbir görünümde hedefiyle birlikte yoktur", () => {
    const base = start();
    const toB = act(base, "a", vote("b"), VOTE_AT);
    const toC = act(base, "a", vote("c"), VOTE_AT);
    // Oyun hedefi yalnız oy verenin özel görünümünü etkiler.
    expect(game.publicView(toB, ctx(VOTE_AT))).toEqual(game.publicView(toC, ctx(VOTE_AT)));
    for (const id of ["b", "c", "d", null]) {
      expect(game.view(toB, id, ctx(VOTE_AT))).toEqual(game.view(toC, id, ctx(VOTE_AT)));
    }
    expect(game.view(toB, "a", ctx(VOTE_AT)).myVote).toBe("b");
  });

  it("YAPISAL: bilgisiz olduğunu gösteren tek alan kendi özel görünümündeki near'dır", () => {
    const s = start();
    const pubKeys = Object.keys(game.publicView(s, ctx(0))).sort();
    expect(pubKeys).toEqual(["drawEndsAt", "drawings", "phase", "players", "reveal", "voteEndsAt", "voted"]);
    for (const id of ["a", "b", "d"]) expect(game.view(s, id, ctx(0)).near).toBe(false);
    expect(game.view(s, "c", ctx(0)).near).toBe(true);
    expect(JSON.stringify(game.publicView(s, ctx(VOTE_AT)))).not.toMatch(/outsider|bilgisiz/);
  });

  it("YAPISAL: çizim süresince başkasının darbesi hiçbir görünümde yok (kendi hariç)", () => {
    const s = act(start(), "a", stroke(5), 1_000);
    const others = ["b", "c", "d", null] as const;
    for (const id of others) {
      expect(game.view(s, id, ctx(2_000))).toEqual(game.view(start(), id, ctx(2_000)));
    }
    expect(game.publicView(s, ctx(2_000))).toEqual(game.publicView(start(), ctx(2_000)));
  });
});

describe("karalama-defteri boyut", () => {
  it("en kötü durumda (8 oyuncu, kota dolu) oylamadaki ortak görünüm 600 KB altında", () => {
    const eight = ["a", "b", "c", "d", "e", "f", "g", "h"];
    let s = start(eight);
    for (const id of eight) {
      for (let i = 0; i < KARALAMA_MAX_TOTAL_POINTS / 120; i++) {
        s = act(
          s,
          id,
          { kind: "stroke", color: "turuncu", size: 3, points: Array(240).fill(1000) },
          1_000 + i,
        );
      }
    }
    const json = JSON.stringify(game.publicView(game.tick(s, ctx(VOTE_AT)), ctx(VOTE_AT)));
    expect(json.length).toBeLessThan(600_000);
  });
});

describe("karalama-defteri botu ve simülasyon", () => {
  it("bot çizim ve oylama eylemleri üretir; üretilenler ayrıştırılır", () => {
    const bot = BOTS["karalama-defteri"];
    if (!bot) throw new Error("bot yok");
    const kinds = new Set<string>();
    let accepted = 0;
    for (let seed = 1; seed <= 15; seed++) {
      const players = ["p1", "p2", "p3", "p4"];
      const out = runSimulation(game, {
        seed,
        players,
        startedAt: T0,
        actions: buildActions(bot, seed, players, T0),
        ticks: buildTicks(seed, "irregular", T0, bot.durationMs),
        durationMs: bot.durationMs,
        onStep: (info) => {
          if (info.label === "action" && info.parsed && !(info.reduced as { rejected?: string }).rejected) {
            kinds.add((info.parsed as KaralamaAction).kind);
            accepted++;
          }
        },
      });
      expect(out.endedAt - T0).toBeGreaterThanOrEqual(KARALAMA_DURATION_MS);
      const total = Object.values(out.result.awards).reduce((a, b) => a + b, 0);
      expect(total === 1 || total === 3).toBe(true); // bilgisiz +1 ya da diğer 3 oyuncu +1
    }
    expect(accepted).toBeGreaterThan(50);
    expect(kinds.has("stroke")).toBe(true);
    expect(kinds.has("vote")).toBe(true);
  });
});
