import { describe, expect, it } from "vitest";
import {
  BEAT_MAX_MS,
  BEAT_MIN_MS,
  nextStepDelay,
  SEQUENCE_SHARE,
  sequenceSpan,
  sequenceTiming,
  stepsShown,
} from "./sequenceTiming.js";

describe("sequenceTiming", () => {
  it("bol sürede vuruş en çok BEAT_MAX_MS olur", () => {
    expect(sequenceTiming(4, 12_000).beatMs).toBe(BEAT_MAX_MS);
  });

  it("dar sürede vuruşlar sıkışır ve dizi aşama süresinin payına sığar", () => {
    for (const [steps, budget] of [
      [8, 6_000],
      [9, 8_000],
      [6, 12_000],
      [13, 8_000],
    ] as const) {
      const t = sequenceTiming(steps, budget);
      expect(t.beatMs).toBeGreaterThanOrEqual(BEAT_MIN_MS);
      expect(sequenceSpan(steps, t)).toBeLessThanOrEqual(budget * SEQUENCE_SHARE);
    }
  });

  it("gerçek aşama sürelerinde (6 sn, 8 sn, 12 sn) tipik oyuncu sayısı sığar", () => {
    expect(sequenceSpan(5, sequenceTiming(5, 6_000))).toBeLessThan(6_000);
    expect(sequenceSpan(9, sequenceTiming(9, 8_000))).toBeLessThan(8_000);
    expect(sequenceSpan(9, sequenceTiming(9, 12_000))).toBeLessThan(12_000);
  });

  it("stepsShown: giriş nefesinden önce 0, sonra her vuruşta bir artar, sonda sabitlenir", () => {
    const t = { leadMs: 400, beatMs: 1000 };
    expect(stepsShown(0, 3, t)).toBe(0);
    expect(stepsShown(399, 3, t)).toBe(0);
    expect(stepsShown(400, 3, t)).toBe(1);
    expect(stepsShown(1399, 3, t)).toBe(1);
    expect(stepsShown(1400, 3, t)).toBe(2);
    expect(stepsShown(2400, 3, t)).toBe(3);
    expect(stepsShown(60_000, 3, t)).toBe(3);
    expect(stepsShown(5, 0, t)).toBe(0);
  });

  it("nextStepDelay: bir sonraki adıma kalan süre, bitince null", () => {
    const t = { leadMs: 400, beatMs: 1000 };
    expect(nextStepDelay(0, 3, t)).toBe(400);
    expect(nextStepDelay(400, 3, t)).toBe(1000);
    expect(nextStepDelay(900, 3, t)).toBe(500);
    expect(nextStepDelay(2400, 3, t)).toBeNull();
  });
});
