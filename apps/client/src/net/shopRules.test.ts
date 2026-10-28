import { COSMETIC_ITEMS, dailyDeals, itemsOfType, nextIstanbulMidnight } from "@glix/engine";
import { describe, expect, it } from "vitest";
import {
  buyText,
  dealViews,
  formatCountdown,
  itemStatus,
  ownedOfType,
  parseShopState,
  priceNow,
  type ShopState,
  shopErrorText,
  shortfall,
  shortfallText,
} from "./shopRules.js";

const NOW = Date.UTC(2026, 9, 28, 9, 0, 0);
const good = {
  ok: true,
  balance: 120,
  owned: ["unvan-sansli", "cerceve-cift"],
  equipped: { unvan: "unvan-sansli" },
  deals: [],
  dealEndsAt: nextIstanbulMidnight(NOW),
  serverNow: NOW + 5000,
};

describe("mağaza yanıtı doğrulama", () => {
  it("geçerli yanıt kabul edilir, saat farkı hesaplanır", () => {
    const s = parseShopState(good, NOW);
    expect(s).toEqual({
      balance: 120,
      owned: ["unvan-sansli", "cerceve-cift"],
      equipped: { unvan: "unvan-sansli" },
      clockOffset: 5000,
    });
  });

  it("bilinmeyen kimlik, yanlış türdeki kuşanma ve tekrarlar atılır", () => {
    const s = parseShopState(
      {
        ...good,
        owned: ["unvan-sansli", "unvan-sansli", "yok-boyle", 4, "cerceve-cift"],
        equipped: { unvan: "cerceve-cift", cerceve: "cerceve-cift", "ad-efekti": "yok" },
      },
      NOW,
    );
    expect(s?.owned).toEqual(["unvan-sansli", "cerceve-cift"]);
    expect(s?.equipped).toEqual({ cerceve: "cerceve-cift" });
  });

  it("bozuk yanıt reddedilir", () => {
    for (const bad of [
      null,
      "x",
      { ...good, ok: false },
      { ...good, balance: -1 },
      { ...good, balance: 1.5 },
      { ...good, serverNow: "x" },
      { ...good, owned: "x" },
      { ...good, equipped: [] },
    ])
      expect(parseShopState(bad, NOW)).toBeNull();
  });
});

describe("mağaza yardımcıları", () => {
  const state = (over: Partial<ShopState> = {}): ShopState => ({
    balance: 100,
    owned: ["unvan-sansli"],
    equipped: { unvan: "unvan-sansli" },
    clockOffset: 0,
    ...over,
  });
  const item = (id: string) => {
    const it = COSMETIC_ITEMS.find((i) => i.id === id);
    if (!it) throw new Error(id);
    return it;
  };

  it("durum: kuşanıldı / sahip / satın al", () => {
    expect(itemStatus(state(), item("unvan-sansli"))).toBe("equipped");
    expect(itemStatus(state({ equipped: {} }), item("unvan-sansli"))).toBe("owned");
    expect(itemStatus(state(), item("unvan-efsane"))).toBe("buy");
  });

  it("fırsat sunucu saatiyle sunucunun hesabıyla aynıdır", () => {
    const views = dealViews(state({ clockOffset: 0 }), NOW);
    expect(views.map((v) => v.item.id)).toEqual(dailyDeals(NOW).map((d) => d.itemId));
    const first = views[0];
    if (!first) throw new Error("fırsat");
    expect(priceNow(state(), first.item.id, NOW)).toBe(first.price);
    // Yerel saat bir gün geri, sunucu saati doğru: fırsat sunucuya göre.
    const skew = state({ clockOffset: 24 * 3600 * 1000 });
    expect(dealViews(skew, NOW - 24 * 3600 * 1000).map((v) => v.item.id)).toEqual(
      views.map((v) => v.item.id),
    );
  });

  it("geri sayım biçimi", () => {
    expect(formatCountdown(5 * 3600_000 + 12 * 60_000 + 33_000)).toBe("05:12:33");
    expect(formatCountdown(0)).toBe("00:00:00");
    expect(formatCountdown(-5)).toBe("00:00:00");
    expect(formatCountdown(1)).toBe("00:00:01");
    expect(formatCountdown(24 * 3600_000)).toBe("24:00:00");
  });

  it("eksik tutar ve metinler", () => {
    expect(shortfall(100, 150)).toBe(50);
    expect(shortfall(200, 150)).toBe(0);
    expect(shortfallText(50)).toBe("50 Glix daha gerekli");
    expect(buyText(105)).toBe("105 Glix'e satın al");
  });

  it("hata kodları Türkçe, teknik kod sızmaz", () => {
    for (const c of [
      "unknown_item",
      "already_owned",
      "insufficient_glix",
      "rate_limited",
      "network",
      "x",
      null,
    ])
      expect(shopErrorText(c)).toMatch(/[ğüşıöçĞÜŞİÖÇ.]/);
    expect(shopErrorText("insufficient_glix")).not.toMatch(/_/);
  });

  it("dolap: yalnız sahip olunanlar", () => {
    const owned = ownedOfType(
      state({ owned: ["unvan-sansli", "unvan-efsane", "cerceve-cift"] }),
      "unvan",
      COSMETIC_ITEMS,
    );
    expect(owned.map((i) => i.id)).toEqual(["unvan-sansli", "unvan-efsane"]);
    expect(itemsOfType("cerceve")).toHaveLength(5);
  });
});
