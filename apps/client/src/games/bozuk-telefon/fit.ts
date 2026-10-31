/**
 * Yazı sığdırma (BT-U2): kelimeler ortasından bölünmez; yazı kutuya sığana kadar küçülür. Tek bir kelime en küçük
 * boyutta bile kutudan genişse (örn. 60 harflik tek kelime) son çare olarak harf sınırında kırılır.
 */

/** `fits(size)` doğru olan en büyük boyutu ikili aramayla bulur (tam sayı px, [min, max]). Hiçbiri sığmazsa min. */
export function largestFit(fits: (size: number) => boolean, min: number, max: number): number {
  const lo0 = Math.max(1, Math.floor(Math.min(min, max)));
  const hi0 = Math.max(lo0, Math.floor(max));
  if (fits(hi0)) return hi0;
  let lo = lo0;
  let hi = hi0;
  if (!fits(lo)) return lo;
  // Değişmez: fits(lo) doğru, fits(hi) yanlış.
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (fits(mid)) lo = mid;
    else hi = mid;
  }
  return lo;
}

/**
 * Kutudaki yazı taşıyor mu: genişlik yazının kendi kutusuna (uzun kelime taşarsa `scrollWidth` büyür), yükseklik
 * dış kutunun iç (dolgusuz) yüksekliğine göre ölçülür.
 */
export function overflows(inner: HTMLElement, outer: HTMLElement): boolean {
  const cs = getComputedStyle(outer);
  const padX = (Number.parseFloat(cs.paddingLeft) || 0) + (Number.parseFloat(cs.paddingRight) || 0);
  const padY = (Number.parseFloat(cs.paddingTop) || 0) + (Number.parseFloat(cs.paddingBottom) || 0);
  const width = Math.min(inner.clientWidth, outer.clientWidth - padX);
  return inner.scrollWidth > width + 1 || inner.scrollHeight > outer.clientHeight - padY + 1;
}

/** Daktilo: `elapsed` ms'de görünen harf sayısı (Unicode kod noktası). Toplam süre metin boyuna göre, en çok `maxMs`. */
export function typedCount(text: string, elapsed: number, maxMs: number, perCharMs = 45): number {
  const n = Array.from(text).length;
  if (n === 0) return 0;
  const total = Math.min(maxMs, n * perCharMs);
  if (elapsed >= total) return n;
  return Math.max(0, Math.min(n, Math.floor((elapsed / total) * n)));
}

/** Metnin ilk `count` kod noktası (daktilo görünen kısmı). */
export function headOf(text: string, count: number): string {
  return Array.from(text).slice(0, Math.max(0, count)).join("");
}
