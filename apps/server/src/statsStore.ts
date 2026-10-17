import { createRequire } from "node:module";
import type { DatabaseSync } from "node:sqlite";
import { log } from "./log.js";

/** İstatistik satırları bu süreden sonra silinir (docs/PROTOKOL.md). */
export const RETENTION_MS = 90 * 24 * 3600 * 1000;
export const PURGE_EVERY_MS = 24 * 3600 * 1000;
export const SCHEMA_VERSION = 1;

export type GameOutcome = "finished" | "aborted" | "failed";

export interface MatchStart {
  playerCount: number;
  selectionMode: "manual" | "random";
  gameCount: number;
}

export interface GamePlay {
  gameId: string;
  playerCount: number;
  startedAt: number;
  durationMs: number;
  outcome: GameOutcome;
}

/**
 * İstatistik deposu. Kişisel veri tutmaz (takma ad, kimlik, IP, belirteç, cevap, çizim yok).
 * Her yazma küçük ve eşzamanlıdır; hata maçı bozmaz (`stats_error` günlüğü).
 */
export interface StatsStore {
  readonly enabled: boolean;
  /** Maçı kaydeder; kimliğini döner (devre dışıysa/hata varsa null). */
  matchStarted(now: number, info: MatchStart): number | null;
  gamePlayed(matchId: number | null, play: GamePlay): void;
  matchEnded(matchId: number | null, now: number, completed: boolean): void;
  feedback(matchId: number | null, now: number, rating: number, text: string | null): void;
  /** `now - 90 gün`den eski satırları siler. */
  purge(now: number): void;
  close(): void;
}

export const noopStats: StatsStore = {
  enabled: false,
  matchStarted: () => null,
  gamePlayed: () => {},
  matchEnded: () => {},
  feedback: () => {},
  purge: () => {},
  close: () => {},
};

const MIGRATIONS: readonly string[] = [
  `CREATE TABLE matches (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     started_at INTEGER NOT NULL,
     ended_at INTEGER,
     player_count INTEGER NOT NULL,
     selection_mode TEXT NOT NULL,
     game_count INTEGER NOT NULL,
     completed INTEGER NOT NULL DEFAULT 0
   );
   CREATE TABLE game_plays (
     match_id INTEGER NOT NULL,
     game_id TEXT NOT NULL,
     player_count INTEGER NOT NULL,
     started_at INTEGER NOT NULL,
     duration_ms INTEGER NOT NULL,
     outcome TEXT NOT NULL
   );
   CREATE TABLE feedback (
     match_id INTEGER,
     rating INTEGER NOT NULL,
     text TEXT,
     created_at INTEGER NOT NULL
   );
   CREATE INDEX matches_started_at ON matches (started_at);
   CREATE INDEX game_plays_started_at ON game_plays (started_at);
   CREATE INDEX feedback_created_at ON feedback (created_at);`,
];

type SqliteModule = typeof import("node:sqlite");

/**
 * `node:sqlite` Node 22'de deneysel uyarısı basar. Yükleme anında yalnız bu uyarı bastırılır
 * (süreç genelinde dinleyici kaldırılmaz; `emitWarning` hemen geri konur). Başka uyarılar etkilenmez.
 */
export function loadSqlite(): SqliteModule {
  const original = process.emitWarning;
  process.emitWarning = ((warning: string | Error, ...rest: unknown[]) => {
    const text = typeof warning === "string" ? warning : warning.message;
    if (/SQLite/i.test(text)) return;
    (original as (...a: unknown[]) => void).call(process, warning, ...rest);
  }) as typeof process.emitWarning;
  try {
    return createRequire(import.meta.url)("node:sqlite") as SqliteModule;
  } finally {
    process.emitWarning = original;
  }
}

/** Veritabanını açar ve göçleri uygular (`schema_version` tablosu). */
export function openDatabase(path: string): DatabaseSync {
  const { DatabaseSync: Db } = loadSqlite();
  const db = new Db(path);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA busy_timeout = 2000;");
  db.exec("CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)");
  const row = db.prepare("SELECT MAX(version) AS v FROM schema_version").get() as
    | { v: number | null }
    | undefined;
  let version = row?.v ?? 0;
  while (version < MIGRATIONS.length) {
    const sql = MIGRATIONS[version] as string;
    db.exec("BEGIN");
    try {
      db.exec(sql);
      version += 1;
      db.prepare("INSERT INTO schema_version (version) VALUES (?)").run(version);
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
  }
  return db;
}

function guarded<T>(what: string, fallback: T, fn: () => T): T {
  try {
    return fn();
  } catch (err) {
    log.error("stats_error", { op: what, error: String(err) });
    return fallback;
  }
}

/** `path` ":memory:" veya dosya yolu olabilir; boşsa devre dışı. Açılamazsa devre dışı kalır (sunucu başlar). */
export function createStats(path: string | undefined | null): StatsStore {
  if (!path) return noopStats;
  let db: DatabaseSync;
  try {
    db = openDatabase(path);
  } catch (err) {
    log.error("stats_error", { op: "open", error: String(err) });
    return noopStats;
  }
  const insertMatch = db.prepare(
    "INSERT INTO matches (started_at, player_count, selection_mode, game_count) VALUES (?, ?, ?, ?)",
  );
  const endMatch = db.prepare(
    "UPDATE matches SET ended_at = ?, completed = ? WHERE id = ? AND ended_at IS NULL",
  );
  const insertPlay = db.prepare(
    "INSERT INTO game_plays (match_id, game_id, player_count, started_at, duration_ms, outcome) VALUES (?, ?, ?, ?, ?, ?)",
  );
  const insertFeedback = db.prepare(
    "INSERT INTO feedback (match_id, rating, text, created_at) VALUES (?, ?, ?, ?)",
  );
  let closed = false;
  return {
    enabled: true,
    matchStarted: (now, info) =>
      closed
        ? null
        : guarded("matchStarted", null, () =>
            Number(
              insertMatch.run(now, info.playerCount, info.selectionMode, info.gameCount).lastInsertRowid,
            ),
          ),
    gamePlayed: (matchId, p) => {
      if (closed || matchId === null) return;
      guarded("gamePlayed", undefined, () => {
        insertPlay.run(
          matchId,
          p.gameId,
          p.playerCount,
          p.startedAt,
          Math.max(0, Math.round(p.durationMs)),
          p.outcome,
        );
      });
    },
    matchEnded: (matchId, now, completed) => {
      if (closed || matchId === null) return;
      guarded("matchEnded", undefined, () => {
        endMatch.run(now, completed ? 1 : 0, matchId);
      });
    },
    feedback: (matchId, now, rating, text) => {
      if (closed) return;
      guarded("feedback", undefined, () => {
        insertFeedback.run(matchId, rating, text, now);
      });
    },
    purge: (now) => {
      if (closed) return;
      guarded("purge", undefined, () => {
        const cut = now - RETENTION_MS;
        db.prepare("DELETE FROM game_plays WHERE started_at < ?").run(cut);
        db.prepare("DELETE FROM feedback WHERE created_at < ?").run(cut);
        db.prepare("DELETE FROM matches WHERE started_at < ?").run(cut);
      });
    },
    close: () => {
      if (closed) return;
      closed = true;
      guarded("close", undefined, () => db.close());
    },
  };
}
