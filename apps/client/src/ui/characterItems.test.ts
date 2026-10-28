import { COSMETIC_ITEMS, cosmeticItem, itemsOfType } from "@glix/engine";
import { describe, expect, it } from "vitest";
import { defaultDancePoster, isCharacterItem, posterSpec, previewCosmetics } from "./characterItems.js";

const item = (id: string) => {
  const it = cosmeticItem(id);
  if (!it) throw new Error(id);
  return it;
};

describe("karakter ürünleri önizlemesi", () => {
  it("yalnız dans ve giysi karakter üzerinde gösterilir", () => {
    expect(COSMETIC_ITEMS.filter(isCharacterItem)).toHaveLength(10);
    expect(isCharacterItem(item("cerceve-cift"))).toBe(false);
  });

  it("dans afişi oyuncunun giysileriyle, dansın kendi dosyasıyla", () => {
    expect(posterSpec(item("dans-cizgi-film"), { hat: "sapka-neon-kep" })).toEqual({
      layers: ["sapka"],
      dance: "mickey",
      focus: "full",
    });
    expect(posterSpec(item("dans-twist"), undefined)).toEqual({ layers: [], dance: "twist", focus: "full" });
  });

  it("giysi afişi tek başına: şapka baş kadrajı, üst gövde kadrajı, dans yok", () => {
    expect(posterSpec(item("sapka-neon-kep"), { top: "ust-neon-bomber" })).toEqual({
      layers: ["sapka"],
      dance: null,
      focus: "head",
    });
    expect(posterSpec(item("ust-neon-bomber"), undefined)).toEqual({
      layers: ["ceket"],
      dance: null,
      focus: "torso",
    });
  });

  it("varsayılan dans afişi Sevinç", () => {
    expect(defaultDancePoster({ top: "ust-neon-bomber" })).toEqual({
      layers: ["ceket"],
      dance: "sevinc",
      focus: "full",
    });
  });

  it("canlı önizleme ürünü kuşanılanların üstüne ekler; aynı yuvanın yerini alır", () => {
    const equipped = { dance: "dans-twist", hat: "sapka-neon-kep" };
    expect(previewCosmetics(item("dans-lambada"), equipped)).toEqual({
      dance: "dans-lambada",
      hat: "sapka-neon-kep",
    });
    expect(previewCosmetics(item("ust-neon-bomber"), equipped)).toEqual({
      ...equipped,
      top: "ust-neon-bomber",
    });
    expect(itemsOfType("dans").every((i) => previewCosmetics(i, undefined).dance === i.id)).toBe(true);
  });
});
