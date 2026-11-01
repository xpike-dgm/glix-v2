import { describe, expect, it } from "vitest";
import {
  crewShown,
  decidedLine,
  headOf,
  outroStep,
  parseGizliHirsizView,
  revealHeadline,
  revealSubline,
  seatArc,
  secondOf,
  shownCount,
  signalText,
  stampAtMs,
  stampText,
  stirredBy,
  stripPos,
} from "./view.js";

const pub = {
  startedAt: 100,
  endsAt: 30_100,
  finished: false,
  decided: ["a"],
  signalAt: 15_100,
  signal: null,
  reveal: null,
};
const reveal = {
  thieves: ["a", "b"],
  pressedAt: [3_200, 27_800],
  outcome: "multi",
  scores: { a: -1, b: -1, c: 0 },
};

describe("Gizli Hırsız görünümü", () => {
  it("geçerli görünümleri birleştirir", () => {
    expect(parseGizliHirsizView(pub, { choice: "steal" })).toEqual({ ...pub, choice: "steal" });
    expect(parseGizliHirsizView(pub, { choice: null })?.choice).toBeNull();
    expect(parseGizliHirsizView({ ...pub, signal: "stir" }, { choice: "pass" })?.signal).toBe("stir");
    expect(parseGizliHirsizView({ ...pub, signalAt: null }, { choice: null })?.signalAt).toBeNull();
  });
  it("sonuç açılışını okur", () => {
    const v = parseGizliHirsizView({ ...pub, finished: true, reveal }, { choice: null });
    expect(v?.reveal?.thieves).toEqual(["a", "b"]);
    expect(v?.reveal?.pressedAt).toEqual([3_200, 27_800]);
    expect(v?.reveal?.outcome).toBe("multi");
  });
  it("bozuk görünümü reddeder", () => {
    expect(parseGizliHirsizView(null, { choice: null })).toBeNull();
    expect(parseGizliHirsizView(pub, null)).toBeNull();
    expect(parseGizliHirsizView(pub, { choice: "x" })).toBeNull();
    expect(parseGizliHirsizView({ ...pub, endsAt: "x" }, { choice: null })).toBeNull();
    expect(parseGizliHirsizView({ ...pub, finished: 0 }, { choice: null })).toBeNull();
    expect(parseGizliHirsizView({ ...pub, decided: [1] }, { choice: null })).toBeNull();
    expect(parseGizliHirsizView({ ...pub, signal: "loud" }, { choice: null })).toBeNull();
    expect(parseGizliHirsizView({ ...pub, signalAt: "15" }, { choice: null })).toBeNull();
    const bad = (r: unknown) => parseGizliHirsizView({ ...pub, reveal: r }, { choice: null });
    expect(bad({ ...reveal, outcome: "x" })).toBeNull();
    expect(bad({ ...reveal, thieves: [1] })).toBeNull();
    expect(bad({ ...reveal, scores: { a: "x" } })).toBeNull();
    expect(bad({ ...reveal, pressedAt: [1] })).toBeNull();
    expect(bad({ ...reveal, pressedAt: ["1", 2] })).toBeNull();
  });
  it("GH-U8: genel şerit başlığı tek satır ve alt satır", () => {
    const r = (thieves: string[], outcome: "solo" | "multi" | "none") => ({
      thieves,
      pressedAt: thieves.map(() => 0),
      outcome,
      scores: {},
    });
    expect(revealHeadline(r(["a"], "solo"))).toBe("Kasa soyuldu!");
    expect(revealHeadline(r([], "none"))).toBe("Kimse çalmadı");
    expect(revealHeadline(r(["a", "b", "c"], "multi"))).toBe("ALARM! 3 hırsız");
    expect(revealSubline(r(["a", "b"], "multi"))).toBe("Çalmayan kazanır");
    for (const o of ["solo", "multi", "none"] as const) {
      expect(Array.from(revealHeadline(r(["a", "b", "c", "d", "e", "f", "g", "h"], o))).length).toBeLessThan(
        18,
      );
    }
  });
  it("GH-U5: damga ve açılış evreleri", () => {
    const name = (id: string) => ({ a: "Mert", b: "Elif" })[id] ?? "?";
    expect(stampText({ thieves: ["a"], pressedAt: [0], outcome: "solo", scores: {} }, name)).toBe(
      "SOYULDU! Mert +1",
    );
    expect(stampText({ ...reveal, outcome: "multi" }, name)).toBe("ALARM! −1");
    expect(stampText({ thieves: [], pressedAt: [], outcome: "none", scores: {} }, name)).toBe(
      "Kasa sağlam kaldı",
    );
    expect(outroStep(0, 2)).toBe("dark");
    expect(outroStep(700, 2)).toBe("door");
    expect(outroStep(1_300, 2)).toBe("count");
    expect(outroStep(2_100, 2)).toBe("crew");
    expect(outroStep(2_900, 2)).toBe("stamp");
    expect(outroStep(2_100, 0)).toBe("stamp");
    // 8 hırsızda da açılış 4,5 sn'ye sığar.
    expect(stampAtMs(8)).toBeLessThanOrEqual(4_000);
    expect(crewShown(1_000, 3)).toBe(0);
    expect(crewShown(2_000, 3)).toBe(1);
    expect(crewShown(2_850, 3)).toBe(3);
    expect(shownCount(1_100, 3)).toBe(0);
    expect(shownCount(1_500, 3)).toBe(2);
    expect(shownCount(5_000, 3)).toBe(3);
  });
  it("GH-U6: zaman şeridi ve kıpırtı simgesi", () => {
    expect(stripPos(0)).toBe(0);
    expect(stripPos(15_000)).toBe(50);
    expect(stripPos(40_000)).toBe(100);
    expect(secondOf(200)).toBe(1);
    expect(secondOf(27_800)).toBe(28);
    expect(stirredBy(3_000, "stir")).toBe(true);
    expect(stirredBy(16_000, "stir")).toBe(false);
    expect(stirredBy(3_000, null)).toBe(false);
  });
  it("GH-U1: koltuklar: sen en altta, diğerleri yarım dairede", () => {
    const seats = seatArc(["a", "b", "me", "c"], "me");
    expect(seats.map((s) => s.id)).toEqual(["c", "a", "b", "me"]);
    const me = seats.find((s) => s.self);
    expect(me).toMatchObject({ x: 50, y: 96 });
    for (const s of seats.filter((x) => !x.self)) expect(s.y).toBeLessThanOrEqual(52);
    expect(seatArc(["a", "b"], "").every((s) => !s.self)).toBe(true);
  });
  it("GH-U2 / GH-U12: başlıklar", () => {
    const base = { spectator: false, choice: null, over: false, hasSignal: true } as const;
    expect(headOf(base)).toEqual({ head: "Çal ya da bekle", sub: "Erken çalan kasaya ilk el koyar" });
    expect(headOf({ ...base, hasSignal: false }).sub).toBe("Kimin çaldığı süre bitince belli olur");
    // ÇAL ile ÇALMA aynı başlık (GH-U4).
    expect(headOf({ ...base, choice: "steal" })).toEqual(headOf({ ...base, choice: "pass" }));
    expect(headOf({ ...base, choice: "steal" }).head).toBe("Kararın kayıtlı");
    expect(headOf({ ...base, over: true }).head).toBe("Süre doldu! Kasa açılıyor…");
    expect(headOf({ ...base, spectator: true }).head).toBe("Kasayı izliyorsun · Kim çalacak?");
    expect(decidedLine(4, 6)).toBe("4/6 karar verdi");
    expect(signalText("stir")).toBe("Kasada kıpırtı var!");
    expect(signalText("quiet")).toBe("Kasa sessiz");
  });
});
