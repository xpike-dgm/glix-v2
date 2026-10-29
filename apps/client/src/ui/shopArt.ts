/**
 * Mağaza ve kozmetik görselleri (public/assets/shop). Ürün kimliği -> dosya tek tablodur: görsel değişince
 * (aynı dosya adı ve boyut) ya da yeni çerçeve eklenince yalnız bu tablo güncellenir.
 */
import {
  type CosmeticItem,
  type Cosmetics,
  cosmeticItem,
  parseStickerId,
  type CosmeticRarity as Rarity,
  stickerFile,
} from "@glix/engine";

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
  "cerceve-camgobegi": { file: "camgobegi-halka", crownTop: -64 },
  "cerceve-pembe": { file: "pembe-halka", crownTop: -64 },
  "cerceve-cift": { file: "cift-halka", crownTop: -64 },
  "cerceve-donen-neon": { file: "donen-neon", crownTop: -64 },
  "cerceve-altin-tac": { file: "altin-tac-halkasi", crownTop: -66 },
  "cerceve-yesil-sarmasik": { file: "yesil-sarmasik", crownTop: -64 },
  "cerceve-buz-kristali": { file: "buz-kristali", crownTop: -64 },
  "cerceve-ates-halkasi": { file: "ates-halkasi", crownTop: -64 },
  "cerceve-devre-karti": { file: "devre-karti", crownTop: -64 },
  "cerceve-galaksi": { file: "galaksi", crownTop: -64 },
  "cerceve-ejderha": { file: "ejderha", crownTop: -68 },
};

export const frameSrc = (id: string): string | undefined => {
  const f = FRAMES[id];
  return f ? `${BASE}/cerceve/${f.file}.webp` : undefined;
};
export const frameCrownTop = (id: string): number => FRAMES[id]?.crownTop ?? -64;

/** Ürün kutusu arka planı (480x600) ve unvan levhası (512x128), nadirliğe göre. */
export const boxSrc = (r: Rarity): string => `${BASE}/kutu/kutu-${r}.webp`;
export const plateSrc = (r: Rarity): string => `${BASE}/unvan/levha-${r}.webp`;
export const COIN_SRC = `${BASE}/jeton/glix-jeton.webp`;
export const COIN_STACK_SRC = `${BASE}/jeton/glix-yigin.webp`;

/** Klasik kart arkası (`public/assets/cards/arka.webp`): kart arkası kuşanılmadığında. */
export const DEFAULT_CARD_BACK_SRC = "/assets/cards/arka.webp";

const assetOf = (id: string | undefined, type: CosmeticItem["type"]): string | undefined => {
  if (id === undefined) return undefined;
  const it = cosmeticItem(id);
  return it && it.type === type ? it.asset : undefined;
};

/** Kart arkası ürünü (ya da klasik) için görsel; bilinmeyen kimlik klasiğe düşer (ağdan gelen veri). */
export function cardBackSrc(id: string | undefined): string {
  const a = assetOf(id, "kart-arkasi");
  return a ? `${BASE}/kart-arkasi/${a}.webp` : DEFAULT_CARD_BACK_SRC;
}

/** Oyuncunun kuşandığı kart arkası görseli. */
export const cardBackOf = (c: Cosmetics | undefined): string => cardBackSrc(c?.cardBack);

/** Zafer kutlamasının n. (1..4) parçacık görseli; geçersizse undefined. */
export function celebrationSprite(id: string | undefined, n: number): string | undefined {
  const a = assetOf(id, "zafer");
  return a ? `${BASE}/zafer/${a}-${n}.webp` : undefined;
}

/** Giriş efekti katmanları: zemin avatarın arkasında, ışık önünde. */
export function entryLayers(id: string | undefined): { back: string; front: string } | undefined {
  const a = assetOf(id, "giris");
  return a ? { back: `${BASE}/giris/${a}-zemin.webp`, front: `${BASE}/giris/${a}-isik.webp` } : undefined;
}

/** Tepki paketi çıkartması (`pack:<paket>:<n>`) görseli; geçersizse undefined. */
export function stickerSrc(id: string): string | undefined {
  const ref = parseStickerId(id);
  return ref ? `${BASE}/${stickerFile(ref)}` : undefined;
}

/** Paketin n. (1..6) çıkartmasının görseli. */
export const packStickerSrc = (item: CosmeticItem, n: number): string =>
  `${BASE}/tepki/${item.asset ?? ""}-${n}.webp`;
