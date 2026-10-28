import { COSMETIC_ITEMS } from "@glix/engine";
import { describe, expect, it } from "vitest";
import {
  CELEBRATION_KINDS,
  capCount,
  celebrationKind,
  createParticles,
  MAX_PARTICLES,
  MAX_PARTICLES_LOW,
  particleAt,
  totalDuration,
} from "./celebration.js";

let seed = 7;
const rand = (): number => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};

describe("zafer kutlaması", () => {
  it("katalogdaki her zafer ürününün hareketi tanımlıdır", () => {
    for (const it of COSMETIC_ITEMS.filter((i) => i.type === "zafer")) {
      expect(celebrationKind(it.asset)).not.toBeNull();
    }
    expect(celebrationKind("yok")).toBeNull();
  });

  it("parçacık sayısı üst sınırı aşmaz (düşük donanımda daha az)", () => {
    for (const kind of CELEBRATION_KINDS) {
      const full = createParticles(kind, 400, 800, false, rand);
      const low = createParticles(kind, 400, 800, true, rand);
      expect(full.length).toBeGreaterThan(0);
      expect(full.length).toBeLessThanOrEqual(MAX_PARTICLES);
      expect(low.length).toBeLessThanOrEqual(MAX_PARTICLES_LOW);
      expect(totalDuration(full)).toBeGreaterThan(0.5);
      expect(totalDuration(full)).toBeLessThan(6);
      for (const p of full) expect(p.sprite).toBeGreaterThanOrEqual(0), expect(p.sprite).toBeLessThan(4);
    }
    expect(capCount(1000, false)).toBe(MAX_PARTICLES);
    expect(capCount(1000, true)).toBe(MAX_PARTICLES_LOW);
  });

  it("parçacık doğmadan önce ve öldükten sonra yoktur; yaşarken alfa 0..1", () => {
    for (const kind of CELEBRATION_KINDS) {
      const ps = createParticles(kind, 400, 800, false, rand);
      for (const p of ps) {
        expect(particleAt(p, p.delay - 0.01)).toBeNull();
        expect(particleAt(p, p.delay + p.life + 0.01)).toBeNull();
        const mid = particleAt(p, p.delay + p.life / 2);
        expect(mid).not.toBeNull();
        expect(mid?.alpha).toBeGreaterThanOrEqual(0);
        expect(mid?.alpha).toBeLessThanOrEqual(1);
        expect(Number.isFinite(mid?.x)).toBe(true);
        expect(Number.isFinite(mid?.y)).toBe(true);
      }
    }
  });

  it("balonlar yükselir, altın yağmur alçalır, konfeti önce yükselip sonra düşer", () => {
    const balon = createParticles("balon", 400, 800, false, rand)[0];
    const yagmur = createParticles("altin-yagmur", 400, 800, false, rand)[0];
    const konfeti = createParticles("konfeti", 400, 800, false, rand)[0];
    if (!balon || !yagmur || !konfeti) throw new Error("parçacık yok");
    expect((particleAt(balon, balon.delay + 1)?.y ?? 0) < balon.y).toBe(true);
    expect((particleAt(yagmur, yagmur.delay + 0.5)?.y ?? 0) > yagmur.y).toBe(true);
    const early = particleAt(konfeti, 0.2)?.y ?? 0;
    const late = particleAt(konfeti, 2)?.y ?? 0;
    expect(late).toBeGreaterThan(early);
  });
});
