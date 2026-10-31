import { describe, expect, it } from "vitest";
import {
  COSMETIC_ITEMS,
  COSMETIC_TYPES,
  type CosmeticItem,
  cosmeticItem,
  currentPrice,
  dailyDeals,
  dealPrice,
  isOnSale,
  itemsOfType,
  LEGACY_DEAL_POOL,
  releaseAt,
  setPreviewItems,
  shopCollections,
  shopItemsOfType,
} from "./cosmetics.js";
import RAW_JSON from "./katalog/magaza.json" with { type: "json" };
import OLD_JSON from "./katalog/onceki-katalog.json" with { type: "json" };
import {
  isCatalogDate,
  loadShopCatalog,
  SHOP_PRICE_RANGES,
  validateShopCatalog,
  validateShopItem,
} from "./shopCatalog.js";

const RAW = RAW_JSON as unknown as { surum: number; urunler: Record<string, unknown>[] };
/** MG-1 öncesi koddaki kataloğun anlık görüntüsü (cosmetics.ts'ten alındı). */
const OLD = OLD_JSON as unknown as {
  urunler: Record<string, unknown>[];
  turler: unknown[];
  firsatlar: (string | number)[][];
};
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const row = (id: string): Record<string, unknown> => clone(RAW.urunler.find((r) => r.id === id) ?? {});
const OLD_FIELDS = ["id", "type", "rarity", "price", "name", "description", "asset", "covers"] as const;

describe("mağaza kataloğu dosyası (MG-1)", () => {
  it("dosyaya taşınan katalog eski kod listesiyle birebir aynı: kimlik, sıra ve oyuncuya görünen her alan", () => {
    const now = COSMETIC_ITEMS.map((i) => {
      const o: Record<string, unknown> = {};
      for (const k of OLD_FIELDS) if (i[k] !== undefined) o[k] = i[k];
      return o;
    });
    expect(now).toEqual(OLD.urunler);
    expect(clone(COSMETIC_TYPES)).toEqual(OLD.turler);
    // Bugünkü ürünlerin hepsi satışta ve çıkış tarihi yok: mağazada aynı ürünler görünür.
    for (const i of COSMETIC_ITEMS) {
      expect(i.satista, i.id).toBe(true);
      expect(i.cikis).toBeUndefined();
    }
  });

  it("günün fırsatı eski kodla aynı (120 gün, geçiş tarihinin iki yanı)", () => {
    for (const [ms, ...rest] of OLD.firsatlar) {
      const want = [];
      for (let k = 0; k < rest.length; k += 3)
        want.push({ itemId: rest[k], price: rest[k + 1], listPrice: rest[k + 2] });
      expect(dailyDeals(Number(ms)), String(ms)).toEqual(want);
    }
  });

  it("katalog dosyası doğrulayıcıdan geçer; her fiyat nadirliğin aralığında", () => {
    expect(validateShopCatalog(RAW)).toEqual({ ok: true, errors: [] });
    for (const i of COSMETIC_ITEMS) {
      const [lo, hi] = SHOP_PRICE_RANGES[i.rarity];
      expect(i.price).toBeGreaterThanOrEqual(lo);
      expect(i.price).toBeLessThanOrEqual(hi);
    }
    expect(SHOP_PRICE_RANGES).toEqual({ siradan: [100, 250], nadir: [300, 600], efsanevi: [800, 1500] });
    for (const id of LEGACY_DEAL_POOL) expect(cosmeticItem(id)).toBeDefined();
  });

  it("hatalı satır kataloğu düşürür (yükleme fırlatır, hata satırı ve kimliği söyler)", () => {
    const bad = clone(RAW);
    (bad.urunler[3] as Record<string, unknown>).price = 99;
    const check = validateShopCatalog(bad);
    expect(check.ok).toBe(false);
    expect(check.errors[0]).toContain("urunler[3] (unvan-taktikci): price");
    expect(() => loadShopCatalog(bad)).toThrow(/unvan-taktikci/);
    expect(validateShopCatalog({ surum: 2, urunler: RAW.urunler }).ok).toBe(false);
    expect(validateShopCatalog({ surum: 1, urunler: [] }).ok).toBe(false);
    expect(validateShopCatalog([]).ok).toBe(false);
    expect(validateShopCatalog({ ...RAW, fazla: 1 }).ok).toBe(false);
  });

  it("validateShopItem: alan kuralları", () => {
    const ok = (r: unknown) => validateShopItem(r, RAW).ok;
    const yeni = { ...row("cerceve-galaksi"), id: "cerceve-neon-gece", name: "Neon Gece" };
    expect(ok(yeni)).toBe(true);
    expect(ok({ ...yeni, koleksiyon: "Neon Gece", cikis: "2026-12-01" })).toBe(true);
    expect(ok({ ...yeni, id: "cerceve-galaksi" })).toBe(false); // kimlik tekrarı
    expect(ok({ ...yeni, name: "galaksi" })).toBe(false); // aynı türde ad tekrarı
    expect(ok({ ...yeni, id: "Cerceve_X" })).toBe(false);
    expect(ok({ ...yeni, price: 1600 })).toBe(false);
    expect(ok({ ...yeni, price: 800.5 })).toBe(false);
    expect(ok({ ...yeni, rarity: "nadir" })).toBe(false); // 1000 nadir aralığında değil
    expect(ok({ ...yeni, name: "x".repeat(25) })).toBe(false);
    expect(ok({ ...yeni, description: "y".repeat(91) })).toBe(false);
    expect(ok({ ...yeni, name: " Boşluk" })).toBe(false);
    expect(ok({ ...yeni, satista: "evet" })).toBe(false);
    expect(ok({ ...yeni, cikis: "2026-02-30" })).toBe(false);
    expect(ok({ ...yeni, koleksiyon: "" })).toBe(false);
    expect(ok({ ...yeni, fiyat: 1 })).toBe(false);
    const efektsiz: Record<string, unknown> = { ...yeni };
    delete efektsiz.efekt;
    expect(ok(efektsiz)).toBe(false); // çerçevede tarif zorunlu
    expect(ok({ ...yeni, asset: "galaksi" })).toBe(false); // çerçevede asset yok
    // Görselli türde asset zorunlu; kart arkası ve tepkide tarif henüz kabul edilmez.
    const kart = { ...row("kart-okyanus"), id: "kart-yeni", name: "Yeni Kart" };
    expect(ok(kart)).toBe(true);
    expect(ok({ ...kart, asset: undefined })).toBe(false);
    expect(
      ok({ ...kart, efekt: { motor: "doku-katmani", parametreler: { doku: "kart-arkasi/yeni.webp" } } }),
    ).toBe(false);
    // Kostümde covers zorunlu ve yalnız kaplanabilir yuvalar.
    const kostum = { ...row("kostum-ninja"), id: "kostum-yeni", name: "Yeni" };
    expect(ok(kostum)).toBe(true);
    expect(ok({ ...kostum, covers: ["aksesuar"] })).toBe(false);
    expect(ok({ ...kostum, covers: [] })).toBe(false);
    expect(ok({ ...row("sapka-tac"), id: "sapka-yeni", name: "Yeni", covers: ["sapka"] })).toBe(false);
    // Giriş efektine ek tarif verilebilir.
    const giris = {
      ...row("giris-portal"),
      id: "giris-yeni",
      name: "Yeni",
      efekt: { motor: "kivilcim", parametreler: { renk: "#ffc23b", sayi: 20 } },
    };
    expect(validateShopItem(giris, RAW)).toEqual({ ok: true, errors: [] });
    expect(validateShopItem(null).ok).toBe(false);
  });

  it("çıkış tarihi biçimi", () => {
    expect(isCatalogDate("2026-11-30")).toBe(true);
    expect(isCatalogDate("2026-13-01")).toBe(false);
    expect(isCatalogDate("26-11-30")).toBe(false);
    expect(isCatalogDate(20261130)).toBe(false);
  });
});

describe("satış, çıkış tarihi ve koleksiyon (MG-3)", () => {
  const base = cosmeticItem("cerceve-galaksi") as CosmeticItem;
  const NOON = Date.UTC(2026, 10, 20, 9);

  it("satıştan kalkan ya da çıkışı gelmemiş ürün satışta değil; çıkış İstanbul gece yarısında başlar", () => {
    expect(isOnSale(base, NOON)).toBe(true);
    expect(isOnSale({ ...base, satista: false }, NOON)).toBe(false);
    const gelecek = { ...base, cikis: "2026-11-21" };
    expect(releaseAt("2026-11-21")).toBe(Date.UTC(2026, 10, 20, 21));
    expect(isOnSale(gelecek, Date.UTC(2026, 10, 20, 20, 59))).toBe(false);
    expect(isOnSale(gelecek, Date.UTC(2026, 10, 20, 21))).toBe(true);
  });

  it("önizleme katmanı: taslak satır mağaza listesine ve kimlik aramasına girer, temizlenince çıkar", () => {
    const draft: CosmeticItem = {
      ...base,
      id: "cerceve-taslak",
      name: "Taslak",
      koleksiyon: "Neon Gece",
      satista: true,
    };
    const second: CosmeticItem = { ...base, koleksiyon: "Neon Gece" };
    const kalkan: CosmeticItem = { ...(cosmeticItem("cerceve-pembe") as CosmeticItem), satista: false };
    setPreviewItems([draft, second, kalkan]);
    try {
      expect(cosmeticItem("cerceve-taslak")).toBe(draft);
      expect(itemsOfType("cerceve").at(-1)).toBe(draft);
      expect(shopItemsOfType("cerceve", NOON).map((i) => i.id)).not.toContain("cerceve-pembe");
      // Satıştan kalkan ürün yine kimlikle bulunur (sahibi kuşanmaya devam eder).
      expect(cosmeticItem("cerceve-pembe")?.satista).toBe(false);
      expect(shopCollections(NOON)).toEqual([{ name: "Neon Gece", items: [second, draft] }]);
    } finally {
      setPreviewItems(null);
    }
    expect(cosmeticItem("cerceve-taslak")).toBeUndefined();
    expect(shopCollections(NOON)).toEqual([]);
  });

  it("satışta olmayan ürünün fiyatı yok (satın alınamaz); fırsat indirimi ürünün kendi fiyatından", () => {
    const d = dailyDeals(NOON)[0];
    expect(d).toBeDefined();
    if (!d) return;
    expect(d.price).toBe(dealPrice(cosmeticItem(d.itemId)?.price ?? 0));
    expect(currentPrice(d.itemId, NOON)).toBe(d.price);
    expect(currentPrice("yok-boyle", NOON)).toBeNull();
  });
});
