import { describe, expect, it } from "vitest";
import { createTapRhythm, hapticMs, humLevel, humPitch, RHYTHM_EVERY, STREAK_GAP_MS } from "./rhythm.js";

describe("Aşırı Yükleme kendi hızın", () => {
  it("son 1 sn'deki dokunuşları sayar", () => {
    const r = createTapRhythm();
    for (let i = 0; i < 5; i++) r.push(i * 100);
    expect(r.push(500).rate).toBe(6);
    expect(r.push(1_450).rate).toBe(2); // 500 ve 1450 kaldı
  });

  it("seri yavaş dokunuşla kırılır; her RHYTHM_EVERY dokunuşta ritim", () => {
    const r = createTapRhythm();
    const pulses = Array.from({ length: RHYTHM_EVERY * 2 }, (_, i) => r.push(i * 100));
    expect(pulses.filter((p) => p.rhythm).map((p) => p.streak)).toEqual([RHYTHM_EVERY, RHYTHM_EVERY * 2]);
    expect(r.push(RHYTHM_EVERY * 200 + STREAK_GAP_MS + 1).streak).toBe(1);
  });

  it("perde hızla yükselir ve tavanı vardır; durunca ses yok", () => {
    expect(humPitch(10)).toBeGreaterThan(humPitch(2));
    expect(humPitch(40)).toBe(humPitch(14));
    expect(humLevel(0)).toBe(0);
    expect(humLevel(30)).toBeLessThanOrEqual(0.05);
    expect(humLevel(8)).toBeGreaterThan(humLevel(1));
  });

  it("titreşim: yavaşta yumuşak, seride sert, ritimde en sert", () => {
    const slow = hapticMs({ rate: 1, streak: 1, rhythm: false });
    const fast = hapticMs({ rate: 9, streak: 5, rhythm: false });
    const beat = hapticMs({ rate: 9, streak: 8, rhythm: true });
    expect(slow).toBeLessThan(fast);
    expect(fast).toBeLessThan(beat);
  });

  it("reset sonrası sıfırdan sayar", () => {
    const r = createTapRhythm();
    r.push(0);
    r.push(50);
    r.reset();
    expect(r.push(60)).toEqual({ rate: 1, streak: 1, rhythm: false });
  });
});
