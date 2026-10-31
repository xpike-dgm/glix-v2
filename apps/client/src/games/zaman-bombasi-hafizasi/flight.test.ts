import { describe, expect, it } from "vitest";
import { flightFrames } from "./flight.js";

const xy = (f: Keyframe): [number, number] => {
  const m = /translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(String(f.transform));
  if (!m) throw new Error("translate yok");
  return [Number(m[1]), Number(m[2])];
};

describe("bomba uçuşu", () => {
  it("kaynaktan hedefe yay çizer: uçlar kaynak ve hedef, ortası ikisinden yukarıda", () => {
    const frames = flightFrames({ x: 0, y: 100 }, { x: 200, y: 100 });
    expect(xy(frames[0] as Keyframe)).toEqual([0, 100]);
    expect(xy(frames[frames.length - 1] as Keyframe)).toEqual([200, 100]);
    const mid = xy(frames[Math.floor(frames.length / 2)] as Keyframe);
    expect(mid[1]).toBeLessThan(100);
    for (const f of frames)
      expect(Object.keys(f).every((k) => ["transform", "opacity", "offset"].includes(k))).toBe(true);
  });

  it("atan yoksa hedefin üstünde belirip yerine oturur", () => {
    const frames = flightFrames(null, { x: 50, y: 60 });
    expect(xy(frames[frames.length - 1] as Keyframe)).toEqual([50, 60]);
    expect(frames[0]?.opacity).toBe(0);
  });
});
