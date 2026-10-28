/** Resimli ürün türleri (kart arkası, zafer, tepki paketi, giriş efekti): önizleme ve görsel kuralları (saf). */
import type { CosmeticItem, CosmeticTypeId } from "@glix/engine";

export const ART_TYPES: readonly CosmeticTypeId[] = ["kart-arkasi", "zafer", "tepki", "giris"];

/** Ürün resimli türlerden biri mi? */
export const isArtItem = (item: CosmeticItem): boolean => ART_TYPES.includes(item.type);

/** Karo ve dolap için kolaj: paketin ilk 4 çıkartması. */
export const COLLAGE_STICKERS = 4;
