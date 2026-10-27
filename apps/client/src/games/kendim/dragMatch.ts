/**
 * Kendim sürükle-bırak eşleştirme: saf vuruş testi. Kart parmakla oyuncu avatarının üstüne taşınır;
 * hangi avatarın hedef sayılacağı burada, ekran koordinatlarıyla hesaplanır (DOM'dan bağımsız, test edilebilir).
 */

export interface DropTarget {
  id: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Parmak bu kadar pikselden fazla kayarsa dokunuş değil sürükleme sayılır. */
export const DRAG_START_PX = 8;
/** Hedefin çevresindeki tolerans (px): parmak ucu avatara tam denk gelmek zorunda değil. */
export const DROP_SLOP_PX = 14;

/** Başlangıçtan bu yana kayma sürükleme eşiğini aştı mı. */
export function exceedsDragThreshold(dx: number, dy: number, threshold = DRAG_START_PX): boolean {
  return Math.hypot(dx, dy) > threshold;
}

/**
 * (x, y) noktasının düştüğü hedef. Tolerans payı içinde birden çok hedef varsa merkezi en yakın olan seçilir;
 * hiçbiri değilse null.
 */
export function hitTest(
  x: number,
  y: number,
  targets: readonly DropTarget[],
  slop = DROP_SLOP_PX,
): string | null {
  let best: string | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const t of targets) {
    if (x < t.left - slop || x > t.right + slop || y < t.top - slop || y > t.bottom + slop) continue;
    const d = Math.hypot(x - (t.left + t.right) / 2, y - (t.top + t.bottom) / 2);
    if (d < bestDist) {
      bestDist = d;
      best = t.id;
    }
  }
  return best;
}

/** Sürüklenen kartın hayaleti ekranın dışına taşmasın. */
export function clampToViewport(
  x: number,
  y: number,
  vw: number,
  vh: number,
  margin = 8,
): { x: number; y: number } {
  return {
    x: Math.min(Math.max(x, margin), Math.max(margin, vw - margin)),
    y: Math.min(Math.max(y, margin), Math.max(margin, vh - margin)),
  };
}
