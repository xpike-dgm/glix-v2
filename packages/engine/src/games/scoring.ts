export interface RankAwardOptions {
  /** true ise yalnız mini puanı 0'dan büyük olanlar ödül alabilir (kimse puan almadıysa ödül yok). */
  positiveOnly?: boolean;
}

/**
 * Sıralamaya göre genel skor ödülü (eski createRankAwards ile aynı): tek lider +2 ve sıradaki puanı paylaşanların
 * hepsi +1; lider eşitse yalnız liderler +1.
 */
export function rankAwards(
  scores: Record<string, number>,
  opts: RankAwardOptions = {},
): Record<string, number> {
  const entries = Object.entries(scores).filter(([, s]) => !opts.positiveOnly || s > 0);
  const awards: Record<string, number> = {};
  if (entries.length === 0) return awards;
  const top = Math.max(...entries.map(([, s]) => s));
  const leaders = entries.filter(([, s]) => s === top).map(([id]) => id);
  if (leaders.length > 1) {
    for (const id of leaders) awards[id] = 1;
    return awards;
  }
  const leader = leaders[0];
  if (leader === undefined) return awards;
  awards[leader] = 2;
  const below = entries.filter(([, s]) => s < top).map(([, s]) => s);
  if (below.length === 0) return awards;
  const next = Math.max(...below);
  for (const [id, s] of entries) if (s === next) awards[id] = 1;
  return awards;
}
