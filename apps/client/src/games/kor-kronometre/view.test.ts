import { describe, expect, it } from "vitest";
import {
  bigOffset,
  clockAt,
  dropped,
  entryOf,
  formatOffset,
  formatSeconds,
  formatTarget,
  handWinners,
  headLine,
  listShown,
  markOf,
  myOffsets,
  NEEDLE,
  needleFrac,
  nextPulseGap,
  PULSE_MAX_MS,
  PULSE_MIN_MS,
  parseKorKronometrePrivateView,
  parseKorKronometrePublicView,
  parseKorKronometreView,
  pointsLabel,
  revealSpeech,
  targetPercent,
  trackPercent,
  trendLine,
} from "./view.js";

const entry = { playerId: "a", ms: 9_850, pressed: true, distance: 150, rank: 1, bullseye: false, points: 2 };
const second = {
  playerId: "b",
  ms: 10_420,
  pressed: true,
  distance: 420,
  rank: 2,
  bullseye: false,
  points: 1,
};
const missed = {
  playerId: "c",
  ms: null,
  pressed: false,
  distance: null,
  rank: null,
  bullseye: false,
  points: 0,
};
const hand0 = { index: 0, targetMs: 10_000, startAt: 100, goAt: 3_100, endsAt: 21_100, reveal: null };
const pub = {
  startedAt: 100,
  hands: 3,
  hand: 0,
  phase: "ready",
  played: [hand0],
  totals: { a: 0, b: 0 },
  endsAt: null,
  revealEndsAt: null,
  final: null,
};
const standing = {
  playerId: "a",
  total: 5,
  handPoints: [2, null, 3],
  pressedHands: 2,
  avgDistance: 100,
  rank: 1,
  award: 2,
};

describe("Kör Kronometre görünümü", () => {
  it("'Hazır ol' görünümünü okur", () => {
    const v = parseKorKronometreView(pub, { pressed: false });
    expect(v).toMatchObject({ hand: 0, phase: "ready", pressed: false, endsAt: null });
    expect(v?.played[0]?.targetMs).toBe(10_000);
  });

  it("açılmış eli ve oyun sonu sıralamasını okur", () => {
    const h = { ...hand0, reveal: { entries: [entry, second, missed] } };
    const v = parseKorKronometrePublicView({
      ...pub,
      phase: "over",
      played: [h],
      endsAt: 21_100,
      revealEndsAt: 27_100,
      final: { standings: [standing] },
    });
    expect(v?.final?.standings[0]).toEqual(standing);
    expect(entryOf(v?.played[0]?.reveal ?? null, "c")).toEqual(missed);
    expect(entryOf(null, "a")).toBeNull();
  });

  it("bozuk görünümü reddeder", () => {
    for (const bad of [
      null,
      [],
      { ...pub, startedAt: "1" },
      { ...pub, hands: 9 },
      { ...pub, hand: 3 },
      { ...pub, phase: "oyun" },
      { ...pub, played: [] },
      { ...pub, played: [{ ...hand0, index: 1 }] },
      { ...pub, played: [{ ...hand0, targetMs: 6_000 }] },
      { ...pub, played: [{ ...hand0, targetMs: 10_500 }] },
      { ...pub, played: [{ ...hand0, goAt: 50 }] },
      { ...pub, played: [{ ...hand0, reveal: { entries: [{ ...entry, bullseye: "evet" }] } }] },
      { ...pub, played: [{ ...hand0, reveal: { entries: [{ ...missed, rank: 3 }] } }] },
      { ...pub, played: [{ ...hand0, reveal: { entries: [{ ...entry, points: 7 }] } }] },
      { ...pub, played: [{ ...hand0, reveal: { entries: Array.from({ length: 40 }, () => entry) } }] },
      { ...pub, totals: { a: 1.5 } },
      { ...pub, endsAt: "x" },
      { ...pub, final: { standings: [{ ...standing, award: 3 }] } },
      { ...pub, final: { standings: [{ ...standing, handPoints: [1, 2, 3, 4] }] } },
    ]) {
      expect(parseKorKronometrePublicView(bad)).toBeNull();
    }
    for (const bad of [null, {}, { pressed: 1 }, []]) expect(parseKorKronometrePrivateView(bad)).toBeNull();
    expect(parseKorKronometreView(pub, null)).toBeNull();
  });

  it("yerel saatle evre: hazır ol → sayma → el arası → (sıradaki el gelince) hazır ol → son", () => {
    const h1 = { ...hand0, index: 1, startAt: 24_100, goAt: 26_100, endsAt: 44_100 };
    const h2 = { ...hand0, index: 2, startAt: 47_100, goAt: 49_100, endsAt: 67_100 };
    expect(clockAt({ hands: 3, played: [hand0] }, 200)?.phase).toBe("ready");
    expect(clockAt({ hands: 3, played: [hand0] }, 3_100)?.phase).toBe("count");
    const gapNoNext = clockAt({ hands: 3, played: [hand0] }, 21_100);
    expect(gapNoNext).toMatchObject({ phase: "gap", hand: 0, next: null, phaseEndsAt: 24_100 });
    const gap = clockAt({ hands: 3, played: [hand0, h1] }, 22_000);
    expect(gap).toMatchObject({ phase: "gap", hand: 0, phaseEndsAt: 24_100 });
    expect(gap?.next?.index).toBe(1);
    expect(clockAt({ hands: 3, played: [hand0, h1] }, 24_100)).toMatchObject({ phase: "ready", hand: 1 });
    expect(clockAt({ hands: 3, played: [hand0, h1, h2] }, 67_100)).toMatchObject({ phase: "over", hand: 2 });
  });

  it("zamanı ve farkı Türkçe biçimler (KR-U6, KR-U7)", () => {
    expect(formatSeconds(9_850)).toBe("9,85");
    expect(formatOffset(9_850, 10_000)).toBe("0,15 erken");
    expect(formatOffset(10_420, 10_000)).toBe("0,42 geç");
    expect(formatOffset(10_050, 10_000)).toBe("tam isabet");
    expect(formatOffset(10_051, 10_000)).toBe("0,05 geç");
    expect(bigOffset(10_320, 10_000)).toBe("0,32 sn GEÇ");
    expect(bigOffset(9_850, 10_000)).toBe("0,15 sn ERKEN");
    expect(bigOffset(9_960, 10_000)).toBe("TAM İSABET");
    expect(formatTarget(11_000)).toBe("Hedef: 11 saniye");
    expect(headLine(entry, 10_000)).toBe("0,15 sn erken · 1.");
    expect(headLine(missed, 10_000)).toBe("Basmadın");
    expect(headLine(null, 10_000)).toBe("Basmadın");
  });

  it("işaretler renkten bağımsız (KR-U16)", () => {
    expect(markOf(entry)).toBe("star");
    expect(markOf(second)).toBe("dot");
    expect(markOf({ ...second, rank: 3 })).toBe("ring");
    expect(markOf(missed)).toBeNull();
    expect(pointsLabel(2)).toBe("+2 ★");
    expect(pointsLabel(3)).toBe("+3 ★");
    expect(pointsLabel(1)).toBe("+1");
    expect(pointsLabel(0)).toBe("0");
    expect(pointsLabel(0, false)).toBe("–");
  });

  it("elin kazananı ve kendi eğilimin (KR-U7)", () => {
    expect(handWinners({ entries: [entry, second, missed] })).toEqual({ ids: ["a"], distance: 150 });
    expect(handWinners({ entries: [missed] })).toBeNull();
    expect(trendLine([300])).toBeNull();
    expect(trendLine([300, 420])).toBe("İç saatin biraz yavaş: iki elde de geç bastın.");
    expect(trendLine([-300, -420, -90])).toBe("İç saatin biraz hızlı: üç elde de erken bastın.");
    expect(trendLine([-300, 280])).toBe("Bir erken bir geç: iç saatin ortayı buluyor.");
    expect(trendLine([10, -20])).toBe("İç saatin kusursuz işliyor.");
    const h = { ...hand0, reveal: { entries: [entry, second, missed] } };
    const h1 = { ...hand0, index: 1, targetMs: 8_000, reveal: { entries: [{ ...entry, ms: 8_200 }] } };
    expect(myOffsets([h, h1], "a", 1)).toEqual([-150, 200]);
    expect(myOffsets([h, h1], "a", 0)).toEqual([-150]);
    expect(myOffsets([h, h1], "c", 1)).toEqual([]);
  });

  it("ibre koşusu (KR-U5): çizgi 0,6 sn, koşu 2,5 sn; avatar ibre geçince düşer; liste koşudan sonra", () => {
    expect(needleFrac(0)).toBe(0);
    expect(needleFrac(NEEDLE.lineIn)).toBe(0);
    expect(needleFrac(NEEDLE.lineIn + 1_250)).toBeCloseTo(0.5);
    expect(needleFrac(99_999)).toBe(1);
    expect(dropped(NEEDLE.lineIn + 1_250, 49)).toBe(true);
    expect(dropped(NEEDLE.lineIn + 1_250, 51)).toBe(false);
    expect(listShown(3_000, false)).toBe(false);
    expect(listShown(3_100, false)).toBe(true);
    expect(listShown(0, true)).toBe(true);
  });

  it("çizgi konumu 0..100 aralığında kalır", () => {
    expect(trackPercent(0, 10_000)).toBe(0);
    expect(trackPercent(18_000, 10_000)).toBe(100);
    expect(trackPercent(99_999, 10_000)).toBe(100);
    expect(targetPercent(10_000)).toBeCloseTo(55.56, 1);
  });

  it("nabız düzensiz (KR-M4): vuruş arası 0,6–2,2 sn", () => {
    expect(nextPulseGap(0)).toBe(PULSE_MIN_MS);
    expect(nextPulseGap(0.999_999)).toBeCloseTo(PULSE_MAX_MS, 0);
    expect(nextPulseGap(5)).toBe(PULSE_MAX_MS);
    expect(PULSE_MIN_MS).toBe(600);
    expect(PULSE_MAX_MS).toBe(2_200);
  });

  it("ekran okuyucu açılış satırı (KR-U17)", () => {
    const names: Record<string, string> = { a: "Can", b: "Elif", c: "Mert" };
    const r = { entries: [entry, second, missed] };
    expect(revealSpeech(r, 10_000, "a", (id) => names[id] ?? "")).toBe(
      "Hedef 10. Sen 9,85'te bastın, 0,15 erken, birinci, 2 puan. Elif ikinci, 0,42 geç.",
    );
    expect(revealSpeech(r, 10_000, "c", (id) => names[id] ?? "")).toBe(
      "Hedef 10. Basmadın. Can birinci, 0,15 erken. Elif ikinci, 0,42 geç.",
    );
  });
});
