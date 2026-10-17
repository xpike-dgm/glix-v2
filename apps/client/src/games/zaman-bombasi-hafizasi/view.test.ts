import { describe, expect, it } from "vitest";
import { clientPhase, isNewResult, litIndexAt, litMs, parseZamanBombasiView, statusOf } from "./view.js";

const pub = {
  order: ["a", "b", "c"],
  eliminated: [],
  scores: { a: 0, b: 1, c: 0 },
  active: "a",
  length: 3,
  phase: "playback",
  turn: 2,
  turnStart: 1000,
  inputStart: 2800,
  deadline: 11_800,
  stepMs: 600,
  playbackIndex: 1,
  sequence: ["kirmizi", "mavi", "sari"],
  pressed: [],
  need: 2,
  last: { turn: 1, player: "b", kind: "ok", at: 900 },
};
const priv = { isOut: false, myTurn: false, turnsAway: 1 };

describe("Zaman Bombası Hafızası görünümü", () => {
  it("geçerli görünümleri birleştirir", () => {
    const v = parseZamanBombasiView(pub, priv);
    expect(v?.sequence).toEqual(["kirmizi", "mavi", "sari"]);
    expect(v?.turnsAway).toBe(1);
    expect(v?.last?.kind).toBe("ok");
  });

  it("giriş evresinde dizi null olabilir", () => {
    const v = parseZamanBombasiView({ ...pub, phase: "input", sequence: null, pressed: ["kirmizi"] }, priv);
    expect(v?.sequence).toBeNull();
    expect(v?.pressed).toEqual(["kirmizi"]);
  });

  it("bozuk görünümü reddeder", () => {
    expect(parseZamanBombasiView(null, priv)).toBeNull();
    expect(parseZamanBombasiView(pub, null)).toBeNull();
    expect(parseZamanBombasiView({ ...pub, phase: "x" }, priv)).toBeNull();
    expect(parseZamanBombasiView({ ...pub, sequence: ["mor"] }, priv)).toBeNull();
    expect(parseZamanBombasiView({ ...pub, scores: { a: "x" } }, priv)).toBeNull();
    expect(parseZamanBombasiView({ ...pub, stepMs: 0 }, priv)).toBeNull();
    expect(parseZamanBombasiView({ ...pub, length: 0 }, priv)).toBeNull();
    expect(parseZamanBombasiView({ ...pub, last: { turn: 1 } }, priv)).toBeNull();
    expect(parseZamanBombasiView({ ...pub, pressed: [1] }, priv)).toBeNull();
    expect(parseZamanBombasiView(pub, { ...priv, myTurn: 1 })).toBeNull();
  });

  it("evreyi mutlak zamandan türetir", () => {
    expect(clientPhase(pub as never, 999)).toBe("pause");
    expect(clientPhase(pub as never, 1000)).toBe("playback");
    expect(clientPhase(pub as never, 2799)).toBe("playback");
    expect(clientPhase(pub as never, 2800)).toBe("input");
    expect(clientPhase(pub as never, 11_799)).toBe("input");
    expect(clientPhase(pub as never, 11_800)).toBe("expired");
    expect(clientPhase({ ...pub, phase: "over" } as never, 0)).toBe("over");
  });

  it("yanan eleman: kısa dizide uzun, uzun dizide kısa yanar; aralarda söner", () => {
    expect(litMs(2, 600)).toBeGreaterThan(litMs(8, 600));
    const v = pub as never;
    expect(litIndexAt(v, 999)).toBe(-1);
    expect(litIndexAt(v, 1000)).toBe(0);
    expect(litIndexAt(v, 1000 + litMs(3, 600) - 1)).toBe(0);
    expect(litIndexAt(v, 1000 + litMs(3, 600))).toBe(-1);
    expect(litIndexAt(v, 1600)).toBe(1);
    expect(litIndexAt(v, 2200)).toBe(2);
    expect(litIndexAt(v, 2800)).toBe(-1);
  });

  it("yeni sonuç yalnız ekran açıkken gelen sıralar için", () => {
    expect(isNewResult(null, 1)).toBe(false);
    expect(isNewResult({ turn: 3, player: "a", kind: "fail", at: 1 }, null)).toBe(false);
    expect(isNewResult({ turn: 3, player: "a", kind: "fail", at: 1 }, 2)).toBe(true);
    expect(isNewResult({ turn: 3, player: "a", kind: "fail", at: 1 }, 3)).toBe(false);
  });

  it("durum başlığı", () => {
    const base = parseZamanBombasiView(pub, priv);
    if (!base) throw new Error("görünüm okunamadı");
    expect(statusOf({ v: base, phase: "playback", spectator: false })).toBe("watch");
    expect(statusOf({ v: { ...base, myTurn: true }, phase: "playback", spectator: false })).toBe("watchMine");
    expect(statusOf({ v: { ...base, myTurn: true }, phase: "input", spectator: false })).toBe("mine");
    expect(statusOf({ v: { ...base, myTurn: true }, phase: "input", spectator: true })).toBe("other");
    expect(statusOf({ v: { ...base, isOut: true }, phase: "input", spectator: false })).toBe("eliminated");
    expect(statusOf({ v: base, phase: "pause", spectator: false })).toBe("ok");
    expect(
      statusOf({
        v: { ...base, last: { turn: 1, player: "b", kind: "timeout", at: 1 } },
        phase: "pause",
        spectator: false,
      }),
    ).toBe("timeout");
    expect(statusOf({ v: { ...base, last: null }, phase: "pause", spectator: false })).toBe("intro");
    expect(statusOf({ v: base, phase: "over", spectator: false })).toBe("over");
  });
});
