/** Oyun dünyası arka planı: /assets/worlds/<oyun>-<portrait|landscape>.webp (dikey 720x1280, yatay 1280x720). */
export type WorldOrientation = "portrait" | "landscape";

export const worldSrc = (gameId: string, o: WorldOrientation): string => `/assets/worlds/${gameId}-${o}.webp`;

/** Çok düşük belleği olan ya da veri tasarrufu isteyen cihazlarda arka plan hiç yüklenmez. */
export function worldAllowed(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  if (nav.deviceMemory !== undefined && nav.deviceMemory <= 2) return false;
  if (nav.connection?.saveData === true) return false;
  try {
    if (window.matchMedia("(prefers-reduced-data: reduce)").matches) return false;
  } catch {
    // desteklenmiyor
  }
  return true;
}

export function currentWorldOrientation(): WorldOrientation {
  return window.innerHeight >= window.innerWidth ? "portrait" : "landscape";
}

const started = new Set<string>();
const keep: HTMLImageElement[] = [];

/** Anlatım başlarken bu yöndeki dünya görselini önden indirir (engellemez). */
export function preloadWorld(gameId: string): void {
  if (typeof Image === "undefined" || !worldAllowed()) return;
  const src = worldSrc(gameId, currentWorldOrientation());
  if (started.has(src)) return;
  started.add(src);
  const img = new Image();
  img.decoding = "async";
  img.src = src;
  keep.push(img);
}
