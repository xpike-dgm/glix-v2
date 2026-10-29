/** Oyuncunun kozmetiklerinden karakter görünümü ve kimlik rengi (saf). */
import {
  type ClothingColourId,
  COSMETIC_TYPES,
  type Cosmetics,
  type CosmeticTypeId,
  clothingColour,
  cosmeticItem,
  DEFAULT_DANCE,
  isClothingType,
  splitEquipped,
} from "@glix/engine";

export interface CharacterLook {
  /** Giyilen giysi katmanları (`rig.json` wardrobe adları); sıra önemsizdir, çizim sırasını yuva belirler. */
  layers: string[];
  /**
   * Katman -> neon renk dönüşü (derece, `hueShiftFor`); yalnız varsayılan dışı renkler yazılır.
   * Giysinin neon vurgusu bu rengi alır, gövdenin neonu oyuncunun kimlik rengidir (bkz. docs/HESAP.md).
   */
  tints: Record<string, number>;
  /** Kazananın oynayacağı dans dosyası. */
  dance: string;
}

/** Katalogdaki geçerli ve doğru türdeki ürünün karakter varlığı; bilinmeyen kimlik yok sayılır. */
function assetOf(id: string | undefined, type: "dans"): string | undefined {
  if (id === undefined) return undefined;
  const it = cosmeticItem(id);
  return it && it.type === type ? it.asset : undefined;
}

export interface Worn {
  type: CosmeticTypeId;
  layer: string;
  colour: ClothingColourId;
  covers: readonly CosmeticTypeId[];
}

/** Bir giysi yuvasındaki kuşanılan değer; geçersiz kimlik, yanlış tür ya da görseli olmayan ürün yok sayılır. */
function worn(type: CosmeticTypeId, value: string | undefined): Worn | null {
  if (value === undefined) return null;
  const e = splitEquipped(value);
  const it = e ? cosmeticItem(e.id) : undefined;
  if (!e || !it || it.type !== type || !it.asset) return null;
  return { type, layer: it.asset, colour: e.colour, covers: it.covers ?? [] };
}

/** Katmanın dönüş açısı: oyuncunun hanesinde seçilen giysi rengine göre. */
export const tintHue = (colour: ClothingColourId): number => {
  const c = clothingColour(colour);
  return c ? hueShiftFor(c.hex) : 0;
};

/** Kostüm kuralı: kostüm varsa kapladığı yuvalardaki giysiler elenir. */
export function withCostume(all: readonly Worn[]): Worn[] {
  const costume = all.find((w) => w.type === "kostum");
  return all.filter((w) => !costume || w === costume || !costume.covers.includes(w.type));
}

/**
 * Kuşanılanlardan görünüm. Kostüm kuralı: kostüm kuşanıldıysa KAPLADIĞI yuvalardaki giysiler giyilmez (kostüm
 * onların yerini alır); kapsamadığı yuvalar (ör. aksesuar) olduğu gibi kalır.
 */
export function lookOf(c: Cosmetics | undefined): CharacterLook {
  const all: Worn[] = [];
  for (const t of COSMETIC_TYPES) {
    if (t.key === null || !isClothingType(t.id)) continue;
    const w = worn(t.id, c?.[t.key]);
    if (w) all.push(w);
  }
  const shown = withCostume(all);
  const tints: Record<string, number> = {};
  for (const w of shown) {
    const deg = tintHue(w.colour);
    if (deg !== 0) tints[w.layer] = deg;
  }
  return { layers: shown.map((w) => w.layer), tints, dance: assetOf(c?.dance, "dans") ?? DEFAULT_DANCE };
}

/** Karakter çiziminin ana neon rengi (camgöbeği); oyuncu renginin hedefi buna göre döndürülür. */
export const BASE_ACCENT = "#2EF2FF";

function rgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Gri eksen çevresindeki renk açısı (derece, 0-360): RGB küpünün renklilik düzleminde. */
export function chromaAngle(hex: string): number {
  const [r, g, b] = rgb(hex);
  return ((Math.atan2(Math.sqrt(3) * (g - b), 2 * r - g - b) * 180) / Math.PI + 360) % 360;
}

/**
 * Camgöbeği vurguyu oyuncunun rengine çeviren renk dönüşü (derece). Pixi'nin `ColorMatrixFilter.hue` işlevi RGB'yi
 * gri eksen çevresinde döndürür; koyu griler (r=g=b) bu eksende olduğundan olduğu gibi kalır.
 */
export function hueShiftFor(color: string): number {
  return (((chromaAngle(color) - chromaAngle(BASE_ACCENT)) % 360) + 360) % 360;
}

/** RGB'yi gri eksen çevresinde `deg` derece döndüren 3x3 matris (satır sıralı); Pixi `hue()` ile aynı. */
export type Mat3 = readonly [number, number, number, number, number, number, number, number, number];
export function hueMatrix(deg: number): Mat3 {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  const w = 1 / 3;
  const q = Math.sqrt(w);
  const a = c + (1 - c) * w;
  const b = w * (1 - c) - q * s;
  const d = w * (1 - c) + q * s;
  return [a, b, d, d, a, b, b, d, a];
}
