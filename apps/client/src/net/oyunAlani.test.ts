/** Oyun alanı (test2) taslak katmanı: yalnız test2 şeridi varken istek atılır; canlıda mağaza birebir aynı kalır. */
import { COSMETIC_ITEMS, cosmeticItem, itemsOfType, setPreviewItems, shopItemsOfType } from "@glix/engine";
import { afterEach, describe, expect, it, vi } from "vitest";
import { assetUrl, setAssetOverrides } from "../ui/assetOverride.js";
import { cardBackSrc, celebrationSprite } from "../ui/shopArt.js";
import { oyunAlaniMi, parseTaslakKatmani, taslaklariYukle, taslakMi, taslakOnce } from "./oyunAlani.js";

const SHA = "a".repeat(64);
const ZAFER = {
  id: "zafer-oyun-alani",
  type: "zafer",
  rarity: "nadir",
  price: 450,
  name: "Taslak Zafer",
  description: "Taslak kutlama.",
  satista: true,
  asset: "oyun-alani",
};
const yanit = {
  ok: true,
  urunler: [ZAFER, { ...ZAFER, id: "bozuk", price: 1 }, { ...COSMETIC_ITEMS[0], name: "Ezmeye çalışan" }],
  dosyalar: {
    "/assets/shop/zafer/oyun-alani-1.webp": `/api/oyun-alani/dosya/${SHA}.webp`,
    "/assets/shop/zafer/oyun-alani-2.webp": "https://kotu.example/x.webp",
    "/etc/passwd": `/api/oyun-alani/dosya/${SHA}.webp`,
  },
};

const sahteBelge = (ortam: string | null) => ({
  querySelector: (s: string) => (ortam !== null && s.includes(`"${ortam}"`) ? {} : null),
});

afterEach(() => {
  setPreviewItems(null);
  setAssetOverrides(null);
  vi.unstubAllGlobals();
});

describe("oyun alanı taslak katmanı (istemci)", () => {
  it("yanıt doğrulanır: geçersiz satır, katalogdaki kimlik ve yabancı adres atılır", () => {
    const k = parseTaslakKatmani(yanit);
    expect(k?.urunler.map((u) => u.id)).toEqual(["zafer-oyun-alani"]);
    expect([...(k?.dosyalar.entries() ?? [])]).toEqual([
      ["/assets/shop/zafer/oyun-alani-1.webp", `/api/oyun-alani/dosya/${SHA}.webp`],
    ]);
    expect(parseTaslakKatmani({ ok: false })).toBeNull();
    expect(parseTaslakKatmani("x")).toBeNull();
  });

  it("canlıda ve test'te hiç istek atılmaz; mağaza ve görsel yolları birebir aynı kalır", async () => {
    const f = vi.fn();
    for (const ortam of [null, "test"]) {
      vi.stubGlobal("document", sahteBelge(ortam));
      expect(oyunAlaniMi()).toBe(false);
      await taslaklariYukle(f as unknown as typeof fetch);
    }
    expect(f).not.toHaveBeenCalled();
    expect(itemsOfType("zafer").map((i) => i.id)).toEqual(
      COSMETIC_ITEMS.filter((i) => i.type === "zafer").map((i) => i.id),
    );
    const z = COSMETIC_ITEMS.find((i) => i.type === "zafer");
    expect(celebrationSprite(z?.id, 1)).toBe(`/assets/shop/zafer/${z?.asset}-1.webp`);
    const kart = COSMETIC_ITEMS.find((i) => i.type === "kart-arkasi");
    expect(cardBackSrc(kart?.id)).toBe(`/assets/shop/kart-arkasi/${kart?.asset}.webp`);
    expect(taslakMi("zafer-oyun-alani")).toBe(false);
    // Sıra değişmez (aynı dizi döner).
    const liste = itemsOfType("zafer");
    expect(taslakOnce(liste)).toBe(liste);
  });

  it("oyun alanında katman yüklenir: taslak mağazada görünür, görseli sunucudan gelir, TASLAK işaretlidir", async () => {
    vi.stubGlobal("document", sahteBelge("test2"));
    const f = vi.fn(async () => new Response(JSON.stringify(yanit), { status: 200 }));
    await taslaklariYukle(f as unknown as typeof fetch);
    expect(f).toHaveBeenCalledWith("/api/oyun-alani/magaza", expect.anything());
    expect(cosmeticItem("zafer-oyun-alani")?.name).toBe("Taslak Zafer");
    expect(shopItemsOfType("zafer", Date.now()).map((i) => i.id)).toContain("zafer-oyun-alani");
    expect(taslakMi("zafer-oyun-alani")).toBe(true);
    expect(taslakOnce(shopItemsOfType("zafer", Date.now()))[0]?.id).toBe("zafer-oyun-alani");
    expect(celebrationSprite("zafer-oyun-alani", 1)).toBe(`/api/oyun-alani/dosya/${SHA}.webp`);
    expect(assetUrl("/assets/shop/zafer/oyun-alani-2.webp")).toBe("/assets/shop/zafer/oyun-alani-2.webp");
    // Katalogdaki ürün ezilmedi.
    expect(cosmeticItem(COSMETIC_ITEMS[0]?.id ?? "")?.name).toBe(COSMETIC_ITEMS[0]?.name);
  });
});
