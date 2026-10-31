import { WIRE_COLORS } from "@glix/engine";
import { describe, expect, it } from "vitest";
import { cbShape } from "../../ui/cbShapes.js";
import { COLOR_MARK, COLOR_PATTERN } from "./view.js";

describe("kablo renkleri için renk körlüğü işaretleri", () => {
  it("her kablo rengi ayrı bir şekil taşır", () => {
    const shapes = WIRE_COLORS.map((c) => cbShape(COLOR_MARK[c]).name);
    expect(new Set(shapes).size).toBe(WIRE_COLORS.length);
  });

  it("her kablo rengi ayrı bir desen taşır ve hiçbiri düz değildir", () => {
    const patterns = WIRE_COLORS.map((c) => COLOR_PATTERN[c]);
    expect(new Set(patterns).size).toBe(WIRE_COLORS.length);
    for (const p of patterns) expect(p).toBeGreaterThan(0);
  });

  it("Zaman Bombası tuşlarıyla tutarlı: yeşil kare, kırmızı üçgen, sarı yıldız, mavi daire; mor baklava", () => {
    expect(cbShape(COLOR_MARK.purple).name).toBe("baklava");
    expect(cbShape(COLOR_MARK.green).name).toBe("kare");
    expect(cbShape(COLOR_MARK.red).name).toBe("üçgen");
    expect(cbShape(COLOR_MARK.yellow).name).toBe("yıldız");
    expect(cbShape(COLOR_MARK.blue).name).toBe("daire");
  });
});
