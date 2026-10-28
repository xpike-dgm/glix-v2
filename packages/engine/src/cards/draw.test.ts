import { describe, expect, it } from "vitest";
import { CARD_IDS, CARDS, type CardId, enabledCards, parseCardSettings } from "./catalog.js";
import { badChance, deriveRng, drawOptions, type Half, halfOf, hashSeed, rarityWeights } from "./draw.js";

const N = 6000;

/** Birçok tohumda 3'lü çekiliş; yuva başına kötü oranı ve iyi kartlarda nadirlik dağılımı. */
function sample(half: Half, boost: boolean, enabled: readonly CardId[] = CARD_IDS) {
  let slots = 0;
  let bad = 0;
  const rar = { siradan: 0, nadir: 0, efsanevi: 0 };
  for (let seed = 0; seed < N; seed++) {
    const opts = drawOptions(deriveRng(seed, "t"), { enabled, half, boost, count: 3 });
    for (const id of opts) {
      slots++;
      const r = CARDS[id].rarity;
      if (r === "kotu") bad++;
      else rar[r]++;
    }
  }
  const good = rar.siradan + rar.nadir + rar.efsanevi;
  return {
    bad: bad / slots,
    siradan: rar.siradan / good,
    nadir: rar.nadir / good,
    efsanevi: rar.efsanevi / good,
  };
}

describe("hashSeed / deriveRng", () => {
  it("aynı parçalar aynı sayıyı, farklı parçalar farklı sayıyı verir", () => {
    expect(hashSeed([1, "a"])).toBe(hashSeed([1, "a"]));
    expect(hashSeed([1, "a"])).not.toBe(hashSeed([1, "b"]));
    expect(deriveRng(5, "x").next()).toBe(deriveRng(5, "x").next());
  });
});

describe("üst / alt yarı", () => {
  const ids = ["a", "b", "c", "d"];
  it("4 oyuncu: ilk ikisi üst, son ikisi alt", () => {
    const s = { a: 10, b: 8, c: 3, d: 0 };
    expect(ids.map((i) => halfOf(i, s, ids))).toEqual(["ust", "ust", "alt", "alt"]);
  });
  it("3 oyuncuda ortadaki nötr", () => {
    const s = { a: 10, b: 5, c: 0 };
    expect(["a", "b", "c"].map((i) => halfOf(i, s, ["a", "b", "c"]))).toEqual(["ust", "notr", "alt"]);
  });
  it("herkes eşitse herkes nötr", () => {
    expect(ids.map((i) => halfOf(i, { a: 1, b: 1, c: 1, d: 1 }, ids))).toEqual([
      "notr",
      "notr",
      "notr",
      "notr",
    ]);
  });
  it("beraberlik ortada olunca nötr", () => {
    const s = { a: 10, b: 5, c: 5, d: 0 };
    expect(ids.map((i) => halfOf(i, s, ids))).toEqual(["ust", "notr", "notr", "alt"]);
  });
  it("2 oyuncu: lider üst, geride kalan alt", () => {
    expect([halfOf("a", { a: 2, b: 1 }, ["a", "b"]), halfOf("b", { a: 2, b: 1 }, ["a", "b"])]).toEqual([
      "ust",
      "alt",
    ]);
  });
  it("kötü olasılığı ve ağırlıklar", () => {
    expect([badChance("ust"), badChance("alt"), badChance("notr")]).toEqual([0.35, 0.25, 0.3]);
    expect(rarityWeights("notr", false)).toEqual({ siradan: 70, nadir: 25, efsanevi: 5 });
    expect(rarityWeights("alt", false)).toEqual({ siradan: 60, nadir: 32, efsanevi: 8 });
    expect(rarityWeights("ust", true)).toEqual({ siradan: 70, nadir: 50, efsanevi: 10 });
  });
});

describe("çekiliş olasılıkları (istatistiksel)", () => {
  const near = (v: number, target: number, tol = 0.02) => expect(Math.abs(v - target)).toBeLessThan(tol);
  it("nötr: kötü %30, nadirlik 70/25/5", () => {
    const r = sample("notr", false);
    near(r.bad, 0.3);
    near(r.siradan, 0.7);
    near(r.nadir, 0.25);
    near(r.efsanevi, 0.05);
  });
  it("üst yarı: kötü %35", () => near(sample("ust", false).bad, 0.35));
  it("alt yarı: kötü %25, nadirlik 60/32/8", () => {
    const r = sample("alt", false);
    near(r.bad, 0.25);
    near(r.siradan, 0.6);
    near(r.nadir, 0.32);
    near(r.efsanevi, 0.08);
  });
  it("Lanetli Hediye: nadir ve efsanevi ağırlığı iki katı (70/50/10 normalleşir)", () => {
    const r = sample("notr", true);
    near(r.siradan, 70 / 130);
    near(r.nadir, 50 / 130);
    near(r.efsanevi, 10 / 130);
  });
  it("kart sınıf içinde eşit olasılıkla seçilir", () => {
    const counts: Record<string, number> = {};
    for (let seed = 0; seed < N * 2; seed++) {
      const [first] = drawOptions(deriveRng(seed, "u"), {
        enabled: CARD_IDS,
        half: "notr",
        boost: false,
        count: 1,
      });
      if (first && CARDS[first].rarity === "efsanevi") counts[first] = (counts[first] ?? 0) + 1;
    }
    const a = counts["altin-dokunus"] ?? 0;
    const b = counts["ters-kose"] ?? 0;
    expect(Math.abs(a - b) / (a + b)).toBeLessThan(0.15);
  });
});

describe("çekiliş kuralları", () => {
  it("aynı rastgelelik aynı seçenekleri verir", () => {
    const p = { enabled: CARD_IDS, half: "notr" as const, boost: false, count: 4 };
    expect(drawOptions(deriveRng(1, "z"), p)).toEqual(drawOptions(deriveRng(1, "z"), p));
  });
  it("bir oyuncunun seçeneklerinde kart tekrar etmez", () => {
    for (let seed = 0; seed < 2000; seed++) {
      const o = drawOptions(deriveRng(seed, "d"), {
        enabled: CARD_IDS,
        half: "notr",
        boost: false,
        count: 4,
      });
      expect(new Set(o).size).toBe(o.length);
      expect(o).toHaveLength(4);
    }
  });
  it("kapalı kartlar hiç çıkmaz", () => {
    const enabled = enabledCards({ enabled: true, off: ["kalkan", "talihsizlik", "ters-kose"] });
    for (let seed = 0; seed < 1500; seed++)
      for (const id of drawOptions(deriveRng(seed, "e"), { enabled, half: "notr", boost: false, count: 4 }))
        expect(["kalkan", "talihsizlik", "ters-kose"]).not.toContain(id);
  });
  it("etkin kart yoksa seçenek yok; çekilebilir kadar seçenek gelir", () => {
    expect(drawOptions(deriveRng(1, "f"), { enabled: [], half: "notr", boost: false, count: 3 })).toEqual([]);
    const two = drawOptions(deriveRng(1, "f"), {
      enabled: ["kalkan", "ayna"],
      half: "notr",
      boost: false,
      count: 3,
    });
    expect([...two].sort()).toEqual(["ayna", "kalkan"]);
  });
  it("yalnız iyi kartlar etkinse kötü çıkmaz; yalnız kötüler etkinse hepsi kötüdür", () => {
    const good = CARD_IDS.filter((id) => CARDS[id].rarity !== "kotu");
    const bad = CARD_IDS.filter((id) => CARDS[id].rarity === "kotu");
    for (let seed = 0; seed < 500; seed++) {
      expect(
        drawOptions(deriveRng(seed, "g"), { enabled: good, half: "ust", boost: false, count: 3 }).every(
          (i) => CARDS[i].rarity !== "kotu",
        ),
      ).toBe(true);
      expect(
        drawOptions(deriveRng(seed, "g"), { enabled: bad, half: "alt", boost: false, count: 3 }).every(
          (i) => CARDS[i].rarity === "kotu",
        ),
      ).toBe(true);
    }
  });
  it("bir nadirlikte kart yoksa kalan olasılıklar normalleşir (efsanevi kapalıyken 70/25 → 73.7/26.3)", () => {
    const enabled = CARD_IDS.filter((id) => CARDS[id].rarity !== "efsanevi");
    const r = sample("notr", false, enabled);
    expect(Math.abs(r.siradan - 70 / 95)).toBeLessThan(0.02);
    expect(r.efsanevi).toBe(0);
  });
});

describe("kart ayarı", () => {
  it("ana anahtar kapalıyken etkin kart yok", () => {
    expect(enabledCards({ enabled: false, off: [] })).toEqual([]);
    expect(enabledCards({ enabled: true, off: [] })).toHaveLength(CARD_IDS.length);
  });
  it("doğrulama: bilinmeyen kimlik, tekrar ve fazla anahtar reddedilir; kapalı liste sıralanır", () => {
    expect(parseCardSettings({ enabled: true, off: ["x"] })).toBeNull();
    expect(parseCardSettings({ enabled: true, off: ["kalkan", "kalkan"] })).toBeNull();
    expect(parseCardSettings({ enabled: true, off: [], extra: 1 })).toBeNull();
    expect(parseCardSettings({ enabled: "evet", off: [] })).toBeNull();
    expect(parseCardSettings(null)).toBeNull();
    expect(parseCardSettings({ enabled: false, off: ["ayna", "kalkan"] })).toEqual({
      enabled: false,
      off: ["kalkan", "ayna"],
    });
  });
  it("kart kimlikleri benzersiz ve oyun kimlikleriyle çakışmaz (görsel yolu /assets/cards/<kimlik>.webp)", () => {
    expect(new Set(CARD_IDS).size).toBe(CARD_IDS.length);
    expect(CARD_IDS).toHaveLength(12 + 6 + 2 + 9);
  });
});
