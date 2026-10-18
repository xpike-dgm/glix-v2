import { describe, expect, it } from "vitest";
import {
  entryOf,
  formatOffset,
  formatSeconds,
  parseKorKronometrePrivateView,
  parseKorKronometrePublicView,
  parseKorKronometreView,
  phaseOf,
  TARGET_PERCENT,
  trackPercent,
} from "./view.js";

const entry = { playerId: "a", ms: 9_850, pressed: true, distance: 150, rank: 1, points: 2 };
const pub = { startedAt: 100, endsAt: 18_100, revealEndsAt: 24_100, reveal: null };

describe("Kör Kronometre görünümü", () => {
  it("süre dolmadan görünümü okur", () => {
    const v = parseKorKronometreView(pub, { pressed: false });
    expect(v).toMatchObject({ endsAt: 18_100, reveal: null, pressed: false });
    expect(phaseOf(v)).toBe("counting");
  });

  it("açılmış sonucu okur", () => {
    const v = parseKorKronometreView({ ...pub, reveal: { entries: [entry] } }, { pressed: true });
    expect(phaseOf(v)).toBe("revealed");
    expect(entryOf(v?.reveal ?? null, "a")).toEqual(entry);
    expect(entryOf(v?.reveal ?? null, "z")).toBeNull();
    expect(entryOf(null, "a")).toBeNull();
  });

  it("bozuk görünümü reddeder", () => {
    for (const bad of [
      null,
      [],
      "x",
      { ...pub, startedAt: "1" },
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
    expect(formatOffset(9_850)).toBe("−0,15 sn");
    expect(formatOffset(10_600)).toBe("+0,60 sn");
    expect(formatOffset(10_000)).toBe("tam isabet");
  });

  it("çizgi konumu 0..100 aralığında kalır", () => {
    expect(trackPercent(0)).toBe(0);
    expect(trackPercent(18_000)).toBe(100);
    expect(trackPercent(99_999)).toBe(100);
    expect(TARGET_PERCENT).toBeCloseTo(55.56, 1);
  });
});
