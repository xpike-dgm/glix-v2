import type { CaprazAtesRoundReveal } from "@glix/engine";
import { describe, expect, it } from "vitest";
import { DUEL, duelLabel, FINAL_TIMELINE, INTERVAL_TIMELINE } from "./timeline.js";
import {
  badgesOf,
  eachCount,
  gridColumns,
  mostTargeted,
  nameList,
  outcomeOf,
  parseCaprazAtesView,
  ringPosition,
  scoreText,
  shootersOf,
  stageOf,
  tracersOf,
} from "./view.js";

const first: CaprazAtesRoundReveal = {
  targets: { a: "b", b: "a", c: "a", d: null, e: "d" },
  cover: ["d"],
  scores: { a: 0, b: 0, c: 1, d: 0, e: 1 },
  mutual: [["a", "b"]],
};
const pub = {
  startedAt: 100,
  round: 1,
  roundStartedAt: 100,
  endsAt: 20_100,
  finishAt: 53_100,
  rounds: [],
  totals: null,
  lockedIds: ["a"],
};
const priv = { myTarget: null, cover: false, locked: false };

describe("Çapraz Ateş görünümü", () => {
  it("tur 1 seçimi sırasında görünümü okur", () => {
    const v = parseCaprazAtesView(pub, { myTarget: "b", cover: false, locked: true });
    expect(v?.rounds).toEqual([]);
    expect(v?.myTarget).toBe("b");
    expect(v?.locked).toBe(true);
    expect(v?.lockedIds).toEqual(["a"]);
  });
  it("siper seçimini okur", () => {
    expect(parseCaprazAtesView(pub, { myTarget: null, cover: true, locked: false })?.cover).toBe(true);
  });
  it("açılmış turları ve toplamı okur", () => {
    const v = parseCaprazAtesView({ ...pub, round: 2, rounds: [first, first], totals: { a: 0, c: 2 } }, priv);
    expect(v?.rounds[0]?.cover).toEqual(["d"]);
    expect(v?.rounds[1]?.mutual).toEqual([["a", "b"]]);
    expect(v?.totals).toEqual({ a: 0, c: 2 });
  });
  it("eksik ya da bozuk alanları reddeder", () => {
    const { lockedIds: _drop, ...rest } = pub;
    expect(parseCaprazAtesView(rest, priv)).toBeNull();
    expect(parseCaprazAtesView({ ...pub, lockedIds: [1] }, priv)).toBeNull();
    expect(parseCaprazAtesView({ ...pub, round: 3 }, priv)).toBeNull();
    expect(parseCaprazAtesView({ ...pub, roundStartedAt: "x" }, priv)).toBeNull();
    expect(parseCaprazAtesView({ ...pub, rounds: [first, first, first] }, priv)).toBeNull();
    expect(parseCaprazAtesView({ ...pub, totals: { a: "x" } }, priv)).toBeNull();
    expect(parseCaprazAtesView(pub, { myTarget: null, locked: false })).toBeNull();
    expect(parseCaprazAtesView(pub, { myTarget: 3, cover: false, locked: false })).toBeNull();
    expect(parseCaprazAtesView(null, priv)).toBeNull();
    expect(parseCaprazAtesView(pub, null)).toBeNull();
    for (const bad of [
      { ...first, scores: { a: "x" } },
      { ...first, mutual: [["a"]] },
      { ...first, targets: { a: 5 } },
      { ...first, cover: [7] },
      { targets: first.targets, scores: first.scores, mutual: first.mutual },
    ]) {
      expect(parseCaprazAtesView({ ...pub, rounds: [bad] }, priv)).toBeNull();
    }
  });
  it("aşama: seçim, kapandı, tur 1 kısa açılışı, final", () => {
    const v = parseCaprazAtesView(pub, priv);
    if (!v) throw new Error("okunamadı");
    expect(stageOf(v, 5_000)).toBe("pick");
    expect(stageOf(v, 20_100)).toBe("closed");
    const r2 = { ...v, round: 2 as const, roundStartedAt: 25_100, endsAt: 45_100, rounds: [first] };
    expect(stageOf(r2, 20_200)).toBe("interval");
    expect(stageOf(r2, 25_100)).toBe("pick");
    expect(stageOf(r2, 45_100)).toBe("closed");
    expect(stageOf({ ...r2, rounds: [first, first] }, 45_100)).toBe("final");
  });
});

describe("Çapraz Ateş açılış yardımcıları", () => {
  const order = ["a", "b", "c", "d", "e"];
  it("hedefi olan herkes için iz; karşılıklı ve siper işaretli", () => {
    expect(tracersOf(first, order)).toEqual([
      { from: "a", to: "b", mutual: true, cover: false },
      { from: "b", to: "a", mutual: true, cover: false },
      { from: "c", to: "a", mutual: false, cover: false },
      { from: "e", to: "d", mutual: false, cover: true },
    ]);
  });
  it("bilinmeyen ya da kendine olan hedefi atar", () => {
    const odd = { ...first, targets: { a: "zzz", b: "b", c: "a", d: null, e: null } };
    expect(tracersOf(odd, order)).toEqual([{ from: "c", to: "a", mutual: false, cover: false }]);
  });
  it("sonuç türleri", () => {
    expect(outcomeOf(first, "a")).toBe("clash");
    expect(outcomeOf(first, "c")).toBe("free");
    expect(outcomeOf(first, "d")).toBe("cover");
    expect(outcomeOf({ ...first, cover: [] }, "d")).toBe("idle");
    expect(outcomeOf({ ...first, cover: [], scores: { ...first.scores, d: -1 } }, "d")).toBe("hit");
  });
  it("sana ateş edenler ve en çok hedeflenen", () => {
    expect(shootersOf(first, "a", order)).toEqual(["b", "c"]);
    expect(shootersOf(first, "e", order)).toEqual([]);
    expect(mostTargeted(first, order)).toEqual({ ids: ["a"], count: 2 });
    const tie = { ...first, targets: { a: "b", b: "a", c: null, d: null, e: null } };
    expect(mostTargeted(tie, order)).toEqual({ ids: ["a", "b"], count: 1 });
    expect(mostTargeted({ ...first, targets: {} }, order)).toBeNull();
  });
  it("tur 2 rozetleri tur 1'den gelir", () => {
    expect(badgesOf(first, "a", "b")).toEqual({ shotYou: true, youShot: true, cover: false });
    expect(badgesOf(first, "a", "c")).toEqual({ shotYou: true, youShot: false, cover: false });
    expect(badgesOf(first, "e", "d")).toEqual({ shotYou: false, youShot: true, cover: true });
    expect(badgesOf(undefined, "a", "b")).toEqual({ shotYou: false, youShot: false, cover: false });
  });
  it("metinler", () => {
    expect([1, -1, 0, 2, -2].map(scoreText)).toEqual(["+1", "−1", "0", "+2", "−2"]);
    expect(nameList(["Elif"])).toBe("Elif");
    expect(nameList(["Elif", "Kaan"])).toBe("Elif ve Kaan");
    expect(nameList(["Elif", "Kaan", "Mert"])).toBe("Elif, Kaan ve Mert");
    expect([1, 2, 3, 4, 5, 6, 7].map(eachCount)).toEqual([
      "1'er",
      "2'şer",
      "3'er",
      "4'er",
      "5'er",
      "6'şar",
      "7'şer",
    ]);
  });
  it("daire yerleşimi: ilk oyuncu üstte", () => {
    const p = ringPosition(0, 4);
    expect(p.x).toBeCloseTo(50);
    expect(p.y).toBeLessThan(50);
    expect(ringPosition(1, 4).x).toBeGreaterThan(50);
  });
  it("sütun sayısı", () => {
    expect([2, 3, 4, 5, 6, 7].map((n) => gridColumns(n))).toEqual([2, 2, 2, 3, 3, 3]);
    expect(gridColumns(7, true)).toBe(4);
  });
});

describe("Çapraz Ateş zaman çizelgesi", () => {
  it("final açılışı sırayla ilerler ve oyunun açılış süresine sığar", () => {
    const t = FINAL_TIMELINE;
    const steps = [t.muzzleAt, t.impactAt, t.chipsAt, t.verdictAt, t.shootersAt, t.summaryAt, t.totalAt];
    expect([...steps].sort((x, y) => x - y)).toEqual(steps);
    expect(t.muzzleAt).toBeGreaterThanOrEqual(1_000);
    expect(t.muzzleAt + t.flightMs).toBe(t.impactAt);
    expect(t.flightMs).toBeGreaterThanOrEqual(1_800);
    // Son satırdan sonra en az 2 sn okuma payı.
    expect(t.endMs - t.totalAt).toBeGreaterThanOrEqual(2_000);
  });
  it("tur 1 kısa açılışı 5 sn içinde biter", () => {
    const t = INTERVAL_TIMELINE;
    expect(t.muzzleAt + t.flightMs).toBeLessThanOrEqual(t.impactAt);
    expect(t.nextAt).toBeLessThan(t.endMs);
    expect(t.endMs).toBe(5_000);
  });
  it("düello: son 5 sn karartma, son 3 sn sayılar", () => {
    expect(duelLabel(6_000)).toBeNull();
    expect(duelLabel(DUEL.startMs)).toBe("");
    expect(duelLabel(3_001)).toBe("");
    expect(duelLabel(3_000)).toBe("3");
    expect(duelLabel(1_500)).toBe("2");
    expect(duelLabel(1)).toBe("1");
    expect(duelLabel(0)).toBeNull();
  });
});
