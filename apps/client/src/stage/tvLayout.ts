/**
 * TV tasarım tuvali: mantıksal boyut en az 1920x1000'dir; gerçek ekran bu tuvale ölçeklenir (1920x1080 → 1,
 * 1280x720 → 2/3). Tuval ekranı tam doldurur (kenar boşluğu bırakmaz): en-boy oranı farklıysa mantıksal
 * genişlik ya da yükseklik büyür, düzen `fr` ile esner.
 */
export const TV_MIN_W = 1920;
export const TV_MIN_H = 1000;

export interface TvCanvas {
  /** Ölçek katsayısı (gerçek piksel / mantıksal piksel). */
  k: number;
  /** Mantıksal genişlik ve yükseklik. */
  w: number;
  h: number;
}

export function tvCanvas(innerW: number, innerH: number): TvCanvas {
  const w0 = Math.max(1, innerW);
  const h0 = Math.max(1, innerH);
  const k = Math.min(w0 / TV_MIN_W, h0 / TV_MIN_H);
  return { k, w: Math.round(w0 / k), h: Math.round(h0 / k) };
}

/** Bir kutuya (aw x ah) sığacak en büyük ölçek; sığacak yer yoksa 0. */
export function fitScale(aw: number, ah: number, w: number, h: number): number {
  if (aw <= 0 || ah <= 0 || w <= 0 || h <= 0) return 0;
  return Math.min(aw / w, ah / h);
}

/** Oyunun telefondaki ekranının TV'de çizildiği mantıksal kutu (yatay oyun 16:9, dikey oyun sütun). */
export function gameBox(orientation: "portrait" | "landscape"): { w: number; h: number } {
  return orientation === "landscape" ? { w: 960, h: 540 } : { w: 520, h: 860 };
}
