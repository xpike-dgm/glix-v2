import type { PlayerInfo } from "@glix/engine";

export interface RankedPlayer {
  player: PlayerInfo;
  score: number;
  /** Eşit puan aynı sırayı paylaşır (1, 1, 3). */
  rank: number;
}

/** Puana göre azalan sıralama; eşitlikte oda sırası korunur. */
export function rankPlayers(
  players: readonly PlayerInfo[],
  scoreOf: (p: PlayerInfo) => number | undefined,
): RankedPlayer[] {
  const rows = players
    .map((player, order) => ({ player, order, score: scoreOf(player) }))
    .filter((r): r is { player: PlayerInfo; order: number; score: number } => r.score !== undefined)
    .sort((a, b) => b.score - a.score || a.order - b.order);
  let rank = 0;
  let prev: number | null = null;
  return rows.map((r, i) => {
    if (prev === null || r.score !== prev) rank = i + 1;
    prev = r.score;
    return { player: r.player, score: r.score, rank };
  });
}

/** En yüksek genel skoru paylaşanların hepsi kazanandır. */
export function winnersOf(ranked: readonly RankedPlayer[]): RankedPlayer[] {
  return ranked.filter((r) => r.rank === 1);
}

/** Podyum sırası: 2 · 1 · 3 (soldan sağa). */
export function podiumOrder<T>(top: readonly T[]): T[] {
  const [first, second, third] = top;
  if (first === undefined) return [];
  if (second === undefined) return [first];
  if (third === undefined) return [second, first];
  return [second, first, third];
}
