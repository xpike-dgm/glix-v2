import type { CizgiReveal } from "@glix/engine";
import { describe, expect, it } from "vitest";
import {
  groupByZone,
  isDense,
  parseCizgiView,
  pinHeight,
  pointsOf,
  statusOf,
  zoneCount,
  zoneFill,
  zoneLabel,
  zoneOf,
  zonesTopDown,
} from "./view.js";

const pub = {
  startedAt: 100,
  zoneWidth: 10,
  endsAt: 30_100,
  revealEndsAt: 37_100,
  reveal: null,
  lockedIds: ["a"],
};
const priv = { myChoice: 42, locked: false };
const reveal: CizgiReveal = {
  zoneWidth: 10,
  choices: { a: 95, b: 91, c: 72, d: null, e: 30 },
  status: { a: "crashed", b: "crashed", c: "first", d: "none", e: "second" },
  points: { a: 0, b: 0, c: 2, d: 0, e: 1 },
};

describe("Çizgiyi Geçme görünümü", () => {
  it("kilit bilgisini okur, bozuksa reddeder", () => {
    expect(parseCizgiView(pub, { myChoice: 42, locked: true })).toMatchObject({
      locked: true,
      lockedIds: ["a"],
    });
    expect(parseCizgiView({ ...pub, lockedIds: [1] }, priv)).toBeNull();
    expect(parseCizgiView({ ...pub, lockedIds: undefined }, priv)).toBeNull();
    expect(parseCizgiView(pub, { myChoice: 42 })).toBeNull();
  });
  it("geçerli görünümleri birleştirir", () => {
    expect(parseCizgiView(pub, priv)).toMatchObject({ myChoice: 42, reveal: null });
    expect(parseCizgiView(pub, { myChoice: null, locked: false })?.myChoice).toBeNull();
  });
  it("açılmış sonucu okur", () => {
    expect(parseCizgiView({ ...pub, reveal }, priv)?.reveal).toEqual(reveal);
  });
  it("bozuk görünümü reddeder", () => {
    expect(parseCizgiView(null, priv)).toBeNull();
    expect(parseCizgiView(pub, null)).toBeNull();
    expect(parseCizgiView({ ...pub, startedAt: "x" }, priv)).toBeNull();
    expect(parseCizgiView({ ...pub, reveal: 3 }, priv)).toBeNull();
    expect(
      parseCizgiView({ ...pub, reveal: { ...reveal, choices: { ...reveal.choices, a: 101 } } }, priv),
    ).toBeNull();
    expect(
      parseCizgiView({ ...pub, reveal: { ...reveal, choices: { ...reveal.choices, a: 1.5 } } }, priv),
    ).toBeNull();
    expect(
      parseCizgiView({ ...pub, reveal: { ...reveal, status: { ...reveal.status, a: "yok" } } }, priv),
    ).toBeNull();
    expect(
      parseCizgiView({ ...pub, reveal: { ...reveal, points: { ...reveal.points, a: 5 } } }, priv),
    ).toBeNull();
    // Seçmeyen ama "none" olmayan / seçen ama "none" olan tutarsızdır.
    expect(
      parseCizgiView({ ...pub, reveal: { ...reveal, status: { ...reveal.status, d: "safe" } } }, priv),
    ).toBeNull();
    expect(
      parseCizgiView({ ...pub, reveal: { ...reveal, status: { ...reveal.status, a: "none" } } }, priv),
    ).toBeNull();
    expect(parseCizgiView({ ...pub, reveal: { ...reveal, status: { a: "crashed" } } }, priv)).toBeNull();
    expect(parseCizgiView(pub, { myChoice: -1, locked: false })).toBeNull();
    expect(parseCizgiView(pub, { myChoice: 101, locked: false })).toBeNull();
    expect(parseCizgiView(pub, { myChoice: 4.5, locked: false })).toBeNull();
    expect(parseCizgiView(pub, {})).toBeNull();
  });
  it("bölge genişliği alanı zorunlu ve makul aralıkta olmalı", () => {
    const { zoneWidth: _w, ...noWidth } = pub;
    expect(parseCizgiView(noWidth, priv)).toBeNull();
    expect(parseCizgiView({ ...pub, zoneWidth: 1 }, priv)).toBeNull();
    expect(parseCizgiView({ ...pub, zoneWidth: 4.5 }, priv)).toBeNull();
    expect(parseCizgiView({ ...pub, zoneWidth: 25 }, priv)?.zoneWidth).toBe(25);
    const { zoneWidth: _rw, ...noRevealWidth } = reveal;
    expect(parseCizgiView({ ...pub, reveal: noRevealWidth }, priv)).toBeNull();
  });
  it("bölgeler genişliğe göre: 10 iken 0–9 … 90–99 ve tek elemanlı 100", () => {
    expect([0, 9, 10, 99, 100].map((v) => zoneOf(v, 10))).toEqual([0, 0, 1, 9, 10]);
    expect(zoneLabel(0, 10)).toBe("0–9");
    expect(zoneLabel(4, 10)).toBe("40–49");
    expect(zoneLabel(9, 10)).toBe("90–99");
    expect(zoneLabel(10, 10)).toBe("100");
    expect(zonesTopDown(10)).toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0]);
    expect(zoneCount(10)).toBe(11);
  });
  it("her oyuncu sayısının genişliği: platform sayısı ve yazılı aralıklar", () => {
    // 2 oyuncu: genişlik 25 → 0–24, 25–49, 50–74, 75–99, 100
    expect(zoneCount(25)).toBe(5);
    expect(zonesTopDown(25).map((z) => zoneLabel(z, 25))).toEqual(["100", "75–99", "50–74", "25–49", "0–24"]);
    // 3 oyuncu: genişlik 14 → son platform 98–100
    expect(zoneCount(14)).toBe(8);
    expect(zoneLabel(7, 14)).toBe("98–100");
    // 8 oyuncu: genişlik 4 → 26 platform, yoğun kule
    expect(zoneCount(4)).toBe(26);
    expect(zoneLabel(24, 4)).toBe("96–99");
    expect(isDense(4)).toBe(true);
    expect(isDense(10)).toBe(false);
    expect(isDense(25)).toBe(false);
  });
  it("platform içi yükseklik ve yol yüksekliği", () => {
    expect(zoneFill(40, 10)).toBe(0);
    expect(zoneFill(49, 10)).toBe(1);
    expect(zoneFill(100, 10)).toBe(1);
    expect(zoneFill(62, 25)).toBeCloseTo(12 / 24, 10);
    expect(zoneFill(99, 14)).toBeCloseTo(0.5, 10);
    expect(pinHeight(0)).toBe(0);
    expect(pinHeight(100)).toBe(1);
    expect(pinHeight(250)).toBe(1);
  });
  it("aynı bölgedekiler gruplanır, seçmeyen gruplara girmez", () => {
    const g = groupByZone(reveal);
    expect(g.get(9)).toEqual(["a", "b"]);
    expect(g.get(7)).toEqual(["c"]);
    expect(g.get(3)).toEqual(["e"]);
    expect([...g.values()].flat()).not.toContain("d");
  });
  it("puan ve durum okunur; bilinmeyen oyuncu pasif/0", () => {
    expect(pointsOf(reveal, "c")).toBe(2);
    expect(pointsOf(reveal, "zzz")).toBe(0);
    expect(statusOf(reveal, "e")).toBe("second");
    expect(statusOf(reveal, "zzz")).toBe("none");
  });
});
