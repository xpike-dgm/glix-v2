import { describe, expect, it } from "vitest";
import { frameRect } from "./poster.js";

describe("afiş baş kadrajı", () => {
  const fig = { top: 60, bottom: 700, left: 120, right: 390 };
  it("şapka baş kadrajına sığıyorsa kadraj değişmez", () => {
    expect(frameRect("head", fig, 256, 50)).toEqual({ x: 131, y: 42, w: 250, h: 250 });
    expect(frameRect("head", fig, 256)).toEqual({ x: 131, y: 42, w: 250, h: 250 });
  });
  it("uzun şapka için kadraj yukarı ve kare büyür, alt kenar aynı kalır", () => {
    const r = frameRect("head", fig, 256, 7);
    expect(r.y).toBe(-1);
    expect(r.y + r.h).toBe(292);
    expect(r.w).toBe(r.h);
    expect(r.x + r.w / 2).toBe(256);
  });
});
