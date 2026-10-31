import { KARALAMA_ERASER_INDEX, type KaralamaStroke } from "@glix/engine";

/** Yeniden çizimin üst süresi (BT-U1: en çok 1,5 sn). */
export const REPLAY_MAX_MS = 1_500;
const REPLAY_MIN_MS = 500;
const MS_PER_POINT = 4;

const isEraser = (s: KaralamaStroke): boolean => s[0] === KARALAMA_ERASER_INDEX;
const pointsOf = (s: KaralamaStroke): number => (s.length - 2) / 2;

/** Kalem (silgi olmayan) noktalarının toplamı. */
export function inkPoints(strokes: readonly KaralamaStroke[]): number {
  let n = 0;
  for (const s of strokes) if (!isEraser(s)) n += pointsOf(s);
  return n;
}

/** Çizimin yeniden çizilme süresi: nokta sayısıyla orantılı, 0,5–1,5 sn; boş çizimde 0. */
export function replayMs(strokes: readonly KaralamaStroke[]): number {
  const n = inkPoints(strokes);
  if (n === 0) return 0;
  return Math.min(REPLAY_MAX_MS, Math.max(REPLAY_MIN_MS, n * MS_PER_POINT));
}

/**
 * Yeniden çizimin `fraction` (0..1) anındaki darbeleri, çizildikleri sırayla. Kalem darbeleri sırayla açılır
 * (yarım kalan kısaltılır); silgi darbeleri baştan tam uygulanır. Böylece sonradan silinen mürekkep yeniden çizim
 * sırasında hiç görünmez (geri alınan darbeler zaten çizimde yoktur), son kare bitmiş resimle aynıdır.
 */
export function replayFrame(strokes: readonly KaralamaStroke[], fraction: number): KaralamaStroke[] {
  if (fraction >= 1) return [...strokes];
  const total = inkPoints(strokes);
  let left = fraction <= 0 ? 0 : Math.ceil(total * fraction);
  const out: KaralamaStroke[] = [];
  for (const s of strokes) {
    if (isEraser(s)) {
      out.push(s);
      continue;
    }
    if (left <= 0) continue;
    const n = pointsOf(s);
    if (n <= left) {
      out.push(s);
      left -= n;
    } else {
      out.push(s.slice(0, 2 + Math.max(2, left) * 2));
      left = 0;
    }
  }
  return out;
}
