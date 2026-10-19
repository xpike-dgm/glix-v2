import type { CizgiReveal } from "@glix/engine";
import { describe, expect, it } from "vitest";
import {
  groupByZone,
  parseCizgiView,
  pinHeight,
  pointsOf,
  statusOf,
  zoneFill,
  zoneLabel,
  zoneOf,
  zonesTopDown,
} from "./view.js";

const pub = { startedAt: 100, endsAt: 30_100, revealEndsAt: 37_100, reveal: null, lockedIds: ["a"] };
const priv = { myChoice: 42, locked: false };
const reveal: CizgiReveal = {
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
  it("bölgeler: 0–9 … 90–99 ve tek elemanlı 100", () => {
    expect([0, 9, 10, 99, 100].map(zoneOf)).toEqual([0, 0, 1, 9, 10]);
    expect(zoneLabel(0)).toBe("0–9");
    expect(zoneLabel(4)).toBe("40–49");
    expect(zoneLabel(9)).toBe("90–99");
    expect(zoneLabel(10)).toBe("100");
    expect(zonesTopDown()).toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0]);
  });
  it("platform içi yükseklik ve yol yüksekliği", () => {
    expect(zoneFill(40)).toBe(0);
    expect(zoneFill(49)).toBe(1);
    expect(zoneFill(100)).toBe(1);
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
