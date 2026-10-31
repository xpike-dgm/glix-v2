/**
 * Mağaza ve kozmetik görselleri (public/assets/shop). Dosya adları ürünün `asset` alanından ve efekt tarifinden
 * (katalog dosyası) türer; çerçeve görseli tarifin dokusudur.
 */
import {
  type CosmeticItem,
  type Cosmetics,
  cosmeticItem,
  parseStickerId,
  type CosmeticRarity as Rarity,
  stickerFile,
} from "@glix/engine";
import { assetUrl } from "./assetOverride.js";

const BASE = "/assets/shop";
/** `/assets/shop/<yol>`; önizleme sayfasında taslak dosya varsa onun adresi (`assetOverride.ts`). */
const shop = (path: string): string => assetUrl(`${BASE}/${path}`);

/** Çerçeve görseli 384x384; ortadaki şeffaf delik görselin %62'sidir (avatar deliğe oturur). */
export const FRAME_HOLE = 0.62;

/**
 * Kazanan tacının çerçevenin üstünde durması için avatar boyuna göre tepe konumu (yüzde, negatif). Çerçevenin görseli
 * ve hareketi ürünün efekt tarifindedir (katalog, MG-4); burada yalnız süslü (yüksek) çerçevelerin taç payı durur.
 */
const CROWN_TOP: Readonly<Record<string, number>> = {
  "cerceve-altin-tac": -66,
  "cerceve-ejderha": -68,
};
export const frameCrownTop = (id: string): number => CROWN_TOP[id] ?? -64;

/** Ürün kutusu arka planı (480x600) ve unvan levhası (512x128), nadirliğe göre. */
export const boxSrc = (r: Rarity): string => shop(`kutu/kutu-${r}.webp`);
export const plateSrc = (r: Rarity): string => shop(`unvan/levha-${r}.webp`);
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
  return a ? shop(`kart-arkasi/${a}.webp`) : DEFAULT_CARD_BACK_SRC;
}

/** Oyuncunun kuşandığı kart arkası görseli. */
export const cardBackOf = (c: Cosmetics | undefined): string => cardBackSrc(c?.cardBack);

/** Zafer kutlamasının n. (1..4) parçacık görseli; geçersizse undefined. */
export function celebrationSprite(id: string | undefined, n: number): string | undefined {
  const a = assetOf(id, "zafer");
  return a ? shop(`zafer/${a}-${n}.webp`) : undefined;
}

/** Giriş efekti katmanları: zemin avatarın arkasında, ışık önünde. */
export function entryLayers(id: string | undefined): { back: string; front: string } | undefined {
  const a = assetOf(id, "giris");
  return a ? { back: shop(`giris/${a}-zemin.webp`), front: shop(`giris/${a}-isik.webp`) } : undefined;
}

/** Tepki paketi çıkartması (`pack:<paket>:<n>`) görseli; geçersizse undefined. */
export function stickerSrc(id: string): string | undefined {
  const ref = parseStickerId(id);
  return ref ? shop(stickerFile(ref)) : undefined;
}

/** Paketin n. (1..6) çıkartmasının görseli. */
export const packStickerSrc = (item: CosmeticItem, n: number): string =>
  shop(`tepki/${item.asset ?? ""}-${n}.webp`);
