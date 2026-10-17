import { describe, expect, it } from "vitest";
import {
  formatBonus,
  formatRemaining,
  parseKorBombaPrivateView,
  parseKorBombaPublicView,
  parseKorBombaView,
  remainingMs,
  seatPositions,
} from "./view.js";

const pub = {
  startedAt: 1000,
  holder: "a",
  passes: 2,
  lastPass: { seq: 2, from: "b", to: "a" },
  exploded: false,
  explodedAt: null,
};

describe("Kör Bomba görünümü", () => {
  it("geçerli ortak görünümü ayrıştırır", () => {
    expect(parseKorBombaPublicView(pub)).toEqual(pub);
    expect(parseKorBombaPublicView({ ...pub, lastPass: null })?.lastPass).toBeNull();
    expect(parseKorBombaPublicView({ ...pub, exploded: true, explodedAt: 5 })?.explodedAt).toBe(5);
  });

  it("bozuk ortak görünümü reddeder", () => {
    for (const bad of [
      null,
      [],
      "x",
      { ...pub, holder: "" },
      { ...pub, holder: 3 },
      { ...pub, passes: "2" },
      { ...pub, startedAt: Number.NaN },
      { ...pub, exploded: "evet" },
      { ...pub, explodedAt: "x" },
      { ...pub, lastPass: { seq: 1, from: "a" } },
      { ...pub, lastPass: 4 },
    ]) {
      expect(parseKorBombaPublicView(bad)).toBeNull();
    }
  });

  it("kişisel görünüm üç rolü tanır", () => {
    expect(parseKorBombaPrivateView({ role: "holder" })).toEqual({ role: "holder" });
    expect(parseKorBombaPrivateView({ role: "spectator" })).toEqual({ role: "spectator" });
    expect(parseKorBombaPrivateView({ role: "watcher", explodeAt: 9, lastBonusMs: null })).toEqual({
      role: "watcher",
      explodeAt: 9,
      lastBonusMs: null,
    });
  });

  it("taşıyıcı görünümündeki fazladan süre alanını taşımaz", () => {
    const v = parseKorBombaPrivateView({ role: "holder", explodeAt: 99 });
    expect(v).toEqual({ role: "holder" });
    expect(JSON.stringify(v)).not.toContain("99");
  });

  it("bozuk kişisel görünümü reddeder", () => {
    for (const bad of [
      null,
      {},
      { role: "x" },
      { role: "watcher" },
      { role: "watcher", explodeAt: "9", lastBonusMs: null },
      { role: "watcher", explodeAt: 9, lastBonusMs: "1" },
      { role: "watcher", explodeAt: 9 },
    ]) {
      expect(parseKorBombaPrivateView(bad)).toBeNull();
    }
  });

  it("birleşik görünüm ikisi de geçerliyse döner", () => {
    expect(parseKorBombaView(pub, { role: "holder" })?.priv.role).toBe("holder");
    expect(parseKorBombaView(pub, null)).toBeNull();
    expect(parseKorBombaView(null, { role: "holder" })).toBeNull();
  });

  it("kalan süre yalnız izleyen katılımcıda vardır ve negatif olmaz", () => {
    const watcher = parseKorBombaView(pub, { role: "watcher", explodeAt: 10_000, lastBonusMs: null });
    if (!watcher) throw new Error("geçerli olmalı");
    expect(remainingMs(watcher, 7_500)).toBe(2_500);
    expect(remainingMs(watcher, 12_000)).toBe(0);
    const holder = parseKorBombaView(pub, { role: "holder" });
    const spectator = parseKorBombaView(pub, { role: "spectator" });
    if (!holder || !spectator) throw new Error("geçerli olmalı");
    expect(remainingMs(holder, 0)).toBeNull();
    expect(remainingMs(spectator, 0)).toBeNull();
  });

  it("süre biçimi", () => {
    expect(formatRemaining(12_345)).toBe("12,3");
    expect(formatRemaining(950)).toBe("0,9");
    expect(formatRemaining(0)).toBe("0,0");
    expect(formatRemaining(-50)).toBe("0,0");
    expect(formatBonus(2_500)).toBe("+2,5");
    expect(formatBonus(1_000)).toBe("+1,0");
    expect(formatBonus(3_960)).toBe("+4,0");
  });

  it("koltuklar: kendin altta, diğerleri saat yönünde, hepsi sahnede", () => {
    const seats = seatPositions(["a", "b", "c", "d"], "c");
    expect(seats.map((s) => s.id)).toEqual(["c", "d", "a", "b"]);
    expect(seats[0]?.x).toBeCloseTo(50);
    expect((seats[0]?.y ?? 0) > 80).toBe(true);
    for (const s of seatPositions(["a", "b", "c", "d", "e", "f", "g", "h"], "x")) {
      expect(s.x).toBeGreaterThan(5);
      expect(s.x).toBeLessThan(95);
      expect(s.y).toBeGreaterThan(5);
      expect(s.y).toBeLessThan(95);
    }
  });
});
