import { describe, expect, it } from "vitest";
import {
  chipColumns,
  limitLinePercent,
  parseAcgozlulukView,
  phaseOf,
  pointsOf,
  segmentPercent,
  tankCapacity,
} from "./view.js";

const pub = {
  startedAt: 100,
  endsAt: 20_100,
  revealEndsAt: 25_100,
  limit: 11,
  maxChoice: 4,
  reveal: null,
  lockedIds: ["a"],
};
const priv = { myChoice: 2, locked: false };
const reveal = { choices: { a: 3, b: 2 }, total: 5, over: false };

describe("Açgözlülük Limiti görünümü", () => {
  it("geçerli görünümleri birleştirir", () => {
    const v = parseAcgozlulukView(pub, priv);
    expect(v).toMatchObject({ limit: 11, maxChoice: 4, myChoice: 2, reveal: null });
    expect(phaseOf(v)).toBe("choosing");
  });
  it("seçmemiş ve izleyici için myChoice null olabilir", () => {
    expect(parseAcgozlulukView(pub, { myChoice: null, locked: false })?.myChoice).toBeNull();
  });
  it("kilit bilgisini okur", () => {
    const v = parseAcgozlulukView(pub, { myChoice: 2, locked: true });
    expect(v).toMatchObject({ locked: true, lockedIds: ["a"] });
  });
  it("açılmış sonucu okur", () => {
    const v = parseAcgozlulukView({ ...pub, reveal }, priv);
    expect(v?.reveal).toEqual(reveal);
    expect(phaseOf(v)).toBe("revealed");
    expect(phaseOf(null)).toBe("choosing");
  });
  it("bozuk görünümü reddeder", () => {
    expect(parseAcgozlulukView(null, priv)).toBeNull();
    expect(parseAcgozlulukView(pub, null)).toBeNull();
    expect(parseAcgozlulukView({ ...pub, limit: 0 }, priv)).toBeNull();
    expect(parseAcgozlulukView({ ...pub, limit: 1.5 }, priv)).toBeNull();
    expect(parseAcgozlulukView({ ...pub, maxChoice: 200 }, priv)).toBeNull();
    expect(parseAcgozlulukView({ ...pub, endsAt: "x" }, priv)).toBeNull();
    expect(parseAcgozlulukView({ ...pub, reveal: 5 }, priv)).toBeNull();
    expect(parseAcgozlulukView({ ...pub, reveal: { ...reveal, over: 1 } }, priv)).toBeNull();
    expect(parseAcgozlulukView({ ...pub, reveal: { ...reveal, choices: { a: "x" } } }, priv)).toBeNull();
    expect(parseAcgozlulukView(pub, { myChoice: -1 })).toBeNull();
    expect(parseAcgozlulukView(pub, { myChoice: 2.5 })).toBeNull();
    expect(parseAcgozlulukView(pub, {})).toBeNull();
    expect(parseAcgozlulukView(pub, { myChoice: 2 })).toBeNull();
    expect(parseAcgozlulukView({ ...pub, lockedIds: "a" }, priv)).toBeNull();
    expect(parseAcgozlulukView({ ...pub, lockedIds: [1] }, priv)).toBeNull();
    expect(parseAcgozlulukView({ ...pub, lockedIds: undefined }, priv)).toBeNull();
  });
  it("hazne ölçekleri: limit çizgisi sabit, en kötü toplam kapasiteye sığar", () => {
    expect(tankCapacity(10)).toBe(15);
    expect(limitLinePercent(11)).toBeCloseTo(66.67, 1);
    for (const [n, limit] of [
      [3, 6],
      [4, 11],
      [5, 17],
      [6, 24],
      [7, 33],
      [8, 43],
    ] as const) {
      expect(segmentPercent(n * n, limit)).toBeLessThanOrEqual(100);
      expect(segmentPercent(limit, limit)).toBeCloseTo(limitLinePercent(limit), 5);
    }
    expect(segmentPercent(-2, 10)).toBe(0);
    expect(segmentPercent(999, 10)).toBe(100);
  });
  it("sayı düğmeleri 3–8 oyuncu için dengeli ızgara kurar", () => {
    const rows = (count: number) => Math.ceil(count / chipColumns(count));
    for (let n = 3; n <= 8; n++) {
      const count = n + 1;
      expect(chipColumns(count)).toBeGreaterThanOrEqual(3);
      expect(rows(count)).toBeLessThanOrEqual(2);
    }
    expect(chipColumns(1)).toBe(1);
  });
  it("puan: taşarsa 0, aksi halde seçilen sayı", () => {
    expect(pointsOf(reveal, "a")).toBe(3);
    expect(pointsOf(reveal, "z")).toBe(0);
    expect(pointsOf({ ...reveal, over: true }, "a")).toBe(0);
  });
});
