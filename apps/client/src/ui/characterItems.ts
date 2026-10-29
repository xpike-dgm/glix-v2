/** Kürsü karakteri ürünlerinin (dans ve tüm giysi yuvaları) önizleme kuralları (saf). */
import {
  type ClothingColourId,
  type CosmeticItem,
  type Cosmetics,
  type CosmeticTypeId,
  cosmeticType,
  DEFAULT_COLOUR,
  DEFAULT_DANCE,
  equippedValue,
  isClothingType,
} from "@glix/engine";
import { lookOf, tintHue } from "../character/look.js";
import type { PosterFocus } from "../character/poster.js";

/** Karakter üzerinde gösterilen ürün mü (dans ya da giysi)? */
export const isCharacterItem = (item: CosmeticItem): boolean =>
  item.type === "dans" || isClothingType(item.type);

export interface PosterSpec {
  layers: string[];
  /** Giysi katmanı -> neon renk dönüşü (derece). */
  tints: Record<string, number>;
  dance: string | null;
  focus: PosterFocus;
}

/** Giysi türüne göre afiş kadrajı: şapka baş, alt bacak, ayakkabı ayak, tam kostüm tüm boy, diğerleri gövde. */
export const FOCUS_OF: Readonly<Partial<Record<CosmeticTypeId, PosterFocus>>> = {
  sapka: "head",
  ust: "torso",
  aksesuar: "torso",
  alt: "legs",
  ayakkabi: "feet",
  kostum: "full",
};

/**
 * Karo afişi: dans ürünü oyuncunun kuşandığı giysilerle dansın en karakteristik karesinde; giysi ürünü tek başına
 * dinlenme duruşunda (kendi yuvasına uygun kadrajda) görünür; `colour` giysinin neon rengidir.
 */
export function posterSpec(
  item: CosmeticItem,
  equipped: Cosmetics | undefined,
  colour: ClothingColourId = DEFAULT_COLOUR,
): PosterSpec {
  if (item.type === "dans") {
    const look = lookOf(equipped);
    return { layers: look.layers, tints: look.tints, dance: item.asset ?? DEFAULT_DANCE, focus: "full" };
  }
  const deg = tintHue(colour);
  return {
    layers: item.asset ? [item.asset] : [],
    tints: item.asset && deg !== 0 ? { [item.asset]: deg } : {},
    dance: null,
    focus: FOCUS_OF[item.type] ?? "torso",
  };
}

/** Varsayılan dansın (Sevinç) afişi: dolapta "Sevinç" karosu. */
export const defaultDancePoster = (equipped: Cosmetics | undefined): PosterSpec => {
  const look = lookOf(equipped);
  return { layers: look.layers, tints: look.tints, dance: DEFAULT_DANCE, focus: "full" };
};

/**
 * Satın alma sayfasındaki canlı önizleme: ürün kuşanılanların üstüne eklenir (aynı yuva ise onun yerini alır);
 * giysilerde `colour` seçilen renktir.
 */
export function previewCosmetics(
  item: CosmeticItem,
  equipped: Cosmetics | undefined,
  colour: ClothingColourId = DEFAULT_COLOUR,
): Cosmetics {
  const key = cosmeticType(item.type).key;
  if (key === null || (item.type !== "dans" && !isClothingType(item.type))) return { ...(equipped ?? {}) };
  const value = item.type === "dans" ? item.id : equippedValue(item.id, colour);
  return { ...(equipped ?? {}), [key]: value };
}
