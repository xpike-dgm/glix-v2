/**
 * Klip kadrajının yerleşimi (saf mantık): 720x1280 tasarım alanında podyum sütunları. Kazananlar (1. sıra; beraberlikte
 * birden çok) ortada ve yüksek blokta dans eder, diğerleri yanlarda alçak blokta alkışlar.
 */
export const DESIGN_W = 720;
export const DESIGN_H = 1280;

export interface Column {
  /** `people` dizisindeki sıra. */
  index: number;
  /** Sütun orta x'i. */
  cx: number;
  /** Blok üst y'si ve yüksekliği; karakterin ayakları bloğun üstünde durur. */
  blockTop: number;
  blockH: number;
  blockW: number;
  /** Karakter kutusu (ayaklar kutunun altında, ortada). */
  figW: number;
  figH: number;
  /** Danseden (1. sıra) mi. */
  dances: boolean;
}

const BASE = 1150;

/** `ranks`: en çok 3 kişi, sıralı (iyiden kötüye). */
export function clipColumns(ranks: readonly number[]): Column[] {
  const n = Math.min(3, ranks.length);
  if (n === 0) return [];
  // Yerleşim sırası: en iyi ortada, sonra sağ, sonra sol (kürsü düzeni 2-1-3).
  const slots = n === 1 ? [360] : n === 2 ? [190, 530] : [130, 360, 590];
  const order = n === 1 ? [0] : n === 2 ? [0, 1] : [1, 0, 2];
  const wide = n === 3 ? 220 : n === 2 ? 300 : 360;
  const cols: Column[] = [];
  for (let s = 0; s < n; s++) {
    const index = order[s] ?? s;
    const first = (ranks[index] ?? 0) === 1;
    const blockH = first ? 210 : (ranks[index] ?? 0) === 2 ? 150 : 110;
    cols.push({
      index,
      cx: slots[s] ?? 360,
      blockTop: BASE - blockH,
      blockH,
      blockW: wide,
      figW: first ? 270 : 200,
      figH: first ? 560 : 410,
      dances: first,
    });
  }
  return cols;
}
