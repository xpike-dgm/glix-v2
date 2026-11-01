import { describe, expect, it } from "vitest";
import {
  betUsed,
  bildiText,
  blastText,
  bombSpot,
  canBet,
  formatBonus,
  formatPeek,
  formatRemaining,
  fuseLine,
  genitive,
  handChip,
  journeyStats,
  lastLinks,
  locative,
  myBet,
  myResult,
  parseKorBombaPrivateView,
  parseKorBombaPublicView,
  parseKorBombaView,
  peekLevel,
  remainingMs,
  seatPositions,
  seatTap,
  shortName,
} from "./view.js";

const pub = {
  startedAt: 1000,
  holder: "a",
  passes: 2,
  lastPass: { seq: 2, from: "b", to: "a" },
  trail: ["c", "b", "a"],
  lockedUntil: 4_000,
  exploded: false,
  explodedAt: null,
  correctPredictors: [],
  journey: null,
};
const watcher = {
  role: "watcher",
  explodeAt: 99,
  lastBonusMs: null,
  bet: { turn: 2, holder: "a" },
  betUsed: true,
  lastResult: null,
};
const journey = {
  fuseMs: 17_300,
  bonusesMs: [2_100, 3_400, 800],
  totalMs: 23_600,
  hands: [
    { holder: "a", heldMs: 3_400 },
    { holder: "b", heldMs: 1_600 },
    { holder: "c", heldMs: 6_200 },
    { holder: "a", heldMs: 12_400 },
  ],
};

describe("Kör Bomba görünümü", () => {
  it("geçerli ortak görünümü ayrıştırır", () => {
    expect(parseKorBombaPublicView(pub)).toEqual(pub);
    expect(parseKorBombaPublicView({ ...pub, lastPass: null })?.lastPass).toBeNull();
    expect(parseKorBombaPublicView({ ...pub, exploded: true, explodedAt: 5, journey })?.journey).toEqual(
      journey,
    );
  });

  it("eksik zincir/kilit alanında güvenli varsayılan", () => {
    const { trail: _t, lockedUntil: _l, ...old } = pub;
    const v = parseKorBombaPublicView(old);
    expect(v?.trail).toEqual(["a"]);
    expect(v?.lockedUntil).toBe(1000);
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
      { ...pub, journey: { fuseMs: 1 } },
      { ...pub, journey: { ...journey, hands: [] } },
      { ...pub, journey: { ...journey, hands: [{ holder: "a" }] } },
      { ...pub, journey: { ...journey, bonusesMs: ["x"] } },
    ]) {
      expect(parseKorBombaPublicView(bad)).toBeNull();
    }
  });

  it("kişisel görünüm üç rolü tanır", () => {
    expect(parseKorBombaPrivateView({ role: "holder", betUsed: true, lastResult: null })).toEqual({
      role: "holder",
      betUsed: true,
      lastResult: null,
    });
    expect(parseKorBombaPrivateView({ role: "spectator" })).toEqual({ role: "spectator" });
    expect(parseKorBombaPrivateView({ role: "watcher", explodeAt: 9, lastBonusMs: null })).toEqual({
      role: "watcher",
      explodeAt: 9,
      lastBonusMs: null,
      bet: null,
      betUsed: false,
      lastResult: null,
    });
  });

  it("taşıyıcı görünümündeki fazladan süre alanını taşımaz", () => {
    const v = parseKorBombaPrivateView({ role: "holder", explodeAt: 99 });
    expect(v).toEqual({ role: "holder", betUsed: false, lastResult: null });
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
      { ...watcher, bet: { turn: "x", holder: "a" } },
      { role: "holder", lastResult: { turn: 1 } },
    ]) {
      expect(parseKorBombaPrivateView(bad)).toBeNull();
    }
  });

  it("kalan süre yalnız izleyen katılımcıda vardır ve negatif olmaz", () => {
    const w = parseKorBombaView(pub, { role: "watcher", explodeAt: 10_000, lastBonusMs: null });
    if (!w) throw new Error("geçerli olmalı");
    expect(remainingMs(w, 7_500)).toBe(2_500);
    expect(remainingMs(w, 12_000)).toBe(0);
    const holder = parseKorBombaView(pub, { role: "holder", lastResult: null });
    const spectator = parseKorBombaView(pub, { role: "spectator" });
    if (!holder || !spectator) throw new Error("geçerli olmalı");
    expect(remainingMs(holder, 0)).toBeNull();
    expect(remainingMs(spectator, 0)).toBeNull();
  });

  it("süre biçimi; BM-U7: son 1 sn'de iki ondalık", () => {
    expect(formatRemaining(12_345)).toBe("12,3");
    expect(formatRemaining(950)).toBe("0,9");
    expect(formatRemaining(-50)).toBe("0,0");
    expect(formatPeek(12_345)).toBe("12,3");
    expect(formatPeek(1_000)).toBe("1,0");
    expect(formatPeek(470)).toBe("0,47");
    expect(formatPeek(5)).toBe("0,00");
    expect(formatBonus(2_500)).toBe("+2,5");
    expect(formatBonus(800)).toBe("+0,8");
  });

  it("BM-U7: aciliyet yalnız bakarken; 5 sn kırmızı, 3 sn titreme", () => {
    expect(peekLevel(9_000)).toBe("calm");
    expect(peekLevel(4_999)).toBe("red");
    expect(peekLevel(2_999)).toBe("shake");
  });

  it("koltuklar: kendin altta, kenardan içeride (BM-U8)", () => {
    const seats = seatPositions(["a", "b", "c", "d"], "c");
    expect(seats.map((s) => s.id)).toEqual(["c", "d", "a", "b"]);
    expect(seats[0]?.x).toBeCloseTo(50);
    expect((seats[0]?.y ?? 0) > 80).toBe(true);
    for (const s of seatPositions(["a", "b", "c", "d", "e", "f", "g", "h"], "x")) {
      expect(s.x).toBeGreaterThan(8);
      expect(s.x).toBeLessThan(92);
      expect(s.y).toBeGreaterThan(14);
      expect(s.y).toBeLessThan(86);
    }
  });

  it("BM-U8: 8 kişide bomba merkeze daha yakın", () => {
    const seat = { id: "a", x: 50, y: 84 };
    expect(bombSpot(seat, 4).y).toBeCloseTo(50 + 34 * 0.36);
    expect(bombSpot(seat, 8).y).toBeLessThan(bombSpot(seat, 4).y);
  });

  it("BM-U8: uzun ad 8 harfte kesilir", () => {
    expect(shortName("Cihad")).toBe("Cihad");
    expect(shortName("Muhammedali")).toBe("Muhammed…");
    expect(shortName("Çağlayanİş")).toBe("Çağlayan…");
  });

  it("BM-U2: koltuk durumları (kopuk, geri pas, kilit)", () => {
    const all = ["a", "b", "c", "d"];
    expect(seatTap(pub, "c", all, 5_000)).toBe("ok");
    expect(seatTap(pub, "b", all, 5_000)).toBe("return");
    expect(seatTap(pub, "d", ["a", "b", "c"], 5_000)).toBe("offline");
    expect(seatTap(pub, "c", all, 3_999)).toBe("locked");
    // atan dışında bağlı kimse yoksa geri pas serbest
    expect(seatTap(pub, "b", ["a", "b"], 5_000)).toBe("ok");
  });

  it("Türkçe ekler", () => {
    expect(locative("Mert")).toBe("Mert'te");
    expect(locative("Elif")).toBe("Elif'te");
    expect(locative("Kaan")).toBe("Kaan'da");
    expect(locative("Ayşe")).toBe("Ayşe'de");
    expect(locative("Burak")).toBe("Burak'ta");
    expect(genitive("Mert")).toBe("Mert'in");
    expect(genitive("Kaan")).toBe("Kaan'ın");
    expect(genitive("Ayşe")).toBe("Ayşe'nin");
    expect(genitive("Onur")).toBe("Onur'un");
    expect(genitive("Gül")).toBe("Gül'ün");
    expect(genitive("Defne")).toBe("Defne'nin");
  });

  it("BM-U3: el çipi ve son 4 halka", () => {
    expect(handChip(3, "Mert")).toBe("4. el · Mert'te");
    expect(handChip(0, "Cihad", true)).toBe("1. el · Sende");
    expect(lastLinks(["a", "b", "c", "d", "e"])).toEqual(["b", "c", "d", "e"]);
  });

  it("BM-U5: bütün adlar; 5+ kişide sayı; patlama damgası", () => {
    expect(bildiText([])).toBe("");
    expect(bildiText(["Sen"])).toBe("Sen bildin!");
    expect(bildiText(["Elif"])).toBe("Elif bildi!");
    expect(bildiText(["Mert", "Sen"])).toBe("Mert ve Sen bildi!");
    expect(bildiText(["Elif", "Mert", "Kaan"])).toBe("Elif, Mert ve Kaan bildi!");
    expect(bildiText(["a", "b", "c", "d", "e"])).toBe("5 kişi bildi!");
    expect(blastText("Elif", false)).toBe("ELİF'TE PATLADI! −1");
    expect(blastText("Elif", true)).toBe("BOMBA SENDE PATLADI · −1");
  });

  it("BM-U6: fitil hesabı ve yolculuk istatistikleri", () => {
    expect(fuseLine(journey)).toBe("Fitil 17,3 sn başladı · paslar +2,1 +3,4 +0,8 · toplam 23,6 sn");
    expect(
      fuseLine({ fuseMs: 17_300, bonusesMs: [], totalMs: 17_300, hands: [{ holder: "a", heldMs: 1 }] }),
    ).toBe("Fitil 17,3 sn başladı · pas yok · toplam 17,3 sn");
    const st = journeyStats(journey);
    expect(st.longest).toEqual({ holder: "a", heldMs: 12_400 });
    // en hızlı kurtulan: patlayan el sayılmaz
    expect(st.fastest).toEqual({ holder: "b", heldMs: 1_600 });
    expect(journeyStats({ ...journey, hands: [{ holder: "a", heldMs: 9 }] }).fastest).toBeNull();
  });
});

describe("Kör Bomba bahis görünümü (BM-M3 / BM-U4)", () => {
  it("duran bahis ve sonucu", () => {
    const v = parseKorBombaView(pub, watcher);
    if (!v) throw new Error("görünüm");
    expect(myBet(v)).toEqual({ turn: 2, holder: "a" });
    expect(betUsed(v)).toBe(true);
    expect(myResult(v)).toBeNull();
    const old = parseKorBombaView({ ...pub, passes: 3 }, watcher);
    expect(old && myBet(old)).toBeNull();
  });

  it("düğme yalnız taşımayan ve hakkını kullanmamış katılımcıya; süreden bağımsız", () => {
    const fresh = parseKorBombaView(pub, { ...watcher, bet: null, betUsed: false });
    if (!fresh) throw new Error("görünüm");
    expect(canBet(fresh, "b", false)).toBe(true);
    expect(canBet(fresh, "a", false)).toBe(false);
    expect(canBet(fresh, "b", true)).toBe(false);
    expect(canBet({ ...fresh, pub: { ...fresh.pub, exploded: true } }, "b", false)).toBe(false);
    const used = parseKorBombaView(pub, watcher);
    expect(used && canBet(used, "b", false)).toBe(false);
    const h = parseKorBombaView(pub, { role: "holder", lastResult: null });
    expect(h && canBet(h, "b", false)).toBe(false);
    // Süre değişse de karar aynı (alan yalnız rol ve hakka bakar).
    const late = parseKorBombaView(pub, { ...watcher, bet: null, betUsed: false, explodeAt: 1 });
    expect(late && canBet(late, "b", false)).toBe(true);
  });
});
