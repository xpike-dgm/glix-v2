/**
 * Mağaza ve kozmetik görselleri (public/assets/shop). Ürün kimliği -> dosya tek tablodur: görsel değişince
 * (aynı dosya adı ve boyut) ya da yeni çerçeve eklenince yalnız bu tablo güncellenir.
 */
import type { CosmeticRarity as Rarity } from "@glix/engine";

const BASE = "/assets/shop";

/** Çerçeve görseli 384x384; ortadaki şeffaf delik görselin %62'sidir (avatar deliğe oturur). */
export const FRAME_HOLE = 0.62;

interface FrameArt {
  file: string;
  /** Kazanan tacının çerçevenin üstünde durması için avatar boyuna göre tepe konumu (yüzde, negatif). */
  crownTop: number;
}

/** Çerçeve ürün kimliği -> görsel. Süslü sürümler gelince taç yüksekliği (`crownTop`) buradan ayarlanır. */
const FRAMES: Readonly<Record<string, FrameArt>> = {
  "cerceve-camgobegi": { file: "camgobegi-halka", crownTop: -72 },
  "cerceve-pembe": { file: "pembe-halka", crownTop: -72 },
  "cerceve-cift": { file: "cift-halka", crownTop: -72 },
  "cerceve-donen-neon": { file: "donen-neon", crownTop: -72 },
  "cerceve-altin-tac": { file: "altin-tac-halkasi", crownTop: -80 },
};

export const frameSrc = (id: string): string | undefined => {
  const f = FRAMES[id];
  return f ? `${BASE}/cerceve/${f.file}.webp` : undefined;
};
export const frameCrownTop = (id: string): number => FRAMES[id]?.crownTop ?? -72;

/** Ürün kutusu arka planı (480x600) ve unvan levhası (512x128), nadirliğe göre. */
export const boxSrc = (r: Rarity): string => `${BASE}/kutu/kutu-${r}.webp`;
export const plateSrc = (r: Rarity): string => `${BASE}/unvan/levha-${r}.webp`;
export const COIN_SRC = `${BASE}/jeton/glix-jeton.webp`;
export const COIN_STACK_SRC = `${BASE}/jeton/glix-yigin.webp`;
