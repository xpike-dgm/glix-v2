import { karaBorsaPropExists, type PropPath, propSrc } from "../../ui/props.js";

/** Kapalı kutular; tura göre sabit, değeri ele vermez. */
export const BORSA_BOXES = ["kutu-ahsap", "kutu-celik", "kutu-hediye", "kutu-antika"] as const;
export type BorsaBox = (typeof BORSA_BOXES)[number] | "kutu-lanet" | "buyuk-sandik";

/** Görsel derlemede var mı (yoksa ekran CSS/SVG karşılığını çizer; bkz. `karaBorsaPropExists`). */
export const borsaArtExists = karaBorsaPropExists;

export const borsaArtSrc = (name: string): string => propSrc(`kara-borsa/${name}` as PropPath);

/** Tura göre kutu: son tur Büyük Kutu (görseli yoksa antika kutu parıltıyla), lanetli açılışta lanet kutusu. */
export function boxFor(round: number, rounds: number, cursed: boolean): BorsaBox {
  if (cursed) return "kutu-lanet";
  if (round === rounds - 1) return borsaArtExists("buyuk-sandik") ? "buyuk-sandik" : "kutu-antika";
  return BORSA_BOXES[Math.abs(round) % BORSA_BOXES.length] ?? "kutu-ahsap";
}
