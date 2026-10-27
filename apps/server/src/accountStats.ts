import type { AccountStore, CoplayPair, GameRow, MatchRow } from "./accountStore.js";
import { awardAfterMatch } from "./badges.js";
import { log } from "./log.js";

/** Sıralamaya giren bir oyuncu: oyuncu kimliği, varsa hesap kimliği ve puanı. */
export interface Entrant {
  playerId: string;
  /** Misafirde null. */
  accountId: number | null;
  score: number;
  /** Oyun sonucundaki sayaçlar (`GameResult.stats`); yalnız sunucu muhasebesi. */
  stats?: Readonly<Record<string, number>>;
}

/** Biten mini oyunun kaydı; yalnız hesaplı oyuncular satıra dönüşür. */
export interface GameRecord {
  gameId: string;
  endedAt: number;
  rows: GameRow[];
}

/** Biten maçın kaydı. */
export interface MatchRecord {
  endedAt: number;
  rows: MatchRow[];
  pairs: CoplayPair[];
}

/**
 * Sunucunun hesaplı oyuncular için istatistik yazıcısı. `match.ts` yalnız bunu çağırır; testlerde değiştirilir.
 * Uygulamalar hata fırlatmaz (oyun akışı asla bozulmaz).
 */
export interface AccountStatsRecorder {
  gameFinished(record: GameRecord): void;
  matchFinished(record: MatchRecord): void;
}

export const noopAccountStats: AccountStatsRecorder = {
  gameFinished() {},
  matchFinished() {},
};

/** Yüksek puan iyi; eşit puan aynı sırayı paylaşır (1, 1, 3). Kimlik -> sıra. */
export function rankEntrants(entrants: readonly Entrant[]): Map<string, number> {
  const sorted = [...entrants].sort((a, b) => b.score - a.score);
  const ranks = new Map<string, number>();
  let rank = 0;
  let prev: number | null = null;
  sorted.forEach((e, i) => {
    if (prev === null || e.score !== prev) rank = i + 1;
    prev = e.score;
    ranks.set(e.playerId, rank);
  });
  return ranks;
}

/** Aynı hesap iki oyuncu olarak girdiyse yalnız ilki sayılır. */
function accountEntrants(entrants: readonly Entrant[]): (Entrant & { accountId: number })[] {
  const seen = new Set<number>();
  const out: (Entrant & { accountId: number })[] = [];
  for (const e of entrants) {
    if (e.accountId === null || seen.has(e.accountId)) continue;
    seen.add(e.accountId);
    out.push({ ...e, accountId: e.accountId });
  }
  return out;
}

/** Mini oyun kaydı: sıralama tüm girenler (misafir dahil) arasında yapılır, yalnız hesaplılar yazılır. */
export function buildGameRecord(gameId: string, endedAt: number, entrants: readonly Entrant[]): GameRecord {
  const ranks = rankEntrants(entrants);
  return {
    gameId,
    endedAt,
    rows: accountEntrants(entrants).map((e) => ({
      accountId: e.accountId,
      gameId,
      players: entrants.length,
      miniScore: e.score,
      rank: ranks.get(e.playerId) ?? entrants.length,
      ...(e.stats ? { stats: e.stats } : {}),
    })),
  };
}

/** Maç kaydı: yer genel skora göre; hesaplı her çift için birlikte oynama artar. */
export function buildMatchRecord(
  gameCount: number,
  endedAt: number,
  entrants: readonly Entrant[],
): MatchRecord {
  const ranks = rankEntrants(entrants);
  const accounts = accountEntrants(entrants);
  const pairs: CoplayPair[] = [];
  for (let i = 0; i < accounts.length; i++)
    for (let j = i + 1; j < accounts.length; j++)
      pairs.push([
        (accounts[i] as { accountId: number }).accountId,
        (accounts[j] as { accountId: number }).accountId,
      ]);
  return {
    endedAt,
    rows: accounts.map((e) => ({
      accountId: e.accountId,
      players: entrants.length,
      games: gameCount,
      score: e.score,
      place: ranks.get(e.playerId) ?? entrants.length,
    })),
    pairs,
  };
}

/** Yeni rozet kazanıldığında çağrılır (hesap kimliği, rozet kimlikleri). */
export type BadgesEarnedHandler = (accountId: number, badgeIds: string[]) => void;

/**
 * Hesap deposuna yazan yazıcı: tek işlem, hata günlüğe gider. Maç satırı yazıldıktan sonra rozetler değerlendirilir;
 * bu adım ayrı hata yalıtımındadır (rozet hatası maç kaydını ya da oyun akışını bozmaz).
 */
export function createAccountRecorder(
  store: AccountStore,
  onBadges: BadgesEarnedHandler = () => {},
): AccountStatsRecorder {
  return {
    gameFinished(record) {
      if (record.rows.length === 0) return;
      try {
        store.recordGame(record.endedAt, record.rows);
      } catch (err) {
        log.error("accounts_error", { op: "record_game", error: String(err) });
      }
    },
    matchFinished(record) {
      if (record.rows.length === 0) return;
      try {
        store.recordMatch(record.endedAt, record.rows, record.pairs);
      } catch (err) {
        log.error("accounts_error", { op: "record_match", error: String(err) });
        return;
      }
      for (const row of record.rows) {
        try {
          const ids = awardAfterMatch(store, row.accountId, {
            endedAt: record.endedAt,
            players: row.players,
            place: row.place,
            won: row.place === 1,
          });
          if (ids.length > 0) onBadges(row.accountId, ids);
        } catch (err) {
          log.error("accounts_error", { op: "badges", error: String(err) });
        }
      }
    },
  };
}
