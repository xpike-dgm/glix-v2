import { describe, expect, it } from "vitest";
import { flashPeak, shakeGain } from "./shake.js";

describe("shakeGain", () => {
  it("azaltılmış harekette sarsıntı yok", () => {
    expect(shakeGain(true, true)).toBe(0);
    expect(shakeGain(true, false)).toBe(0);
  });
  it("titreşimsiz cihazda biraz güçlü, yoksa 1", () => {
    expect(shakeGain(false, true)).toBeGreaterThan(1);
    expect(shakeGain(false, true)).toBeLessThanOrEqual(1.5);
    expect(shakeGain(false, false)).toBe(1);
  });
});

describe("flashPeak", () => {
  it("güçlenir ama 1'i aşmaz; azaltılmış harekette yarıya iner", () => {
    expect(flashPeak(0.55, false, true)).toBeGreaterThan(0.55);
    expect(flashPeak(0.9, false, true)).toBe(1);
    expect(flashPeak(0.55, false, false)).toBe(0.55);
    expect(flashPeak(0.6, true, true)).toBeCloseTo(0.3);
  });
});
