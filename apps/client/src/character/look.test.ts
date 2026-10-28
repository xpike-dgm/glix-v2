import { DEFAULT_DANCE } from "@glix/engine";
import { describe, expect, it } from "vitest";
import { BASE_ACCENT, chromaAngle, hueMatrix, hueShiftFor, lookOf } from "./look.js";

const COLORS = ["#2EF2FF", "#FF2BD6", "#FFC23B", "#B6FF3B", "#8B5CFF", "#FF8A3B", "#2BFFA8", "#3B7BFF"];
const rgb = (hex: string): [number, number, number] => {
  const n = Number.parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

describe("kimlik rengi", () => {
  it("camgöbeği oyuncuda dönüş yok", () => {
    expect(hueShiftFor("#2EF2FF")).toBeCloseTo(0, 5);
    expect(BASE_ACCENT).toBe("#2EF2FF");
  });

  it("matris camgöbeği vurguyu oyuncu rengine çevirir (renk açısı en çok 8 derece sapar)", () => {
    for (const c of COLORS) {
      const m = hueMatrix(hueShiftFor(c));
      const [r, g, b] = rgb(BASE_ACCENT);
      const out = [
        m[0] * r + m[1] * g + m[2] * b,
        m[3] * r + m[4] * g + m[5] * b,
        m[6] * r + m[7] * g + m[8] * b,
      ].map((v) => Math.min(255, Math.max(0, Math.round(v * 255))));
      const hex = `#${out.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
      const d = Math.abs(((chromaAngle(hex) - chromaAngle(c) + 540) % 360) - 180);
      expect(d).toBeLessThan(8);
    }
  });

  it("gri eksendeki renkler (koyu griler) döndürülmez", () => {
    const m = hueMatrix(127);
    for (const v of [0.1, 0.25, 0.5]) {
      expect(m[0] * v + m[1] * v + m[2] * v).toBeCloseTo(v, 6);
      expect(m[3] * v + m[4] * v + m[5] * v).toBeCloseTo(v, 6);
      expect(m[6] * v + m[7] * v + m[8] * v).toBeCloseTo(v, 6);
    }
  });
});

describe("görünüm", () => {
  it("kozmetik yoksa çıplak karakter ve varsayılan dans", () => {
    expect(lookOf(undefined)).toEqual({ layers: [], dance: DEFAULT_DANCE });
    expect(lookOf({})).toEqual({ layers: [], dance: DEFAULT_DANCE });
  });

  it("kuşanılan dans ve giysiler karakter varlıklarına çevrilir", () => {
    expect(lookOf({ dance: "dans-makarena", hat: "sapka-neon-kep", top: "ust-neon-bomber" })).toEqual({
      layers: ["sapka", "ceket"],
      dance: "makarena",
    });
    expect(lookOf({ dance: "dans-cizgi-film" }).dance).toBe("mickey");
  });

  it("bilinmeyen ya da yanlış türdeki kimlik yok sayılır", () => {
    expect(lookOf({ dance: "yok-boyle", hat: "ust-neon-bomber", top: "sapka-neon-kep" })).toEqual({
      layers: [],
      dance: DEFAULT_DANCE,
    });
  });
});
