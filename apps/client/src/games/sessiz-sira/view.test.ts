import { describe, expect, it } from "vitest";
import {
  beatsOf,
  parseSessizPrivateView,
  parseSessizPublicView,
  parseSessizView,
  roundVerdict,
} from "./view.js";

const pub = {
  startedAt: 1,
  round: 1,
  rounds: 3,
  phase: "play",
  phaseStartedAt: 3_001,
  phaseEndsAt: 21_001,
  lives: 3,
  maxLives: 3,
  counts: { a: 1, b: 1 },
  plays: [],
  missed: [],
  totals: { a: 0, b: 0 },
  dead: false,
  final: null,
};

describe("Sessiz Sıra görünümü", () => {
  it("geçerli görünümleri kabul eder", () => {
    expect(parseSessizPublicView(pub)).toMatchObject({ round: 1, lives: 3 });
    expect(parseSessizView(pub, { hand: [12, 40] })).toMatchObject({ hand: [12, 40] });
  });

  it("olay akışı ve tur hükmü", () => {
    const v = parseSessizPublicView({
      ...pub,
      phase: "reveal",
      lives: 2,
      plays: [{ playerId: "a", card: 30, ok: false }],
      missed: [{ playerId: "b", card: 10 }],
    });
    expect(v).not.toBeNull();
    if (!v) return;
    expect(beatsOf(v)).toEqual([
      { playerId: "a", card: 30, kind: "wrong" },
      { playerId: "b", card: 10, kind: "missed" },
    ]);
    expect(roundVerdict(v)).toEqual({ text: "Hata! Takım can kaybetti", tone: "bad" });
    expect(roundVerdict({ ...v, plays: [{ playerId: "a", card: 5, ok: true }], missed: [] }).tone).toBe(
      "good",
    );
    expect(roundVerdict({ ...v, plays: [], missed: [{ playerId: "a", card: 5 }] }).text).toBe(
      "Süre doldu! Takım can kaybetti",
    );
    expect(roundVerdict({ ...v, dead: true }).text).toBe("Canlar bitti!");
  });

  it("bozuk veriyi reddeder", () => {
    expect(parseSessizPublicView(null)).toBeNull();
    expect(parseSessizPublicView({ ...pub, phase: "x" })).toBeNull();
    expect(parseSessizPublicView({ ...pub, lives: 4 })).toBeNull();
    expect(parseSessizPublicView({ ...pub, plays: [{ playerId: "a", card: 100, ok: true }] })).toBeNull();
    expect(parseSessizPublicView({ ...pub, plays: [{ playerId: "a", card: 5 }] })).toBeNull();
    expect(parseSessizPublicView({ ...pub, missed: "x" })).toBeNull();
    expect(parseSessizPublicView({ ...pub, dead: "hayır" })).toBeNull();
    expect(parseSessizPrivateView({ hand: [0] })).toBeNull();
    expect(parseSessizPrivateView({ hand: [1.5] })).toBeNull();
    expect(parseSessizPrivateView({})).toBeNull();
    expect(parseSessizView(pub, null)).toBeNull();
  });
});
