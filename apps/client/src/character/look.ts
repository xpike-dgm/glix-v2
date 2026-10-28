/** Oyuncunun kozmetiklerinden karakter görünümü ve kimlik rengi (saf). */
import { type Cosmetics, cosmeticItem, DEFAULT_DANCE } from "@glix/engine";

export interface CharacterLook {
  /** Giyilen giysi katmanları (`rig.json` wardrobe adları). */
  layers: string[];
  /** Kazananın oynayacağı dans dosyası. */
  dance: string;
}

/** Katalogdaki geçerli ve doğru türdeki ürünün karakter varlığı; bilinmeyen kimlik yok sayılır. */
function assetOf(id: string | undefined, type: "dans" | "sapka" | "ust"): string | undefined {
  if (id === undefined) return undefined;
  const it = cosmeticItem(id);
  return it && it.type === type ? it.asset : undefined;
}

export function lookOf(c: Cosmetics | undefined): CharacterLook {
  const layers: string[] = [];
  const hat = assetOf(c?.hat, "sapka");
  const top = assetOf(c?.top, "ust");
  if (hat) layers.push(hat);
  if (top) layers.push(top);
  return { layers, dance: assetOf(c?.dance, "dans") ?? DEFAULT_DANCE };
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
