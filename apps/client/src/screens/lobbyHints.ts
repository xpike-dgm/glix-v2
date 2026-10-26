import type { GameInfo } from "@glix/engine";

/**
 * Başlamak için gereken en az oyuncu sayısı, gerçek oyun listesinden hesaplanır.
 * Rastgele modda en küçük alt sınırlı oyun yeter; el ile modda seçilenlerin en büyük alt sınırı gerekir.
 */
export function minPlayersNeeded(
  catalog: readonly GameInfo[],
  mode: "random" | "manual",
  selected: readonly GameInfo[],
): number {
  const pool = mode === "random" || selected.length === 0 ? catalog : selected;
  if (pool.length === 0) return 1;
  const mins = pool.map((g) => g.minPlayers);
  return mode === "random" || selected.length === 0 ? Math.min(...mins) : Math.max(...mins);
}

/** "Bir arkadaş daha" / "N arkadaş daha gelince başlayabilirsin". */
export function friendsHint(missing: number): string {
  return missing <= 1
    ? "Bir arkadaş daha gelince başlayabilirsin"
    : `${missing} arkadaş daha gelince başlayabilirsin`;
}

/** "1/8 oyuncu · en az 2 gerekli". */
export function playerCounter(count: number, max: number, min: number): string {
  return `${count}/${max} oyuncu · en az ${min} gerekli`;
}
