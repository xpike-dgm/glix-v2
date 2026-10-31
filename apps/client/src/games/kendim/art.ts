/**
 * Kendim görselleri (KN-U1 ayna çerçevesi, KN-U4 kart arka yüzü). Sahip üretir (docs/oneriler/kendim-gorsel.md);
 * dosya `public/assets/props/kendim/<ad>.webp` olarak konunca bir sonraki derlemede kod değişmeden kullanılır.
 * Dosya yokken ekran CSS/SVG karşılığını çizer ve dosyayı hiç istemez (404 yok).
 */
export type KendimArt = "ayna-cercevesi" | "kart-arka";

const present = (): readonly string[] => (typeof __KENDIM_PROPS__ !== "undefined" ? __KENDIM_PROPS__ : []);

export function kendimArtUrl(name: KendimArt): string | null {
  return present().includes(name) ? `/assets/props/kendim/${name}.webp` : null;
}
