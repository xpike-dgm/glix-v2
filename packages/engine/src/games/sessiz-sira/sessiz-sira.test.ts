import { describe, expect, it } from "vitest";
import { isRejected } from "../../game.js";
import { createRng } from "../../rng.js";
import { sessizSira as g, type SessizState } from "./index.js";
import {
  SESSIZ_CARDS,
  SESSIZ_DURATION_MS,
  SESSIZ_END_GRACE_MS,
  SESSIZ_LIVES,
  SESSIZ_LOOK_MS,
  SESSIZ_PLAY_MS,
  SESSIZ_REVEAL_MS,
  SESSIZ_ROUNDS,
} from "./types.js";

const T0 = 1_000_000;
const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);
const ctx = (now: number, connected: readonly string[] = ids(8)) => ({ now, rng: createRng(1), connected });

/** Elleri sabitlenmiş bir tur 1 (her oyuncuda tek kart) kurar. */
function fixed(cards: Record<string, number[]>): SessizState {
  const players = Object.keys(cards);
  const s = g.setup(players, ctx(T0));
  return { ...s, hands: cards, deals: [cards, ...s.deals.slice(1)] };
}
const PLAY = SESSIZ_LOOK_MS + 100;
function play(s: SessizState, id: string, at = PLAY) {
  const r = g.reduce(s, id, { kind: "play" }, ctx(T0 + at));
  if (isRejected(r)) throw new Error(`reddedildi: ${r.rejected}`);
  return r as SessizState;
}

describe("sessiz-sira kuralları", () => {
  it("katılım 3–8, dikey, anlatım ≤ 3 madde, rastgele havuz dışı (taslak)", () => {
    expect([g.minPlayers, g.maxPlayers, g.orientation]).toEqual([3, 8, "portrait"]);
    expect(g.briefing.steps.length).toBeLessThanOrEqual(3);
    expect(g.randomPool).toBe(false);
  });

  it("3 tur, kart sayıları 1/2/2, 3 can; azami süre 82 sn", () => {
    expect(SESSIZ_ROUNDS).toBe(3);
    expect(SESSIZ_CARDS).toEqual([1, 2, 2]);
    expect(SESSIZ_LIVES).toBe(3);
    expect(SESSIZ_DURATION_MS).toBe(82_000);
    const s = g.setup(ids(5), ctx(T0));
    expect(Object.values(s.hands).map((h) => h.length)).toEqual([1, 1, 1, 1, 1]);
    expect(s.deals.map((d) => Object.values(d)[0]?.length)).toEqual([1, 2, 2]);
  });

  it("kartlar bir turda benzersiz, 1–99 arası ve elde küçükten büyüğe sıralı", () => {
    const s = g.setup(ids(8), ctx(T0));
    for (const deal of s.deals) {
      const all = Object.values(deal).flat();
      expect(new Set(all).size).toBe(all.length);
      for (const hand of Object.values(deal)) {
        expect([...hand].sort((a, b) => a - b)).toEqual(hand);
        for (const c of hand) expect(c >= 1 && c <= 99).toBe(true);
      }
    }
  });

  it("bakma aşamasında oynanamaz; oynama aşamasında en küçük kartı oynar", () => {
    const s = fixed({ p1: [10, 50], p2: [20, 60], p3: [30, 70] });
    expect(g.reduce(s, "p1", { kind: "play" }, ctx(T0 + 500))).toEqual({ rejected: "not_playing" });
    const a = play(s, "p1");
    expect(a.plays).toEqual([{ playerId: "p1", card: 10, ok: true }]);
    expect(g.view(a, "p1", ctx(T0 + PLAY)).hand).toEqual([50]);
  });

  it("doğru sırada oynanırsa +1 puan, can kaybı yok", () => {
    let s = fixed({ p1: [10], p2: [20], p3: [30] });
    s = play(s, "p1", PLAY);
    s = play(s, "p2", PLAY + 500);
    s = play(s, "p3", PLAY + 900);
    const pub = g.publicView(s, ctx(T0 + PLAY + 1_000));
    expect(pub.lives).toBe(SESSIZ_LIVES);
    expect(pub.totals).toEqual({ p1: 1, p2: 1, p3: 1 });
    expect(pub.plays.every((p) => p.ok)).toBe(true);
  });

  it("hatalı hamle: oynayan −1, takım −1 can, daha küçük kartlar açılıp atılır", () => {
    let s = fixed({ p1: [10], p2: [20], p3: [30] });
    s = play(s, "p3");
    const pub = g.publicView(s, ctx(T0 + PLAY));
    expect(pub.lives).toBe(SESSIZ_LIVES - 1);
    expect(pub.totals).toEqual({ p1: 0, p2: 0, p3: -1 });
    expect(pub.plays).toEqual([{ playerId: "p3", card: 30, ok: false }]);
    expect(pub.missed).toEqual([
      { playerId: "p1", card: 10 },
      { playerId: "p2", card: 20 },
    ]);
    expect(pub.counts).toEqual({ p1: 0, p2: 0, p3: 0 });
  });

  it("açılan kartlar sahibinin elinden de düşer; tur kartlar bitince 1 sn sonra kapanır", () => {
    let s = fixed({ p1: [10], p2: [20], p3: [30] });
    s = play(s, "p3");
    expect(g.view(s, "p1", ctx(T0 + PLAY)).hand).toEqual([]);
    expect(g.publicView(s, ctx(T0 + PLAY + SESSIZ_END_GRACE_MS - 1)).phase).toBe("play");
    expect(g.publicView(s, ctx(T0 + PLAY + SESSIZ_END_GRACE_MS)).phase).toBe("reveal");
  });

  it("iki kartlı elde hatalı hamle yalnız daha küçük kartları açar", () => {
    let s = fixed({ p1: [10, 80], p2: [20, 40], p3: [30, 90] });
    s = play(s, "p2"); // 20 oynandı; p1'in 10'u açılır
    const pub = g.publicView(s, ctx(T0 + PLAY));
    expect(pub.missed).toEqual([{ playerId: "p1", card: 10 }]);
    expect(pub.counts).toEqual({ p1: 1, p2: 1, p3: 2 });
    expect(g.view(s, "p1", ctx(T0 + PLAY)).hand).toEqual([80]);
  });

  it("süre dolunca kalan kartlar açılır ve 1 can gider; kart kalmadıysa can gitmez", () => {
    const s = fixed({ p1: [10], p2: [20], p3: [30] });
    const end = SESSIZ_LOOK_MS + SESSIZ_PLAY_MS[0]!;
    const out = g.publicView(s, ctx(T0 + end));
    expect(out.phase).toBe("reveal");
    expect(out.lives).toBe(SESSIZ_LIVES - 1);
    expect(out.missed.map((m) => m.card)).toEqual([10, 20, 30]);
    let clean = fixed({ p1: [10], p2: [20], p3: [30] });
    clean = play(clean, "p1", PLAY);
    clean = play(clean, "p2", PLAY + 10);
    clean = play(clean, "p3", PLAY + 20);
    expect(g.publicView(clean, ctx(T0 + end)).lives).toBe(SESSIZ_LIVES);
  });

  it("canlar bitince oyun erken biter ve genel skor verilmez", () => {
    let s = fixed({ p1: [10, 11], p2: [20, 21], p3: [30, 31] });
    s = { ...s, lives: 1 };
    s = play(s, "p3");
    const pub = g.publicView(s, ctx(T0 + PLAY + SESSIZ_END_GRACE_MS));
    expect(pub.dead).toBe(true);
    expect(pub.lives).toBe(0);
    const ticked = g.tick(s, ctx(T0 + PLAY + SESSIZ_END_GRACE_MS));
    // Son sonuç süresi bitince oyun biter, ikinci tura geçilmez.
    const done = PLAY + SESSIZ_END_GRACE_MS + SESSIZ_REVEAL_MS;
    expect(g.isFinished(ticked, ctx(T0 + done - 1))).toBe(false);
    expect(g.isFinished(ticked, ctx(T0 + done))).toBe(true);
    const res = g.result(g.tick(ticked, ctx(T0 + done)));
    expect(res.awards).toEqual({ p1: 0, p2: 0, p3: 0 });
    expect(res.miniScores.p3).toBe(-1);
  });

  it("takım ayakta kalırsa mini puana göre ödül: tek lider +2, ikinci +1", () => {
    const s = fixed({ p1: [10], p2: [20], p3: [30] });
    const scored: SessizState = { ...s, scores: { p1: 4, p2: 3, p3: 1 } };
    const res = g.result(scored);
    expect(res.awards).toEqual({ p1: 2, p2: 1, p3: 0 });
  });

  it("tam akış: bakma, oynama, sonuç, sonraki tur; kartlar tur başında dağıtılır", () => {
    let s = fixed({ p1: [10], p2: [20], p3: [30] });
    s = play(s, "p1", PLAY);
    s = play(s, "p2", PLAY + 100);
    s = play(s, "p3", PLAY + 200);
    // Tur 1 kapanışı + 3 sn sonuç sonrası 2. tur bakma aşamasında 2'şer kart gelir.
    const secondStart = PLAY + 200 + SESSIZ_END_GRACE_MS + 3_000;
    const pub = g.publicView(s, ctx(T0 + secondStart));
    expect(pub.round).toBe(2);
    expect(pub.phase).toBe("look");
    expect(pub.counts).toEqual({ p1: 2, p2: 2, p3: 2 });
    expect(pub.totals).toEqual({ p1: 1, p2: 1, p3: 1 });
    expect(g.view(s, "p1", ctx(T0 + secondStart)).hand).toHaveLength(2);
  });

  it("katılımcı olmayan reddedilir; kartı olmayan oyun oynayamaz; çöp ayrıştırılmaz", () => {
    const s = fixed({ p1: [10], p2: [20], p3: [30] });
    expect(g.reduce(s, "ghost", { kind: "play" }, ctx(T0 + PLAY))).toEqual({ rejected: "not_participant" });
    const after = play(s, "p1");
    expect(g.reduce(after, "p1", { kind: "play" }, ctx(T0 + PLAY + 10))).toEqual({ rejected: "no_cards" });
    for (const raw of [{ kind: "play", x: 1 }, { kind: "pass" }, {}, null, "play", []]) {
      expect(g.parseAction(raw)).toBeNull();
    }
    expect(g.parseAction({ kind: "play" })).toEqual({ kind: "play" });
  });
});

describe("sessiz-sira gizlilik (yapısal)", () => {
  it("secrets() boştur (gerekçe: kartlar kısa sayılar)", () => {
    expect(g.secrets(g.setup(ids(4), ctx(T0)))).toEqual([]);
  });

  it("elde kalan kartlar ortak görünümde yok; yalnız sayıları ve oynananlar var", () => {
    const s = fixed({ p1: [11, 55], p2: [22, 66], p3: [33, 77] });
    const pub = g.publicView(s, ctx(T0 + 500));
    const flat = JSON.stringify(pub);
    for (const card of [11, 55, 22, 66, 33, 77]) expect(flat).not.toMatch(new RegExp(`[^0-9]${card}[^0-9]`));
    expect(pub.counts).toEqual({ p1: 2, p2: 2, p3: 2 });
    expect(Object.keys(pub).sort()).toEqual([
      "counts",
      "dead",
      "final",
      "lives",
      "maxLives",
      "missed",
      "phase",
      "phaseEndsAt",
      "phaseStartedAt",
      "plays",
      "round",
      "rounds",
      "startedAt",
      "totals",
    ]);
  });

  it("kişisel görünüm yalnız sahibinin elini taşır; izleyici boş görür", () => {
    const s = fixed({ p1: [11, 55], p2: [22, 66], p3: [33, 77] });
    expect(g.view(s, "p1", ctx(T0 + 500)).hand).toEqual([11, 55]);
    expect(g.view(s, "p2", ctx(T0 + 500)).hand).toEqual([22, 66]);
    expect(JSON.stringify(g.view(s, "p2", ctx(T0 + 500)))).not.toContain("55");
    expect(g.view(s, null, ctx(T0 + 500)).hand).toEqual([]);
  });

  it("gelecek turların elleri hiçbir görünümde yok", () => {
    const s = g.setup(ids(4), ctx(T0));
    const later = JSON.stringify(s.deals[2]);
    expect(JSON.stringify(g.publicView(s, ctx(T0 + 100)))).not.toContain(later);
    for (const id of ids(4)) expect(JSON.stringify(g.view(s, id, ctx(T0 + 100)))).not.toContain(later);
  });

  it("oynanan kart herkese açılır (sahibi ve değeri)", () => {
    let s = fixed({ p1: [10], p2: [20], p3: [30] });
    s = play(s, "p1");
    const pub = g.publicView(s, ctx(T0 + PLAY));
    expect(pub.plays).toEqual([{ playerId: "p1", card: 10, ok: true }]);
  });
});
