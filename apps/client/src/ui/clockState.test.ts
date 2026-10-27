import { describe, expect, it } from "vitest";
import {
  type ClockWindow,
  clockView,
  movedEarlier,
  shouldTick,
  stepFraction,
  tensionLevel,
  URGENT_MS,
} from "./clockState.js";

const win = (urgency = true): ClockWindow => ({ startedAt: 1000, endsAt: 21000, urgency });

describe("clockView", () => {
  it("normal: orta pencerede oran, sayı yok", () => {
    const v = clockView(win(), 11000);
    expect(v.tone).toBe("normal");
    expect(v.fraction).toBeCloseTo(0.5);
    expect(v.secs).toBeNull();
  });
  it("son 5 sn: urgent ve yukarı yuvarlanmış saniye", () => {
    expect(clockView(win(), 21000 - URGENT_MS).secs).toBe(5);
    expect(clockView(win(), 21000 - 4200)).toMatchObject({ tone: "urgent", secs: 5 });
    expect(clockView(win(), 21000 - 900)).toMatchObject({ tone: "urgent", secs: 1 });
  });
  it("urgency kapalıysa son saniyelerde de normal kalır", () => {
    expect(clockView(win(false), 20000)).toMatchObject({ tone: "normal", secs: null });
  });
  it("süre dolunca ve pencere yokken oran 0", () => {
    expect(clockView(win(), 25000)).toMatchObject({ fraction: 0, tone: "normal", secs: null });
    expect(clockView(null, 5).fraction).toBe(0);
  });
});

describe("stepFraction ve erken bitiş", () => {
  it("doğal geri sayımda hedefe doğrudan oturur", () => {
    expect(stepFraction(0.5, 0.4985, 16)).toBe(0.4985);
  });
  it("hedef yükselince hemen oturur", () => {
    expect(stepFraction(0.2, 1, 16)).toBe(1);
  });
  it("hedef birden düşünce sıçramaz, kareler boyunca kapanır", () => {
    const first = stepFraction(0.6, 0, 16);
    expect(first).toBeLessThan(0.6);
    expect(first).toBeGreaterThan(0.3);
    let shown = first;
    for (let i = 0; i < 120; i++) shown = stepFraction(shown, 0, 16);
    expect(shown).toBe(0);
  });
  it("movedEarlier yalnız gelecekteki bir bitişin öne alınmasını sayar", () => {
    expect(movedEarlier(win(), { ...win(), endsAt: 12000 }, 8000)).toBe(true);
    expect(movedEarlier(win(), { ...win(), endsAt: 22000 }, 8000)).toBe(false);
    expect(movedEarlier(win(), { ...win(), endsAt: 12000 }, 22000)).toBe(false);
    expect(movedEarlier(null, win(), 0)).toBe(false);
  });
});

describe("shouldTick", () => {
  it("saniye değişince bir kez çalar, normalde çalmaz", () => {
    const v = clockView(win(), 17500);
    expect(shouldTick(null, v)).toBe(true);
    expect(shouldTick(v.secs, v)).toBe(false);
    expect(shouldTick(null, clockView(win(), 5000))).toBe(false);
  });
});

describe("tensionLevel (gerilim ritmi)", () => {
  const win = { startedAt: 0, endsAt: 30_000, urgency: true };

  it("10 sn'den uzakta ve bittikten sonra kapalı", () => {
    expect(tensionLevel(win, 10_000, true)).toBe(0);
    expect(tensionLevel(win, 19_999, true)).toBe(0);
    expect(tensionLevel(win, 30_000, true)).toBe(0);
    expect(tensionLevel(win, 31_000, true)).toBe(0);
  });

  it("son 10 sn'de açılır ve süre azaldıkça yükselir", () => {
    const a = tensionLevel(win, 21_000, true);
    const b = tensionLevel(win, 27_000, true);
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
    expect(b).toBeLessThanOrEqual(1);
  });

  it("süresi gizli oyunda (saat görünmez) ya da karar süresi değilken asla açılmaz", () => {
    for (let now = 0; now <= 31_000; now += 500) {
      expect(tensionLevel(win, now, false)).toBe(0);
      expect(tensionLevel({ ...win, urgency: false }, now, true)).toBe(0);
    }
    expect(tensionLevel(null, 25_000, true)).toBe(0);
  });
});
