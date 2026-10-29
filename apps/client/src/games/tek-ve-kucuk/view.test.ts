import { describe, expect, it } from "vitest";
import { columnOf, parseTekPrivateView, parseTekPublicView, parseTekView, pickersOf } from "./view.js";

const pub = {
  startedAt: 1,
  round: 2,
  rounds: 5,
  phase: "choose",
  phaseStartedAt: 1,
  phaseEndsAt: 10_001,
  max: 6,
  previous: [{ winningValue: 2, winner: "a" }],
  totals: { a: 3, b: 0 },
  lockedIds: [],
  reveal: null,
  final: null,
};
const reveal = {
  picks: { a: 1, b: 1, c: 3, d: 4 },
  counts: [2, 0, 1, 1, 0, 0],
  winner: "c",
  winningValue: 3,
  points: { a: 0, b: 0, c: 3, d: 0 },
};

describe("Tek ve Küçük görünümü", () => {
  it("geçerli görünümleri kabul eder", () => {
    expect(parseTekPublicView(pub)).toMatchObject({ round: 2, max: 6 });
    expect(parseTekView(pub, { myValue: 4, locked: false })).toMatchObject({ myValue: 4, locked: false });
  });

  it("sütun durumları ve seçenler", () => {
    const v = parseTekPublicView({ ...pub, phase: "reveal", reveal });
    const r = v?.reveal;
    expect(r).toBeTruthy();
    if (!r) return;
    expect(columnOf(r, 1)).toBe("clash");
    expect(columnOf(r, 2)).toBe("empty");
    expect(columnOf(r, 3)).toBe("win");
    expect(columnOf(r, 4)).toBe("solo");
    expect(pickersOf(r, 1)).toEqual(["a", "b"]);
  });

  it("bozuk veriyi reddeder", () => {
    expect(parseTekPublicView(undefined)).toBeNull();
    expect(parseTekPublicView({ ...pub, max: 11 })).toBeNull();
    expect(parseTekPublicView({ ...pub, phase: "done" })).toBeNull();
    expect(parseTekPublicView({ ...pub, previous: [{ winningValue: 99, winner: null }] })).toBeNull();
    expect(parseTekPublicView({ ...pub, reveal: { ...reveal, picks: { a: 0 } } })).toBeNull();
    expect(parseTekPublicView({ ...pub, reveal: { ...reveal, counts: "x" } })).toBeNull();
    expect(parseTekPublicView({ ...pub, totals: { a: "1" } })).toBeNull();
    expect(parseTekPrivateView({ myValue: 0, locked: false })).toBeNull();
    expect(parseTekPrivateView({ myValue: 3 })).toBeNull();
    expect(parseTekView(pub, 5)).toBeNull();
  });
});
