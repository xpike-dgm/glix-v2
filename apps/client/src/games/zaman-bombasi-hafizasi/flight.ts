/** Bomba fırlatma (ZB-U1): iki nokta arasında yay çizen uçuşun anahtar kareleri (yalnız transform). */

/** Uçuş süresi (ms); "SIRA SENDE!" uyarısı bomba hedefe varınca başlar. */
export const FLIGHT_MS = 650;

export interface Point {
  x: number;
  y: number;
}

/**
 * `from`'dan `to`'ya yay: yatay doğrusal, dikeyde yukarı doğru parabol (tepe yüksekliği mesafeyle büyür).
 * `from` yoksa (atan yok) bomba hedefin üstünde belirir ve yerine oturur. Dönen kareler `Element.animate` içindir.
 */
export function flightFrames(from: Point | null, to: Point, steps = 10): Keyframe[] {
  if (!from) {
    return [
      { transform: `translate(${to.x}px, ${to.y - 40}px) scale(0.2)`, opacity: 0 },
      { transform: `translate(${to.x}px, ${to.y - 12}px) scale(1.25)`, opacity: 1, offset: 0.6 },
      { transform: `translate(${to.x}px, ${to.y}px) scale(1)`, opacity: 1 },
    ];
  }
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  const peak = Math.min(220, 40 + dist * 0.45);
  const frames: Keyframe[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = from.x + (to.x - from.x) * t;
    const y = from.y + (to.y - from.y) * t - peak * 4 * t * (1 - t);
    const rot = 540 * t;
    const scale = 1 + 0.5 * Math.sin(Math.PI * t);
    frames.push({
      transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${rot.toFixed(0)}deg) scale(${scale.toFixed(2)})`,
      opacity: 1,
      offset: t,
    });
  }
  return frames;
}

/** Bir öğenin, kapsayıcısına göre merkezi (uçan bombanın sol üstü kapsayıcının sol üstündedir). */
export function centerIn(el: Element, box: Element): Point {
  const r = el.getBoundingClientRect();
  const b = box.getBoundingClientRect();
  return { x: r.left + r.width / 2 - b.left, y: r.top + r.height / 2 - b.top };
}
