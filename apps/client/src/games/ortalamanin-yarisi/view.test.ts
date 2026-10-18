import type { OrtalamaReveal } from "@glix/engine";
import { describe, expect, it } from "vitest";
import {
  assignLanes,
  formatNumber,
  linePercent,
  parseOrtalamaView,
  phaseOf,
  pointsOf,
  tierOf,
} from "./view.js";

const pub = { startedAt: 100, endsAt: 20_100, revealEndsAt: 27_100, reveal: null };
const priv = { myChoice: 42 };
const reveal: OrtalamaReveal = {
  choices: { a: 20, b: 30, c: 60 },
  mean: 36.6667,
  target: 18.3333,
  distances: { a: 1.6667, b: 11.6667, c: 41.6667 },
  order: ["a", "b", "c"],
  ranks: { a: 1, b: 2, c: 3 },
  points: { a: 2, b: 1, c: 0 },
};

describe("Ortalamaya En Yakın görünümü", () => {
  it("geçerli görünümleri birleştirir", () => {
    const v = parseOrtalamaView(pub, priv);
    expect(v).toMatchObject({ myChoice: 42, reveal: null });
    expect(phaseOf(v)).toBe("choosing");
  });
  it("seçmemiş ve izleyici için myChoice null olabilir", () => {
    expect(parseOrtalamaView(pub, { myChoice: null })?.myChoice).toBeNull();
  });
  it("açılmış sonucu okur", () => {
    const v = parseOrtalamaView({ ...pub, reveal }, priv);
    expect(v?.reveal).toEqual(reveal);
    expect(phaseOf(v)).toBe("revealed");
    expect(phaseOf(null)).toBe("choosing");
  });
  it("bozuk görünümü reddeder", () => {
    expect(parseOrtalamaView(null, priv)).toBeNull();
    expect(parseOrtalamaView(pub, null)).toBeNull();
    expect(parseOrtalamaView({ ...pub, endsAt: "x" }, priv)).toBeNull();
    expect(parseOrtalamaView({ ...pub, reveal: 5 }, priv)).toBeNull();
    expect(parseOrtalamaView({ ...pub, reveal: { ...reveal, mean: "x" } }, priv)).toBeNull();
    expect(
      parseOrtalamaView({ ...pub, reveal: { ...reveal, choices: { a: 101, b: 1, c: 1 } } }, priv),
    ).toBeNull();
    expect(
      parseOrtalamaView({ ...pub, reveal: { ...reveal, choices: { a: 1.5, b: 1, c: 1 } } }, priv),
    ).toBeNull();
    expect(parseOrtalamaView({ ...pub, reveal: { ...reveal, order: ["a", "b"] } }, priv)).toBeNull();
    expect(parseOrtalamaView({ ...pub, reveal: { ...reveal, order: ["a", "b", "z"] } }, priv)).toBeNull();
    expect(parseOrtalamaView({ ...pub, reveal: { ...reveal, ranks: { a: 1 } } }, priv)).toBeNull();
    expect(parseOrtalamaView({ ...pub, reveal: { ...reveal, points: { a: 1, b: 1 } } }, priv)).toBeNull();
    expect(parseOrtalamaView(pub, { myChoice: -1 })).toBeNull();
    expect(parseOrtalamaView(pub, { myChoice: 101 })).toBeNull();
    expect(parseOrtalamaView(pub, { myChoice: 2.5 })).toBeNull();
    expect(parseOrtalamaView(pub, {})).toBeNull();
  });
  it("sayıyı Türkçe yazar", () => {
    expect(formatNumber(20)).toBe("20");
    expect(formatNumber(19.25)).toBe("19,3");
    expect(formatNumber(18.3333)).toBe("18,3");
    expect(formatNumber(0)).toBe("0");
    expect(formatNumber(99.96)).toBe("100");
  });
  it("doğru konumu 0–100 arasına sıkıştırır", () => {
    expect(linePercent(-5)).toBe(0);
    expect(linePercent(37.5)).toBe(37.5);
    expect(linePercent(400)).toBe(100);
  });
  it("üst üste binen noktalar ayrı şeritlere dağılır", () => {
    expect(assignLanes([10, 50, 90], 8)).toEqual([0, 0, 0]);
    expect(assignLanes([20, 20, 20], 8)).toEqual([0, 1, 2]);
    expect(assignLanes([20, 24, 40, 20], 8)).toEqual([0, 2, 0, 1]);
    expect(Math.max(...assignLanes(Array(8).fill(33), 8))).toBe(7);
    expect(assignLanes([], 8)).toEqual([]);
  });
  it("puan ve ışık rengi: altın en yakın, mavi ikinci", () => {
    expect(pointsOf(reveal, "a")).toBe(2);
    expect(pointsOf(reveal, "zzz")).toBe(0);
    expect(tierOf(reveal, "a")).toBe("gold");
    expect(tierOf(reveal, "b")).toBe("blue");
    expect(tierOf(reveal, "c")).toBe("none");
    // eşit en yakınlar: hepsi +1 ve altın
    const tie: OrtalamaReveal = { ...reveal, ranks: { a: 1, b: 1, c: 2 }, points: { a: 1, b: 1, c: 0 } };
    expect(tierOf(tie, "a")).toBe("gold");
    expect(tierOf(tie, "b")).toBe("gold");
    expect(tierOf(tie, "c")).toBe("none");
  });
});
