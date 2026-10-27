import { serverNow } from "./store.js";

/**
 * Kare kare akıcı sunucu saati: `performance.now()` üzerine bir sapma ekler. Sunucuyla yeni eşitleme gelince
 * sapma bir anda zıplamaz, kare başına en çok `slewMs` kadar yaklaşır; böylece saate bağlı hareket (ör. kayan
 * blok) titremez. Büyük farkta (ilk kurulum, sekme dönüşü) doğrudan atlar.
 */
export function createSmoothClock(slewMs = 1.5, snapMs = 250): () => number {
  let base = serverNow() - performance.now();
  return () => {
    const target = serverNow() - performance.now();
    const diff = target - base;
    if (Math.abs(diff) > snapMs) base = target;
    else base += Math.max(-slewMs, Math.min(slewMs, diff));
    return performance.now() + base;
  };
}
