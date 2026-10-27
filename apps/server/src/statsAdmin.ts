/**
 * Yönetici paneli için anonim istatistik tablolarından salt okunur toplamlar (U16 A1).
 * Hepsi sınırlı sonuç döner (LIMIT); kişi bilgisi bu tablolarda zaten yoktur.
 */
import type { DatabaseSync } from "node:sqlite";
import type { AdminAccounts, AdminErrors, AdminMailCount, AdminMailKind, AdminStats } from "@glix/engine";

const DAY_MS = 24 * 3600 * 1000;
const RETENTION_DAYS = 90;
const DAILY_DAYS = 30;
const WEEKLY_WEEKS = 8;
const PERF_ROWS = 20_000;

export type StatsPart = Omit<AdminStats, "accounts">;
export type ErrorsPart = Omit<AdminErrors, "enabled">;

export type MailPart = Omit<AdminAccounts["mail"], "enabled">;

export interface StatsReader {
  stats(now: number): StatsPart;
  errors(now: number): ErrorsPart;
  /** Son 30 günün e-posta gönderim sayaçları (sıfırlar dahil, eskiden yeniye). */
  mail(now: number): MailPart;
}

const MAIL_KINDS: readonly AdminMailKind[] = ["verify", "reset", "admin"];
const MAIL_DAYS = 30;

type Row = Record<string, number | string | null>;
const num = (v: unknown): number => (typeof v === "number" ? v : 0);
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const round1 = (n: number): number => Math.round(n * 10) / 10;
const round2 = (n: number): number => Math.round(n * 100) / 100;

export const dayLabel = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

function p95(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil(s.length * 0.95) - 1)] as number;
}
function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor((s.length - 1) / 2)] as number;
}
const mean = (xs: number[]): number => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);

export function createStatsReader(db: DatabaseSync): StatsReader {
  const all = (sql: string, ...args: number[]): Row[] => db.prepare(sql).all(...args) as Row[];

  return {
    mail(now) {
      const today = Math.floor(now / DAY_MS);
      const rows = all(
        "SELECT day, kind, ok, failed FROM mail_stats WHERE day >= ? LIMIT 500",
        (today - (MAIL_DAYS - 1)) * DAY_MS,
      );
      const byKey = new Map(rows.map((r) => [`${num(r.day)}:${str(r.kind)}`, r]));
      const totals: Record<AdminMailKind, AdminMailCount> = {
        verify: { ok: 0, failed: 0 },
        reset: { ok: 0, failed: 0 },
        admin: { ok: 0, failed: 0 },
      };
      const days = Array.from({ length: MAIL_DAYS }, (_, i) => {
        const d = today - (MAIL_DAYS - 1 - i);
        const count = (kind: AdminMailKind): AdminMailCount => {
          const r = byKey.get(`${d * DAY_MS}:${kind}`);
          const c = { ok: num(r?.ok), failed: num(r?.failed) };
          totals[kind].ok += c.ok;
          totals[kind].failed += c.failed;
          return c;
        };
        return {
          day: dayLabel(d * DAY_MS),
          verify: count(MAIL_KINDS[0] as AdminMailKind),
          reset: count(MAIL_KINDS[1] as AdminMailKind),
          admin: count(MAIL_KINDS[2] as AdminMailKind),
        };
      });
      return { days, totals };
    },
    stats(now) {
      const today = Math.floor(now / DAY_MS);
      const since = now - RETENTION_DAYS * DAY_MS;

      // Günlük: son 56 gün tek sorguda; 30 günü günlük grafik, 8 haftayı haftalık toplam için kullanılır.
      const dayRows = all(
        `SELECT CAST(started_at / ${DAY_MS} AS INTEGER) AS d, COUNT(*) AS m, COALESCE(SUM(player_count), 0) AS p
           FROM matches WHERE started_at >= ? GROUP BY d`,
        (today - WEEKLY_WEEKS * 7 + 1) * DAY_MS,
      );
      const byDay = new Map(dayRows.map((r) => [num(r.d), { m: num(r.m), p: num(r.p) }]));
      const daily = Array.from({ length: DAILY_DAYS }, (_, i) => {
        const d = today - (DAILY_DAYS - 1 - i);
        const v = byDay.get(d);
        return { day: dayLabel(d * DAY_MS), matches: v?.m ?? 0, players: v?.p ?? 0 };
      });
      const weekly = Array.from({ length: WEEKLY_WEEKS }, (_, i) => {
        const last = today - (WEEKLY_WEEKS - 1 - i) * 7;
        let matches = 0;
        let players = 0;
        for (let d = last - 6; d <= last; d++) {
          matches += byDay.get(d)?.m ?? 0;
          players += byDay.get(d)?.p ?? 0;
        }
        return { weekStart: dayLabel((last - 6) * DAY_MS), matches, players };
      });

      const playerCounts = all(
        `SELECT player_count AS n, COUNT(*) AS m FROM matches WHERE started_at >= ?
           GROUP BY player_count ORDER BY player_count LIMIT 20`,
        since,
      ).map((r) => ({ players: num(r.n), matches: num(r.m) }));

      const ratings = new Map(
        all(
          `SELECT gp.game_id AS id, AVG(f.rating) AS avg, COUNT(*) AS n
             FROM feedback f
             JOIN (SELECT DISTINCT match_id, game_id FROM game_plays WHERE started_at >= ?) gp
               ON gp.match_id = f.match_id
            WHERE f.created_at >= ${since}
            GROUP BY gp.game_id`,
          since,
        ).map((r) => [str(r.id), { avg: num(r.avg), n: num(r.n) }]),
      );
      const games = all(
        `SELECT game_id AS id, COUNT(*) AS plays,
                AVG(CASE WHEN outcome = 'finished' THEN duration_ms END) AS avg_ms,
                SUM(outcome <> 'finished') AS bad, SUM(outcome = 'failed') AS failed
           FROM game_plays WHERE started_at >= ? GROUP BY game_id ORDER BY plays DESC LIMIT 80`,
        since,
      ).map((r) => {
        const rating = ratings.get(str(r.id));
        const plays = num(r.plays);
        return {
          gameId: str(r.id),
          plays,
          avgDurationSec: round1(num(r.avg_ms) / 1000),
          abandonRate: plays === 0 ? 0 : round2(num(r.bad) / plays),
          failed: num(r.failed),
          ratingAvg: rating ? round2(rating.avg) : null,
          ratingCount: rating?.n ?? 0,
        };
      });

      const fb =
        all("SELECT COUNT(*) AS n, AVG(rating) AS avg FROM feedback WHERE created_at >= ?", since)[0] ?? {};
      const byRating = [0, 0, 0, 0, 0];
      for (const r of all(
        "SELECT rating AS r, COUNT(*) AS n FROM feedback WHERE created_at >= ? GROUP BY rating",
        since,
      )) {
        const i = num(r.r) - 1;
        if (i >= 0 && i < 5) byRating[i] = num(r.n);
      }
      const latest = all(
        `SELECT rating, text, created_at FROM feedback
          WHERE created_at >= ? AND text IS NOT NULL AND text <> '' ORDER BY created_at DESC LIMIT 20`,
        since,
      ).map((r) => ({ rating: num(r.rating), text: str(r.text).slice(0, 300), at: num(r.created_at) }));

      const selection = all(
        `SELECT selection_mode AS mode, COUNT(*) AS m, AVG(game_count) AS g FROM matches
          WHERE started_at >= ? GROUP BY selection_mode LIMIT 5`,
        since,
      ).map((r) => ({ mode: str(r.mode), matches: num(r.m), avgGameCount: round1(num(r.g)) }));
      const gameCounts = all(
        `SELECT game_count AS c, COUNT(*) AS m FROM matches WHERE started_at >= ?
          GROUP BY game_count ORDER BY game_count LIMIT 20`,
        since,
      ).map((r) => ({ count: num(r.c), matches: num(r.m) }));

      return {
        enabled: true,
        windowDays: RETENTION_DAYS,
        daily,
        weekly,
        playerCounts,
        games,
        feedback: {
          count: num(fb.n),
          avg: num(fb.n) === 0 ? null : round2(num(fb.avg)),
          byRating,
          latest,
        },
        selection,
        gameCounts,
      };
    },

    errors(now) {
      const today = Math.floor(now / DAY_MS);
      const since = now - RETENTION_DAYS * DAY_MS;
      const groups = all(
        `SELECT message, frame, SUM(count) AS c, MIN(first_seen) AS f, MAX(last_seen) AS l,
                SUM(CASE WHEN platform = 'ios' THEN count ELSE 0 END) AS ios,
                SUM(CASE WHEN platform = 'android' THEN count ELSE 0 END) AS android,
                SUM(CASE WHEN platform NOT IN ('ios', 'android') THEN count ELSE 0 END) AS other,
                GROUP_CONCAT(DISTINCT browser) AS browsers, GROUP_CONCAT(DISTINCT version) AS versions
           FROM client_errors WHERE day >= ? GROUP BY message, frame ORDER BY l DESC LIMIT 50`,
        Math.floor(since / DAY_MS) * DAY_MS,
      ).map((r) => ({
        message: str(r.message),
        frame: str(r.frame),
        count: num(r.c),
        firstSeen: num(r.f),
        lastSeen: num(r.l),
        platforms: { ios: num(r.ios), android: num(r.android), diger: num(r.other) },
        browsers: str(r.browsers).split(",").filter(Boolean).slice(0, 6),
        versions: str(r.versions).split(",").filter(Boolean).slice(0, 6),
      }));

      const errDays = new Map(
        all(
          "SELECT day, SUM(count) AS n FROM client_errors WHERE day >= ? GROUP BY day",
          (today - 13) * DAY_MS,
        ).map((r) => [num(r.day), num(r.n)]),
      );
      const perDay = Array.from({ length: 14 }, (_, i) => {
        const d = today - (13 - i);
        return { day: dayLabel(d * DAY_MS), count: errDays.get(d * DAY_MS) ?? 0 };
      });

      const perfRows = all(
        `SELECT platform, rtt_ms, ack_p95, tap_p95, long_tasks, reconnects, reloads FROM perf
          WHERE created_at >= ? ORDER BY created_at DESC LIMIT ${PERF_ROWS}`,
        now - 7 * DAY_MS,
      );
      const byPlatform = new Map<string, Row[]>();
      for (const r of perfRows) {
        const key = str(r.platform) || "diger";
        const list = byPlatform.get(key) ?? [];
        list.push(r);
        byPlatform.set(key, list);
      }
      const perf = [...byPlatform.entries()]
        .sort((a, b) => b[1].length - a[1].length)
        .map(([platform, rs]) => {
          const col = (k: string): number[] => rs.map((r) => num(r[k]));
          return {
            platform,
            samples: rs.length,
            reconnectsPerSample: round2(mean(col("reconnects"))),
            reloadsPerSample: round2(mean(col("reloads"))),
            ackP95: Math.round(p95(col("ack_p95"))),
            tapP95: Math.round(p95(col("tap_p95"))),
            longTasksPerSample: round2(mean(col("long_tasks"))),
            rttMedian: Math.round(median(col("rtt_ms"))),
          };
        });

      const failures = all(
        "SELECT game_id, fn, message, at FROM game_failures WHERE at >= ? ORDER BY at DESC, id DESC LIMIT 50",
        since,
      ).map((r) => ({
        gameId: str(r.game_id) || "bilinmiyor",
        fn: str(r.fn),
        message: str(r.message),
        at: num(r.at),
      }));

      return { groups, perDay, perf, failures };
    },
  };
}
