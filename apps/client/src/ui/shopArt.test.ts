import { existsSync } from "node:fs";
import { join } from "node:path";
import { COSMETIC_ITEMS, cosmeticAssetFiles, cosmeticItem } from "@glix/engine";
import { describe, expect, it } from "vitest";
import { ART_TYPES, isArtItem } from "./artItems.js";
import { cardBackOf, cardBackSrc, DEFAULT_CARD_BACK_SRC, entryLayers, stickerSrc } from "./shopArt.js";

describe("resimli ürün yolları", () => {
  it("katalogdaki her resimli ürünün bütün görselleri public/assets/shop altında var", () => {
    const root = join(process.cwd(), "public/assets/shop");
    let checked = 0;
    for (const it of COSMETIC_ITEMS) {
      for (const f of cosmeticAssetFiles(it)) {
        expect(existsSync(join(root, f)), `${it.id}: ${f}`).toBe(true);
        checked++;
      }
    }
    expect(checked).toBe(9 * 1 + 5 * 4 + 3 * 6 + 5 * 2);
  });

  it("kart arkası: kuşanılan görsel, yoksa ya da bilinmiyorsa klasik", () => {
    expect(cardBackSrc("kart-elektrik")).toBe("/assets/shop/kart-arkasi/elektrik.webp");
    expect(cardBackOf({ cardBack: "kart-altin-kraliyet" })).toBe(
      "/assets/shop/kart-arkasi/altin-kraliyet.webp",
    );
    expect(cardBackOf(undefined)).toBe(DEFAULT_CARD_BACK_SRC);
    expect(cardBackSrc("kart-yok")).toBe(DEFAULT_CARD_BACK_SRC);
    // yanlış türdeki kimlik klasiğe düşer
    expect(cardBackSrc("zafer-balon")).toBe(DEFAULT_CARD_BACK_SRC);
  });

  it("giriş efekti iki katman; çıkartma yolu paket ve sıradan", () => {
    expect(entryLayers("giris-portal")).toEqual({
      back: "/assets/shop/giris/portal-zemin.webp",
      front: "/assets/shop/giris/portal-isik.webp",
    });
    expect(entryLayers("kart-elektrik")).toBeUndefined();
    expect(stickerSrc("pack:efsane-tepkiler:5")).toBe("/assets/shop/tepki/efsane-tepkiler-5.webp");
    expect(stickerSrc("pack:yok:5")).toBeUndefined();
  });

  it("resimli türler: kart arkası, zafer, tepki, giriş", () => {
    expect(ART_TYPES).toEqual(["kart-arkasi", "zafer", "tepki", "giris"]);
    expect(isArtItem(cosmeticItem("tepki-parti") ?? (null as never))).toBe(true);
    expect(isArtItem(cosmeticItem("unvan-sansli") ?? (null as never))).toBe(false);
  });
});
