import { describe, expect, it } from "vitest";
import {
  COSMETIC_ITEMS,
  COSMETIC_PRICES,
  COSMETIC_TYPES,
  cosmeticsFromEquipped,
  currentPrice,
  dailyDeals,
  dealPrice,
  istanbulDayNumber,
  nextIstanbulMidnight,
  parseCosmetics,
} from "./cosmetics.js";

const DAY = 24 * 3600 * 1000;
const at = (iso: string) => Date.parse(iso);

describe("kozmetik kataloğu", () => {
  it("kimlikler benzersiz kebab-case, fiyat nadirlikten gelir, her türün ürünü var", () => {
    const ids = COSMETIC_ITEMS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const i of COSMETIC_ITEMS) {
      expect(i.id).toMatch(/^[a-z]+(-[a-z]+)+$/);
      expect(i.price).toBe(COSMETIC_PRICES[i.rarity]);
      expect(i.name.length).toBeGreaterThan(0);
    }
    for (const t of COSMETIC_TYPES) expect(COSMETIC_ITEMS.some((i) => i.type === t.id)).toBe(true);
    expect(COSMETIC_ITEMS).toHaveLength(17);
  });

  it("parseCosmetics: bilinmeyen ya da yanlış türdeki kimlik atılır", () => {
    expect(parseCosmetics({ title: "unvan-efsane", nameFx: "ad-neon-mavi", frame: "cerceve-cift" })).toEqual({
      title: "unvan-efsane",
      nameFx: "ad-neon-mavi",
      frame: "cerceve-cift",
    });
    expect(parseCosmetics({ title: "yok-boyle", nameFx: "unvan-efsane", frame: 3 })).toBeUndefined();
    expect(parseCosmetics({ title: "unvan-sansli", frame: "x" })).toEqual({ title: "unvan-sansli" });
    expect(parseCosmetics(null)).toBeUndefined();
    expect(parseCosmetics([])).toBeUndefined();
    expect(parseCosmetics("unvan-efsane")).toBeUndefined();
  });

  it("cosmeticsFromEquipped: tür başına kuşanılan alanlara çevrilir", () => {
    expect(cosmeticsFromEquipped({ unvan: "unvan-sansli", cerceve: "cerceve-cift" })).toEqual({
      title: "unvan-sansli",
      frame: "cerceve-cift",
    });
    expect(cosmeticsFromEquipped({})).toBeUndefined();
    expect(cosmeticsFromEquipped({ unvan: "cerceve-cift" })).toBeUndefined();
  });
});

describe("günün fırsatı", () => {
  it("aynı İstanbul gününde hep aynı, iki farklı ücretli ürün", () => {
    const a = dailyDeals(at("2026-10-28T00:00:00+03:00"));
    const b = dailyDeals(at("2026-10-28T23:59:59+03:00"));
    expect(a).toEqual(b);
    expect(a).toHaveLength(2);
    expect(a[0]?.itemId).not.toBe(a[1]?.itemId);
    for (const d of a) {
      const it = COSMETIC_ITEMS.find((i) => i.id === d.itemId);
      expect(it).toBeDefined();
      expect(d.listPrice).toBe(it?.price);
      expect(d.price).toBeLessThan(d.listPrice);
    }
  });

  it("gün sınırı İstanbul gece yarısıdır (21:00 UTC)", () => {
    const before = at("2026-10-28T20:59:59Z");
    const after = at("2026-10-28T21:00:00Z");
    expect(istanbulDayNumber(after)).toBe(istanbulDayNumber(before) + 1);
    expect(nextIstanbulMidnight(before)).toBe(after);
    expect(nextIstanbulMidnight(after)).toBe(after + DAY);
    expect(dailyDeals(before)).toEqual(dailyDeals(at("2026-10-28T00:00:00+03:00")));
    expect(dailyDeals(after)).toEqual(dailyDeals(at("2026-10-29T12:00:00+03:00")));
  });

  it("günler arasında fırsat değişir (60 günde birden çok farklı çift)", () => {
    const start = at("2026-11-01T12:00:00Z");
    const pairs = new Set<string>();
    for (let d = 0; d < 60; d++)
      pairs.add(
        dailyDeals(start + d * DAY)
          .map((x) => x.itemId)
          .join("+"),
      );
    expect(pairs.size).toBeGreaterThan(30);
  });

  it("indirimli fiyat %70, en yakın 5'e yuvarlanır", () => {
    expect([150, 400, 1000].map(dealPrice)).toEqual([105, 280, 700]);
    expect(dealPrice(155)).toBe(110); // 108,5 -> 110
    expect(dealPrice(151)).toBe(105); // 105,7 -> 105
    expect(dealPrice(10)).toBe(5); // 7 -> 5
    for (const d of dailyDeals(Date.now())) expect(d.price % 5).toBe(0);
  });

  it("currentPrice: fırsattaki indirimli, diğeri liste fiyatı, bilinmeyen null", () => {
    const now = at("2026-10-28T12:00:00Z");
    const deals = dailyDeals(now);
    const first = deals[0];
    if (!first) throw new Error("fırsat yok");
    expect(currentPrice(first.itemId, now)).toBe(first.price);
    const other = COSMETIC_ITEMS.find((i) => !deals.some((d) => d.itemId === i.id));
    expect(currentPrice(other?.id ?? "", now)).toBe(other?.price);
    expect(currentPrice("yok", now)).toBeNull();
  });
});
