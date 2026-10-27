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

/** Oyun kartındaki alt yazı: yeterli kişi yoksa "en az N kişi", varsa oyuncu aralığı. */
export function gameTag(game: GameInfo, connected: number): string {
  return game.minPlayers > connected
    ? `en az ${game.minPlayers} kişi`
    : `${game.minPlayers}–${game.maxPlayers} oyuncu`;
}

/** Şu an yeterli oyuncu yok mu (kart soluk görünür ama seçilebilir). */
export function isGameDim(game: GameInfo, connected: number): boolean {
  return game.minPlayers > connected;
}

/** Oyuncu olmayanlar için salt okunur özet: "Bu gece: 3 oyun" ya da "Rastgele · 5". */
export function selectionSummary(
  mode: "random" | "manual",
  randomCount: number,
  selectedCount: number,
): string {
  return mode === "random" ? `Rastgele · ${randomCount}` : `Bu gece: ${selectedCount} oyun`;
}
