import { describe, expect, it } from "vitest";
import { median, offsetFromPong, pushSample } from "./clock.js";

describe("saat farkı", () => {
  it("gidiş-dönüşün ortasından hesaplar", () => {
    // istemci 1000'de yolladı, 1100'de aldı; sunucu 5050 dedi → fark 4000
    expect(offsetFromPong(1000, 1100, 5050)).toBe(4000);
  });
  it("medyan tek ve çift sayıda örnekte doğru", () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBe(0);
  });
  it("aykırı bir örnek medyanı bozmaz", () => {
    expect(median([100, 102, 101, 900, 99])).toBe(101);
  });
  it("yalnız son 5 örneği tutar", () => {
    let s: number[] = [];
    for (let i = 1; i <= 8; i++) s = pushSample(s, i);
    expect(s).toEqual([4, 5, 6, 7, 8]);
  });
});
