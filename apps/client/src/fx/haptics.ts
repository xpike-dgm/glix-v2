type Pattern = number | readonly number[];

function reducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** Azaltılmış harekette titreşimler yarıya iner (en az 6 ms); aralar aynı kalır. */
export function shapePattern(pattern: Pattern, reduced: boolean): number[] {
  const list = typeof pattern === "number" ? [pattern] : [...pattern];
  if (!reduced) return list;
  return list.map((ms, i) => (i % 2 === 0 ? Math.max(6, Math.round(ms / 2)) : ms));
}

function vibrate(pattern: Pattern): void {
  try {
    if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
    // Tarayıcı kullanıcı dokunmadan titreşimi engeller (konsola uyarı yazar).
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
    navigator.vibrate(shapePattern(pattern, reducedMotion()));
  } catch {
    // desteklenmiyor
  }
}

/** Ses olaylarıyla aynı adlar; her biri `sound.ts`'teki karşılığının titreşim eşleniği. */
export const hapticTap = (): void => vibrate(10);
export const hapticReady = (): void => vibrate([12, 30, 24]);
export const hapticTick = (): void => vibrate(6);
export const hapticGo = (): void => vibrate(32);
export const hapticMatch = (): void => vibrate([14, 40, 14]);
export const hapticSolo = (): void => vibrate(45);
export const hapticResult = (): void => vibrate([10, 50, 10, 50, 22]);
export const hapticFinal = (): void => vibrate([20, 60, 20, 60, 20, 60, 70]);
export const hapticError = (): void => vibrate([30, 60, 30]);
