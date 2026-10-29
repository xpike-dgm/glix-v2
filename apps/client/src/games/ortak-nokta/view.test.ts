import { describe, expect, it } from "vitest";
import { parseOrtakPrivateView, parseOrtakPublicView, parseOrtakView, partnersOf, pointsOf } from "./view.js";

const board = Array.from({ length: 6 }, (_, i) => ({ color: i, shape: i }));
const pub = {
  startedAt: 1,
  round: 1,
  rounds: 4,
  phase: "choose",
  phaseStartedAt: 1,
  phaseEndsAt: 12_001,
  board,
  totals: { a: 0, b: 0 },
  lockedIds: ["a"],
  reveal: null,
  final: null,
};
const priv = { layout: [3, 1, 0, 5, 4, 2], myTile: 1, locked: false };
const reveal = {
  picks: { a: 2, b: 2, c: 4 },
  groups: [
    { tile: 2, ids: ["a", "b"] },
    { tile: 4, ids: ["c"] },
  ],
  topTile: 2,
  points: { a: 2, b: 2, c: 0 },
};

describe("Ortak Nokta görünümü", () => {
  it("geçerli ortak ve kişisel görünümü kabul eder", () => {
    expect(parseOrtakPublicView(pub)).toMatchObject({ round: 1, phase: "choose" });
    expect(parseOrtakView(pub, priv)).toMatchObject({ myTile: 1, locked: false, board });
  });

  it("sonuç aşamasını ve puanları ayrıştırır", () => {
    const v = parseOrtakPublicView({ ...pub, phase: "reveal", reveal, lockedIds: [] });
    expect(v?.reveal && pointsOf(v.reveal, "a")).toBe(2);
    expect(v?.reveal && partnersOf(v.reveal, "a")).toBe(1);
    expect(v?.reveal && partnersOf(v.reveal, "c")).toBe(0);
    expect(v?.reveal && partnersOf(v.reveal, "ghost")).toBe(0);
  });

  it("bozuk veriyi reddeder", () => {
    expect(parseOrtakPublicView(null)).toBeNull();
    expect(parseOrtakPublicView({ ...pub, phase: "x" })).toBeNull();
    expect(parseOrtakPublicView({ ...pub, board: board.slice(1) })).toBeNull();
    expect(parseOrtakPublicView({ ...pub, board: [...board.slice(1), { color: 9, shape: 0 }] })).toBeNull();
    expect(parseOrtakPublicView({ ...pub, round: 5 })).toBeNull();
    expect(parseOrtakPublicView({ ...pub, lockedIds: [1] })).toBeNull();
    expect(parseOrtakPublicView({ ...pub, reveal: { ...reveal, picks: { a: 9 } } })).toBeNull();
    expect(parseOrtakPublicView({ ...pub, reveal: { ...reveal, topTile: 6 } })).toBeNull();
    expect(parseOrtakPrivateView({ ...priv, layout: [0, 0, 1, 2, 3, 4] })).toBeNull();
    expect(parseOrtakPrivateView({ ...priv, myTile: 6 })).toBeNull();
    expect(parseOrtakPrivateView({ ...priv, locked: "evet" })).toBeNull();
    expect(parseOrtakView(pub, null)).toBeNull();
  });
});
