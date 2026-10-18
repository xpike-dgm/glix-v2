import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChoiceSender, ratioOfValue, SEND_GAP_MS, stepValue, valueFromRatio } from "./numberPicker.js";

describe("sayı seçici hesapları", () => {
  it("konum oranı en yakın tam sayıya çevrilir, uçlara yapışır", () => {
    expect(valueFromRatio(0, 0, 100)).toBe(0);
    expect(valueFromRatio(1, 0, 100)).toBe(100);
    expect(valueFromRatio(0.5, 0, 100)).toBe(50);
    expect(valueFromRatio(0.374, 0, 100)).toBe(37);
    expect(valueFromRatio(-3, 0, 100)).toBe(0);
    expect(valueFromRatio(7, 0, 100)).toBe(100);
    expect(valueFromRatio(Number.NaN, 0, 100)).toBe(0);
  });
  it("her değere çubuktan ulaşılır (100 adım)", () => {
    const seen = new Set<number>();
    for (let px = 0; px <= 2000; px++) seen.add(valueFromRatio(px / 2000, 0, 100));
    expect(seen.size).toBe(101);
  });
  it("değerin konumu 0..1", () => {
    expect(ratioOfValue(0, 0, 100)).toBe(0);
    expect(ratioOfValue(25, 0, 100)).toBe(0.25);
    expect(ratioOfValue(500, 0, 100)).toBe(1);
    expect(ratioOfValue(5, 5, 5)).toBe(0);
  });
  it("adım sınırda durur; değer yokken başlangıçtan sayar", () => {
    expect(stepValue(50, 10, 0, 100, 30)).toBe(60);
    expect(stepValue(95, 10, 0, 100, 30)).toBe(100);
    expect(stepValue(3, -10, 0, 100, 30)).toBe(0);
    expect(stepValue(null, 1, 0, 100, 30)).toBe(31);
    expect(stepValue(null, -10, 0, 100, 30)).toBe(20);
  });
});

describe("ChoiceSender", () => {
  let now = 0;
  beforeEach(() => {
    vi.useFakeTimers();
    now = 0;
  });
  afterEach(() => vi.useRealTimers());
  const make = () => {
    const sent: number[] = [];
    const s = new ChoiceSender(
      (v) => sent.push(v),
      () => now,
    );
    return { s, sent };
  };

  it("bırakınca hemen gönderir", () => {
    const { s, sent } = make();
    s.set(42, true);
    expect(sent).toEqual([42]);
    expect(s.idle).toBe(true);
  });
  it("sürüklerken sıklığı sınırlar ve son değeri kaybetmez", () => {
    const { s, sent } = make();
    s.set(10, false);
    now += 10;
    s.set(20, false);
    now += 10;
    s.set(30, false);
    expect(sent).toEqual([]);
    expect(s.idle).toBe(false);
    now += SEND_GAP_MS;
    vi.advanceTimersByTime(SEND_GAP_MS);
    expect(sent).toEqual([30]);
    s.set(55, true);
    expect(sent).toEqual([30, 55]);
  });
  it("aynı değer iki kez gitmez; sunucu onayı da sayılır", () => {
    const { s, sent } = make();
    s.set(40, true);
    s.set(40, true);
    expect(sent).toEqual([40]);
    s.acknowledge(70);
    s.set(70, true);
    expect(sent).toEqual([40]);
  });
  it("sürükleme sürerken sunucudan gelen değer yerel değeri ezmez", () => {
    const { s } = make();
    s.set(10, false);
    expect(s.idle).toBe(false);
    s.set(10, true);
    expect(s.idle).toBe(true);
  });
});
