import type { IncomingMessage, ServerResponse } from "node:http";
import type { AccountStore, GameStandingRow, StandingRow } from "./accountStore.js";
import { accountFromCookie } from "./auth.js";
import { istanbulWeekStart } from "./badges.js";
import type { Clock } from "./clock.js";
import { log } from "./log.js";
import { TokenBucket } from "./ratelimit.js";
import { SECURITY_HEADERS } from "./static.js";

export const LEADERBOARD_PATH = "/api/leaderboard";

export const PERIODS = ["week", "all"] as const;
export type Period = (typeof PERIODS)[number];
export const METRICS = ["wins", "score", "matches"] as const;
export type Metric = (typeof METRICS)[number];

export interface LeaderRow {
  username: string;
  value: number;
  rank: number;
  you: boolean;
}

/** Dönemin başlangıcı (UTC ms): hafta İstanbul'da pazartesi 00:00'da başlar; "all" için null. */
export function periodStart(period: Period, now: number): number | null {
  return period === "week" ? istanbulWeekStart(now) : null;
}

const metricValue = (r: StandingRow, metric: Metric): number =>
  metric === "wins" ? r.wins : metric === "score" ? r.score : r.matches;

/** Değere göre azalan sıra; eşit değer aynı sırayı paylaşır (1, 1, 3). Eşitlikte kullanıcı adı sırası. */
export function rankStandings(rows: readonly StandingRow[], metric: Metric, selfId: number): LeaderRow[] {
  const sorted = [...rows].sort(
    (a, b) =>
      metricValue(b, metric) - metricValue(a, metric) ||
      a.username.toLowerCase().localeCompare(b.username.toLowerCase()),
  );
  let rank = 0;
  let prev: number | null = null;
  return sorted.map((r, i) => {
    const value = metricValue(r, metric);
    if (prev === null || value !== prev) rank = i + 1;
    prev = value;
    return { username: r.username, value, rank, you: r.accountId === selfId };
  });
}

export interface GameLeader {
  gameId: string;
  name: string;
  leader: { username: string; wins: number };
  you: { wins: number };
}

/** Oyun başına lider: en çok birincilik, eşitlikte en çok oynama, sonra kullanıcı adı. Hiç birincilik yoksa oyun listelenmez. */
export function gameLeaders(
  rows: readonly GameStandingRow[],
  selfId: number,
  gameName: (id: string) => string | null,
): GameLeader[] {
  const best = new Map<string, GameStandingRow>();
  const mine = new Map<string, number>();
  for (const r of rows) {
    if (r.accountId === selfId) mine.set(r.gameId, r.wins);
    const cur = best.get(r.gameId);
    if (
      !cur ||
      r.wins > cur.wins ||
      (r.wins === cur.wins && r.plays > cur.plays) ||
      (r.wins === cur.wins && r.plays === cur.plays && r.username.toLowerCase() < cur.username.toLowerCase())
    )
      best.set(r.gameId, r);
  }
  const out: GameLeader[] = [];
  for (const [gameId, r] of best) {
    const name = gameName(gameId);
    if (r.wins <= 0 || name === null) continue;
    out.push({
      gameId,
      name,
      leader: { username: r.username, wins: r.wins },
      you: { wins: mine.get(gameId) ?? 0 },
    });
  }
  return out.sort((a, b) => b.leader.wins - a.leader.wins || a.name.localeCompare(b.name, "tr"));
}

export interface LeaderboardEnv {
  accounts: AccountStore;
  clock: Clock;
  gameName: (id: string) => string | null;
}

type Outcome =
  | { status: 200; body: Record<string, unknown> }
  | { status: 400 | 401 | 405 | 429 | 500; code: string; message: string };

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...SECURITY_HEADERS,
  });
  res.end(JSON.stringify(body));
}

/**
 * `GET /api/leaderboard?period=&metric=` ve `GET /api/leaderboard/games?period=`: yalnız sen ve kabul edilmiş
 * arkadaşların. Oturum şart; hesap başına hız sınırı. Tek toplu sorgu (arkadaş sayısı en çok 200).
 */
export function createLeaderboardApi(
  env: LeaderboardEnv,
): (req: IncomingMessage, res: ServerResponse) => void {
  const { accounts, clock } = env;
  const buckets = new Map<number, TokenBucket>();
  const take = (id: number): boolean => {
    let b = buckets.get(id);
    if (!b) {
      if (buckets.size > 5000) for (const [k, v] of buckets) if (v.isFull()) buckets.delete(k);
      b = new TokenBucket(clock, 20, 0.5);
      buckets.set(id, b);
    }
    return b.take();
  };

  function resolve(req: IncomingMessage): Outcome {
    if (req.method !== "GET")
      return { status: 405, code: "method_not_allowed", message: "Bu istek desteklenmiyor." };
    const me = accountFromCookie(accounts, req.headers.cookie, clock.now());
    if (!me) return { status: 401, code: "login_required", message: "Önce giriş yap." };
    if (!take(me.id))
      return { status: 429, code: "rate_limited", message: "Çok hızlı gidiyorsun, biraz yavaşla." };
    const url = new URL(req.url ?? "", "http://x");
    const rest = url.pathname.slice(LEADERBOARD_PATH.length).replace(/\/+$/, "");
    const period = PERIODS.find((p) => p === url.searchParams.get("period"));
    if (!period) return { status: 400, code: "invalid_input", message: "Geçersiz istek." };
    const since = periodStart(period, clock.now());
    const ids = [me.id, ...accounts.friendIds(me.id)];
    if (rest === "") {
      const metric = METRICS.find((m) => m === url.searchParams.get("metric"));
      if (!metric) return { status: 400, code: "invalid_input", message: "Geçersiz istek." };
      return {
        status: 200,
        body: { ok: true, rows: rankStandings(accounts.standings(ids, since), metric, me.id) },
      };
    }
    if (rest === "/games")
      return {
        status: 200,
        body: { ok: true, games: gameLeaders(accounts.gameStandings(ids, since), me.id, env.gameName) },
      };
    return { status: 400, code: "invalid_input", message: "Geçersiz istek." };
  }

  return (req, res) => {
    let out: Outcome;
    try {
      out = resolve(req);
    } catch (err) {
      log.error("accounts_error", { op: "leaderboard", error: String(err) });
      out = { status: 500, code: "server_error", message: "Bir sorun oluştu, biraz sonra tekrar dene." };
    }
    if (out.status === 200) send(res, 200, out.body);
    else send(res, out.status, { ok: false, code: out.code, message: out.message });
  };
}
