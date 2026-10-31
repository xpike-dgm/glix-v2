import { describe, expect, it } from "vitest";
import {
  addStroke,
  clearStrokes,
  DRAW_COLORS,
  DRAW_ERASER_INDEX,
  DRAW_GRID,
  DRAW_MAX_POINTS,
  DRAW_PALETTE_CLASSIC,
  DRAW_PALETTE_FULL,
  DRAW_PENS,
  type DrawLimits,
  EMPTY_DRAWING,
  parseStrokeFields,
  undoStroke,
} from "./drawing.js";

const LIMITS: DrawLimits = { maxStrokes: 3, maxTotalPoints: 10, maxActions: 6 };
const pts = (n: number): number[] => Array.from({ length: n * 2 }, (_, i) => (i * 7) % (DRAW_GRID + 1));

describe("ortak çizim darbe biçimi", () => {
  it("renk dizini, kalınlık ve noktalar sıkıştırılmış darbede durur", () => {
    for (const color of DRAW_COLORS) {
      const i = DRAW_PENS.indexOf(color);
      const f = parseStrokeFields(
        { kind: "stroke", color, size: 3, points: [1, 2, 3, 4] },
        DRAW_PALETTE_FULL,
      );
      expect(f).not.toBeNull();
      const r = addStroke(EMPTY_DRAWING, f as NonNullable<typeof f>, LIMITS);
      expect("drawing" in r && r.drawing.strokes["0"]).toEqual([i, 3, 1, 2, 3, 4]);
    }
    const e = parseStrokeFields(
      { kind: "stroke", color: "eraser", size: 1, points: [0, 0, 5, 5] },
      DRAW_PALETTE_FULL,
    );
    const r = addStroke(EMPTY_DRAWING, e as NonNullable<typeof e>, LIMITS);
    expect("drawing" in r && r.drawing.strokes["0"]?.[0]).toBe(DRAW_ERASER_INDEX);
  });

  it("bilinmeyen renk, kalınlık ve fazladan alan reddedilir", () => {
    const ok = { kind: "stroke", color: "mavi", size: 2, points: [0, 0, 1, 1] };
    for (const palette of [DRAW_PALETTE_FULL, DRAW_PALETTE_CLASSIC]) {
      expect(parseStrokeFields(ok, palette)).not.toBeNull();
      expect(parseStrokeFields({ ...ok, color: "#ff0000" }, palette)).toBeNull();
      expect(parseStrokeFields({ ...ok, color: "eraser " }, palette)).toBeNull();
      expect(parseStrokeFields({ ...ok, size: 5 }, palette)).toBeNull();
      expect(parseStrokeFields({ ...ok, size: 0 }, palette)).toBeNull();
      expect(parseStrokeFields({ ...ok, size: 2.5 }, palette)).toBeNull();
      expect(parseStrokeFields({ ...ok, width: 9 }, palette)).toBeNull();
      expect(parseStrokeFields({ kind: "stroke", color: "mavi", points: [0, 0, 1, 1] }, palette)).toBeNull();
    }
  });

  it("tam palet 10 renk + silgi ve 4 kalınlık; ilk palet 6 renk + silgi ve 3 kalınlık kabul eder", () => {
    const ok = { kind: "stroke", size: 1, points: [0, 0, 1, 1] };
    expect(DRAW_COLORS).toHaveLength(10);
    // İlk paletin dizinleri ve silgi (6) eski biçimle aynı; yeni renkler silgiden sonra.
    expect(DRAW_ERASER_INDEX).toBe(6);
    expect(DRAW_PENS.slice(0, 7)).toEqual(["beyaz", "pembe", "sari", "yesil", "mavi", "turuncu", "eraser"]);
    expect(DRAW_PENS.slice(7)).toEqual(["kirmizi", "mor", "kahverengi", "gri"]);
    for (const color of ["kirmizi", "mor", "kahverengi", "gri"]) {
      expect(parseStrokeFields({ ...ok, color }, DRAW_PALETTE_FULL)).not.toBeNull();
      expect(parseStrokeFields({ ...ok, color }, DRAW_PALETTE_CLASSIC)).toBeNull();
    }
    for (const color of ["beyaz", "pembe", "sari", "yesil", "mavi", "turuncu", "eraser"])
      expect(parseStrokeFields({ ...ok, color }, DRAW_PALETTE_CLASSIC)).not.toBeNull();
    expect(parseStrokeFields({ ...ok, color: "mavi", size: 4 }, DRAW_PALETTE_FULL)).not.toBeNull();
    expect(parseStrokeFields({ ...ok, color: "mavi", size: 4 }, DRAW_PALETTE_CLASSIC)).toBeNull();
    expect(parseStrokeFields({ ...ok, color: "mavi", size: 3 }, DRAW_PALETTE_CLASSIC)).not.toBeNull();
  });

  it("nokta sayısı 2..120 aralığında, koordinatlar 0..1000 tam sayı", () => {
    const base = { kind: "stroke", color: "beyaz", size: 1 };
    expect(parseStrokeFields({ ...base, points: pts(DRAW_MAX_POINTS) }, DRAW_PALETTE_FULL)).not.toBeNull();
    expect(parseStrokeFields({ ...base, points: pts(DRAW_MAX_POINTS + 1) }, DRAW_PALETTE_FULL)).toBeNull();
    expect(parseStrokeFields({ ...base, points: [1, 2] }, DRAW_PALETTE_FULL)).toBeNull();
    expect(parseStrokeFields({ ...base, points: [1, 2, 3] }, DRAW_PALETTE_FULL)).toBeNull();
    expect(parseStrokeFields({ ...base, points: [0, 0, 1001, 5] }, DRAW_PALETTE_FULL)).toBeNull();
    expect(parseStrokeFields({ ...base, points: [0, 0, 1.5, 5] }, DRAW_PALETTE_FULL)).toBeNull();
  });

  it("darbe, nokta ve eylem kotaları sunucuda uygulanır; geri al noktaları iade eder", () => {
    const stroke = (n: number) => {
      const f = parseStrokeFields(
        { kind: "stroke", color: "sari", size: 2, points: pts(n) },
        DRAW_PALETTE_FULL,
      );
      return f as NonNullable<typeof f>;
    };
    let d = EMPTY_DRAWING;
    for (let i = 0; i < 3; i++) {
      const r = addStroke(d, stroke(3), LIMITS);
      expect("drawing" in r).toBe(true);
      if ("drawing" in r) d = r.drawing;
    }
    expect(addStroke(d, stroke(2), LIMITS)).toEqual({ rejected: "too_many_strokes" });
    const u = undoStroke(d, LIMITS);
    expect("drawing" in u && u.drawing.points).toBe(6);
    if ("drawing" in u) d = u.drawing;
    expect(addStroke(d, stroke(5), LIMITS)).toEqual({ rejected: "too_many_points" });
    const c = clearStrokes(d, LIMITS);
    expect("drawing" in c && c.drawing.actions).toBe(5);
    if ("drawing" in c) d = c.drawing;
    expect(clearStrokes(d, LIMITS)).toEqual({ rejected: "empty" });
    const full = { ...d, actions: LIMITS.maxActions };
    expect(addStroke(full, stroke(2), LIMITS)).toEqual({ rejected: "too_many_actions" });
  });
});
