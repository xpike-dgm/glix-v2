/** Kürsü karakteri ürünlerinin (dans, şapka, üst) önizleme kuralları (saf). */
import { type CosmeticItem, type Cosmetics, DEFAULT_DANCE } from "@glix/engine";
import { lookOf } from "../character/look.js";
import type { PosterFocus } from "../character/poster.js";

/** Karakter üzerinde gösterilen ürün mü (dans ya da giysi)? */
export const isCharacterItem = (item: CosmeticItem): boolean =>
  item.type === "dans" || item.type === "sapka" || item.type === "ust";

export interface PosterSpec {
  layers: string[];
  dance: string | null;
  focus: PosterFocus;
}

/**
 * Karo afişi: dans ürünü oyuncunun kuşandığı giysilerle dansın en karakteristik karesinde; giysi ürünü tek başına
 * dinlenme duruşunda (şapkada baş, üstte gövde kadrajı) görünür.
 */
export function posterSpec(item: CosmeticItem, equipped: Cosmetics | undefined): PosterSpec {
  if (item.type === "dans")
    return { layers: lookOf(equipped).layers, dance: item.asset ?? DEFAULT_DANCE, focus: "full" };
  return {
    layers: item.asset ? [item.asset] : [],
    dance: null,
    focus: item.type === "sapka" ? "head" : "torso",
  };
}

/** Varsayılan dansın (Sevinç) afişi: dolapta "Sevinç" karosu. */
export const defaultDancePoster = (equipped: Cosmetics | undefined): PosterSpec => ({
  layers: lookOf(equipped).layers,
  dance: DEFAULT_DANCE,
  focus: "full",
});

/** Satın alma sayfasındaki canlı önizleme: ürün kuşanılanların üstüne eklenir (aynı yuva ise onun yerini alır). */
export function previewCosmetics(item: CosmeticItem, equipped: Cosmetics | undefined): Cosmetics {
  const base = equipped ?? {};
  const one = itemCosmeticsOf(item);
  return { ...base, ...one };
}

function itemCosmeticsOf(item: CosmeticItem): Cosmetics {
  if (item.type === "dans") return { dance: item.id };
  if (item.type === "sapka") return { hat: item.id };
  if (item.type === "ust") return { top: item.id };
  return {};
}
