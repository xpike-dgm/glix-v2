import { createRequire } from "node:module";
import type { DatabaseSync } from "node:sqlite";
import type { AdminMailKind, PerfMeta, PerfSample } from "@glix/engine";
import { log } from "./log.js";
import { createStatsReader, type StatsReader } from "./statsAdmin.js";

/** İstatistik satırları bu süreden sonra silinir (docs/PROTOKOL.md). */
export const RETENTION_MS = 90 * 24 * 3600 * 1000;
export const PURGE_EVERY_MS = 24 * 3600 * 1000;
export const SCHEMA_VERSION = 5;

export type GameOutcome = "finished" | "aborted" | "failed";

export interface MatchStart {
  playerCount: number;
  selectionMode: "manual" | "random";
  gameCount: number;
}

/** Kalıcı istemci hata satırı: hepsi temizlenmiş/kısaltılmıştır (bkz. errorScrub.ts); kişi bilgisi içermez. */
export interface ClientErrorRecord {
  message: string;
  /** Yığının tepe karesi: `işlev dosya:satır:sütun` (dosya adı yalnız taban ad). */
  frame: string;
  platform: "ios" | "android" | "diger";
  browser: string;
  version: string;
}

/** Çöken oyun satırı: oyun, çöken işlev ve kısaltılmış hata metni. Maç kaydı (eylemler) ASLA yazılmaz. */
export interface GameFailureRecord {
  gameId: string | null;
  fn: string;
  message: string;
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
  /** Anonim istemci performans özeti (oyun başına oyuncu başına en çok bir). */
  perf(matchId: number | null, gameId: string, now: number, sample: PerfSample & Partial<PerfMeta>): void;
  /** İstemci hatasını gün başına gruplayarak sayar (aynı gün + aynı hata + aynı platform/tarayıcı/sürüm = tek satır). */
  clientError(now: number, rec: ClientErrorRecord): void;
  /** Çöken oyunu kaydeder (yönetici paneli "çöken oyunlar"). */
  gameFailure(now: number, rec: GameFailureRecord): void;
  /** E-posta gönderim denemesini gün/tür başına sayar (adres tutulmaz); `ok` = servis kabul etti. */
  mailSent(now: number, kind: AdminMailKind, ok: boolean): void;
  /** Yönetici paneli için salt okunur toplamlar; istatistik kapalıysa null. */
  readonly reader: StatsReader | null;
  /** `now - 90 gün`den eski satırları siler. */
  purge(now: number): void;
  /** Veritabanı dosya yolu (":memory:" olabilir); kapalıysa null. */
  readonly path: string | null;
  /** Veritabanının tutarlı bir kopyasını `dest` dosyasına yazar (`VACUUM INTO`). Kapalıysa fırlatır. */
  snapshotTo(dest: string): void;
  close(): void;
}

export const noopStats: StatsStore = {
  enabled: false,
  matchStarted: () => null,
  gamePlayed: () => {},
  matchEnded: () => {},
  feedback: () => {},
  perf: () => {},
  clientError: () => {},
  gameFailure: () => {},
  mailSent: () => {},
  reader: null,
  purge: () => {},
  path: null,
  snapshotTo: () => {
    throw new Error("istatistik kapalı");
  },
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
  `CREATE TABLE perf (
     match_id INTEGER,
     game_id TEXT NOT NULL,
     created_at INTEGER NOT NULL,
     rtt_ms INTEGER NOT NULL,
     ack_p50 INTEGER NOT NULL,
     ack_p95 INTEGER NOT NULL,
     ack_n INTEGER NOT NULL,
     slow_taps INTEGER NOT NULL,
     tap_p95 INTEGER NOT NULL,
     long_tasks INTEGER NOT NULL,
     long_task_ms INTEGER NOT NULL
   );
   CREATE INDEX perf_created_at ON perf (created_at);`,
  // iOS ayrı grup: platform (ios/android/diger), oyun başına kopma ve sekme oturumu başına sayfa yenileme.
  `ALTER TABLE perf ADD COLUMN platform TEXT NOT NULL DEFAULT 'diger';
   ALTER TABLE perf ADD COLUMN reconnects INTEGER NOT NULL DEFAULT 0;
   ALTER TABLE perf ADD COLUMN reloads INTEGER NOT NULL DEFAULT 0;`,
  // Yönetici paneli (U16 A1): istemci hataları gün başına gruplu sayaç; çöken oyunlar (kayıt içeriği yok). 90 gün.
  `CREATE TABLE client_errors (
     day INTEGER NOT NULL,
     message TEXT NOT NULL,
     frame TEXT NOT NULL,
     platform TEXT NOT NULL,
     browser TEXT NOT NULL,
     version TEXT NOT NULL,
     count INTEGER NOT NULL,
     first_seen INTEGER NOT NULL,
     last_seen INTEGER NOT NULL,
     PRIMARY KEY (day, message, frame, platform, browser, version)
   ) WITHOUT ROWID;
   CREATE TABLE game_failures (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     game_id TEXT,
     fn TEXT NOT NULL,
     message TEXT NOT NULL,
     at INTEGER NOT NULL
   );
   CREATE INDEX game_failures_at ON game_failures (at);`,
  // Yönetici paneli (U16 A2): e-posta gönderim sayaçları. Yalnız gün + tür + sayı; adres, hesap ya da içerik yok. 90 gün.
  `CREATE TABLE mail_stats (
     day INTEGER NOT NULL,
     kind TEXT NOT NULL,
     ok INTEGER NOT NULL DEFAULT 0,
     failed INTEGER NOT NULL DEFAULT 0,
     PRIMARY KEY (day, kind)
   ) WITHOUT ROWID;`,
];

const DAY_MS = 24 * 3600 * 1000;
/** Bir günde saklanan en çok farklı hata satırı (sürekli değişen metinle tabloyu şişirmeyi önler). */
export const MAX_ERROR_ROWS_PER_DAY = 3000;

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
  const insertPerf = db.prepare(
    "INSERT INTO perf (match_id, game_id, created_at, rtt_ms, ack_p50, ack_p95, ack_n, slow_taps, tap_p95, long_tasks, long_task_ms, platform, reconnects, reloads) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const upsertError = db.prepare(
    `INSERT INTO client_errors (day, message, frame, platform, browser, version, count, first_seen, last_seen)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
     ON CONFLICT (day, message, frame, platform, browser, version)
     DO UPDATE SET count = count + 1, last_seen = excluded.last_seen`,
  );
  const errorRowsToday = db.prepare("SELECT COUNT(*) AS n FROM client_errors WHERE day = ?");
  const insertFailure = db.prepare(
    "INSERT INTO game_failures (game_id, fn, message, at) VALUES (?, ?, ?, ?)",
  );
  const upsertMail = db.prepare(
    `INSERT INTO mail_stats (day, kind, ok, failed) VALUES (?, ?, ?, ?)
     ON CONFLICT (day, kind) DO UPDATE SET ok = ok + excluded.ok, failed = failed + excluded.failed`,
  );
  const reader = createStatsReader(db);
  let closed = false;
  return {
    enabled: true,
    reader,
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
    perf: (matchId, gameId, now, p) => {
      if (closed) return;
      guarded("perf", undefined, () => {
        insertPerf.run(
          matchId,
          gameId,
          now,
          p.rttMs,
          p.ackP50,
          p.ackP95,
          p.ackN,
          p.slowTaps,
          p.tapP95,
          p.longTasks,
          p.longTaskMs,
          p.platform ?? "diger",
          p.reconnects ?? 0,
          p.reloads ?? 0,
        );
      });
    },
    clientError: (now, e) => {
      if (closed) return;
      guarded("clientError", undefined, () => {
        const day = Math.floor(now / DAY_MS) * DAY_MS;
        const n = (errorRowsToday.get(day) as { n: number }).n;
        if (n >= MAX_ERROR_ROWS_PER_DAY) return;
        upsertError.run(day, e.message, e.frame, e.platform, e.browser, e.version, now, now);
      });
    },
    gameFailure: (now, f) => {
      if (closed) return;
      guarded("gameFailure", undefined, () => {
        insertFailure.run(f.gameId, f.fn, f.message, now);
      });
    },
    mailSent: (now, kind, ok) => {
      if (closed) return;
      guarded("mailSent", undefined, () => {
        upsertMail.run(Math.floor(now / DAY_MS) * DAY_MS, kind, ok ? 1 : 0, ok ? 0 : 1);
      });
    },
    purge: (now) => {
      if (closed) return;
      guarded("purge", undefined, () => {
        const cut = now - RETENTION_MS;
        db.prepare("DELETE FROM mail_stats WHERE day < ?").run(Math.floor(cut / DAY_MS) * DAY_MS);
        db.prepare("DELETE FROM client_errors WHERE last_seen < ?").run(cut);
        db.prepare("DELETE FROM game_failures WHERE at < ?").run(cut);
        db.prepare("DELETE FROM perf WHERE created_at < ?").run(cut);
        db.prepare("DELETE FROM game_plays WHERE started_at < ?").run(cut);
        db.prepare("DELETE FROM feedback WHERE created_at < ?").run(cut);
        db.prepare("DELETE FROM matches WHERE started_at < ?").run(cut);
      });
    },
    path,
    snapshotTo: (dest) => {
      db.prepare("VACUUM INTO ?").run(dest);
    },
    close: () => {
      if (closed) return;
      closed = true;
      guarded("close", undefined, () => db.close());
    },
  };
}
