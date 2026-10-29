import { COSMETIC_ITEMS, cosmeticItem, itemsOfType } from "@glix/engine";
import { describe, expect, it } from "vitest";
import { hueShiftFor } from "../character/look.js";
import {
  defaultDancePoster,
  FOCUS_OF,
  isCharacterItem,
  posterSpec,
  previewCosmetics,
} from "./characterItems.js";

const item = (id: string) => {
  const it = cosmeticItem(id);
  if (!it) throw new Error(id);
  return it;
};

describe("karakter ürünleri önizlemesi", () => {
  it("yalnız dans ve giysi karakter üzerinde gösterilir", () => {
    expect(COSMETIC_ITEMS.filter(isCharacterItem)).toHaveLength(42);
    expect(isCharacterItem(item("cerceve-cift"))).toBe(false);
  });

  it("dans afişi oyuncunun giysileriyle, dansın kendi dosyasıyla", () => {
    expect(posterSpec(item("dans-cizgi-film"), { hat: "sapka-neon-kep" })).toEqual({
      layers: ["sapka"],
      tints: {},
      dance: "mickey",
      focus: "full",
    });
    expect(posterSpec(item("dans-twist"), undefined)).toEqual({
      layers: [],
      tints: {},
      dance: "twist",
      focus: "full",
    });
  });

  it("giysi afişi tek başına: şapka baş kadrajı, üst gövde kadrajı, dans yok", () => {
    expect(posterSpec(item("sapka-neon-kep"), { top: "ust-neon-bomber" })).toEqual({
      layers: ["sapka"],
      tints: {},
      dance: null,
      focus: "head",
    });
    expect(posterSpec(item("ust-neon-bomber"), undefined)).toEqual({
      layers: ["ceket"],
      tints: {},
      dance: null,
      focus: "torso",
    });
  });

  it("başa takılan aksesuar baş kadrajında, diğer aksesuarlar gövde kadrajında", () => {
    expect(posterSpec(item("aksesuar-gunes-gozlugu"), undefined).focus).toBe("head");
    expect(posterSpec(item("aksesuar-kolye"), undefined).focus).toBe("torso");
  });

  it("giysi afişinde seçilen renk katmana yazılır; kadraj yuvaya göre", () => {
    expect(posterSpec(item("sapka-tac"), undefined, "mor").tints).toEqual({ tac: hueShiftFor("#8B5CFF") });
    expect(posterSpec(item("sapka-tac"), undefined, "camgobegi").tints).toEqual({});
    expect(FOCUS_OF).toEqual({
      sapka: "head",
      ust: "torso",
      aksesuar: "torso",
      alt: "legs",
      ayakkabi: "feet",
      kostum: "full",
    });
  });

  it("varsayılan dans afişi Sevinç", () => {
    expect(defaultDancePoster({ top: "ust-neon-bomber" })).toEqual({
      layers: ["ceket"],
      tints: {},
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
    expect(previewCosmetics(item("sapka-tac"), equipped, "pembe")).toEqual({
      ...equipped,
      hat: "sapka-tac~pembe",
    });
    expect(previewCosmetics(item("sapka-tac"), equipped).hat).toBe("sapka-tac");
    expect(previewCosmetics(item("cerceve-cift"), equipped)).toEqual(equipped);
    expect(itemsOfType("dans").every((i) => previewCosmetics(i, undefined).dance === i.id)).toBe(true);
  });
});
