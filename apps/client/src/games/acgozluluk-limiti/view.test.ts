import { type AcgozlulukReveal, createRng, acgozlulukLimiti as g, isRejected } from "@glix/engine";
import { describe, expect, it } from "vitest";
import { acgozlulukBriefing } from "./briefing.js";
import {
  chipColumns,
  chipHue,
  doorProgress,
  everyoneLine,
  FOG_MS,
  fairShareOf,
  fillPlan,
  greedLabel,
  ledgerBoxes,
  parseAcgozlulukView,
  runningTotal,
  SEG_MS,
  SEG_SLOW_MS,
  shortName,
  stripOrder,
  tankCapacity,
  tankPercent,
  tvSlow,
  VERDICT_TEXT,
  verdictOf,
  whatIfLine,
} from "./view.js";

const IDS = ["a", "b", "c", "d", "e"];
const ctx = (now: number) => ({ now, rng: createRng(2), connected: IDS });

/** Gerçek motordan görünüm (istemci ayrıştırması motorla aynı sözleşmeyi okur). */
function engineView(at: number, viewer: string | null = "a") {
  let s = g.setup(IDS, ctx(0));
  for (const [i, id] of IDS.entries()) {
    const r = g.reduce(s, id, { kind: "choose", value: i % 4 }, ctx(500));
    if (!isRejected(r)) s = r;
  }
  return parseAcgozlulukView(g.publicView(s, ctx(at)), g.view(s, viewer, ctx(at)));
}

const reveal = (choices: Record<string, number>, limit: number, missing: string[] = []): AcgozlulukReveal => {
  const total = Object.values(choices).reduce((x, y) => x + y, 0);
  const over = total > limit;
  const order = Object.keys(choices)
    .filter((id) => (choices[id] ?? 0) > 0)
    .sort((x, y) => (choices[x] ?? 0) - (choices[y] ?? 0));
  const points = Object.fromEntries(Object.entries(choices).map(([k, v]) => [k, over ? 0 : v]));
  return { choices, missing, total, limit, over, points, order, spillers: [] };
};

describe("Açgözlülük Limiti görünümü (ayrıştırma)", () => {
  it("motorun seçim, açılış ve son açılış görünümlerini okur", () => {
    const choosing = engineView(1_000);
    expect(choosing).toMatchObject({
      round: 1,
      rounds: 3,
      maxChoice: 5,
      band: { low: 15, high: 19 },
      reveal: null,
    });
    expect(choosing?.myChoice).toBe(0);
    const opened = engineView(12_000);
    expect(opened?.reveal?.choices).toEqual({ a: 0, b: 1, c: 2, d: 3, e: 0 });
    const last = engineView(46_000 + 12_000);
    expect(last?.round).toBe(3);
    expect(last?.history).toHaveLength(2);
    expect(last?.final).not.toBeNull();
  });

  it("Gözcü kelimesini yalnız geçerliyse okur; bozuk veride null", () => {
    const pub = g.publicView(g.setup(IDS, ctx(0)), ctx(0));
    expect(
      parseAcgozlulukView(pub, { myChoice: 2, locked: false, scout: { word: "rahat", at: 7 } })?.scout,
    ).toEqual({
      word: "rahat",
      at: 7,
    });
    expect(
      parseAcgozlulukView(pub, { myChoice: 2, locked: false, scout: { word: "yalan", at: 7 } }),
    ).toBeNull();
    expect(parseAcgozlulukView(pub, { myChoice: 2.5, locked: false, scout: null })).toBeNull();
    expect(
      parseAcgozlulukView(
        { ...pub, band: { low: 9, high: 3 } },
        { myChoice: null, locked: false, scout: null },
      ),
    ).toBeNull();
    expect(
      parseAcgozlulukView(
        { ...pub, reveal: { choices: {} } },
        { myChoice: null, locked: false, scout: null },
      ),
    ).toBeNull();
    expect(parseAcgozlulukView(null, {})).toBeNull();
  });
});

describe("AL-U1 / AL-U2 / AL-U10: hazne ve düğmeler", () => {
  it("hazne ölçeği bandın üst ucunun 1,5 katı; en kötü toplam (N×N) sığar", () => {
    expect(tankCapacity({ low: 15, high: 19 })).toBe(28.5);
    for (const [n, high] of [
      [3, 7],
      [8, 46],
    ] as const) {
      expect(tankPercent(n * n, { low: 1, high })).toBeLessThanOrEqual(100);
    }
    expect(tankPercent(-2, { low: 1, high: 4 })).toBe(0);
  });

  it("herkes senin kadar: bandın altında sığar, içinde sisin içinde, üstünde taşar", () => {
    const band = { low: 15, high: 19 };
    expect(everyoneLine(3, 5, band)).toEqual({ total: 15, fit: "fits" });
    expect(everyoneLine(4, 5, band)).toEqual({ total: 20, fit: "over" });
    expect(everyoneLine(4, 4, { low: 10, high: 17 })).toEqual({ total: 16, fit: "maybe" });
  });

  it("adil pay ve etiketler: Pas, Kanaatkâr, Dengeli, Açgözlü, Hepsi benim!", () => {
    expect(fairShareOf({ low: 15, high: 19 }, 5)).toBe(3);
    expect(fairShareOf({ low: 40, high: 46 }, 8)).toBe(5);
    expect([0, 1, 2, 3, 4, 5].map((v) => greedLabel(v, 3, 5))).toEqual([
      "Pas",
      "Kanaatkâr",
      "Kanaatkâr",
      "Dengeli",
      "Açgözlü",
      "Hepsi benim!",
    ]);
    expect(chipHue(0, 5)).toBe(140);
    expect(chipHue(5, 5)).toBe(0);
  });

  it("düğme ızgarası korunur", () => {
    expect([4, 5, 6, 7, 9].map(chipColumns)).toEqual([4, 5, 3, 4, 5]);
  });

  it("kasa kapısı yalnız son 5 sn'de iner", () => {
    const v = engineView(1_000);
    if (!v) throw new Error("görünüm yok");
    expect(doorProgress(v, 6_000)).toBe(0);
    expect(doorProgress(v, 9_500)).toBeCloseTo(0.5);
    expect(doorProgress(v, 12_000)).toBe(1);
  });
});

describe("AL-U6 / AL-U8: sıralı dolum ve dört karar", () => {
  it("bant çizgiye döner, şeritler küçükten büyüğe 300 ms; limite 3 kala 450 ms", () => {
    const r = reveal({ a: 2, b: 3, c: 4, d: 5 }, 12);
    const plan = fillPlan(r);
    expect(plan.segments.map((s) => [s.id, s.at, s.slow])).toEqual([
      ["a", FOG_MS, false],
      ["b", FOG_MS + SEG_MS, false],
      ["c", FOG_MS + 2 * SEG_MS, false],
      ["d", FOG_MS + 3 * SEG_MS, true], // 9 → limite 3
    ]);
    expect(plan.segments.map((s) => s.spill)).toEqual([false, false, false, true]);
    expect(plan.verdictAt).toBe(FOG_MS + 3 * SEG_MS + SEG_SLOW_MS + 250);
    expect(plan.whatIfAt).toBe(plan.verdictAt + 600);
  });

  it("toplam baştan yazmaz: ilk şerit düşmeden '?' (null), sonra yükselir", () => {
    const plan = fillPlan(reveal({ a: 2, b: 3 }, 12));
    expect(runningTotal(plan, 0)).toBeNull();
    expect(runningTotal(plan, FOG_MS)).toBe(2);
    expect(runningTotal(plan, 5_000)).toBe(5);
    expect(runningTotal(fillPlan(reveal({ a: 0 }, 5)), 5_000)).toBe(0);
  });

  it("8 kişide en kötü dolum ara açılışa (5 sn) sığar", () => {
    const plan = fillPlan(reveal({ a: 5, b: 5, c: 5, d: 5, e: 5, f: 5, g: 5, h: 6 }, 40));
    expect(plan.verdictAt).toBeLessThan(5_000);
  });

  it("hareket azaltmada dolum anlık, karar ve satır 0,5 sn arayla", () => {
    const plan = fillPlan(reveal({ a: 2, b: 3 }, 12), true);
    expect(plan.segments.every((s) => s.at === 0)).toBe(true);
    expect([plan.verdictAt, plan.whatIfAt]).toEqual([500, 1_000]);
  });

  it("dört karar: ağzına kadar, kıl payı, bol bol yer, bir jetonla / patladı; arası Altın! ve Taştı!", () => {
    const v = (total: number, limit: number) => VERDICT_TEXT[verdictOf({ total, limit })];
    expect(v(17, 17)).toBe("AĞZINA KADAR!");
    expect(v(15, 17)).toBe("Kıl payı!");
    expect(v(16, 17)).toBe("Kıl payı!");
    expect(v(11, 17)).toBe("Bol bol yer var");
    expect(v(13, 17)).toBe("Altın!");
    expect(v(18, 17)).toBe("Bir jetonla taştı!");
    expect(v(20, 17)).toBe("Taştı!");
    expect(v(22, 17)).toBe("PATLADI!");
  });
});

describe("AL-U7: ne olurdu?", () => {
  const name = (id: string) => ({ a: "Elif", b: "Mert", c: "Defne" })[id] ?? id;

  it("taştı ve sen önleyebilirdin: 'Sen X deseydin sığardı.'", () => {
    const r = reveal({ a: 4, b: 3, c: 3 }, 8);
    expect(whatIfLine(r, "a", 4, {}, name)).toBe("Sen 2 deseydin sığardı.");
  });
  it("taştı ve önleyemezdin: fazla + taşıranlar", () => {
    const r = { ...reveal({ a: 1, b: 8, c: 8 }, 14), spillers: ["b", "c"] };
    expect(whatIfLine(r, "a", 8, {}, name)).toBe("3 jeton fazla. Taşıran: Mert (8), Defne (8).");
  });
  it("taşmadı: boşluk ve 'birinci olurdun'", () => {
    const r = reveal({ a: 3, b: 4, c: 3 }, 12);
    expect(whatIfLine(r, "a", 5, { a: 3, b: 4, c: 3 }, name)).toBe(
      "Kasada 2 boşluk kaldı: 5 deseydin de sığardı (ve birinci olurdun).",
    );
    expect(whatIfLine(r, "c", 5, { a: 3, b: 9, c: 3 }, name)).toBe(
      "Kasada 2 boşluk kaldı: 5 deseydin de sığardı.",
    );
    expect(whatIfLine(reveal({ a: 3, b: 2 }, 6), "a", 3, {}, name)).toBe("Kasada 1 boşluk kaldı.");
  });
  it("tam limit, seçmeyen, izleyici", () => {
    expect(whatIfLine(reveal({ a: 3, b: 3 }, 6), "a", 3, {}, name)).toBe(
      "Ağzına kadar! Bir jeton daha taşırırdı.",
    );
    expect(whatIfLine(reveal({ a: 0, b: 3 }, 6, ["a"]), "a", 3, {}, name)).toBe("Seçmedin, 0 sayıldın.");
    expect(whatIfLine(reveal({ a: 4, b: 4 }, 5), null, 3, {}, name)).toBe("3 jeton fazla.");
    expect(whatIfLine(reveal({ a: 1, b: 2 }, 5), null, 3, {}, name)).toBe("2 boşluk kaldı.");
  });
});

describe("AL-U3 / AL-U9 / AL-U12 / AL-U16", () => {
  it("sonuç şeridi büyükten küçüğe, eşitlerde katılım sırası; ad en çok 8 harf", () => {
    expect(stripOrder(reveal({ a: 1, b: 3, c: 3, d: 0 }, 9), ["a", "b", "c", "d"])).toEqual([
      "b",
      "c",
      "a",
      "d",
    ]);
    expect(shortName("Muhammedcan")).toBe("Muhamme…");
    expect(shortName("Zeynep")).toBe("Zeynep");
  });

  it("kasa defteri: oynanmış turlar toplam/limit ✓/✗, oynanan tur işaretli", () => {
    const v = engineView(17_000 + 12_000);
    if (!v) throw new Error("görünüm yok");
    const boxes = ledgerBoxes(v);
    expect(boxes.map((b) => b.current)).toEqual([false, true, false]);
    expect(boxes[0]?.total).toBe(6);
    expect(boxes[0]?.over).toBe(false);
    expect(boxes[2]?.total).toBeNull();
  });

  it("TV dolumu açılışa sığacak kadar yavaşlar (en çok 1,5 kat)", () => {
    expect(tvSlow(2_000, 5_000)).toBe(1.5);
    expect(tvSlow(4_400, 5_000)).toBe(1);
    expect(tvSlow(4_000, 7_000)).toBe(1.5);
    expect(tvSlow(4_000, 5_600)).toBeCloseTo(1.2);
  });

  it("anlatım masanın sayılarıyla: aralık, bant ve her zaman sığan örnek", () => {
    const steps = acgozlulukBriefing(g.briefing.steps, 5);
    expect(steps[0]).toContain("0 ile 5 arasında");
    expect(steps[1]).toContain("Toplam 15–19 arası gizli limiti geçmesin: herkes 3 derse 15, sığar.");
    expect(steps[1]).toContain("Gözcü");
    expect(acgozlulukBriefing(g.briefing.steps, 3)[1]).toContain(
      "5–7 arası gizli limiti geçmesin: herkes 1 derse 3",
    );
    expect(steps).toHaveLength(3);
  });
});
