import { type OrtalamaReveal, ortalamaScore } from "@glix/engine";
import { describe, expect, it } from "vitest";
import {
  assignLanes,
  badgeOf,
  crossedFive,
  exampleLine,
  formatNumber,
  lastSeconds,
  leadersTied,
  linePercent,
  multiplierLabel,
  parseOrtalamaView,
  phaseOf,
  pointsOf,
  poppedCount,
  revealStage,
  revealTimeline,
  roadX,
  ropesOut,
  roundPhase,
  roundTable,
  shortName,
  strongMark,
  targetName,
  tierOf,
  whatIf,
  whatIfText,
  winningRange,
  winningRangeText,
} from "./view.js";

const pub = {
  startedAt: 100,
  introAt: 100,
  roundStartedAt: 1_000,
  endsAt: 10_100,
  revealEndsAt: 15_100,
  round: 1,
  rounds: 3,
  multiplier: { num: 1, den: 2 },
  previous: [],
  totals: { a: 0, b: 0, c: 0 },
  reveal: null,
  final: null,
  lockedIds: ["a"],
};
const priv = { myChoice: 42, locked: false };
const reveal: OrtalamaReveal = {
  choices: { a: 20, b: 30, c: 60 },
  mean: 36.6667,
  target: 18.3333,
  distances: { a: 1.6667, b: 11.6667, c: 41.6667 },
  order: ["a", "b", "c"],
  ranks: { a: 1, b: 2, c: 3 },
  points: { a: 2, b: 1, c: 0 },
  random: [],
  burned: [],
};
const summary = {
  mean: 40,
  target: 20,
  multiplier: { num: 1, den: 2 },
  choices: { a: 22, b: 30, c: 68 },
  points: { a: 2, b: 1, c: 0 },
  random: ["c"],
  burned: [],
};

describe("Ortalamaya En Yakın görünümü", () => {
  it("geçerli görünümleri birleştirir", () => {
    const v = parseOrtalamaView(pub, priv);
    expect(v).toMatchObject({ myChoice: 42, reveal: null });
    expect(phaseOf(v)).toBe("choosing");
  });
  it("seçmemiş ve izleyici için myChoice null olabilir", () => {
    expect(parseOrtalamaView(pub, { myChoice: null, locked: false })?.myChoice).toBeNull();
  });
  it("kilit bilgisini okur, bozuksa reddeder", () => {
    expect(parseOrtalamaView(pub, { myChoice: 42, locked: true })).toMatchObject({
      locked: true,
      lockedIds: ["a"],
    });
    expect(parseOrtalamaView({ ...pub, lockedIds: [1] }, priv)).toBeNull();
    expect(parseOrtalamaView({ ...pub, lockedIds: undefined }, priv)).toBeNull();
    expect(parseOrtalamaView(pub, { myChoice: 42 })).toBeNull();
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
  it("tur bilgisi: tur numarası, çarpan, önceki turlar, toplamlar ve genel skor okunur", () => {
    const round2 = {
      ...pub,
      round: 2,
      multiplier: { num: 2, den: 3 },
      previous: [summary],
      totals: { a: 2, b: 1, c: 0 },
    };
    const v = parseOrtalamaView(round2, priv);
    expect(v).toMatchObject({ round: 2, rounds: 3, multiplier: { num: 2, den: 3 } });
    expect(v?.previous).toEqual([summary]);
    expect(v?.totals).toEqual({ a: 2, b: 1, c: 0 });
    expect(v?.final).toBeNull();
    const last = parseOrtalamaView({ ...pub, round: 3, final: { a: 2, b: 1, c: 0 }, reveal }, priv);
    expect(last?.final).toEqual({ a: 2, b: 1, c: 0 });
  });
  it("bozuk tur bilgisini reddeder", () => {
    expect(parseOrtalamaView({ ...pub, round: 0 }, priv)).toBeNull();
    expect(parseOrtalamaView({ ...pub, round: 4 }, priv)).toBeNull();
    expect(parseOrtalamaView({ ...pub, multiplier: { num: 3, den: 2 } }, priv)).toBeNull();
    expect(parseOrtalamaView({ ...pub, multiplier: null }, priv)).toBeNull();
    expect(parseOrtalamaView({ ...pub, previous: [{ mean: "x" }] }, priv)).toBeNull();
    expect(parseOrtalamaView({ ...pub, previous: 3 }, priv)).toBeNull();
    expect(parseOrtalamaView({ ...pub, totals: { a: "x" } }, priv)).toBeNull();
    expect(parseOrtalamaView({ ...pub, final: { a: "x" } }, priv)).toBeNull();
    expect(parseOrtalamaView({ ...pub, roundStartedAt: undefined }, priv)).toBeNull();
    expect(parseOrtalamaView({ ...pub, introAt: undefined }, priv)).toBeNull();
    expect(parseOrtalamaView({ ...pub, previous: [{ ...summary, choices: undefined }] }, priv)).toBeNull();
    expect(parseOrtalamaView({ ...pub, previous: [{ ...summary, random: ["zz"] }] }, priv)).toBeNull();
    expect(parseOrtalamaView({ ...pub, previous: [{ ...summary, burned: "a" }] }, priv)).toBeNull();
    expect(parseOrtalamaView({ ...pub, reveal: { ...reveal, random: ["x"] } }, priv)).toBeNull();
    expect(parseOrtalamaView({ ...pub, reveal: { ...reveal, burned: ["a", "a"] } }, priv)).toBeNull();
    expect(parseOrtalamaView({ ...pub, reveal: { ...reveal, burned: undefined } }, priv)).toBeNull();
  });
  it("çarpan ve hedef adları Türkçe", () => {
    expect([1, 2, 3].map((n) => multiplierLabel({ num: n, den: n + 1 }))).toEqual(["½", "⅔", "¾"]);
    expect(targetName({ num: 1, den: 2 })).toBe("ortalamanın yarısı");
    expect(targetName({ num: 2, den: 3 })).toBe("ortalamanın üçte ikisi");
    expect(targetName({ num: 3, den: 4 })).toBe("ortalamanın dörtte üçü");
  });

  it("evre: tur kartı → seçim → açılış; son 3 saniye (OY-U3, OY-U4)", () => {
    const v = parseOrtalamaView(pub, priv);
    if (!v) throw new Error("görünüm yok");
    expect(roundPhase(v, 500)).toBe("card");
    expect(roundPhase(v, 1_000)).toBe("choose");
    expect(roundPhase({ ...v, reveal }, 500)).toBe("reveal");
    expect(lastSeconds(v, 5_000)).toBeNull();
    expect(lastSeconds(v, 7_100)).toBe(3);
    expect(lastSeconds(v, 9_200)).toBe(1);
    expect(lastSeconds(v, 10_100)).toBeNull();
    expect(lastSeconds(v, 500)).toBeNull();
  });
  it("rozet ve ışık (OY-U9, OY-U6): yalnız ödül alanlarda derece; yanan ve rastgele etiketli", () => {
    expect(badgeOf(reveal, "a")).toBe("best");
    expect(badgeOf(reveal, "b")).toBe("second");
    expect(badgeOf(reveal, "c")).toBeNull();
    const r = ortalamaScore(["a", "b", "c", "d", "e"], { a: 0, b: 0, c: 0, d: 4, e: 4 }, ["e"], {
      num: 1,
      den: 2,
    });
    expect(badgeOf(r, "a")).toBe("burned");
    expect(badgeOf(r, "e")).toBe("random");
    expect(badgeOf(r, "d")).toBe("best");
    const tie = ortalamaScore(["a", "b", "c"], { a: 0, b: 10, c: 20 }, [], { num: 1, den: 2 });
    expect(badgeOf(tie, "a")).toBe("tie");
    expect(tierOf(tie, "b")).toBe("gold");
    expect(tierOf(r, "a")).toBe("none");
  });
  it("ne olurdu? (OY-U7): kazandıracak aralık, kıl payı, rastgele ve erişilemez tur", () => {
    const m = { num: 1, den: 2 };
    const r = ortalamaScore(["a", "b", "c", "d"], { a: 20, b: 30, c: 60, d: 50 }, [], m);
    // a hedefte (20): kazanan. b için bir aralık var mı? Hedef b'ye bağlı değişir; tek en yakın olacağı sayılar.
    const wb = whatIf(r, "b", m);
    expect(wb?.kind).toBe("range");
    if (wb?.kind === "range") {
      for (let x = wb.lo; x <= wb.hi; x++) {
        expect(ortalamaScore(["a", "b", "c", "d"], { ...r.choices, b: x }, [], m).points.b).toBe(2);
      }
      expect(whatIfText(wb, (id) => id)).toMatch(/yazsaydın \+2 alırdın\.$/);
    }
    const wa = whatIf(r, "a", m);
    expect(wa).toMatchObject({ kind: "close", rival: "b" });
    expect(whatIfText({ kind: "close", rival: "b", gap: 0.4 }, () => "Elif")).toBe(
      "Kıl payı: Elif senden 0,4 uzaktaydı.",
    );
    const rr = ortalamaScore(["a", "b", "c"], { a: 74, b: 10, c: 12 }, ["a"], m);
    expect(whatIf(rr, "a", m)).toEqual({ kind: "random", value: 74 });
    expect(whatIfText({ kind: "random", value: 74 }, String)).toBe("Seçmedin, sana 🎲 74 düştü.");
    expect(whatIfText({ kind: "range", lo: 17, hi: 17, points: 2 }, String)).toBe("17 yazsaydın +2 alırdın.");
    expect(whatIfText({ kind: "range", lo: 15, hi: 19, points: 2 }, String)).toBe(
      "15 ile 19 arası yazsaydın +2 alırdın.",
    );
    expect(whatIfText({ kind: "untouchable", winner: "z" }, () => "Zeynep")).toBe(
      "Bu turu kimse alamazdı: Zeynep hedefe çok yakındı.",
    );
    expect(whatIf(r, "zz", m)).toBeNull();
  });
  it("izleyici için kazandıran aralık; herkes yandıysa söylenir", () => {
    const r = ortalamaScore(["a", "b", "c", "d"], { a: 20, b: 30, c: 60, d: 50 }, [], { num: 1, den: 2 });
    expect(winningRange(r)).toEqual({ lo: 20, hi: 20 });
    expect(winningRangeText(r)).toBe("Kazandıran sayı: 20");
    const wide = ortalamaScore(["a", "b", "c"], { a: 14, b: 30, c: 60 }, [], { num: 1, den: 2 });
    // hedef ~17,3; en yakın 14 (3,3 uzak) → 14…20
    expect(winningRange(wide)).toEqual({ lo: 14, hi: 20 });
    const all = ortalamaScore(["a", "b", "c"], { a: 5, b: 5, c: 5 }, [], { num: 1, den: 2 });
    expect(winningRange(all)).toBeNull();
    expect(winningRangeText(all)).toBe("Bu tur kimse puan alamadı.");
  });
  it("yol yakınlaşması (OY-U11): monoton, uçlar sabit, hedef ±20 yolun %70'i", () => {
    expect(roadX(37, 18, false)).toBeCloseTo(0.37);
    expect(roadX(0, 30, true)).toBe(0);
    expect(roadX(100, 30, true)).toBeCloseTo(1);
    expect(roadX(50, 30, true) - roadX(10, 30, true)).toBeCloseTo(0.7);
    let prev = -1;
    for (let v = 0; v <= 100; v++) {
      const x = roadX(v, 12, true);
      expect(x).toBeGreaterThanOrEqual(prev);
      prev = x;
    }
    // Hedef uca yakın (0): büyütülen bölüm 0–20.
    expect(roadX(20, 0, true)).toBeCloseTo(0.7);
  });
  it("açılış zaman çizelgesi (OY-U5): puan en geç 4 sn'de, 8 kişide de; hareket azaltmada 0,4 sn arayla", () => {
    for (const n of [3, 5, 8]) {
      const t = revealTimeline(n, false);
      expect(t.popStep * n).toBeLessThanOrEqual(1_200);
      expect(t.list).toBeLessThanOrEqual(4_000);
      expect(t.list).toBeLessThan(5_000);
      expect(revealStage(0, t, false)).toBe(0);
      expect(revealStage(1_300, t, false)).toBe(1);
      expect(revealStage(2_300, t, false)).toBe(2);
      expect(revealStage(3_100, t, false)).toBe(3);
      expect(revealStage(4_000, t, false)).toBe(4);
      expect(revealStage(9_000, t, false)).toBe(4);
      expect(revealStage(5_500, t, true)).toBe(5);
      expect(poppedCount(0, t, n)).toBe(1);
      expect(poppedCount(1_200, t, n)).toBe(n);
      expect(ropesOut(2_999, t, n)).toBe(0);
      expect(ropesOut(3_999, t, n)).toBe(n);
    }
    const red = revealTimeline(8, true);
    expect([red.mean, red.target, red.list]).toEqual([0, 400, 800]);
    expect(revealStage(0, red, false)).toBe(1);
    expect(revealStage(400, red, false)).toBe(2);
    expect(revealStage(800, red, false)).toBe(4);
    expect(poppedCount(0, red, 8)).toBe(8);
  });
  it("üç turun tablosu (OY-U8): toplam sıralı, tur kutuları, genel skor; lider eşitliği", () => {
    const played = [
      { points: { a: 2, b: 1, c: 0 }, burned: [], random: ["c"] },
      { points: { a: 0, b: 0, c: 0 }, burned: ["a", "b", "c"], random: [] },
    ];
    const rows = roundTable(["a", "b", "c"], played, 3, null);
    expect(rows.map((r) => [r.id, r.total])).toEqual([
      ["a", 2],
      ["b", 1],
      ["c", 0],
    ]);
    expect(rows[2]?.rounds).toEqual([
      { points: 0, burned: false, random: true },
      { points: 0, burned: true, random: false },
      null,
    ]);
    expect(rows[0]?.award).toBeNull();
    const fin = roundTable(["a", "b", "c"], played, 3, { a: 2, b: 1, c: 0 });
    expect(fin.map((r) => r.award)).toEqual([2, 1, 0]);
    expect(leadersTied({ a: 1, b: 1, c: 0 })).toBe(true);
    expect(leadersTied({ a: 2, b: 1 })).toBe(false);
    expect(leadersTied({ a: 0, b: 0 })).toBe(false);
    expect(leadersTied(null)).toBe(false);
  });
  it("sürükleme tiki (OY-U15): her 5'in katında bir; 0/50/100 güçlü", () => {
    expect(crossedFive(3, 4)).toBeNull();
    expect(crossedFive(3, 5)).toBe(5);
    expect(crossedFive(4, 12)).toBe(10);
    expect(crossedFive(12, 4)).toBe(5);
    expect(crossedFive(5, 5)).toBeNull();
    expect(crossedFive(null, 30)).toBe(30);
    expect(crossedFive(null, 31)).toBeNull();
    expect([0, 50, 100, 45].map(strongMark)).toEqual([true, true, true, false]);
  });
  it("kısa ad ve kart örneği", () => {
    expect(shortName("Elif")).toBe("Elif");
    expect(shortName("Zeynepnur")).toBe("Zeyne…");
    expect(Array.from(shortName("Çağdaşoğlu")).length).toBeLessThanOrEqual(6);
    expect([1, 2, 3].map((k) => exampleLine({ num: k, den: k + 1 }))).toEqual([
      "ortalama 30 olursa hedef 15",
      "ortalama 30 olursa hedef 20",
      "ortalama 30 olursa hedef 22,5",
    ]);
  });
});
