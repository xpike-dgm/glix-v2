function vibrate(pattern: number | number[]): void {
  try {
    if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
    // Tarayıcı kullanıcı dokunmadan titreşimi engeller (konsola uyarı yazar).
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
    navigator.vibrate(pattern);
  } catch {
    // desteklenmiyor
  }
}

export const hapticTap = (): void => vibrate(10);
export const hapticMatch = (): void => vibrate([14, 40, 14]);
export const hapticSolo = (): void => vibrate(45);
