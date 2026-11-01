import { describe, expect, it } from "vitest";
import {
  accusative,
  bamLine,
  dative,
  displayPub,
  genitive,
  locative,
  nextRisk,
  numLocative,
  outEntries,
  outsLeft,
  outsText,
  parseRusRuletiView,
  recentShots,
  riskFraction,
  riskLine,
  seatPositions,
  seatTap,
  shortName,
  shotLine,
  shownRisk,
  stageOf,
  tallyLine,
} from "./view.js";

const shot = { seq: 2, shooter: "a", target: "b", auto: false, exploded: true, risk: 26, at: 5000 };
const pub = {
  startedAt: 100,
  players: ["a", "b", "c", "d"],
  alive: ["a", "c", "d"],
  eliminated: ["b"],
  holder: "c",
  risk: 16,
  shots: 2,
  last: shot,
  history: [shot],
  noReturn: null,
  lastWord: null,
  handoff: null,
  openAt: 8500,
  deadline: 26500,
  over: false,
  result: null,
};

describe("Rus Ruleti görünümü", () => {
  it("geçerli görünümleri birleştirir", () => {
    const v = parseRusRuletiView(pub, { role: "alive" });
    expect(v?.pub.holder).toBe("c");
    expect(v?.pub.last?.exploded).toBe(true);
    expect(v?.priv.role).toBe("alive");
  });

  it("son atış ve sonuç boş olabilir; bitişte deadline null", () => {
    const v = parseRusRuletiView(
      { ...pub, last: null, over: true, deadline: null, result: { survivors: ["a"], eliminated: ["b"] } },
      { role: "out", turn: 3, prediction: null, lastResult: null },
    );
    expect(v?.pub.last).toBeNull();
    expect(v?.pub.deadline).toBeNull();
    expect(v?.pub.result?.survivors).toEqual(["a"]);
  });

  it("bozuk görünümü reddeder", () => {
    expect(parseRusRuletiView(null, { role: "alive" })).toBeNull();
    expect(parseRusRuletiView(pub, null)).toBeNull();
    expect(parseRusRuletiView(pub, { role: "boss" })).toBeNull();
    expect(parseRusRuletiView({ ...pub, alive: [1] }, { role: "alive" })).toBeNull();
    expect(parseRusRuletiView({ ...pub, risk: "16" }, { role: "alive" })).toBeNull();
    expect(parseRusRuletiView({ ...pub, holder: 3 }, { role: "alive" })).toBeNull();
    expect(parseRusRuletiView({ ...pub, deadline: "x" }, { role: "alive" })).toBeNull();
    expect(parseRusRuletiView({ ...pub, last: { ...shot, exploded: "evet" } }, { role: "alive" })).toBeNull();
    expect(parseRusRuletiView({ ...pub, last: 5 }, { role: "alive" })).toBeNull();
    expect(
      parseRusRuletiView({ ...pub, result: { survivors: [1], eliminated: [] } }, { role: "alive" }),
    ).toBeNull();
    expect(parseRusRuletiView({ ...pub, over: 1 }, { role: "alive" })).toBeNull();
  });

  it("evre: dönüş (1,2 sn), sonuç, karar; bitişte de son atış önce gösterilir", () => {
    expect(stageOf(pub, 5000)).toBe("spin");
    expect(stageOf(pub, 6199)).toBe("spin");
    expect(stageOf(pub, 6200)).toBe("result");
    expect(stageOf(pub, 8500)).toBe("deciding");
    expect(stageOf({ ...pub, last: null }, 0)).toBe("deciding");
    expect(stageOf({ ...pub, over: true }, 6000)).toBe("spin");
    expect(stageOf({ ...pub, over: true }, 8500)).toBe("over");
  });

  it("RR-M3 evreleri: son söz, ardından el değiştirme", () => {
    const lw = { ...pub, lastWord: { from: "b", opensAt: 8500, endsAt: 12_500 }, openAt: 12_500 };
    expect(stageOf(lw, 8000)).toBe("result");
    expect(stageOf(lw, 9000)).toBe("lastWord");
    const ho = { ...pub, handoff: { from: "b", to: "c", chosen: true }, openAt: 10_000 };
    expect(stageOf(ho, 9_700)).toBe("handoff");
    expect(stageOf(ho, 10_000)).toBe("deciding");
  });

  it("RR-U5: dönüşte sonuç ele verilmez (masa atıştan önceki hâliyle)", () => {
    const spinning = displayPub(pub, 5100);
    expect(spinning.alive).toEqual(["a", "b", "c", "d"]);
    expect(spinning.eliminated).toEqual([]);
    expect(spinning.holder).toBe("a");
    expect(spinning.risk).toBe(26);
    expect(spinning.history).toEqual([]);
    expect(displayPub(pub, 6300)).toBe(pub);
  });

  it("RR-U5: halka dönüşte atışın riskini, sonra yeni riski gösterir", () => {
    expect(shownRisk(pub, 5100)).toBe(26);
    expect(shownRisk(pub, 6300)).toBe(16);
  });

  it("yeni alanları okur; bozuk olanı reddeder; eksikse varsayılan", () => {
    const full = {
      ...pub,
      history: [shot],
      noReturn: "a",
      lastWord: { from: "b", opensAt: 1, endsAt: 2 },
      handoff: { from: "b", to: "c", chosen: false },
    };
    const v = parseRusRuletiView(full, {
      role: "out",
      turn: 2,
      prediction: null,
      lastResult: null,
      tally: { made: 3, hit: 1, yes: 2, yesHit: 1 },
    });
    expect(v?.pub.history).toHaveLength(1);
    expect(v?.pub.noReturn).toBe("a");
    expect(v?.pub.lastWord?.from).toBe("b");
    expect(v?.pub.handoff?.to).toBe("c");
    expect(v?.priv).toMatchObject({ tally: { made: 3, hit: 1, yes: 2, yesHit: 1 } });
    expect(parseRusRuletiView({ ...full, history: [{ seq: 1 }] }, { role: "alive" })).toBeNull();
    expect(parseRusRuletiView({ ...full, lastWord: { from: 1 } }, { role: "alive" })).toBeNull();
    expect(parseRusRuletiView({ ...full, handoff: { from: "b" } }, { role: "alive" })).toBeNull();
    expect(parseRusRuletiView({ ...full, noReturn: 4 }, { role: "alive" })).toBeNull();
    expect(
      parseRusRuletiView(full, {
        role: "out",
        turn: 1,
        prediction: null,
        lastResult: null,
        tally: { made: "1" },
      }),
    ).toBeNull();
    const { history: _h, noReturn: _n, lastWord: _l, handoff: _o, ...old } = pub;
    const bare = parseRusRuletiView(old, { role: "alive" });
    expect(bare?.pub).toMatchObject({ history: [], noReturn: null, lastWord: null, handoff: null });
  });

  it("yardımcılar", () => {
    expect(riskFraction(16)).toBeCloseTo(0.16);
    expect(riskFraction(-4)).toBe(0);
    expect(riskFraction(140)).toBe(1);
  });

  it("RR-U4: sıradaki risk ve tavan", () => {
    expect(nextRisk(36)).toBe(46);
    expect(nextRisk(76)).toBe(76);
    expect(riskLine(36)).toBe("Boş geçerse sıradaki: %46");
    expect(riskLine(76)).toBe("Risk tavanda: %76");
  });

  it("RR-U2: bitiş sayacı", () => {
    expect(outsLeft(8, 0)).toBe(4);
    expect(outsLeft(5, 1)).toBe(2);
    expect(outsLeft(2, 0)).toBe(1);
    expect(outsLeft(4, 3)).toBe(0);
    expect(outsText(2)).toBe("2 elenme daha → oyun biter");
    expect(outsText(1)).toBe("Son kurşun!");
  });

  it("RR-U3: atış satırı ve son 4", () => {
    const name = (id: string) => ({ a: "Mert", b: "Elif" })[id] ?? id;
    expect(shotLine({ ...shot, exploded: false }, name)).toBe("Mert → Elif · %26 · klik");
    expect(shotLine({ ...shot, auto: true }, name)).toBe("⏱ Mert → Elif · %26 · BAM");
    const many = [1, 2, 3, 4, 5].map((seq) => ({ ...shot, seq }));
    expect(recentShots(many).map((x) => x.seq)).toEqual([5, 4, 3, 2]);
  });

  it("RR-U8: elenme sırası, vuran ve risk", () => {
    const h = [
      { ...shot, seq: 1, shooter: "a", target: "a", exploded: false, risk: 16 },
      { ...shot, seq: 2, shooter: "a", target: "b", exploded: true, risk: 26 },
      { ...shot, seq: 3, shooter: "c", target: "c", exploded: true, risk: 16 },
    ];
    expect(outEntries(["b", "c"], h)).toEqual([
      { id: "b", order: 1, shooter: "a", risk: 26, self: false },
      { id: "c", order: 2, shooter: "c", risk: 16, self: true },
    ]);
  });

  it("RR-U1: masa yerleşimi: sen altta ortada; 2 kişide karşılıklı", () => {
    const two = seatPositions(["a", "b"], "b");
    expect(two[0]?.id).toBe("b");
    expect(two[0]?.x).toBeCloseTo(50);
    expect(two[0]?.y).toBeGreaterThan(80);
    expect(two[1]?.x).toBeCloseTo(50);
    expect(two[1]?.y).toBeLessThan(20);
    const eight = seatPositions(["a", "b", "c", "d", "e", "f", "g", "h"], "c");
    expect(eight.map((p) => p.id)).toEqual(["c", "d", "e", "f", "g", "h", "a", "b"]);
    for (const p of eight) {
      expect(p.x).toBeGreaterThan(5);
      expect(p.x).toBeLessThan(95);
    }
    expect(shortName("Abdurrahman")).toBe("Abdurrah…");
    expect(shortName("Elif")).toBe("Elif");
  });

  it("RR-M1: kilitli koltuk", () => {
    const p = { ...pub, noReturn: "a", holder: "c" };
    expect(seatTap(p, "a", "c")).toBe("return");
    expect(seatTap(p, "c", "c")).toBe("self");
    expect(seatTap(p, "b", "c")).toBe("dead");
    expect(seatTap(p, "d", "c")).toBe("ok");
  });

  it("Türkçe ekler ve BAM satırı (RR-U6, RR-U12)", () => {
    expect(genitive("Mert")).toBe("Mert'in");
    expect(genitive("Kaan")).toBe("Kaan'ın");
    expect(genitive("Ayşe")).toBe("Ayşe'nin");
    expect(accusative("Elif")).toBe("Elif'i");
    expect(accusative("Kaan")).toBe("Kaan'ı");
    expect(accusative("Ayşe")).toBe("Ayşe'yi");
    expect(dative("Mert")).toBe("Mert'e");
    expect(dative("Kaan")).toBe("Kaan'a");
    expect(dative("Defne")).toBe("Defne'ye");
    expect(locative("Mert")).toBe("Mert'te");
    expect(locative("Kaan")).toBe("Kaan'da");
    const name = (id: string) => ({ a: "Mert", b: "Elif", c: "Sen" })[id] ?? id;
    expect(bamLine({ ...shot }, name, "c")).toBe("Mert, Elif'i vurdu");
    expect(bamLine({ ...shot, target: "c" }, name, "c")).toBe("Seni Mert vurdu");
    expect(bamLine({ ...shot, shooter: "b" }, name, "c")).toBe("Elif kendine sıktı");
    expect(bamLine({ ...shot, shooter: "c" }, name, "c")).toBe("Elif'i vurdun");
  });

  it("RR-U13: karne", () => {
    expect(tallyLine({ made: 0, hit: 0, yes: 0, yesHit: 0 })).toBe("Henüz tahminin yok");
    expect(tallyLine({ made: 3, hit: 1, yes: 2, yesHit: 1 })).toBe(
      "Tahminlerin: 3 · bildiğin 1 · Evet: 2'de 1",
    );
    expect(tallyLine({ made: 3, hit: 3, yes: 0, yesHit: 0 })).toBe("Tahminlerin: 3 · bildiğin 3");
    expect(numLocative(3)).toBe("3'te");
    expect(numLocative(6)).toBe("6'da");
    expect(numLocative(10)).toBe("10'da");
    expect(numLocative(40)).toBe("40'ta");
  });
});
