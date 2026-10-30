import { warmImage } from "../../ui/imageWarm.js";

/**
 * Çapraz Ateş'in isteğe bağlı görselleri (sahip üretir: docs/oneriler/capraz-ates-gorsel.md). Görsel yokken her
 * öğe CSS/SVG karşılığıyla çizilir. Dosya `apps/client/public/assets/props/capraz-ates/<ad>.webp` olarak eklenince
 * buradaki satırı `true` yapmak yeterlidir; o zaman görsel CSS karşılığının yerine geçer. (Yok olan dosyayı
 * denemek konsola 404 yazdırır; bu yüzden kendiliğinden yoklanmaz.)
 */
export const CX_ART = {
  "namlu-atesi": false,
  "mermi-parilti": false,
  kalkan: false,
  "cam-catlagi": false,
} as const satisfies Record<string, boolean>;

export type CxArtName = keyof typeof CX_ART;

export const cxArtSrc = (name: CxArtName): string => `/assets/props/capraz-ates/${name}.webp`;

/** Görsel eklenmiş mi. */
export const hasArt = (name: CxArtName): boolean => CX_ART[name];

/** Eklenmiş görselleri önden indirir (anlatım sırasında). */
export function preloadCxArt(): void {
  for (const name of Object.keys(CX_ART) as CxArtName[]) if (hasArt(name)) warmImage(cxArtSrc(name), true);
}
