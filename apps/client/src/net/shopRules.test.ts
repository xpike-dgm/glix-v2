import {
  COSMETIC_ITEMS,
  type CosmeticItem,
  cosmeticItem,
  dailyDeals,
  itemsOfType,
  nextIstanbulMidnight,
} from "@glix/engine";
import { describe, expect, it } from "vitest";
import {
  buyText,
  dealViews,
  equippedColour,
  equippedId,
  formatCountdown,
  itemStatus,
  ownedOfType,
  ownedPacks,
  parseShopState,
  priceNow,
  SHOP_TABS,
  SHOP_TYPES,
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

describe("kürsü karakteri ürünleri (dans, şapka, üst)", () => {
  it("mağaza yanıtında yeni türler kuşanılabilir; yanlış yuvadaki ürün atılır", () => {
    const s = parseShopState(
      {
        ...good,
        owned: ["dans-twist", "sapka-neon-kep", "ust-neon-bomber"],
        equipped: { dans: "dans-twist", sapka: "sapka-neon-kep", ust: "sapka-neon-kep" },
      },
      NOW,
    );
    expect(s?.owned).toEqual(["dans-twist", "sapka-neon-kep", "ust-neon-bomber"]);
    expect(s?.equipped).toEqual({ dans: "dans-twist", sapka: "sapka-neon-kep" });
  });

  it("sekmeler: giysi yuvaları tek 'Giysiler' sekmesinde; dans kendi sekmesinde", () => {
    expect(SHOP_TABS.map((t) => t.label)).toEqual([
      "Çerçeveler",
      "Lakaplar",
      "Ad efektleri",
      "Danslar",
      "Giysiler",
      "Kart arkası",
      "Zafer",
      "Tepki",
      "Giriş",
    ]);
    // İki bölüm: Görünüş (5 sekme) ve Efektler (4 sekme); her sekme tek bölümde.
    expect(SHOP_TABS.filter((t) => t.section === "gorunus")).toHaveLength(5);
    expect(SHOP_TABS.filter((t) => t.section === "efekt").map((t) => t.id)).toEqual([
      "kart-arkasi",
      "zafer",
      "tepki",
      "giris",
    ]);
    const giysi = SHOP_TABS.find((t) => t.id === "giysi");
    expect(giysi?.types).toEqual(["sapka", "ust", "alt", "ayakkabi"]);
    expect(SHOP_TABS.find((t) => t.id === "dans")?.types).toEqual(["dans"]);
  });

  it("dolap bölümleri: her giysi yuvası ayrı, dans 'Sevinç' ile başlar, giysiler 'Yok' ile", () => {
    expect(SHOP_TYPES.map((t) => t.name)).toEqual([
      "Çerçeve",
      "Lakap",
      "Ad efekti",
      "Dans",
      "Şapka",
      "Üst",
      "Alt",
      "Ayakkabı",
      "Kart arkası",
      "Zafer kutlaması",
      "Giriş efekti",
      "Tepki paketi",
    ]);
    expect(SHOP_TYPES.find((t) => t.id === "kart-arkasi")?.none).toBe("Klasik");
    expect(SHOP_TYPES.find((t) => t.id === "dans")?.none).toBe("Sevinç");
    expect(SHOP_TYPES.find((t) => t.id === "sapka")?.none).toBe("Yok");
  });

  it("dolap: yalnız sahip olunan danslar", () => {
    const st: ShopState = {
      balance: 0,
      owned: ["dans-twist", "dans-lambada", "sapka-neon-kep"],
      equipped: {},
      clockOffset: 0,
    };
    const owned = ownedOfType(st, "dans", COSMETIC_ITEMS);
    expect(owned.map((i) => i.id)).toEqual(["dans-twist", "dans-lambada"]);
  });
});

describe("giysi renkleri ve boş yuvalar", () => {
  it("kuşanılan renkli değer kabul edilir, bilinmeyen renk atılır", () => {
    const s = parseShopState(
      {
        ...good,
        owned: ["sapka-tac", "ust-neon-bomber"],
        equipped: { sapka: "sapka-tac~mor", ust: "ust-neon-bomber~turuncu", cerceve: "cerceve-cift~pembe" },
      },
      NOW,
    );
    expect(s?.equipped).toEqual({ sapka: "sapka-tac~mor" });
    if (!s) throw new Error("durum");
    expect(equippedId(s, "sapka")).toBe("sapka-tac");
    expect(equippedColour(s, "sapka")).toBe("mor");
    expect(equippedColour(s, "ust")).toBe("camgobegi");
    expect(itemStatus(s, cosmeticItem("sapka-tac") as CosmeticItem)).toBe("equipped");
    expect(itemStatus(s, cosmeticItem("sapka-bere") as CosmeticItem)).toBe("buy");
  });

  it("katalogda ürünü olmayan giysi yuvası mağaza sekmesinde ve dolapta gösterilmez", () => {
    expect(SHOP_TYPES.map((t) => t.id)).toContain("alt");
    expect(SHOP_TYPES.map((t) => t.id)).not.toContain("kostum");
    for (const t of SHOP_TABS.find((x) => x.id === "giysi")?.types ?? [])
      expect(itemsOfType(t).length).toBeGreaterThan(0);
  });
});

describe("resimli türler (M3)", () => {
  const withOwned = (owned: string[], equipped: Record<string, string> = {}) =>
    parseShopState({ ...good, owned, equipped }, NOW);

  it("her türün sekmesi var: katalogdaki her ürün bir mağaza sekmesinde görünür", () => {
    const shown = new Set(SHOP_TABS.flatMap((t) => t.types));
    for (const it of COSMETIC_ITEMS) expect(shown.has(it.type), it.id).toBe(true);
  });

  it("yeni türlerin ürünleri doğrulanır: kart arkası kuşanılır, tepki paketi kuşanılmış sayılmaz", () => {
    const s = withOwned(["kart-elektrik", "zafer-balon", "tepki-parti", "giris-duman"], {
      "kart-arkasi": "kart-elektrik",
      giris: "giris-duman",
      tepki: "tepki-parti",
      zafer: "kart-elektrik",
    });
    expect(s?.equipped).toEqual({ "kart-arkasi": "kart-elektrik", giris: "giris-duman" });
    const parti = itemsOfType("tepki")[1];
    if (!parti || !s) throw new Error("hazırlık");
    expect(itemStatus(s, parti)).toBe("owned");
  });

  it("sahip olunan paketler katalog sırasıyla; hiçbiri yoksa ya da mağaza yoksa boş", () => {
    expect(ownedPacks(null)).toEqual([]);
    expect(ownedPacks(withOwned(["unvan-sansli"]))).toEqual([]);
    const s = withOwned(["tepki-efsane", "tepki-neon-yuzler", "giris-duman"]);
    expect(ownedPacks(s).map((p) => p.id)).toEqual(["tepki-neon-yuzler", "tepki-efsane"]);
  });
});

describe("Glix tutarları binlik ayırıcıyla yazılır", () => {
  it("1.250 biçimi ve ek uyumu", () => {
    expect(buyText(1250)).toBe("1.250 Glix'e satın al");
    expect(shortfallText(2400)).toBe("2.400 Glix daha gerekli");
    expect(buyText(150)).toBe("150 Glix'e satın al");
  });
});
