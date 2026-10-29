/**
 * Yönetici ucu yanıtlarının doğrulaması: ağdan gelen hiçbir şey doğrulanmadan kullanılmaz.
 * Tipler `@glix/engine`deki `Admin*` arayüzleridir (yalnız tip; pakete kod eklemez).
 */
import type {
  AdminAccountDetail,
  AdminAccountLive,
  AdminAccountRow,
  AdminAccountSearch,
  AdminAccounts,
  AdminAuditPage,
  AdminBannedAccounts,
  AdminBannedWords,
  AdminBroadcastResult,
  AdminBroadcastStatus,
  AdminContent,
  AdminDayCount,
  AdminEconomy,
  AdminEconomyDay,
  AdminEconomyGroup,
  AdminErrorGroup,
  AdminErrors,
  AdminGameFailure,
  AdminGameStat,
  AdminGameSwitch,
  AdminGlixRow,
  AdminLive,
  AdminMailCount,
  AdminMailDay,
  AdminMaintenance,
  AdminPerfRow,
  AdminPlayerPage,
  AdminPlayerRole,
  AdminPlayerRow,
  AdminPoolBulk,
  AdminPoolEntry,
  AdminPoolPage,
  AdminPoolSummary,
  AdminPools,
  AdminRelease,
  AdminReportDetail,
  AdminReportPage,
  AdminReportRow,
  AdminRoomPlayers,
  AdminRoomRow,
  AdminStats,
  Announcement,
  ReportEvidence,
  ReportStatus,
} from "@glix/engine";
import { isReportReason, isReportStatus, REPORT_STATUSES } from "./moderationRules.js";

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

// ---- A2: hesaplar ve işlem kaydı ---------------------------------------------------------------------------

const mailCount = (o: Rec, k: string): AdminMailCount => {
  const c = rec(o[k]);
  return { ok: num(c, "ok"), failed: num(c, "failed") };
};

const mailDay = (o: Rec): AdminMailDay => ({
  day: str(o, "day"),
  verify: mailCount(o, "verify"),
  reset: mailCount(o, "reset"),
  admin: mailCount(o, "admin"),
});

export function parseAccounts(v: unknown): AdminAccounts {
  const o = rec(v);
  const methods = rec(o.methods);
  const mail = rec(o.mail);
  const totals = rec(mail.totals);
  return {
    total: num(o, "total"),
    verified: num(o, "verified"),
    methods: {
      google: num(methods, "google"),
      password: num(methods, "password"),
      both: num(methods, "both"),
    },
    active7: num(o, "active7"),
    active30: num(o, "active30"),
    suspended: num(o, "suspended"),
    newPerDay: list(o, "newPerDay", (d) => ({ day: str(d, "day"), count: num(d, "count") }), 60),
    mail: {
      enabled: bool(mail, "enabled"),
      days: list(mail, "days", mailDay, 60),
      totals: {
        verify: mailCount(totals, "verify"),
        reset: mailCount(totals, "reset"),
        admin: mailCount(totals, "admin"),
      },
    },
  };
}

const accountRow = (o: Rec): AdminAccountRow => ({
  id: num(o, "id"),
  username: str(o, "username"),
  createdAt: num(o, "createdAt"),
  verified: bool(o, "verified"),
  google: bool(o, "google"),
  password: bool(o, "password"),
  lastSeen: nullableNum(o, "lastSeen"),
  matches: num(o, "matches"),
  suspended: bool(o, "suspended"),
});

const ROLES: readonly AdminPlayerRole[] = ["player", "spectator", "host"];

/** Canlı durum: oda varsa kod, rol ve oyuncu kimliği (atma için) biçimce doğrulanır. */
function liveOf(v: unknown): AdminAccountLive {
  const o = rec(v);
  const online = bool(o, "online");
  if (o.room === null) return { online, room: null };
  const r = rec(o.room);
  const role = ROLES.find((x) => x === r.role);
  const code = str(r, "code");
  const playerId = str(r, "playerId");
  if (!role || !/^[A-Z0-9]{5}$/.test(code) || !/^[0-9a-f]{12}$/.test(playerId)) throw new ParseError("room");
  return { online, room: { code, role, playerId } };
}

export function parsePlayerPage(v: unknown): AdminPlayerPage {
  const o = rec(v);
  const next = o.next;
  if (next !== null && (typeof next !== "string" || !/^[A-Za-z0-9_-]{1,200}$/.test(next)))
    throw new ParseError("next");
  return {
    rows: list(
      o,
      "rows",
      (r): AdminPlayerRow => ({
        ...accountRow(r),
        glix: num(r, "glix"),
        suspendedUntil: nullableNum(r, "suspendedUntil"),
        admin: bool(r, "admin"),
        live: liveOf(r.live),
      }),
      100,
    ),
    next,
    total: num(o, "total"),
  };
}

export function parseSearch(v: unknown): AdminAccountSearch {
  const o = rec(v);
  return { results: list(o, "results", accountRow, 50), limit: num(o, "limit") };
}

const GLIX_REASONS = ["mac", "rozet", "yonetici", "satin-alma", "gorev"] as const;

function glixReason(o: Rec): AdminGlixRow["reason"] {
  const v = str(o, "reason");
  const found = GLIX_REASONS.find((r) => r === v);
  if (!found) throw new ParseError("reason");
  return found;
}

export function parseDetail(v: unknown): AdminAccountDetail {
  const o = rec(v);
  const s = o.suspension;
  const sus = s === null ? null : rec(s);
  return {
    id: num(o, "id"),
    username: str(o, "username"),
    email: str(o, "email"),
    createdAt: num(o, "createdAt"),
    verified: bool(o, "verified"),
    google: bool(o, "google"),
    password: bool(o, "password"),
    usernameChangedAt: nullableNum(o, "usernameChangedAt"),
    lastSeen: nullableNum(o, "lastSeen"),
    sessions: num(o, "sessions"),
    matches: num(o, "matches"),
    wins: num(o, "wins"),
    games: num(o, "games"),
    badges: num(o, "badges"),
    friends: num(o, "friends"),
    glix: (() => {
      const g = rec(o.glix);
      return {
        balance: num(g, "balance"),
        ledger: list(
          g,
          "ledger",
          (r) => ({
            at: num(r, "at"),
            amount: num(r, "amount"),
            reason: glixReason(r),
            ref: r.ref === null ? null : str(r, "ref"),
          }),
          50,
        ),
      };
    })(),
    cosmetics: (() => {
      const c = rec(o.cosmetics);
      const eq = rec(c.equipped);
      const equipped: Record<string, string> = {};
      for (const [slot, id] of Object.entries(eq)) {
        if (typeof id !== "string") throw new ParseError("equipped");
        equipped[slot] = id;
      }
      return {
        owned: list(
          c,
          "owned",
          (r) => ({
            itemId: str(r, "itemId"),
            acquiredAt: num(r, "acquiredAt"),
            pricePaid: num(r, "pricePaid"),
          }),
          100,
        ),
        equipped,
      };
    })(),
    protected: bool(o, "protected"),
    live: liveOf(o.live),
    suspension: sus
      ? { since: num(sus, "since"), until: nullableNum(sus, "until"), reason: str(sus, "reason") }
      : null,
  };
}

export function parseAuditPage(v: unknown): AdminAuditPage {
  const o = rec(v);
  return {
    entries: list(
      o,
      "entries",
      (e) => ({
        id: num(e, "id"),
        actorId: num(e, "actorId"),
        action: str(e, "action"),
        targetId: nullableNum(e, "targetId"),
        detail: str(e, "detail"),
        at: num(e, "at"),
      }),
      200,
    ),
    nextBefore: nullableNum(o, "nextBefore"),
  };
}

// ---- A3: içerik, bildirim ve bakım ---------------------------------------------------------------------------

const gameSwitch = (o: Rec): AdminGameSwitch => ({
  id: str(o, "id"),
  name: str(o, "name"),
  minPlayers: num(o, "minPlayers"),
  maxPlayers: num(o, "maxPlayers"),
  open: bool(o, "open"),
  randomPool: bool(o, "randomPool"),
  engineRandomPool: bool(o, "engineRandomPool"),
  overridden: bool(o, "overridden"),
});

function announcement(v: unknown): Announcement | null {
  if (v === null) return null;
  const o = rec(v);
  const kind = o.kind;
  if (kind !== "bilgi" && kind !== "uyari") throw new ParseError("kind: bilinmeyen tür");
  return { id: num(o, "id"), text: str(o, "text"), kind, endsAt: nullableNum(o, "endsAt") };
}

export function parseContent(v: unknown): AdminContent {
  const o = rec(v);
  return {
    games: list(o, "games", gameSwitch, 200),
    announcement: announcement(o.announcement),
    gunlukGorevler: bool(o, "gunlukGorevler"),
  };
}

/** `content/game` yanıtı: güncel oyun listesi. */
export function parseGameList(v: unknown): AdminGameSwitch[] {
  return list(rec(v), "games", gameSwitch, 200);
}

const RELEASE_STATES = ["running", "clean", "unclean"] as const;

const release = (o: Rec): AdminRelease => {
  const state = RELEASE_STATES.find((x) => x === o.state);
  if (!state) throw new ParseError("state: bilinmeyen durum");
  return {
    id: num(o, "id"),
    revision: str(o, "revision"),
    version: str(o, "version"),
    startedAt: num(o, "startedAt"),
    endedAt: nullableNum(o, "endedAt"),
    durationSec: nullableNum(o, "durationSec"),
    state,
  };
};

export function parseMaintenance(v: unknown): AdminMaintenance {
  const o = rec(v);
  const backup = rec(o.backup);
  return {
    on: bool(o, "on"),
    activeMatches: num(o, "activeMatches"),
    rooms: num(o, "rooms"),
    players: num(o, "players"),
    draining: bool(o, "draining"),
    backup: {
      usedToday: num(backup, "usedToday"),
      limit: num(backup, "limit"),
      nextAt: nullableNum(backup, "nextAt"),
    },
    releases: list(o, "releases", release, 50),
  };
}

const broadcastResult = (o: Rec): AdminBroadcastResult => ({
  at: num(o, "at"),
  title: str(o, "title"),
  total: num(o, "total"),
  sent: num(o, "sent"),
  failed: num(o, "failed"),
  removed: num(o, "removed"),
  finished: bool(o, "finished"),
});

export function parsePushStatus(v: unknown): AdminBroadcastStatus {
  const o = rec(v);
  return {
    enabled: bool(o, "enabled"),
    subscribers: num(o, "subscribers"),
    nextAllowedAt: nullableNum(o, "nextAllowedAt"),
    last: o.last === null ? null : broadcastResult(rec(o.last)),
  };
}

// ---- A4: moderasyon -------------------------------------------------------------------------------------------

function reportStatus(o: Rec, k: string): ReportStatus {
  const v = o[k];
  if (!isReportStatus(v)) throw new ParseError(`${k}: bilinmeyen durum`);
  return v;
}

const reportRow = (o: Rec): AdminReportRow => {
  const reason = o.reason;
  if (!isReportReason(reason)) throw new ParseError("reason: bilinmeyen sebep");
  return {
    id: num(o, "id"),
    createdAt: num(o, "createdAt"),
    status: reportStatus(o, "status"),
    reason,
    targetName: str(o, "targetName"),
    targetAccountId: nullableNum(o, "targetAccountId"),
    roomCode: str(o, "roomCode"),
    gameId: nullableStr(o, "gameId"),
  };
};

export function parseReportPage(v: unknown): AdminReportPage {
  const o = rec(v);
  const c = rec(o.counts);
  const counts = Object.fromEntries(REPORT_STATUSES.map((st) => [st, num(c, st)])) as Record<
    ReportStatus,
    number
  >;
  return { reports: list(o, "reports", reportRow, 200), nextBefore: nullableNum(o, "nextBefore"), counts };
}

function evidence(v: unknown): ReportEvidence | null {
  if (v === null) return null;
  const o = rec(v);
  return { gameId: str(o, "gameId"), texts: strList(o, "texts") };
}

export function parseReportDetail(v: unknown): AdminReportDetail {
  const o = rec(v);
  return {
    ...reportRow(o),
    reporterAccountId: nullableNum(o, "reporterAccountId"),
    note: str(o, "note"),
    evidence: evidence(o.evidence),
    adminNote: str(o, "adminNote"),
    reviewedAt: nullableNum(o, "reviewedAt"),
    targetPlayerId: str(o, "targetPlayerId"),
    inRoom: bool(o, "inRoom"),
    targetProtected: bool(o, "targetProtected"),
  };
}

export function parseBannedWords(v: unknown): AdminBannedWords {
  const o = rec(v);
  return {
    words: list(o, "words", (w) => ({ word: str(w, "word"), addedAt: num(w, "addedAt") }), 600),
    max: num(o, "max"),
  };
}

export function parseBannedAccounts(v: unknown): AdminBannedAccounts {
  const o = rec(v);
  return {
    accounts: list(o, "accounts", (a) => ({ id: num(a, "id"), username: str(a, "username") }), 200),
    truncated: bool(o, "truncated"),
  };
}

export function parseRoomPlayers(v: unknown): AdminRoomPlayers {
  const o = rec(v);
  return {
    code: str(o, "code"),
    phase: str(o, "phase"),
    players: list(
      o,
      "players",
      (p) => ({
        id: str(p, "id"),
        nickname: str(p, "nickname"),
        connected: bool(p, "connected"),
        spectator: bool(p, "spectator"),
        host: bool(p, "host"),
        account: bool(p, "account"),
      }),
      20,
    ),
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

// ---- A4: içerik havuzları ------------------------------------------------------------------------------------------

function fieldValues(o: Rec, k: string): Record<string, string> {
  const r = rec(o[k]);
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(r)) {
    if (typeof value !== "string") throw new ParseError(`${k}.${key}: metin bekleniyordu`);
    out[key] = value;
  }
  return out;
}

function poolSummary(o: Rec): AdminPoolSummary {
  return {
    id: str(o, "id"),
    gameId: str(o, "gameId"),
    gameName: str(o, "gameName"),
    label: str(o, "label"),
    hint: str(o, "hint"),
    fields: list(
      o,
      "fields",
      (f) => ({
        key: str(f, "key"),
        label: str(f, "label"),
        hint: str(f, "hint"),
        min: num(f, "min"),
        max: num(f, "max"),
        long: bool(f, "long"),
      }),
      8,
    ),
    min: num(o, "min"),
    needed: num(o, "needed"),
    builtin: num(o, "builtin"),
    custom: num(o, "custom"),
    disabled: num(o, "disabled"),
    active: num(o, "active"),
    applied: bool(o, "applied"),
    belowMin: bool(o, "belowMin"),
  };
}

export function parsePools(v: unknown): AdminPools {
  const o = rec(v);
  return { pools: list(o, "pools", poolSummary, 50), customMax: num(o, "customMax") };
}

export const parsePoolSummary = (v: unknown): AdminPoolSummary => poolSummary(rec(v));

export function parsePoolPage(v: unknown): AdminPoolPage {
  const o = rec(v);
  return {
    pool: poolSummary(rec(o.pool)),
    entries: list(
      o,
      "entries",
      (e): AdminPoolEntry => {
        const source = str(e, "source");
        if (source !== "builtin" && source !== "custom") throw new ParseError("source: geçersiz");
        return {
          key: str(e, "key"),
          source,
          disabled: bool(e, "disabled"),
          fields: fieldValues(e, "fields"),
        };
      },
      200,
    ),
    total: num(o, "total"),
    page: num(o, "page"),
    pageSize: num(o, "pageSize"),
  };
}

const LINE_STATUSES = ["ok", "invalid", "duplicate", "banned", "full"] as const;

export function parsePoolBulk(v: unknown): AdminPoolBulk {
  const o = rec(v);
  return {
    lines: list(
      o,
      "lines",
      (l) => {
        const status = str(l, "status");
        if (!(LINE_STATUSES as readonly string[]).includes(status)) throw new ParseError("status: geçersiz");
        return {
          line: num(l, "line"),
          status: status as (typeof LINE_STATUSES)[number],
          message: str(l, "message"),
          fields: fieldValues(l, "fields"),
        };
      },
      300,
    ),
    ok: num(o, "ok"),
    added: num(o, "added"),
    pool: poolSummary(rec(o.pool)),
  };
}

const ecoDayFields = (o: Rec): Omit<AdminEconomyDay, "day"> => ({
  mac: num(o, "mac"),
  rozet: num(o, "rozet"),
  gorev: num(o, "gorev"),
  yonetici: num(o, "yonetici"),
  yoneticiEksi: num(o, "yoneticiEksi"),
  harcanan: num(o, "harcanan"),
  kazanilan: num(o, "kazanilan"),
  net: num(o, "net"),
  sinirdaki: num(o, "sinirdaki"),
});
const ecoGroup = (o: Rec): AdminEconomyGroup => ({
  id: str(o, "id"),
  label: str(o, "label"),
  count: num(o, "count"),
  glix: num(o, "glix"),
});

export function parseEconomy(v: unknown): AdminEconomy {
  const o = rec(v);
  const circ = rec(o.circulation);
  const sales = rec(o.sales);
  return {
    days: num(o, "days"),
    daily: list(o, "daily", (d) => ({ day: str(d, "day"), ...ecoDayFields(d) }), 90),
    totals: ecoDayFields(rec(o.totals)),
    circulation: { total: num(circ, "total"), holders: num(circ, "holders") },
    dailyCap: num(o, "dailyCap"),
    topItems: list(
      o,
      "topItems",
      (i) => ({
        itemId: str(i, "itemId"),
        name: str(i, "name"),
        rarity: str(i, "rarity"),
        typeName: str(i, "typeName"),
        count: num(i, "count"),
        glix: num(i, "glix"),
      }),
      50,
    ),
    sales: { count: num(sales, "count"), glix: num(sales, "glix") },
    byRarity: list(o, "byRarity", ecoGroup, 20),
    byType: list(o, "byType", ecoGroup, 20),
    deals: list(
      o,
      "deals",
      (d) => ({
        itemId: str(d, "itemId"),
        name: str(d, "name"),
        rarity: str(d, "rarity"),
        listPrice: num(d, "listPrice"),
        price: num(d, "price"),
        soldToday: num(d, "soldToday"),
      }),
      10,
    ),
    dealEndsAt: num(o, "dealEndsAt"),
  };
}
