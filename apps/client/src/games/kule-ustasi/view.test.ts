import { describe, expect, it } from "vitest";
import { formatClock, isNewResult, kulePhase, kuleStatus, parseKuleView, pct } from "./view.js";

const tower = [
  { left: 300, width: 400, perfect: false },
  { left: 320, width: 360, perfect: true },
];
const pub = {
  order: ["a", "b", "c"],
  eliminated: [],
  scores: { a: 1, b: 2, c: 1 },
  perfects: { a: 0, b: 1, c: 0 },
  active: "a",
  turn: 3,
  turnStart: 10_000,
  deadline: 16_000,
  speed: 1060,
  blockWidth: 360,
  tower,
  floors: 1,
  need: 2,
  startedAt: 0,
  endsAt: 90_000,
  timeUp: false,
  last: {
    turn: 2,
    player: "b",
    kind: "perfect",
    at: 9_000,
    auto: false,
    dropLeft: 322,
    dropWidth: 360,
    cutLeft: 322,
    cutWidth: 0,
  },
};
const priv = { isOut: false, myTurn: false, turnsAway: 1 };

describe("Kule Ustası görünümü", () => {
  it("geçerli görünümleri birleştirir", () => {
    const v = parseKuleView(pub, priv);
    expect(v?.tower).toHaveLength(2);
    expect(v?.last?.kind).toBe("perfect");
    expect(v?.turnsAway).toBe(1);
  });

  it("ıskada yıkılan kuleyi okur", () => {
    const v = parseKuleView({ ...pub, last: { ...pub.last, kind: "miss", fallen: tower } }, priv);
    expect(v?.last?.fallen).toHaveLength(2);
  });

  it("bozuk görünümü reddeder", () => {
    expect(parseKuleView(null, priv)).toBeNull();
    expect(parseKuleView(pub, null)).toBeNull();
    expect(parseKuleView({ ...pub, tower: [] }, priv)).toBeNull();
    expect(parseKuleView({ ...pub, tower: [{ left: 900, width: 400, perfect: false }] }, priv)).toBeNull();
    expect(parseKuleView({ ...pub, tower: [{ left: 1, width: 0, perfect: false }] }, priv)).toBeNull();
    expect(parseKuleView({ ...pub, scores: { a: "x" } }, priv)).toBeNull();
    expect(parseKuleView({ ...pub, blockWidth: 0 }, priv)).toBeNull();
    expect(parseKuleView({ ...pub, speed: 0 }, priv)).toBeNull();
    expect(parseKuleView({ ...pub, endsAt: 0 }, priv)).toBeNull();
    expect(parseKuleView({ ...pub, last: { turn: 1 } }, priv)).toBeNull();
    expect(parseKuleView({ ...pub, last: { ...pub.last, kind: "x" } }, priv)).toBeNull();
    expect(parseKuleView({ ...pub, last: { ...pub.last, fallen: [1] } }, priv)).toBeNull();
    expect(parseKuleView(pub, { isOut: "x", myTurn: false, turnsAway: null })).toBeNull();
    expect(parseKuleView(pub, { isOut: false, myTurn: false, turnsAway: "1" })).toBeNull();
  });

  it("evre sunucu saatinden türer", () => {
    const v = parseKuleView(pub, priv);
    if (!v) throw new Error("görünüm yok");
    expect(kulePhase(v, 9_000)).toBe("pause");
    expect(kulePhase(v, 10_000)).toBe("moving");
    expect(kulePhase(v, 15_999)).toBe("moving");
    expect(kulePhase(v, 16_000)).toBe("expired");
    expect(kulePhase({ ...v, endsAt: 12_000 }, 12_000)).toBe("expired");
    expect(kulePhase({ ...v, active: null }, 12_000)).toBe("over");
    expect(kulePhase({ ...v, timeUp: true }, 12_000)).toBe("over");
  });

  it("durum başlığı: ara, sıra bende, sıra başkasında, çıktım, izleyici", () => {
    const v = parseKuleView(pub, { isOut: false, myTurn: true, turnsAway: 0 });
    if (!v) throw new Error("görünüm yok");
    expect(kuleStatus({ v, phase: "pause", spectator: false })).toBe("perfect");
    expect(kuleStatus({ v: { ...v, turn: 9 }, phase: "pause", spectator: false })).toBe("intro");
    expect(kuleStatus({ v, phase: "moving", spectator: false })).toBe("mine");
    expect(kuleStatus({ v, phase: "moving", spectator: true })).toBe("other");
    expect(kuleStatus({ v: { ...v, myTurn: false }, phase: "moving", spectator: false })).toBe("other");
    expect(kuleStatus({ v: { ...v, isOut: true, myTurn: false }, phase: "moving", spectator: false })).toBe(
      "eliminated",
    );
    expect(kuleStatus({ v, phase: "over", spectator: false })).toBe("over");
  });

  it("yeni sonuç yalnız ekran açıkken gelen sıralarda sayılır", () => {
    const v = parseKuleView(pub, priv);
    expect(isNewResult(v?.last ?? null, null)).toBe(false);
    expect(isNewResult(v?.last ?? null, 1)).toBe(true);
    expect(isNewResult(v?.last ?? null, 2)).toBe(false);
    expect(isNewResult(null, 1)).toBe(false);
  });

  it("süre ve yüzde biçimi", () => {
    expect(formatClock(65_000)).toBe("1:05");
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(-5)).toBe("0:00");
    expect(formatClock(1)).toBe("0:01");
    expect(pct(500)).toBe(50);
  });
});
