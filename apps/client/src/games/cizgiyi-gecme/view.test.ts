import { type CizgiReveal, createRng, cizgiyiGecme as g, isRejected } from "@glix/engine";
import { describe, expect, it } from "vitest";
import { cizgiBriefing, crashExample } from "./briefing.js";
import {
  bandLabel,
  climbPlan,
  groupByZone,
  isDense,
  myHeadline,
  parseCizgiView,
  pinAt,
  pointsOf,
  statusOf,
  tableLine,
  towerRatio,
  valueAtRatio,
  whatIfLine,
  widthWord,
  zoneCount,
  zoneLabel,
  zoneOf,
  zonesTopDown,
} from "./view.js";

const pub = {
  startedAt: 100,
  roundStartedAt: 100,
  zoneWidth: 10,
  endsAt: 30_100,
  revealEndsAt: 35_100,
  round: 1,
  rounds: 2,
  radarAt: 15_100,
  radar: null,
  history: [],
  totals: { a: 0 },
  reveal: null,
  final: null,
  lockedIds: ["a"],
};
const priv = { myChoice: 42, locked: false };
const reveal: CizgiReveal = {
  zoneWidth: 10,
  choices: { a: 95, b: 91, c: 72, d: null, e: 30 },
  status: { a: "crashed", b: "crashed", c: "first", d: "none", e: "second" },
  points: { a: 0, b: 0, c: 2, d: 0, e: 1 },
};

describe("Çizgiyi Geçme görünümü: doğrulama", () => {
  it("geçerli görünümleri birleştirir; kilit bilgisini okur", () => {
    expect(parseCizgiView(pub, priv)).toMatchObject({ myChoice: 42, reveal: null, round: 1, rounds: 2 });
    expect(parseCizgiView(pub, { myChoice: 42, locked: true })?.locked).toBe(true);
    expect(parseCizgiView(pub, { myChoice: null, locked: false })?.myChoice).toBeNull();
  });
  it("radar, geçmiş, toplam ve genel puanı okur", () => {
    const full = {
      ...pub,
      round: 2,
      radar: { at: 15_100, zones: [4, 9] },
      history: [reveal],
      totals: { a: 0, c: 2, e: 1 },
      reveal,
      final: { a: 0, c: 2, e: 1 },
    };
    const v = parseCizgiView(full, priv);
    expect(v?.radar).toEqual({ at: 15_100, zones: [4, 9] });
    expect(v?.history[0]).toEqual(reveal);
    expect(v?.final).toEqual({ a: 0, c: 2, e: 1 });
    expect(parseCizgiView({ ...pub, radarAt: null }, priv)?.radarAt).toBeNull();
  });
  it("bozuk görünümü reddeder", () => {
    const bad: unknown[] = [
      null,
      { ...pub, startedAt: "x" },
      { ...pub, roundStartedAt: undefined },
      { ...pub, round: 3 },
      { ...pub, round: 0 },
      { ...pub, rounds: 9 },
      { ...pub, radarAt: "15" },
      { ...pub, radar: { at: 1, zones: [99] } },
      { ...pub, radar: { at: 1, zones: [1.5] } },
      { ...pub, radar: { zones: [] } },
      { ...pub, history: [3] },
      { ...pub, history: null },
      { ...pub, totals: { a: -1 } },
      { ...pub, totals: null },
      { ...pub, final: { a: 3 } },
      { ...pub, reveal: 3 },
      { ...pub, reveal: { ...reveal, choices: { ...reveal.choices, a: 101 } } },
      { ...pub, reveal: { ...reveal, status: { ...reveal.status, a: "yok" } } },
      { ...pub, reveal: { ...reveal, points: { ...reveal.points, a: 5 } } },
      { ...pub, reveal: { ...reveal, status: { ...reveal.status, d: "safe" } } },
      { ...pub, reveal: { ...reveal, status: { a: "crashed" } } },
      { ...pub, lockedIds: [1] },
      { ...pub, zoneWidth: 1 },
    ];
    for (const b of bad) expect(parseCizgiView(b, priv)).toBeNull();
    for (const p of [null, {}, { myChoice: -1, locked: false }, { myChoice: 4.5, locked: false }]) {
      expect(parseCizgiView(pub, p)).toBeNull();
    }
  });
  it("motorun gerçek görünümleri her anda geçer", () => {
    const ids = ["p1", "p2", "p3", "p4", "p5"];
    const ctx = (now: number) => ({ now, rng: createRng(1), connected: ids });
    let s = g.setup(ids, ctx(0));
    for (const [i, id] of ids.entries()) {
      const r = g.reduce(s, id, { kind: "choose", value: 90 + i }, ctx(1_000));
      if (!isRejected(r)) s = r;
    }
    for (const t of [0, 15_000, 30_000, 35_000, 50_000, 65_000, 71_000]) {
      expect(parseCizgiView(g.publicView(s, ctx(t)), g.view(s, "p1", ctx(t))), `t=${t}`).not.toBeNull();
    }
  });
});

describe("Çizgiyi Geçme görünümü: platformlar (CZ-M4, U2, U3)", () => {
  it("Zirve her genişlikte tek sayılık en üst platform", () => {
    expect(zoneCount(10)).toBe(11);
    expect(zonesTopDown(25).map((z) => zoneLabel(z, 25))).toEqual(["100", "75–99", "50–74", "25–49", "0–24"]);
    expect(zoneCount(14)).toBe(9);
    expect(zoneLabel(7, 14)).toBe("98–99");
    expect(zoneLabel(8, 14)).toBe("100");
    expect(zoneLabel(16, 6)).toBe("96–99");
    expect(zoneCount(4)).toBe(26);
    expect([zoneOf(99, 6), zoneOf(100, 6)]).toEqual([16, 17]);
  });
  it("yoğun kule onluk kuşaklara ayrılır; kuşak etiketi kuşağın ortasındaki platformda", () => {
    expect(isDense(4)).toBe(true);
    expect(isDense(7)).toBe(true);
    expect(isDense(10)).toBe(false);
    const labels = zonesTopDown(4)
      .map((z) => bandLabel(z, 4))
      .filter((x) => x !== null);
    expect(labels).toEqual([
      "Zirve",
      "90'lar",
      "80'ler",
      "70'ler",
      "60'lar",
      "50'ler",
      "40'lar",
      "30'lar",
      "20'ler",
      "10'lar",
      "0–9",
    ]);
  });
  it("5 kişide (genişlik 7) her kuşağın etiketi bir kez çıkar", () => {
    const labels = zonesTopDown(7)
      .map((z) => bandLabel(z, 7))
      .filter((x) => x !== null);
    expect(labels).toContain("50'ler");
    expect(labels).toHaveLength(11);
  });
  it("darlık kelimesi: 2 geniş, 3–4 orta, 5+ dar", () => {
    expect([2, 3, 4, 5, 8].map(widthWord)).toEqual(["geniş", "orta", "orta", "dar", "dar"]);
  });
  it("kule yüksekliği ↔ sayı (CZ-U1): her sayı kendi yüksekliğinden geri okunur", () => {
    for (const w of [25, 14, 10, 7, 6, 5, 4]) {
      for (let v = 0; v <= 100; v++) expect(valueAtRatio(towerRatio(v, w), w), `w=${w} v=${v}`).toBe(v);
    }
    expect(valueAtRatio(0, 10)).toBe(0);
    expect(valueAtRatio(1, 10)).toBe(100);
    expect(valueAtRatio(-3, 10)).toBe(0);
  });
});

describe("Çizgiyi Geçme görünümü: sonuç (CZ-U6…U9)", () => {
  it("gruplar, puan ve durum okunur", () => {
    const groups = groupByZone(reveal);
    expect(groups.get(9)).toEqual(["a", "b"]);
    expect([...groups.values()].flat()).not.toContain("d");
    expect(pointsOf(reveal, "c")).toBe(2);
    expect(statusOf(reveal, "zzz")).toBe("none");
  });
  it("başlık ve masa özeti", () => {
    expect(myHeadline(reveal, "c").text).toBe("+2 BİRİNCİ");
    expect(myHeadline(reveal, "e").text).toBe("+1 İKİNCİ");
    expect(myHeadline(reveal, "a").text).toBe("ÇARPIŞTIN");
    expect(myHeadline(reveal, "d").text).toBe("SEÇMEDİN");
    const peak: CizgiReveal = { ...reveal, choices: { ...reveal.choices, c: 100 } };
    expect(myHeadline(peak, "c").text).toBe("+2 ZİRVEDEN!");
    const safe: CizgiReveal = { ...reveal, status: { ...reveal.status, e: "safe" } };
    expect(myHeadline(safe, "e").text).toBe("TEK KALDIN");
    const name = (id: string) => ({ c: "Cihad" })[id] ?? id;
    expect(tableLine(reveal, name)).toBe("2 çarpışan · 2 tek kalan · en yüksek tek: Cihad 72");
    const crowd: CizgiReveal = {
      zoneWidth: 10,
      choices: { a: 41, b: 45 },
      status: { a: "crashed", b: "crashed" },
      points: { a: 0, b: 0 },
    };
    expect(tableLine(crowd, name)).toBe("Herkes çarpıştı! Kimse puan alamadı.");
  });
  it("'ne olurdu?' satırı (CZ-U8)", () => {
    // a 95 ile b 91'le çarpıştı: aşağı kaçsa b tek kalıp birinci olurdu (+1); +2 yalnız Zirve'de.
    expect(whatIfLine(reveal, "a")).toBe("Bir platform yukarıda (100) tek kalırdın: +2.");
    // Aşağıdaki platform en iyisiyse "bir platform aşağıda".
    const low: CizgiReveal = {
      zoneWidth: 10,
      choices: { a: 55, b: 52, c: 30, d: 100 },
      status: { a: "crashed", b: "crashed", c: "second", d: "first" },
      points: { a: 0, b: 0, c: 1, d: 2 },
    };
    expect(whatIfLine(low, "a")).toBe("60–99 arası yazsaydın tek kalırdın: +1.");
    // c birinci: üstündeki ilk boş platform 80–89.
    expect(whatIfLine(reveal, "c")).toBe("Üstündeki ilk boş platform: 80–89. Biraz daha cesur olabilirdin.");
    // e ikinci (30): birinci olması için 80–89 platformu (73–79 c ile, 90'lar a ve b ile çarpışır) ya da 100.
    expect(whatIfLine(reveal, "e")).toBe("80–89 arası yazsaydın birinci olurdun.");
    expect(whatIfLine(reveal, "d")).toBe("Seçmedin, pasif kaldın.");
    expect(whatIfLine(reveal, null)).toBe("Zirve (100) boş kaldı.");
    const full: CizgiReveal = { ...reveal, choices: { ...reveal.choices, d: 100 } };
    expect(whatIfLine({ ...full, status: { ...full.status, d: "first" } }, null)).toBe(
      "En yüksek boş platform: 80–89.",
    );
  });
  it("tırmanış planı: küçükten büyüğe, eşitler aynı anda; çarpışma ikinci pin oturunca", () => {
    const r: CizgiReveal = {
      zoneWidth: 10,
      choices: { a: 50, b: 50, c: 95, d: 91, e: null },
      status: { a: "crashed", b: "crashed", c: "crashed", d: "crashed", e: "none" },
      points: { a: 0, b: 0, c: 0, d: 0, e: 0 },
    };
    const p = climbPlan(r, ["a", "b", "c", "d", "e"], false, false);
    expect(p.pins.map((x) => x.id)).toEqual(["a", "b", "d", "c"]);
    expect(p.pins[0]?.seatAt).toBe(p.pins[1]?.seatAt);
    expect(p.crashAt.get(5)).toBe(p.pins[1]?.seatAt);
    expect(p.crashAt.get(9)).toBe(p.pins[3]?.seatAt);
    expect(p.launchAt).toBeGreaterThan(p.pins[3]?.seatAt ?? 0);
    expect(p.whatIfAt).toBeGreaterThan(p.pointsAt);
    // 8 kişide son açılış 7 sn'ye, ara açılış 5 sn'ye sığar.
    const many: CizgiReveal = {
      zoneWidth: 4,
      choices: Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`p${i}`, i * 12])),
      status: Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`p${i}`, "safe"])),
      points: Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`p${i}`, 0])),
    };
    expect(climbPlan(many, [], false, false).whatIfAt).toBeLessThan(6_000);
    expect(climbPlan(many, [], false, true).whatIfAt).toBeLessThan(4_200);
    // Hareket azaltma: tırmanış yok, çarpışma 0,4 sn sonra.
    const red = climbPlan(r, [], true, false);
    expect(red.pins.every((x) => x.startAt === 0 && x.seatAt === 0)).toBe(true);
    expect(red.crashAt.get(5)).toBe(400);
  });
  it("pin sayacı tırmanırken akar, oturunca durur", () => {
    const pin = { id: "a", value: 80, zone: 8, startAt: 100, seatAt: 600 };
    expect(pinAt(pin, 0)).toEqual({ phase: "wait", progress: 0, shown: 0 });
    expect(pinAt(pin, 350)).toEqual({ phase: "climb", progress: 0.5, shown: 40 });
    expect(pinAt(pin, 600)).toEqual({ phase: "seat", progress: 1, shown: 80 });
  });
});

describe("Çizgiyi Geçme anlatımı (CZ-U15)", () => {
  it("masanın platformları ve gerçek çarpışma örneği", () => {
    const steps = cizgiBriefing(g.briefing.steps, 5);
    expect(steps[0]).toBe(
      "İki tur: gizlice 0 ile 100 arasında bir sayı seç. 5 kişisiniz: her platform 7 sayı (0–6, 7–13 … 91–97, 98–99, 100 Zirve).",
    );
    expect(steps[1]).toContain("Örnek: 95 ve 94 → çarpıştı.");
    expect(steps[1]).toContain("radar");
    expect(cizgiBriefing(g.briefing.steps, 2)[1]).not.toContain("radar");
    expect(cizgiBriefing(g.briefing.steps, 8)[0]).toContain(
      "her platform 4 sayı (0–3, 4–7 … 92–95, 96–99, 100 Zirve)",
    );
  });
  it("örnek sayılar her genişlikte gerçekten aynı platformda", () => {
    for (const w of [25, 14, 10, 7, 6, 5, 4]) {
      const [a, b] = crashExample(w);
      expect(zoneOf(a, w)).toBe(zoneOf(b, w));
      expect(a).toBeLessThan(100);
    }
    expect(crashExample(5)).toEqual([99, 98]);
  });
});
