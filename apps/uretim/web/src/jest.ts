/** Telefonda kaydırma jestleri (UM-U5): sağa onay, sola ret, yukarı düzeltme. Saf karar işlevi (testli). */

export type JestKarari = "onay" | "ret" | "duzeltme" | null;

export const JEST_ESIGI = 96;
export const JEST_HIZ_ESIGI = 0.6;

/**
 * dx/dy: parmağın toplam kayması (px), ms: süre. Belirgin yatay kayma ya da hızlı fiske karar verir; dikeyde
 * yalnız yukarı ve yataydan baskınsa düzeltme. Kararsız hareket `null` (kart yerine döner).
 */
export function jestKarari(dx: number, dy: number, ms: number): JestKarari {
  const hizX = Math.abs(dx) / Math.max(ms, 1);
  const hizY = Math.abs(dy) / Math.max(ms, 1);
  const yatay = Math.abs(dx) > Math.abs(dy) * 1.2;
  const dikey = Math.abs(dy) > Math.abs(dx) * 1.2;
  if (yatay && (Math.abs(dx) >= JEST_ESIGI || (hizX >= JEST_HIZ_ESIGI && Math.abs(dx) > 32)))
    return dx > 0 ? "onay" : "ret";
  if (dikey && dy < 0 && (-dy >= JEST_ESIGI || (hizY >= JEST_HIZ_ESIGI && -dy > 32))) return "duzeltme";
  return null;
}

/** Sürüklerken gösterilecek ipucu ve yoğunluğu (0..1). */
export function jestIpucu(dx: number, dy: number): { karar: JestKarari; guc: number } {
  if (Math.abs(dx) > Math.abs(dy))
    return { karar: dx > 0 ? "onay" : "ret", guc: Math.min(1, Math.abs(dx) / JEST_ESIGI) };
  if (dy < 0) return { karar: "duzeltme", guc: Math.min(1, -dy / JEST_ESIGI) };
  return { karar: null, guc: 0 };
}
