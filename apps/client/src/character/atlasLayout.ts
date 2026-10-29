/** Atlas yerleşimi (saf): parça boyutlarından, hiçbir görsel yüklenmeden, her parçanın atlastaki konumu. */

export interface AtlasBox {
  w: number;
  h: number;
}

export interface AtlasSlot {
  /** Parçanın atlas içindeki sol üst köşesi (kenar payı dahil edilmiş). */
  ax: number;
  ay: number;
}

/**
 * Raf paketleme: yüksekten alçağa, satır satır (eşit yükseklikte giriş sırası korunur). Yerleşim yalnız boyutlara
 * bağlıdır; görseller sonradan, istendikçe kendi yerlerine çizilir ve atlas büyümez ya da yeniden dizilmez.
 */
export function packAtlas(
  boxes: readonly AtlasBox[],
  width: number,
  pad: number,
): { slots: AtlasSlot[]; height: number } {
  const order = boxes.map((_, i) => i).sort((a, b) => (boxes[b]?.h ?? 0) - (boxes[a]?.h ?? 0));
  const slots: AtlasSlot[] = new Array(boxes.length);
  let px = 0;
  let py = 0;
  let rowH = 0;
  for (const i of order) {
    const b = boxes[i];
    if (!b) continue;
    if (px + b.w + pad * 2 > width) {
      px = 0;
      py += rowH + pad * 2;
      rowH = 0;
    }
    slots[i] = { ax: px + pad, ay: py + pad };
    px += b.w + pad * 2;
    rowH = Math.max(rowH, b.h);
  }
  return { slots, height: py + rowH + pad * 2 };
}
