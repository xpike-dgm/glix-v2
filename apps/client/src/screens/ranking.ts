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

/** Puan metni: eksi için gerçek eksi işareti (−), sütunlarda hizalı görünsün. */
export function formatScore(n: number): string {
  return n < 0 ? `\u2212${Math.abs(n)}` : String(n);
}

/** Sıralamaya girenler: izleyiciler hariç. */
export function playersOnly(players: readonly PlayerInfo[]): PlayerInfo[] {
  return players.filter((p) => !p.spectator);
}

/** Maçı izleyenler (sıralanmaz). */
export function watchersOf(players: readonly PlayerInfo[]): PlayerInfo[] {
  return players.filter((p) => p.spectator);
}

/** Bu turdan önceki genel puan: şimdiki puandan bu turda eklenen puan çıkarılır (sunucu `result.awards`'ı zaten gönderir). */
export function previousScore(player: PlayerInfo, awards: Readonly<Record<string, number>>): number {
  return player.score - (awards[player.id] ?? 0);
}

/**
 * Tur sonunda genel sıralamadaki değişim: oyuncu kimliği -> önceki sıra eksi yeni sıra
 * (pozitif: yükseldi, negatif: düştü, 0 ya da yok: aynı). Eşit puan aynı sırayı paylaşır.
 */
export function rankDeltas(
  players: readonly PlayerInfo[],
  awards: Readonly<Record<string, number>>,
): Record<string, number> {
  const now = rankPlayers(players, (p) => p.score);
  const before = rankPlayers(players, (p) => previousScore(p, awards));
  const prevRank = new Map(before.map((r) => [r.player.id, r.rank]));
  const out: Record<string, number> = {};
  for (const r of now) {
    const prev = prevRank.get(r.player.id);
    if (prev !== undefined && prev !== r.rank) out[r.player.id] = prev - r.rank;
  }
  return out;
}

/** Sıra değişimi rozeti: "↑2", "↓1"; değişmediyse boş. */
export function deltaLabel(delta: number | undefined): string {
  if (!delta) return "";
  return delta > 0 ? `↑${delta}` : `↓${Math.abs(delta)}`;
}
