import { describe, expect, it } from "vitest";
import { fitScale, gameBox, tvCanvas } from "./tvLayout.js";

describe("TV tuvali", () => {
  it("1920x1080 ve 1280x720 tuvale tam oturur", () => {
    const a = tvCanvas(1920, 1080);
    expect(a.k).toBe(1);
    expect(a.w).toBe(1920);
    expect(a.h).toBe(1080);
    const b = tvCanvas(1280, 720);
    expect(b.k).toBeCloseTo(2 / 3, 5);
    expect(b.w).toBe(1920);
    expect(b.h).toBe(1080);
  });
  it("farklı oranda ekranı kenar boşluğu bırakmadan doldurur", () => {
    const c = tvCanvas(1280, 800);
    expect(c.w * c.k).toBeCloseTo(1280, 0);
    expect(c.h * c.k).toBeCloseTo(800, 0);
    expect(c.w).toBeGreaterThanOrEqual(1920);
    expect(c.h).toBeGreaterThanOrEqual(1000);
    const wide = tvCanvas(2560, 1080);
    expect(wide.w).toBeGreaterThan(1920);
    expect(wide.h).toBeGreaterThanOrEqual(1000);
  });
  it("fitScale en küçük oranı seçer, boş alanda 0 döner", () => {
    expect(fitScale(1300, 700, 960, 540)).toBeCloseTo(700 / 540, 5);
    expect(fitScale(0, 700, 960, 540)).toBe(0);
  });
  it("oyun kutusu yöne göre", () => {
    expect(gameBox("landscape").w).toBeGreaterThan(gameBox("landscape").h);
    expect(gameBox("portrait").h).toBeGreaterThan(gameBox("portrait").w);
  });
});
