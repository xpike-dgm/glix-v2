import { describe, expect, it } from "vitest";
import {
  entryOf,
  formatOffset,
  formatSeconds,
  formatTarget,
  parseKorKronometrePrivateView,
  parseKorKronometrePublicView,
  parseKorKronometreView,
  phaseOf,
  targetPercent,
  trackPercent,
} from "./view.js";

const entry = { playerId: "a", ms: 9_850, pressed: true, distance: 150, rank: 1, points: 2 };
const pub = { startedAt: 100, targetMs: 10_000, endsAt: 18_100, revealEndsAt: 24_100, reveal: null };
const missed = { playerId: "b", ms: null, pressed: false, distance: null, rank: null, points: 0 };

describe("Kör Kronometre görünümü", () => {
  it("süre dolmadan görünümü okur", () => {
    const v = parseKorKronometreView(pub, { pressed: false });
    expect(v).toMatchObject({ endsAt: 18_100, targetMs: 10_000, reveal: null, pressed: false });
    expect(phaseOf(v)).toBe("counting");
  });

  it("açılmış sonucu okur", () => {
    const v = parseKorKronometreView({ ...pub, reveal: { entries: [entry] } }, { pressed: true });
    expect(phaseOf(v)).toBe("revealed");
    expect(entryOf(v?.reveal ?? null, "a")).toEqual(entry);
    expect(entryOf(v?.reveal ?? null, "z")).toBeNull();
    expect(entryOf(null, "a")).toBeNull();
  });

  it("basmayan satırı sıralamasız okur; basmadı ama sıra/süre taşıyan satırı reddeder", () => {
    const v = parseKorKronometreView({ ...pub, reveal: { entries: [entry, missed] } }, { pressed: false });
    expect(entryOf(v?.reveal ?? null, "b")).toEqual(missed);
    for (const bad of [
      { ...missed, rank: 3 },
      { ...missed, ms: 18_000 },
      { ...missed, points: 1 },
    ]) {
      expect(parseKorKronometrePublicView({ ...pub, reveal: { entries: [bad] } })).toBeNull();
    }
  });

  it("bozuk görünümü reddeder", () => {
    for (const bad of [
      null,
      [],
      "x",
      { ...pub, startedAt: "1" },
      { ...pub, targetMs: 6_000 },
      { ...pub, targetMs: 14_000 },
      { ...pub, targetMs: 10_500 },
      { ...pub, targetMs: undefined },
      { ...pub, endsAt: Number.NaN },
      { ...pub, reveal: 3 },
      { ...pub, reveal: {} },
      { ...pub, reveal: { entries: [{ ...entry, playerId: "" }] } },
      { ...pub, reveal: { entries: [{ ...entry, ms: -1 }] } },
      { ...pub, reveal: { entries: [{ ...entry, rank: 0 }] } },
      { ...pub, reveal: { entries: [{ ...entry, points: 1.5 }] } },
      { ...pub, reveal: { entries: [{ ...entry, pressed: "evet" }] } },
      { ...pub, reveal: { entries: Array.from({ length: 40 }, () => entry) } },
    ]) {
      expect(parseKorKronometrePublicView(bad)).toBeNull();
    }
    for (const bad of [null, {}, { pressed: 1 }, []]) expect(parseKorKronometrePrivateView(bad)).toBeNull();
    expect(parseKorKronometreView(pub, null)).toBeNull();
  });

  it("zamanı Türkçe biçimler", () => {
    expect(formatSeconds(9_850)).toBe("9,85");
    expect(formatSeconds(18_000)).toBe("18,00");
    expect(formatOffset(9_850, 10_000)).toBe("−0,15 sn");
    expect(formatOffset(10_600, 10_000)).toBe("+0,60 sn");
    expect(formatOffset(11_000, 11_000)).toBe("tam isabet");
    expect(formatTarget(11_000)).toBe("Hedef: 11 saniye");
  });

  it("çizgi konumu 0..100 aralığında kalır", () => {
    expect(trackPercent(0, 10_000)).toBe(0);
    expect(trackPercent(18_000, 10_000)).toBe(100);
    expect(trackPercent(99_999, 10_000)).toBe(100);
    expect(targetPercent(10_000)).toBeCloseTo(55.56, 1);
    expect(targetPercent(7_000)).toBeCloseTo(46.67, 1);
  });
});
