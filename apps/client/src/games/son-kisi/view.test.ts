import { createRng, type SonKisiPublicView, sonKisi } from "@glix/engine";
import { describe, expect, it } from "vitest";
import {
  alarmLine,
  alarmMoment,
  bandFor,
  CueGate,
  formatSeconds,
  heartbeatMs,
  ownLine,
  parseSonKisiView,
  playHeadline,
  pulseMs,
  roundHeadline,
  roundsLine,
  sonKisiCues,
  timelinePercent,
  totalsLine,
} from "./view.js";

const result = {
  index: 0,
  alarmMs: 14_300,
  rang: true,
  escapes: [
    { id: "a", ms: 3_000, points: 0, close: false },
    { id: "c", ms: 12_400, points: 1, close: false },
    { id: "b", ms: 14_000, points: 3, close: true },
  ],
  caught: ["d"],
  last: ["b"],
  second: ["c"],
  points: { a: 0, b: 3, c: 1, d: 0 },
};
const pub: SonKisiPublicView = {
  startedAt: 100,
  rounds: 3,
  round: 0,
  phase: "play",
  tension: 2,
  escapedCount: 1,
  results: [],
  totals: { a: 0, b: 0, c: 0, d: 0 },
  final: null,
  finished: false,
};
const names: Record<string, string> = { a: "Elif", b: "Zeynep", c: "Mert", d: "Can" };
const nameOf = (id: string) => names[id] ?? "?";

describe("Son Kişi görünümü", () => {
  it("geçerli görünümleri birleştirir", () => {
    const v = parseSonKisiView(pub, { escaped: true, myMs: 2_000 });
    expect(v?.pub.tension).toBe(2);
    expect(v?.pub.escapedCount).toBe(1);
    expect(v?.priv).toEqual({ escaped: true, myMs: 2_000 });
  });
  it("sonucu ve sıralamayı okur", () => {
    const final = [{ playerId: "b", total: 5, roundPoints: [3, 2, 0], rank: 1, award: 2 }];
    const v = parseSonKisiView(
      { ...pub, phase: "over", results: [result], final, finished: true },
      { escaped: false, myMs: null },
    );
    expect(v?.pub.results[0]?.last).toEqual(["b"]);
    expect(v?.pub.final?.[0]?.award).toBe(2);
  });
  it("gerçek motorun görünümünü kabul eder", () => {
    const s = sonKisi.setup(["a", "b"], { now: 0, rng: createRng(3), connected: ["a", "b"] });
    const ctx = { now: 10, rng: createRng(1), connected: ["a", "b"] };
    expect(parseSonKisiView(sonKisi.publicView(s, ctx), sonKisi.view(s, "a", ctx))).not.toBeNull();
  });
  it("bozuk görünümü reddeder", () => {
    const ok = { escaped: false, myMs: null };
    expect(parseSonKisiView(null, ok)).toBeNull();
    expect(parseSonKisiView(pub, null)).toBeNull();
    expect(parseSonKisiView(pub, { escaped: "x", myMs: null })).toBeNull();
    expect(parseSonKisiView(pub, { escaped: true, myMs: "1" })).toBeNull();
    expect(parseSonKisiView({ ...pub, tension: 4 }, ok)).toBeNull();
    expect(parseSonKisiView({ ...pub, phase: "end" }, ok)).toBeNull();
    expect(parseSonKisiView({ ...pub, escapedCount: -1 }, ok)).toBeNull();
    expect(parseSonKisiView({ ...pub, results: [{ ...result, last: [2] }] }, ok)).toBeNull();
    expect(parseSonKisiView({ ...pub, results: [{ ...result, escapes: [{ id: "a" }] }] }, ok)).toBeNull();
    expect(parseSonKisiView({ ...pub, totals: { a: "x" } }, ok)).toBeNull();
    expect(parseSonKisiView({ ...pub, final: [{ playerId: "a" }] }, ok)).toBeNull();
  });
  it("süre biçimi ve nabız", () => {
    expect(formatSeconds(12_480)).toBe("12,4 sn");
    expect(formatSeconds(-5)).toBe("0,0 sn");
    expect(pulseMs(0)).toBeGreaterThan(pulseMs(1));
    expect(pulseMs(2)).toBeGreaterThan(pulseMs(3));
    expect(heartbeatMs(0)).toBeNull();
    expect(heartbeatMs(1)).toBe(857);
    expect(heartbeatMs(3)).toBe(429);
  });
});

describe("Son Kişi metinleri", () => {
  it("SK-U2 başlıklar: bekleyen, kaçan (kendi süren), son iki, son kişi, izleyici", () => {
    const base = { spectator: false, escaped: false, myMs: null, inside: 4, players: 5 };
    expect(playHeadline(base)).toEqual({ head: "Alarmdan önce kaç!", sub: "En son kaçan kazanır" });
    expect(playHeadline({ ...base, escaped: true, myMs: 12_400 }).head).toBe("Kaçtın! · 12,4 sn'de");
    expect(playHeadline({ ...base, inside: 2 }).sub).toBe("Son iki kişiden birisin!");
    expect(playHeadline({ ...base, inside: 1 }).sub).toBe(
      "Herkes kaçtı. Şimdi kaçarsan +2 · son 1 saniyede +3",
    );
    expect(playHeadline({ ...base, spectator: true }).head).toBe("Koridoru izliyorsun");
  });
  it("SK-U7 bantları ad taşımaz; 2 oyuncuda SON İKİ yok", () => {
    expect(bandFor(2, 5)).toBe("SON İKİ!");
    expect(bandFor(1, 5)).toBe("SON KİŞİ!");
    expect(bandFor(2, 2)).toBeNull();
    expect(bandFor(1, 2)).toBe("SON KİŞİ!");
    expect(bandFor(3, 5)).toBeNull();
  });
  it("SK-M3 alarm satırı: çaldı / çalacaktı", () => {
    expect(alarmLine(result)).toBe("Alarm 14,3 sn'de çaldı");
    expect(alarmLine({ ...result, rang: false, alarmMs: 17_400 })).toBe("Alarm 17,4 sn'de çalacaktı");
  });
  it("SK-U5 alarm anı: son kişi, kurtuldun, yakalandın", () => {
    expect(alarmMoment(result, "b")).toBe("last");
    expect(alarmMoment(result, "a")).toBe("safe");
    expect(alarmMoment(result, "d")).toBe("caught");
    expect(alarmMoment(result, null)).toBeNull();
  });
  it("SK-U9 kendi satırın ve üç tur özeti", () => {
    expect(ownLine(result, "c", nameOf)).toBe(
      "12,4 sn'de kaçtın · Zeynep 1,6 sn sonra kaçtı · alarma 1,9 sn vardı",
    );
    expect(ownLine(result, "b", nameOf)).toBe("14,0 sn'de kaçtın · alarma 0,3 sn vardı");
    expect(ownLine(result, "d", nameOf)).toBe("Alarm seni yakaladı · son kaçan 14,0 sn'deydi");
    expect(roundsLine([result, { ...result, points: { b: 0 } }, { ...result, points: { b: 2 } }], "b")).toBe(
      "+3 · 0 · +2 = 5",
    );
  });
  it("tur başlığı ve toplam şeridi", () => {
    expect(roundHeadline(result, nameOf)).toBe("Son kaçan: Zeynep · alarm 14,3 sn");
    expect(roundHeadline({ ...result, escapes: [], last: [] }, nameOf)).toBe(
      "Kimse kurtulamadı · alarm 14,3 sn",
    );
    expect(totalsLine({ a: 1, b: 5, c: 3 }, nameOf)).toBe("Zeynep 5 · Mert 3 · Elif 1");
    expect(timelinePercent(0, 10_000)).toBe(0);
    expect(timelinePercent(20_000, 10_000)).toBe(100);
  });
});

describe("Son Kişi sesleri: her an yalnız geçişte bir kez", () => {
  it("aynı görünüm tekrar tekrar gelse de an bir kez geçer", () => {
    const gate = new CueGate();
    const v = { ...pub, tension: 1 as const, escapedCount: 0 };
    expect(gate.fresh(sonKisiCues(v, 4)).map((c) => c.kind)).toEqual(["tension"]);
    // Aynı turda aynı durum (her görünüm güncellemesi): hiçbir şey çalmaz.
    for (let i = 0; i < 5; i++) expect(gate.fresh(sonKisiCues(v, 4))).toEqual([]);
    // Biri kaçtı: yalnız kapı.
    expect(gate.fresh(sonKisiCues({ ...v, escapedCount: 1 }, 4)).map((c) => c.kind)).toEqual(["door"]);
    expect(gate.fresh(sonKisiCues({ ...v, escapedCount: 1 }, 4))).toEqual([]);
    // İçeride iki kişi: kapı + SON İKİ bandı, bir kez.
    const two = { ...v, escapedCount: 2 };
    expect(gate.fresh(sonKisiCues(two, 4)).map((c) => c.kind)).toEqual(["door", "band"]);
    expect(gate.fresh(sonKisiCues(two, 4))).toEqual([]);
  });
  it("alarm her tur bir kez; sonraki turun aynı düzeyi yeniden çalar", () => {
    const gate = new CueGate();
    const gap = { ...pub, phase: "gap" as const, tension: 3 as const };
    expect(gate.fresh(sonKisiCues(gap, 4)).map((c) => c.kind)).toEqual(["alarm"]);
    expect(gate.fresh(sonKisiCues(gap, 4))).toEqual([]);
    const next = { ...pub, round: 1, tension: 1 as const, escapedCount: 0 };
    expect(gate.fresh(sonKisiCues(next, 4)).map((c) => c.kind)).toEqual(["tension", "ready"]);
    const over = { ...pub, round: 2, phase: "over" as const };
    expect(gate.fresh(sonKisiCues(over, 4)).map((c) => c.kind)).toEqual(["alarm", "final"]);
    expect(gate.fresh(sonKisiCues(over, 4))).toEqual([]);
  });
  it("ekrana sonradan gelen eski anları duymaz (prime)", () => {
    const gate = new CueGate();
    const v = { ...pub, tension: 3 as const, escapedCount: 3 };
    gate.prime(sonKisiCues(v, 4));
    expect(gate.fresh(sonKisiCues(v, 4))).toEqual([]);
  });
});
