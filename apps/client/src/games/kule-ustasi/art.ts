/**
 * Kule Ustası görselleri (KU-U1). Sahip üretir (docs/oneriler/kule-ustasi-gorsel.md); dosya
 * `public/assets/props/kule-ustasi/<ad>.webp` olarak konunca bir sonraki derlemede kod değişmeden kullanılır.
 * Dosya yokken ekran CSS/SVG karşılığını çizer ve dosyayı hiç istemez (404 yok).
 */
export type KuleArt = "kanca" | "blok-doku";

const present = (): readonly string[] => (typeof __KULE_PROPS__ !== "undefined" ? __KULE_PROPS__ : []);

export function kuleArtUrl(name: KuleArt): string | null {
  return present().includes(name) ? `/assets/props/kule-ustasi/${name}.webp` : null;
}
