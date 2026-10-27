/**
 * Yönetici ucu yanıtlarının doğrulaması: ağdan gelen hiçbir şey doğrulanmadan kullanılmaz.
 * Tipler `@glix/engine`deki `Admin*` arayüzleridir (yalnız tip; pakete kod eklemez).
 */
import type {
  AdminDayCount,
  AdminErrorGroup,
  AdminErrors,
  AdminGameFailure,
  AdminGameStat,
  AdminLive,
  AdminPerfRow,
  AdminRoomRow,
  AdminStats,
} from "@glix/engine";

class ParseError extends Error {}

type Rec = Record<string, unknown>;

function rec(v: unknown): Rec {
  if (typeof v !== "object" || v === null || Array.isArray(v)) throw new ParseError("nesne bekleniyordu");
  return v as Rec;
}
function num(o: Rec, k: string): number {
  const v = o[k];
  if (typeof v !== "number" || !Number.isFinite(v)) throw new ParseError(`${k}: sayı bekleniyordu`);
  return v;
}
function str(o: Rec, k: string): string {
  const v = o[k];
  if (typeof v !== "string") throw new ParseError(`${k}: metin bekleniyordu`);
  return v;
}
function bool(o: Rec, k: string): boolean {
  const v = o[k];
  if (typeof v !== "boolean") throw new ParseError(`${k}: doğru/yanlış bekleniyordu`);
  return v;
}
function nullableNum(o: Rec, k: string): number | null {
  return o[k] === null ? null : num(o, k);
}
function nullableStr(o: Rec, k: string): string | null {
  return o[k] === null ? null : str(o, k);
}
function list<T>(o: Rec, k: string, item: (v: Rec) => T, max = 500): T[] {
  const v = o[k];
  if (!Array.isArray(v) || v.length > max) throw new ParseError(`${k}: liste bekleniyordu`);
  return v.map((x) => item(rec(x)));
}
function strList(o: Rec, k: string): string[] {
  const v = o[k];
  if (!Array.isArray(v) || !v.every((x) => typeof x === "string"))
    throw new ParseError(`${k}: metin listesi`);
  return v as string[];
}

const room = (o: Rec): AdminRoomRow => ({
  code: str(o, "code"),
  phase: str(o, "phase"),
  players: num(o, "players"),
  connected: num(o, "connected"),
  spectators: num(o, "spectators"),
  stages: num(o, "stages"),
  gameId: nullableStr(o, "gameId"),
  ageSec: num(o, "ageSec"),
});

export function parseLive(v: unknown): AdminLive {
  const o = rec(v);
  const sockets = rec(o.sockets);
  const memory = rec(o.memory);
  return {
    rooms: num(o, "rooms"),
    players: num(o, "players"),
    activeMatches: num(o, "activeMatches"),
    stages: num(o, "stages"),
    sockets: {
      total: num(sockets, "total"),
      guests: num(sockets, "guests"),
      accounts: num(sockets, "accounts"),
    },
    memory: {
      rssMb: num(memory, "rssMb"),
      heapUsedMb: num(memory, "heapUsedMb"),
      heapTotalMb: num(memory, "heapTotalMb"),
    },
    cpuPercent: num(o, "cpuPercent"),
    eventLoopLagMsP95: num(o, "eventLoopLagMsP95"),
    tickMsP95: num(o, "tickMsP95"),
    bytesOutPerSec: num(o, "bytesOutPerSec"),
    uptimeSec: num(o, "uptimeSec"),
    startedAt: num(o, "startedAt"),
    version: str(o, "version"),
    revision: str(o, "revision"),
    draining: bool(o, "draining"),
    roomList: list(o, "roomList", room, 200),
  };
}

const day = (o: Rec): AdminDayCount => ({
  day: str(o, "day"),
  matches: num(o, "matches"),
  players: num(o, "players"),
});
const game = (o: Rec): AdminGameStat => ({
  gameId: str(o, "gameId"),
  plays: num(o, "plays"),
  avgDurationSec: num(o, "avgDurationSec"),
  abandonRate: num(o, "abandonRate"),
  failed: num(o, "failed"),
  ratingAvg: nullableNum(o, "ratingAvg"),
  ratingCount: num(o, "ratingCount"),
});

export function parseStats(v: unknown): AdminStats {
  const o = rec(v);
  const fb = rec(o.feedback);
  const acc = rec(o.accounts);
  const byRating = fb.byRating;
  if (!Array.isArray(byRating) || byRating.length !== 5 || !byRating.every((n) => typeof n === "number"))
    throw new ParseError("byRating");
  return {
    enabled: bool(o, "enabled"),
    windowDays: num(o, "windowDays"),
    daily: list(o, "daily", day, 120),
    weekly: list(
      o,
      "weekly",
      (w) => ({ weekStart: str(w, "weekStart"), matches: num(w, "matches"), players: num(w, "players") }),
      60,
    ),
    playerCounts: list(
      o,
      "playerCounts",
      (p) => ({ players: num(p, "players"), matches: num(p, "matches") }),
      30,
    ),
    games: list(o, "games", game, 120),
    feedback: {
      count: num(fb, "count"),
      avg: nullableNum(fb, "avg"),
      byRating: byRating as number[],
      latest: list(
        fb,
        "latest",
        (l) => ({ rating: num(l, "rating"), text: str(l, "text"), at: num(l, "at") }),
        50,
      ),
    },
    selection: list(
      o,
      "selection",
      (s) => ({ mode: str(s, "mode"), matches: num(s, "matches"), avgGameCount: num(s, "avgGameCount") }),
      10,
    ),
    gameCounts: list(o, "gameCounts", (g) => ({ count: num(g, "count"), matches: num(g, "matches") }), 30),
    accounts: {
      total: num(acc, "total"),
      verified: num(acc, "verified"),
      google: num(acc, "google"),
      password: num(acc, "password"),
      friendships: num(acc, "friendships"),
      badgesAwarded: num(acc, "badgesAwarded"),
      newPerDay: list(acc, "newPerDay", (d) => ({ day: str(d, "day"), count: num(d, "count") }), 60),
    },
  };
}

const group = (o: Rec): AdminErrorGroup => {
  const p = rec(o.platforms);
  return {
    message: str(o, "message"),
    frame: str(o, "frame"),
    count: num(o, "count"),
    firstSeen: num(o, "firstSeen"),
    lastSeen: num(o, "lastSeen"),
    platforms: { ios: num(p, "ios"), android: num(p, "android"), diger: num(p, "diger") },
    browsers: strList(o, "browsers"),
    versions: strList(o, "versions"),
  };
};
const perf = (o: Rec): AdminPerfRow => ({
  platform: str(o, "platform"),
  samples: num(o, "samples"),
  reconnectsPerSample: num(o, "reconnectsPerSample"),
  reloadsPerSample: num(o, "reloadsPerSample"),
  ackP95: num(o, "ackP95"),
  tapP95: num(o, "tapP95"),
  longTasksPerSample: num(o, "longTasksPerSample"),
  rttMedian: num(o, "rttMedian"),
});
const failure = (o: Rec): AdminGameFailure => ({
  gameId: str(o, "gameId"),
  fn: str(o, "fn"),
  message: str(o, "message"),
  at: num(o, "at"),
});

export function parseErrors(v: unknown): AdminErrors {
  const o = rec(v);
  return {
    enabled: bool(o, "enabled"),
    groups: list(o, "groups", group, 100),
    perDay: list(o, "perDay", (d) => ({ day: str(d, "day"), count: num(d, "count") }), 60),
    perf: list(o, "perf", perf, 10),
    failures: list(o, "failures", failure, 100),
  };
}

/** Doğrulayıcıyı çalıştırır; geçersizse null (panel "beklenmeyen yanıt" gösterir). */
export function tryParse<T>(parse: (v: unknown) => T, value: unknown): T | null {
  try {
    return parse(value);
  } catch (err) {
    if (err instanceof ParseError) return null;
    throw err;
  }
}

/** `/api/admin/status` yanıtı. */
export function parseState(v: unknown): "need_otp" | "ready" | null {
  if (typeof v !== "object" || v === null) return null;
  const s = (v as { state?: unknown }).state;
  return s === "need_otp" || s === "ready" ? s : null;
}
