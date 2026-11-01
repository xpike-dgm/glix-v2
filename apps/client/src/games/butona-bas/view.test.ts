import { describe, expect, it } from "vitest";
import {
  gapStep,
  hintNeeded,
  leadersOf,
  maxWindowIndex,
  newWindows,
  parseButonaBasView,
  rankOf,
  rejoinLine,
  resultOf,
  revealOrder,
  ringWord,
  roundClockAt,
  roundEndLine,
  roundStar,
  shortName,
  stripSplit,
  urgentSecs,
  windowKey,
} from "./view.js";

const win = (over: Record<string, unknown>) => ({
  round: 0,
  index: 0,
  pressers: ["a", "b"],
  outcome: "match",
  points: 1,
  crowd: null,
  settledAt: 500,
  ...over,
});
const pub = {
  startedAt: 100,
  endsAt: 51_100,
  round: 1,
  rounds: 3,
  phase: "play",
  windowMs: 300,
  phaseEndsAt: 15_100,
  scores: { a: 2, b: -1 },
  roundScores: { a: [2, 0, 0], b: [-1, 0, 0] },
  recent: [win({ index: 4 }), win({ index: 6, pressers: ["b"], outcome: "solo", points: -1 })],
  final: null,
};
const priv = { myScore: 2, pressedThisWindow: false, readyAt: null };

describe("Butona Bas görünümü", () => {
  it("geçerli görünümleri birleştirir", () => {
    const v = parseButonaBasView(pub, priv);
    expect(v?.recent).toHaveLength(2);
    expect(v?.myScore).toBe(2);
    expect(v?.scores).toEqual({ a: 2, b: -1 });
    expect(v?.roundScores.a).toEqual([2, 0, 0]);
    expect(v?.final).toBeNull();
  });
  it("izleyicide myScore null olabilir; kişisel görünüm yoksa (TV) boş sayılır", () => {
    expect(parseButonaBasView(pub, { ...priv, myScore: null })?.myScore).toBeNull();
    expect(parseButonaBasView(pub, null)?.myScore).toBeNull();
  });
  it("kalabalık, dolum ve son açılış alanlarını okur", () => {
    const v = parseButonaBasView(
      {
        ...pub,
        phase: "over",
        recent: [win({ points: 2, crowd: "full" })],
        final: { pairs: [{ a: "a", b: "b", count: 3 }], solos: { b: 2 } },
      },
      { ...priv, readyAt: 900 },
    );
    expect(v?.recent[0]).toMatchObject({ points: 2, crowd: "full" });
    expect(v?.final).toEqual({ pairs: [{ a: "a", b: "b", count: 3 }], solos: { b: 2 } });
    expect(v?.readyAt).toBe(900);
  });
  it("bozuk görünümü reddeder", () => {
    expect(parseButonaBasView(null, priv)).toBeNull();
    expect(parseButonaBasView({ ...pub, scores: { a: "x" } }, priv)).toBeNull();
    expect(parseButonaBasView({ ...pub, recent: [win({ outcome: "x" })] }, priv)).toBeNull();
    expect(parseButonaBasView({ ...pub, recent: [win({ crowd: "çok" })] }, priv)).toBeNull();
    expect(parseButonaBasView({ ...pub, roundScores: { a: ["x"] } }, priv)).toBeNull();
    expect(parseButonaBasView({ ...pub, final: { pairs: [{ a: 1 }], solos: {} } }, priv)).toBeNull();
    expect(parseButonaBasView(pub, { ...priv, pressedThisWindow: 1 })).toBeNull();
    expect(parseButonaBasView(pub, { ...priv, readyAt: "x" })).toBeNull();
    const { round: _r, ...noRound } = pub;
    expect(parseButonaBasView(noRound, priv)).toBeNull();
    expect(parseButonaBasView({ ...pub, phase: "x" }, priv)).toBeNull();
  });
  it("yalnız yeni pencereleri verir; ilk görünümde hiçbiri tepki üretmez", () => {
    const v = parseButonaBasView(pub, priv);
    if (!v) throw new Error("görünüm okunamadı");
    expect(newWindows(v.recent, null)).toEqual([]);
    expect(newWindows(v.recent, 4).map((w) => w.index)).toEqual([6]);
    expect(newWindows(v.recent, 6)).toEqual([]);
    expect(maxWindowIndex(v.recent, null)).toBe(6);
    expect(maxWindowIndex([], 3)).toBe(3);
  });
  it("pencere anahtarı turlar arasında artar", () => {
    const a = parseButonaBasView({ ...pub, recent: [win({ round: 0, index: 49 }), win({ round: 1 })] }, priv);
    const [w0, w1] = a?.recent ?? [];
    if (!w0 || !w1) throw new Error("pencere yok");
    expect(windowKey(w1)).toBeGreaterThan(windowKey(w0));
  });
  it("tur ve evre bilgisi yerel saatten türetilir (3 tur, 2 ara)", () => {
    const at = (t: number) => roundClockAt(1_000, 52_000, 1_000 + t);
    expect(at(0)).toMatchObject({ round: 0, phase: "play", windowMs: 300, phaseEndsAt: 16_000 });
    expect(at(15_000)).toMatchObject({ round: 1, phase: "gap", windowMs: 200, phaseStartsAt: 16_000 });
    expect(at(18_000)).toMatchObject({ round: 1, phase: "play", windowMs: 200, phaseEndsAt: 34_000 });
    expect(at(36_000)).toMatchObject({ round: 2, phase: "play", windowMs: 120 });
    expect(at(51_000)).toMatchObject({ round: 2, phase: "over" });
  });
});

describe("Butona Bas arayüz kuralları", () => {
  it("BB-U1: pencere tek kelimeyle, ms yok", () => {
    expect([0, 1, 2].map(ringWord)).toEqual(["Geniş", "Dar", "İğne ucu"]);
  });
  it("BB-U2: lider tacı yalnız puan 0'ın üstündeyse; eşit liderlerin hepsi", () => {
    expect(leadersOf({ a: 0, b: 0 })).toEqual([]);
    expect(leadersOf({ a: 3, b: 3, c: 1 })).toEqual(["a", "b"]);
    expect(rankOf({ a: 5, b: 3, c: 3, d: 1 }, "c")).toEqual({ rank: 2, gap: 2 });
    expect(rankOf({ a: 5, b: 3 }, "a")).toEqual({ rank: 1, gap: 0 });
  });
  it("BB-U2: ad en çok 7 harf, taşan …", () => {
    expect(shortName("Zeynep")).toBe("Zeynep");
    expect(shortName("Muhammedali")).toBe("Muhamme…");
    expect(shortName("Muhammedali", 5)).toBe("Muham…");
    expect([2, 4, 5, 8].map(stripSplit)).toEqual([2, 4, 3, 4]);
  });
  it("BB-U4 / BB-U16: sonuç satırı ve yüzen yazıda işaret", () => {
    const parse = (o: Record<string, unknown>) =>
      parseButonaBasView({ ...pub, recent: [win(o)] }, priv)?.recent[0];
    const m = parse({});
    const c = parse({ points: 2, crowd: "crowd" });
    const f = parse({ points: 2, crowd: "full" });
    const s = parse({ pressers: ["a"], outcome: "solo", points: -1 });
    if (!m || !c || !f || !s) throw new Error("pencere yok");
    expect(resultOf(m)).toEqual({ tone: "match", float: "+1 ✓", line: "+1" });
    expect(resultOf(c)).toEqual({ tone: "crowd", float: "+2 ✓", line: "+2 KALABALIK!" });
    expect(resultOf(f).line).toBe("+2 TAM EKİP!");
    expect(resultOf(s)).toEqual({ tone: "solo", float: "−1 ✕", line: "Yalnız kaldın −1" });
  });
  it("BB-U5: tur yıldızı ve ara adımları", () => {
    const rs = { a: [3, 9, 0], b: [5, 2, 0], c: [-1, 9, 0] };
    expect(roundStar(rs, 0, ["a", "b", "c"])).toEqual({ id: "b", points: 5 });
    expect(roundStar(rs, 1, ["a", "b", "c"])).toEqual({ id: "a", points: 9 });
    expect(roundStar(rs, 2, ["a", "b", "c"])).toBeNull();
    expect([0, 1_199, 1_200, 2_199, 2_200, 2_999].map(gapStep)).toEqual([
      "done",
      "done",
      "gains",
      "gains",
      "tight",
      "tight",
    ]);
  });
  it("BB-U6: son 3 saniye", () => {
    const c = roundClockAt(0, 51_000, 10_000);
    expect(urgentSecs(c, 11_999)).toBeNull();
    expect(urgentSecs(c, 12_000)).toBe(3);
    expect(urgentSecs(c, 14_001)).toBe(1);
    expect(urgentSecs(roundClockAt(0, 51_000, 16_000), 16_000)).toBeNull();
  });
  it("BB-U7: sondan başa açılış, lider en son", () => {
    expect(revealOrder({ a: 5, b: -1, c: 3 }, ["a", "b", "c"])).toEqual(["b", "c", "a"]);
  });
  it("BB-U12 / BB-U15 / BB-U17: bant, ipucu ve ekran okuyucu satırları", () => {
    expect(rejoinLine(roundClockAt(0, 51_000, 18_500), 18_500)).toBeNull();
    expect(rejoinLine(roundClockAt(0, 51_000, 20_000), 20_000)).toBe("Tur 2 sürüyor — bas!");
    expect(rejoinLine(roundClockAt(0, 51_000, 16_000), 16_000)).toBeNull();
    expect(hintNeeded(null, "1")).toBe(true);
    expect(hintNeeded("elif", null)).toBe(true);
    expect(hintNeeded("elif", "1")).toBe(false);
    expect(roundEndLine(1, 9, 2)).toBe("Tur 1 bitti. Puanın 9, ikincisin.");
    expect(roundEndLine(2, -1, 3)).toBe("Tur 2 bitti. Puanın -1, üçüncüsün.");
    expect(roundEndLine(1, null, null)).toBe("Tur 1 bitti.");
  });
});
