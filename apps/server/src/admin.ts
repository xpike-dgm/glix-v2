/**
 * Yönetici paneli uçları (U16 A1 salt okunur veri uçları, A2 hesap işlemleri): erişim denetimi, veri uçları, hesap arama,
 * hesap dökümü ve hesap işlemleri (ad zorla değiştirme, askı, silme, oturum kapatma). İşlemler POST'tur; her biri
 * Origin denetimi, yönetici başına hız sınırı ve işlem kaydı (`admin_audit`; e-posta asla yazılmaz) taşır.
 * Erişim = geçerli hesap oturumu + `GLIX_ADMIN_ACCOUNT_IDS` listesinde hesap + e-postayla gelen tek kullanımlık kodla
 * alınmış `glix_admin` çerezi. Kod ve belirteçler asla günlüğe yazılmaz; veritabanında yalnız özetleri durur.
 */
import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { pipeline } from "node:stream";
import {
  ADMIN_PLAYER_FILTERS,
  ADMIN_PLAYER_SORTS,
  type AdminAccountDetail,
  type AdminAccountSearch,
  type AdminAuditPage,
  type AdminBannedAccounts,
  type AdminBannedWords,
  type AdminContent,
  type AdminLive,
  type AdminMaintenance,
  type AdminPlayerFilter,
  type AdminPlayerPage,
  type AdminPlayerSort,
  type AdminPoolFilter,
  type AdminReportDetail,
  type AdminReportPage,
  type AdminReportRow,
  type AdminRoomPlayers,
  ANNOUNCEMENT_MAX_AHEAD_MS,
  type AnnouncementKind,
  BANNED_WORDS_MAX,
  BROADCAST_BODY_MAX,
  BROADCAST_TITLE_MAX,
  COSMETIC_TYPES,
  type CosmeticTypeId,
  cleanAnnouncementText,
  cleanPlainText,
  cleanSitePath,
  cosmeticItem,
  ECONOMY_RANGES,
  isAnnouncementKind,
  isReportStatus,
  REPORT_ADMIN_NOTE_MAX,
  type ReportStatus,
  ROOM_CODE_LENGTH,
} from "@glix/engine";
import {
  type AccountStore,
  ADMIN_SEARCH_LIMIT,
  type AdminPlayerListQuery,
  type AdminSearchQuery,
  type ReportRow,
} from "./accountStore.js";
import { buildAccounts, buildEconomy, buildErrors, buildReleases, buildStats } from "./adminData.js";
import type { AdminRoomOps } from "./adminRooms.js";
import {
  hashToken,
  isSecureRequest,
  normalizeEmail,
  originAllowed,
  readCookie,
  readSessionToken,
  send,
  USERNAME_PATTERN,
} from "./auth.js";
import { BACKUP_FRESH_MS, BACKUP_PER_DAY, type BackupService } from "./backup.js";
import type { Clock } from "./clock.js";
import {
  BULK_MAX_LINE_LENGTH,
  BULK_MAX_LINES,
  CONTENT_CUSTOM_MAX,
  type ContentStore,
  entryTag,
  POOL_PAGE_SIZE,
} from "./contentStore.js";
import type { GoogleAuth } from "./google.js";
import { confirmMatches } from "./kvkk.js";
import { log } from "./log.js";
import { adminCodeMessage, type MailService, type MailThrottle } from "./mail.js";
import type { BannedWords } from "./moderation.js";
import type { PushBroadcaster } from "./pushBroadcast.js";
import { type IpLimiter, TokenBucket } from "./ratelimit.js";
import type { SiteSettings } from "./siteSettings.js";
import type { Social } from "./social.js";
import type { StatsStore } from "./statsStore.js";

export const ADMIN_PREFIX = "/api/admin/";
export const ADMIN_COOKIE = "glix_admin";
export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
/** Aynı hesaba iki kod isteği arası en az bu kadar; günde en çok `OTP_PER_DAY`. */
export const OTP_GAP_MS = 60 * 1000;
export const OTP_PER_DAY = 10;
export const ADMIN_SESSION_TTL_MS = 12 * 3600 * 1000;
const MAX_BODY_BYTES = 512;
/** Hesap işlemi gövdesi (sebep metni dahil). */
const MAX_ACTION_BODY_BYTES = 1024;
/** Askıya alınan hesabın canlı soketleri bu kodla kapatılır. */
export const SUSPEND_CLOSE_CODE = 4003;
/** Askı sebebi en çok bu kadar karakter. */
export const SUSPEND_REASON_MAX = 140;
const DAY_MS = 24 * 3600 * 1000;
/** İşlem kaydı sayfası: varsayılan ve en büyük satır sayısı. */
export const AUDIT_PAGE_DEFAULT = 50;
export const AUDIT_PAGE_MAX = 100;

/** Askı süresi seçenekleri: gün sayısı ya da süresiz (null). */
export const SUSPEND_DURATIONS = { "1d": 1, "7d": 7, forever: null } as const;
export type SuspendDuration = keyof typeof SUSPEND_DURATIONS;

/** Yönetici başına hız sınırları (bellekte): işlemler, aramalar ve hesap dökümü görüntüleme ayrı kovalardır. */
export interface AdminLimits {
  action(adminId: number): boolean;
  search(adminId: number): boolean;
  detail(adminId: number): boolean;
}

export function createAdminLimits(clock: Clock): AdminLimits {
  const make = (capacity: number, perSec: number) => {
    const buckets = new Map<number, TokenBucket>();
    return (id: number): boolean => {
      let b = buckets.get(id);
      if (!b) {
        b = new TokenBucket(clock, capacity, perSec);
        buckets.set(id, b);
      }
      return b.take();
    };
  };
  // İşlem: 10 ani, 6 sn'de 1. Arama: 30 ani, 2 sn'de 1. Döküm (e-posta görünür): 20 ani, 3 sn'de 1.
  return { action: make(10, 1 / 6), search: make(30, 1 / 2), detail: make(20, 1 / 3) };
}
export interface AdminEnv {
  accounts: AccountStore;
  stats: StatsStore;
  limiter: IpLimiter;
  /** Kod isteği hız sınırı (hesap başına); süreç boyunca tek örnek. */
  throttle: MailThrottle;
  mail: MailService | null;
  adminIds: ReadonlySet<number>;
  allowedOrigins: readonly string[] | null;
  trustProxy: boolean;
  ip: string;
  now: number;
  live: () => AdminLive;
  /** Hesap işlemlerinin canlı etkisi (ad yayını, bağlantıları misafire çevirme). */
  social: Social;
  /** Silinen hesabın bekleyen Google kayıtları buradan düşer; kapalıysa null. */
  google: GoogleAuth | null;
  limits: AdminLimits;
  /** A3: oyun anahtarları, duyuru, bakım kipi. */
  site: SiteSettings;
  /** A3: herkese web bildirimi. */
  broadcaster: PushBroadcaster;
  /** A3: veritabanı yedeği. */
  backup: BackupService;
  clock: Clock;
  /** A4: oda oyuncu listesi, odayı kapatma, oyuncu atma. */
  rooms: AdminRoomOps;
  /** A4: yasaklı kelime listesi. */
  banned: BannedWords;
  /** A4: içerik havuzları (kelime/soru listeleri). */
  content: ContentStore;
  /** Bu sunucu sürecinin başlangıç kaydı (`server_starts`); kayıt yazılamadıysa null. */
  runId: number | null;
}

function fail(res: ServerResponse, status: number, code: string, message: string): void {
  send(res, status, { ok: false, code, message });
}

const notFound = (res: ServerResponse): void => fail(res, 404, "not_found", "Bulunamadı");

function adminCookie(token: string, secure: boolean, maxAgeSec: number): string {
  return `${ADMIN_COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=${maxAgeSec}${secure ? "; Secure" : ""}`;
}

const codeHash = (salt: string, code: string): string =>
  createHash("sha256").update(`${salt}:${code}`).digest("hex");

function sameHex(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Gövdeyi en çok `max` bayt okur; geçersiz/büyükse null. */
function readJson(req: IncomingMessage, max = MAX_BODY_BYTES): Promise<unknown> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let done = false;
    const finish = (value: unknown): void => {
      if (done) return;
      done = true;
      resolve(value);
    };
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > max) {
        finish(null);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("error", () => finish(null));
    req.on("end", () => {
      try {
        finish(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        finish(null);
      }
    });
  });
}

/** Kod isteği/denemesi yalnız `{ "code": "123456" }`. */
export function parseCode(data: unknown): string | null {
  if (typeof data !== "object" || data === null || Array.isArray(data)) return null;
  const keys = Object.keys(data);
  if (keys.length !== 1 || keys[0] !== "code") return null;
  const code = (data as { code?: unknown }).code;
  if (typeof code !== "string") return null;
  const clean = code.replace(/\s/g, "");
  return /^\d{6}$/.test(clean) ? clean : null;
}

function audit(
  env: AdminEnv,
  accountId: number,
  action: string,
  detail: string,
  targetId: number | null = null,
): void {
  try {
    env.accounts.adminAudit(accountId, action, detail, env.now, targetId);
  } catch (err) {
    log.error("accounts_error", { op: "admin_audit", error: String(err) });
  }
}

export function handleAdmin(req: IncomingMessage, res: ServerResponse, env: AdminEnv): void {
  void route(req, res, env).catch((err: unknown) => {
    log.error("admin_failed", { error: String(err) });
    if (!res.headersSent) fail(res, 500, "server_error", "Beklenmeyen bir sorun oluştu.");
    else res.end();
  });
}

const POST_ROUTES: ReadonlySet<string> = new Set([
  "otp/request",
  "otp/verify",
  "logout",
  "accounts/rename",
  "accounts/suspend",
  "accounts/unsuspend",
  "accounts/delete",
  "accounts/logout-all",
  "accounts/glix",
  "accounts/cosmetic-grant",
  "accounts/cosmetic-revoke",
  "accounts/cosmetic-unequip",
  "accounts/glix-set",
  "content/game",
  "content/quests",
  "announcement/set",
  "announcement/clear",
  "push/broadcast",
  "maintenance/set",
  "backup",
  "reports/status",
  "rooms/close",
  "rooms/kick",
  "banned-words/add",
  "banned-words/remove",
  "pools/toggle",
  "pools/add",
  "pools/edit",
  "pools/delete",
  "pools/check",
  "pools/bulk",
]);
const GET_ROUTES: ReadonlySet<string> = new Set([
  "status",
  "live",
  "stats",
  "errors",
  "accounts",
  "accounts/search",
  "accounts/list",
  "accounts/detail",
  "economy",
  "audit",
  "content",
  "maintenance",
  "push/status",
  "reports",
  "reports/detail",
  "rooms/players",
  "banned-words",
  "banned-words/accounts",
  "pools",
  "pools/entries",
]);

async function route(req: IncomingMessage, res: ServerResponse, env: AdminEnv): Promise<void> {
  // Kapalıyken uçlar yok sayılır: hiçbir şey sızmaz.
  if (env.adminIds.size === 0) return notFound(res);
  const url = new URL(req.url ?? "", "http://x");
  const name = url.pathname.slice(ADMIN_PREFIX.length);
  const isPost = POST_ROUTES.has(name);
  const isGet = GET_ROUTES.has(name);
  if (!isPost && !isGet) return notFound(res);
  if (req.method !== (isPost ? "POST" : "GET")) {
    send(
      res,
      405,
      { ok: false, code: "method", message: "Yöntem desteklenmiyor." },
      { Allow: isPost ? "POST" : "GET" },
    );
    return;
  }
  if (isPost && !originAllowed(req, env.allowedOrigins))
    return fail(res, 403, "bad_origin", "İstek reddedildi.");

  const token = readSessionToken(req.headers.cookie);
  const account = token ? safeResolve(env, token) : null;
  if (!account || !token) return fail(res, 401, "login_required", "Önce oyuna giriş yap.");
  // Yönetici olmayan hesap için panel hiç yokmuş gibi davranılır.
  if (!env.adminIds.has(account.id)) return notFound(res);
  const sessionHash = hashToken(token);
  const adminToken = readCookie(req.headers.cookie, ADMIN_COOKIE);
  const adminHash = adminToken ? hashToken(adminToken) : null;
  const authed =
    adminHash !== null && env.accounts.adminSessionValid(adminHash, account.id, sessionHash, env.now);

  switch (name) {
    case "status":
      send(res, 200, { state: authed ? "ready" : "need_otp" });
      return;
    case "otp/request":
      return requestCode(res, env, account.id, account.email, sessionHash);
    case "otp/verify":
      return verifyCode(req, res, env, account.id, sessionHash);
    case "logout":
      if (adminHash) env.accounts.adminSessionDelete(adminHash);
      audit(env, account.id, "logout", "");
      send(
        res,
        200,
        { ok: true },
        { "Set-Cookie": adminCookie("", isSecureRequest(req, env.trustProxy), 0) },
      );
      return;
    default:
      break;
  }
  if (!authed) return fail(res, 403, "otp_required", "Giriş kodu gerekli.");
  switch (name) {
    case "live":
      return send(res, 200, env.live());
    case "stats":
      return send(res, 200, buildStats(env.stats, env.accounts, env.now));
    case "errors":
      return send(res, 200, buildErrors(env.stats, env.now));
    case "accounts":
      return send(res, 200, buildAccounts(env.stats, env.accounts, env.now));
    case "economy": {
      const days = Number(url.searchParams.get("days") ?? "7");
      if (!(ECONOMY_RANGES as readonly number[]).includes(days))
        return fail(res, 400, "bad_request", "Geçersiz aralık.");
      return send(res, 200, buildEconomy(env.accounts, env.now, days));
    }
    case "accounts/search":
      return searchAccounts(res, env, account.id, url.searchParams.get("q"));
    case "accounts/list":
      return listAccounts(res, env, account.id, url.searchParams);
    case "accounts/detail":
      return accountDetail(res, env, account.id, url.searchParams.get("id"));
    case "audit":
      return auditPage(res, env, url.searchParams.get("before"), url.searchParams.get("limit"));
    case "content":
      return send(res, 200, contentBody(env));
    case "maintenance":
      return send(res, 200, maintenanceBody(env));
    case "push/status":
      return send(res, 200, env.broadcaster.status());
    case "backup":
      return downloadBackup(req, res, env, account.id, adminHash);
    case "reports":
      return reportsPage(res, env, url.searchParams);
    case "reports/detail":
      return reportDetail(res, env, account.id, url.searchParams.get("id"));
    case "rooms/players":
      return roomPlayers(res, env, account.id, url.searchParams.get("code"));
    case "banned-words":
      return send(res, 200, bannedBody(env));
    case "banned-words/accounts":
      return bannedAccounts(res, env, account.id);
    case "pools":
      return send(res, 200, { pools: env.content.summaries(), customMax: CONTENT_CUSTOM_MAX });
    case "pools/entries":
      return poolEntries(res, env, account.id, url.searchParams);
    case "pools/toggle":
    case "pools/add":
    case "pools/edit":
    case "pools/delete":
    case "pools/check":
    case "pools/bulk":
      return poolAction(req, res, env, account.id, name);
    case "reports/status":
    case "rooms/close":
    case "rooms/kick":
    case "banned-words/add":
    case "banned-words/remove":
      return moderationAction(req, res, env, account.id, name);
    case "content/game":
    case "content/quests":
    case "announcement/set":
    case "announcement/clear":
    case "push/broadcast":
    case "maintenance/set":
      return contentAction(req, res, env, account.id, name);
    default:
      return accountAction(req, res, env, account.id, name);
  }
}

function safeResolve(env: AdminEnv, token: string): { id: number; email: string } | null {
  try {
    return env.accounts.resolveSession(hashToken(token), env.now);
  } catch (err) {
    log.error("accounts_error", { op: "resolve", error: String(err) });
    return null;
  }
}

async function requestCode(
  res: ServerResponse,
  env: AdminEnv,
  accountId: number,
  email: string,
  sessionHash: string,
): Promise<void> {
  if (!env.limiter.takeAuth(env.ip)) return fail(res, 429, "rate_limited", "Biraz bekleyip tekrar dene.");
  if (!env.mail) return fail(res, 503, "mail_disabled", "E-posta gönderimi kapalı; kod gönderilemez.");
  if (!env.throttle.allow(`admin:${accountId}`, env.now, OTP_GAP_MS, OTP_PER_DAY)) {
    audit(env, accountId, "otp_request", "throttled");
    return fail(res, 429, "too_soon", "Yeni kod için biraz bekle.");
  }
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const sent = await env.mail.mailer.send(adminCodeMessage(email, code, OTP_TTL_MS / 60_000));
  if (!sent) {
    audit(env, accountId, "otp_request", "mail_failed");
    return fail(res, 502, "mail_failed", "Kod e-postası gönderilemedi.");
  }
  const salt = randomBytes(16).toString("hex");
  env.accounts.adminOtpPut(accountId, sessionHash, salt, codeHash(salt, code), env.now + OTP_TTL_MS);
  audit(env, accountId, "otp_request", "sent");
  send(res, 200, { ok: true, expiresInSec: OTP_TTL_MS / 1000 });
}

async function verifyCode(
  req: IncomingMessage,
  res: ServerResponse,
  env: AdminEnv,
  accountId: number,
  sessionHash: string,
): Promise<void> {
  if (!env.limiter.takeAuth(env.ip)) return fail(res, 429, "rate_limited", "Biraz bekleyip tekrar dene.");
  const code = parseCode(await readJson(req));
  if (!code) return fail(res, 400, "invalid_code", "Altı haneli kodu yaz.");
  const result = env.accounts.adminOtpCheck(accountId, sessionHash, env.now, OTP_MAX_ATTEMPTS, (salt, hash) =>
    sameHex(codeHash(salt, code), hash),
  );
  if (result === "ok") {
    const token = randomBytes(32).toString("base64url");
    env.accounts.adminSessionCreate(
      hashToken(token),
      accountId,
      sessionHash,
      env.now,
      env.now + ADMIN_SESSION_TTL_MS,
    );
    audit(env, accountId, "otp_ok", "");
    send(
      res,
      200,
      { ok: true },
      {
        "Set-Cookie": adminCookie(token, isSecureRequest(req, env.trustProxy), ADMIN_SESSION_TTL_MS / 1000),
      },
    );
    return;
  }
  audit(env, accountId, result === "invalid" ? "otp_fail" : `otp_${result}`, "");
  if (result === "invalid") return fail(res, 400, "invalid_code", "Kod hatalı.");
  if (result === "locked") return fail(res, 429, "locked", "Çok fazla hatalı deneme. Yeni kod iste.");
  fail(res, 400, "expired", "Kodun süresi doldu ya da kod istenmedi. Yeni kod iste.");
}

// ---- A2: hesap arama, döküm, işlemler ve işlem kaydı ---------------------------------------------------------

/**
 * Arama metni: "@" içeriyorsa tam e-posta, değilse kullanıcı adı öneki (1-20 harf/rakam/alt çizgi). Geçersizse null.
 * İkisi de küçük harfe çevrilir (hesaplar küçük harfle aranır).
 */
export function parseSearch(q: string | null): AdminSearchQuery | null {
  const text = (q ?? "").trim();
  if (text.includes("@")) {
    const email = normalizeEmail(text);
    return email === null ? null : { kind: "email", value: email };
  }
  return /^[A-Za-z0-9_]{1,20}$/.test(text) ? { kind: "prefix", value: text.toLowerCase() } : null;
}

/** Sorgu dizgesindeki pozitif tam sayı (kimlik, sayfa imleci); değilse null. */
export function parseId(v: string | null): number | null {
  if (v === null || !/^\d{1,15}$/.test(v)) return null;
  const n = Number(v);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

async function searchAccounts(
  res: ServerResponse,
  env: AdminEnv,
  adminId: number,
  q: string | null,
): Promise<void> {
  if (!env.limits.search(adminId)) return fail(res, 429, "rate_limited", "Biraz bekleyip tekrar dene.");
  const query = parseSearch(q);
  if (!query)
    return fail(
      res,
      400,
      "invalid_input",
      "Kullanıcı adının başını (harf, rakam, alt çizgi) ya da tam bir e-posta yaz.",
    );
  // E-postayla arama kişisel veriyi sorgular: arama metni olmadan yalnız yapıldığı kaydedilir.
  if (query.kind === "email") audit(env, adminId, "account_search_email", "");
  const body: AdminAccountSearch = {
    results: env.accounts.adminSearch(query, env.now),
    limit: ADMIN_SEARCH_LIMIT,
  };
  send(res, 200, body);
}

async function accountDetail(
  res: ServerResponse,
  env: AdminEnv,
  adminId: number,
  rawId: string | null,
): Promise<void> {
  const id = parseId(rawId);
  if (id === null) return fail(res, 400, "invalid_input", "Geçersiz hesap.");
  if (!env.limits.detail(adminId)) return fail(res, 429, "rate_limited", "Biraz bekleyip tekrar dene.");
  const found = env.accounts.adminAccountDetail(id, env.now);
  if (!found) return fail(res, 404, "not_found", "Hesap bulunamadı.");
  // E-posta bu yanıtta olduğu için her görüntüleme kaydedilir (yanıttan önce).
  audit(env, adminId, "account_view", "", id);
  const body: AdminAccountDetail = {
    ...found,
    protected: env.adminIds.has(id),
    live: env.social.liveOf(id),
  };
  send(res, 200, body);
}

/** Oyuncu listesi sayfa boyutu: varsayılan ve en büyük. */
export const PLAYER_PAGE_DEFAULT = 25;
export const PLAYER_PAGE_MAX = 50;
/** "Çevrimiçi" süzgecinde sorguya verilen en çok hesap sayısı (soket sayısı bunu aşarsa fazlası listelenmez). */
const PLAYER_ONLINE_IDS_MAX = 2000;
const SORT_DEFAULT_DIR: Readonly<Record<AdminPlayerSort, "asc" | "desc">> = {
  seen: "desc",
  created: "desc",
  glix: "desc",
  name: "asc",
};

/** İmleç: `[değer, kimlik]` çiftinin base64url JSON'u. Sıralamaya uymayan değer tipi geçersizdir. */
export function encodeCursor(value: number | string, id: number): string {
  return Buffer.from(JSON.stringify([value, id])).toString("base64url");
}

export function decodeCursor(
  raw: string,
  sort: AdminPlayerSort,
): { value: number | string; id: number } | null {
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(raw)) return null;
  let v: unknown;
  try {
    v = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!Array.isArray(v) || v.length !== 2) return null;
  const [value, id] = v as [unknown, unknown];
  if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0) return null;
  if (sort === "name") {
    return typeof value === "string" && value.length >= 1 && value.length <= 40 ? { value, id } : null;
  }
  return typeof value === "number" && Number.isSafeInteger(value) && value >= -1e15 && value <= 1e15
    ? { value, id }
    : null;
}

/** Liste sorgu dizgesi doğrulaması; geçersizse null. */
export function parsePlayerQuery(p: URLSearchParams): {
  filter: AdminPlayerFilter;
  sort: AdminPlayerSort;
  dir: "asc" | "desc";
  prefix: string | null;
  after: string | null;
  limit: number;
} | null {
  const filter = p.get("filter") ?? "all";
  const sort = p.get("sort") ?? "seen";
  if (!(ADMIN_PLAYER_FILTERS as readonly string[]).includes(filter)) return null;
  if (!(ADMIN_PLAYER_SORTS as readonly string[]).includes(sort)) return null;
  const s = sort as AdminPlayerSort;
  const dirRaw = p.get("dir");
  if (dirRaw !== null && dirRaw !== "asc" && dirRaw !== "desc") return null;
  const limitRaw = p.get("limit");
  const limit = limitRaw === null ? PLAYER_PAGE_DEFAULT : parseId(limitRaw);
  if (limit === null) return null;
  let prefix: string | null = null;
  const q = p.get("q");
  if (q !== null && q.trim() !== "") {
    const parsed = parseSearch(q);
    if (!parsed || parsed.kind !== "prefix") return null;
    prefix = parsed.value;
  }
  return {
    filter: filter as AdminPlayerFilter,
    sort: s,
    dir: dirRaw ?? SORT_DEFAULT_DIR[s],
    prefix,
    after: p.get("after"),
    limit: Math.min(limit, PLAYER_PAGE_MAX),
  };
}

async function listAccounts(
  res: ServerResponse,
  env: AdminEnv,
  adminId: number,
  params: URLSearchParams,
): Promise<void> {
  const q = parsePlayerQuery(params);
  if (!q) return fail(res, 400, "invalid_input", "Geçersiz liste isteği.");
  const cursor = q.after === null ? null : decodeCursor(q.after, q.sort);
  if (q.after !== null && cursor === null) return fail(res, 400, "invalid_input", "Geçersiz sayfa.");
  if (!env.limits.search(adminId)) return fail(res, 429, "rate_limited", "Biraz bekleyip tekrar dene.");
  const ids =
    q.filter === "online"
      ? env.social.onlineAccountIds().slice(0, PLAYER_ONLINE_IDS_MAX)
      : q.filter === "admin"
        ? [...env.adminIds]
        : null;
  const query: AdminPlayerListQuery = {
    suspendedOnly: q.filter === "suspended",
    ids,
    prefix: q.prefix,
    sort: q.sort,
    dir: q.dir,
    cursor,
    limit: q.limit,
  };
  const page = env.accounts.adminPlayerPage(query, env.now);
  const body: AdminPlayerPage = {
    rows: page.rows.map((r) => ({
      ...r,
      admin: env.adminIds.has(r.id),
      live: env.social.liveOf(r.id),
    })),
    next: page.next === null ? null : encodeCursor(page.next.value, page.next.id),
    total: page.total,
  };
  send(res, 200, body);
}

async function auditPage(
  res: ServerResponse,
  env: AdminEnv,
  rawBefore: string | null,
  rawLimit: string | null,
): Promise<void> {
  const before = rawBefore === null ? null : parseId(rawBefore);
  const asked = rawLimit === null ? AUDIT_PAGE_DEFAULT : parseId(rawLimit);
  if ((rawBefore !== null && before === null) || asked === null)
    return fail(res, 400, "invalid_input", "Geçersiz sayfa.");
  const limit = Math.min(asked, AUDIT_PAGE_MAX);
  // Bir fazla okunur: fazlası varsa sonraki sayfa vardır.
  const rows = env.accounts.adminAuditPage(before, limit + 1);
  const more = rows.length > limit;
  const page = more ? rows.slice(0, limit) : rows;
  const body: AdminAuditPage = {
    entries: page.map((r) => ({
      id: r.id,
      actorId: r.accountId,
      action: r.action,
      targetId: r.targetId,
      detail: r.detail,
      at: r.at,
    })),
    nextBefore: more ? (page.at(-1)?.id ?? null) : null,
  };
  send(res, 200, body);
}

type ActionInput =
  | { op: "rename"; id: number; username: string }
  | { op: "suspend"; id: number; duration: SuspendDuration; reason: string }
  | { op: "unsuspend"; id: number }
  | { op: "delete"; id: number; confirm: string }
  | { op: "logout-all"; id: number }
  | { op: "glix"; id: number; amount: number; reason: string }
  | { op: "glix-set"; id: number; balance: number; reason: string }
  | { op: "cosmetic-grant" | "cosmetic-revoke"; id: number; itemId: string }
  | { op: "cosmetic-unequip"; id: number; slot: string };

/** Tek düzeltmede en çok |tutar|. */
export const GLIX_ADJUST_MAX = 100_000;
/** "Bakiyeyi ayarla" hedefi en çok bu kadar olabilir. */
export const GLIX_BALANCE_MAX = 10_000_000;

/** Kuşanılabilen kozmetik türü kimlikleri (yönetici "kuşanmayı kaldır" için). */
const EQUIP_SLOTS: readonly string[] = COSMETIC_TYPES.filter((t) => t.key !== null).map((t) => t.id);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function exactKeys(o: Record<string, unknown>, keys: readonly string[]): boolean {
  const own = Object.keys(o);
  return own.length === keys.length && keys.every((k) => own.includes(k));
}

/** Sebep: kırpılmış, 1-140 karakter, denetim karakteri yok. */
export function cleanReason(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const text = v.trim();
  // biome-ignore lint/suspicious/noControlCharactersInRegex: denetim karakterleri bilerek reddedilir
  if (text.length === 0 || text.length > SUSPEND_REASON_MAX || /[\u0000-\u001f\u007f]/.test(text))
    return null;
  return text;
}

/** İşlem gövdesi doğrulaması; geçersizse null. */
export function parseAction(op: ActionInput["op"], data: unknown): ActionInput | null {
  if (!isRecord(data)) return null;
  const id = data.id;
  if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0) return null;
  switch (op) {
    case "rename": {
      if (!exactKeys(data, ["id", "username"])) return null;
      const username = data.username;
      return typeof username === "string" && USERNAME_PATTERN.test(username) ? { op, id, username } : null;
    }
    case "suspend": {
      if (!exactKeys(data, ["id", "duration", "reason"])) return null;
      const duration = data.duration;
      const reason = cleanReason(data.reason);
      if (typeof duration !== "string" || !Object.hasOwn(SUSPEND_DURATIONS, duration) || reason === null)
        return null;
      return { op, id, duration: duration as SuspendDuration, reason };
    }
    case "glix": {
      if (!exactKeys(data, ["id", "amount", "reason"])) return null;
      const amount = data.amount;
      const reason = cleanReason(data.reason);
      if (
        typeof amount !== "number" ||
        !Number.isSafeInteger(amount) ||
        amount === 0 ||
        Math.abs(amount) > GLIX_ADJUST_MAX ||
        reason === null
      )
        return null;
      return { op, id, amount, reason };
    }
    case "glix-set": {
      if (!exactKeys(data, ["id", "balance", "reason"])) return null;
      const balance = data.balance;
      const reason = cleanReason(data.reason);
      if (
        typeof balance !== "number" ||
        !Number.isSafeInteger(balance) ||
        balance < 0 ||
        balance > GLIX_BALANCE_MAX ||
        reason === null
      )
        return null;
      return { op, id, balance, reason };
    }
    case "cosmetic-unequip": {
      if (!exactKeys(data, ["id", "slot"])) return null;
      const slot = data.slot;
      return typeof slot === "string" && EQUIP_SLOTS.includes(slot) ? { op, id, slot } : null;
    }
    case "cosmetic-grant":
    case "cosmetic-revoke": {
      if (!exactKeys(data, ["id", "itemId"])) return null;
      const itemId = data.itemId;
      if (typeof itemId !== "string" || !cosmeticItem(itemId)) return null;
      return { op, id, itemId };
    }
    case "delete": {
      if (!exactKeys(data, ["id", "confirm"])) return null;
      const confirm = data.confirm;
      return typeof confirm === "string" && confirm.length <= 64 ? { op, id, confirm } : null;
    }
    default:
      return exactKeys(data, ["id"]) ? { op, id } : null;
  }
}

const ACTION_OPS: Readonly<Record<string, ActionInput["op"]>> = {
  "accounts/rename": "rename",
  "accounts/suspend": "suspend",
  "accounts/unsuspend": "unsuspend",
  "accounts/delete": "delete",
  "accounts/logout-all": "logout-all",
  "accounts/glix": "glix",
  "accounts/cosmetic-grant": "cosmetic-grant",
  "accounts/cosmetic-revoke": "cosmetic-revoke",
  "accounts/cosmetic-unequip": "cosmetic-unequip",
  "accounts/glix-set": "glix-set",
};

async function accountAction(
  req: IncomingMessage,
  res: ServerResponse,
  env: AdminEnv,
  adminId: number,
  name: string,
): Promise<void> {
  const op = ACTION_OPS[name];
  if (!op) return notFound(res);
  if (!env.limits.action(adminId)) return fail(res, 429, "rate_limited", "Biraz bekleyip tekrar dene.");
  const input = parseAction(op, await readJson(req, MAX_ACTION_BODY_BYTES));
  if (!input) return fail(res, 400, "invalid_input", "Geçersiz istek.");
  // Yönetici listesindeki hesaplar (işlemi yapan dahil) korunur.
  if (env.adminIds.has(input.id))
    return fail(res, 403, "protected", "Yönetici hesaplarına bu işlem yapılamaz.");
  const target = env.accounts.findById(input.id);
  if (!target) return fail(res, 404, "not_found", "Hesap bulunamadı.");
  const { id } = input;

  switch (input.op) {
    case "rename": {
      if (input.username === target.username)
        return fail(res, 400, "username_same", "Bu zaten kullanıcı adı.");
      const done = env.accounts.forceUsername(id, input.username);
      if (done === "taken") return fail(res, 409, "username_taken", "Bu kullanıcı adı alınmış.");
      if (done === "missing") return fail(res, 404, "not_found", "Hesap bulunamadı.");
      // Canlı etki oyuncunun kendi değişikliğiyle aynı yoldan gider (oda adı, arkadaş listeleri).
      env.social.accountRenamed(id, input.username);
      audit(env, adminId, "account_rename", "", id);
      return send(res, 200, { ok: true, username: input.username });
    }
    case "suspend": {
      const days = SUSPEND_DURATIONS[input.duration];
      const until = days === null ? null : env.now + days * DAY_MS;
      const related = env.accounts.relatedAccountIds(id);
      if (!env.accounts.suspend(id, env.now, until, input.reason))
        return fail(res, 404, "not_found", "Hesap bulunamadı.");
      // Canlı soketler hemen kapanır (hesap dizininden silinmeden önce); sonra bağlantılar misafire döner.
      const dropped = env.social.disconnect(id, SUSPEND_CLOSE_CODE, "Hesabın askıya alındı");
      env.social.accountSignedOut(id, related);
      // Sebep hesap satırında durur (hesapla birlikte silinir); işlem kaydına yalnız süre yazılır.
      audit(env, adminId, "account_suspend", input.duration, id);
      return send(res, 200, { ok: true, until, disconnected: dropped });
    }
    case "unsuspend": {
      if (!env.accounts.unsuspend(id, env.now)) return fail(res, 409, "not_suspended", "Hesap askıda değil.");
      audit(env, adminId, "account_unsuspend", "", id);
      return send(res, 200, { ok: true });
    }
    case "delete": {
      if (!confirmMatches(input.confirm, target.username))
        return fail(res, 400, "confirm_mismatch", "Kullanıcı adını doğru yaz.");
      // Silmeden önce topla: sonrasında ilişki ve Google kimliği okunamaz (KVKK silmesiyle aynı akış).
      const related = env.accounts.relatedAccountIds(id);
      const sub = env.accounts.exportData(id)?.googleSub ?? null;
      if (!env.accounts.deleteAccount(id)) return fail(res, 404, "not_found", "Hesap bulunamadı.");
      env.social.accountDeleted(id, related);
      env.google?.flows.dropPendingFor(sub, target.email);
      audit(env, adminId, "account_delete", "", id);
      log.info("account_deleted");
      return send(res, 200, { ok: true });
    }
    case "glix": {
      const done = env.accounts.adjustGlix(id, input.amount, input.reason, env.now);
      if (!done.ok) {
        return done.reason === "negative"
          ? fail(res, 409, "glix_negative", "Bakiye 0'ın altına inemez.")
          : fail(res, 404, "not_found", "Hesap bulunamadı.");
      }
      audit(env, adminId, "account_glix", String(input.amount), id);
      return send(res, 200, { ok: true, balance: done.balance });
    }
    case "cosmetic-grant": {
      const done = env.accounts.grantCosmetic(id, input.itemId, env.now);
      if (done === "owned") return fail(res, 409, "already_owned", "Hesapta bu ürün zaten var.");
      if (done !== "granted") return fail(res, 404, "not_found", "Hesap ya da ürün bulunamadı.");
      audit(env, adminId, "account_cosmetic_grant", input.itemId, id);
      return send(res, 200, { ok: true });
    }
    case "cosmetic-revoke": {
      if (!env.accounts.revokeCosmetic(id, input.itemId))
        return fail(res, 409, "not_owned", "Hesapta bu ürün yok.");
      // Kuşanılıyorsa odadaki görünümü de düşer.
      env.social.cosmeticsChanged(id);
      audit(env, adminId, "account_cosmetic_revoke", input.itemId, id);
      return send(res, 200, { ok: true });
    }
    case "glix-set": {
      const done = env.accounts.setGlixBalance(id, input.balance, input.reason, env.now, GLIX_ADJUST_MAX);
      if (!done.ok) {
        if (done.reason === "same") return fail(res, 409, "glix_same", "Bakiye zaten bu değerde.");
        if (done.reason === "too_big")
          return fail(res, 400, "glix_too_big", `Tek seferde en çok ${GLIX_ADJUST_MAX} Glix değişebilir.`);
        return fail(res, 404, "not_found", "Hesap bulunamadı.");
      }
      // Kim (işlem kaydı sahibi), ne (eski -> yeni) ve neden (sebep; defterde de durur).
      audit(
        env,
        adminId,
        "account_glix_set",
        `${done.balance - done.amount}->${done.balance}: ${input.reason}`,
        id,
      );
      return send(res, 200, { ok: true, balance: done.balance, amount: done.amount });
    }
    case "cosmetic-unequip": {
      const worn = env.accounts.equippedCosmetics(id)[input.slot];
      if (worn === undefined) return fail(res, 409, "not_equipped", "Bu türde kuşanılmış ürün yok.");
      if (env.accounts.equipCosmetic(id, input.slot as CosmeticTypeId, null) !== "ok")
        return fail(res, 404, "not_found", "Hesap bulunamadı.");
      // Odadaki görünüm de hemen güncellenir (iptal ile aynı yol).
      env.social.cosmeticsChanged(id);
      audit(env, adminId, "account_cosmetic_unequip", `${input.slot}:${worn}`, id);
      return send(res, 200, { ok: true });
    }
    case "logout-all": {
      const related = env.accounts.relatedAccountIds(id);
      const closed = env.accounts.deleteSessionsOf(id);
      env.social.accountSignedOut(id, related);
      audit(env, adminId, "account_logout_all", String(closed), id);
      return send(res, 200, { ok: true, closed });
    }
  }
}

// ---- A3: içerik, bildirim ve bakım ---------------------------------------------------------------------------

/** Duyuru/bildirim gövdesi (metinler dahil) için en büyük bayt. */
const MAX_CONTENT_BODY_BYTES = 2048;

function contentBody(env: AdminEnv): AdminContent {
  return {
    games: env.site.games(),
    announcement: env.site.announcement(),
    gunlukGorevler: env.site.gunlukGorevler(),
  };
}

function maintenanceBody(env: AdminEnv): AdminMaintenance {
  const live = env.live();
  const used = env.accounts.adminAuditCount("db_backup", env.now - DAY_MS);
  return {
    on: env.site.maintenance(),
    activeMatches: live.activeMatches,
    rooms: live.rooms,
    players: live.players,
    draining: live.draining,
    backup: {
      usedToday: used.count,
      limit: BACKUP_PER_DAY,
      nextAt: used.count >= BACKUP_PER_DAY && used.oldest !== null ? used.oldest + DAY_MS : null,
    },
    releases: buildReleases(env.accounts.serverStarts(20), env.runId, env.now),
  };
}

export interface GameSwitchInput {
  id: string;
  open?: boolean;
  random?: boolean;
}

/** `content/game` gövdesi: `id` + en az biri `open` / `random` (doğru/yanlış). */
export function parseGameSwitch(data: unknown): GameSwitchInput | null {
  if (!isRecord(data)) return null;
  const keys = Object.keys(data);
  if (!keys.every((k) => k === "id" || k === "open" || k === "random")) return null;
  const { id, open, random } = data;
  if (typeof id !== "string" || id.length === 0 || id.length > 64) return null;
  if (open === undefined && random === undefined) return null;
  if (open !== undefined && typeof open !== "boolean") return null;
  if (random !== undefined && typeof random !== "boolean") return null;
  return {
    id,
    ...(open === undefined ? {} : { open }),
    ...(random === undefined ? {} : { random }),
  };
}

export interface AnnouncementInput {
  text: string;
  kind: AnnouncementKind;
  endsAt: number | null;
}

/** `announcement/set` gövdesi: `text`, `kind`, `endsAt` (gelecekte bir an ya da null). */
export function parseAnnouncementInput(data: unknown, now: number): AnnouncementInput | null {
  if (!isRecord(data) || !exactKeys(data, ["text", "kind", "endsAt"])) return null;
  const text = cleanAnnouncementText(data.text);
  if (text === null || !isAnnouncementKind(data.kind)) return null;
  const ends = data.endsAt;
  if (ends === null) return { text, kind: data.kind, endsAt: null };
  if (typeof ends !== "number" || !Number.isSafeInteger(ends)) return null;
  if (ends <= now || ends > now + ANNOUNCEMENT_MAX_AHEAD_MS) return null;
  return { text, kind: data.kind, endsAt: ends };
}

export interface BroadcastBody {
  title: string;
  body: string;
  url: string | null;
}

/** `push/broadcast` gövdesi: `title` (≤40), `body` (≤120), `url` (site içi yol ya da null). */
export function parseBroadcastBody(data: unknown): BroadcastBody | null {
  if (!isRecord(data) || !exactKeys(data, ["title", "body", "url"])) return null;
  const title = cleanPlainText(data.title, BROADCAST_TITLE_MAX);
  const body = cleanPlainText(data.body, BROADCAST_BODY_MAX);
  if (title === null || body === null) return null;
  if (data.url === null) return { title, body, url: null };
  const url = cleanSitePath(data.url);
  return url === null ? null : { title, body, url };
}

async function contentAction(
  req: IncomingMessage,
  res: ServerResponse,
  env: AdminEnv,
  adminId: number,
  name: string,
): Promise<void> {
  if (!env.limits.action(adminId)) return fail(res, 429, "rate_limited", "Biraz bekleyip tekrar dene.");
  const data = await readJson(req, MAX_CONTENT_BODY_BYTES);
  const invalid = (): void => fail(res, 400, "invalid_input", "Geçersiz istek.");
  switch (name) {
    case "content/game": {
      const input = parseGameSwitch(data);
      if (!input) return invalid();
      if (env.site.setGame(input.id, input, env.now) === "unknown")
        return fail(res, 404, "not_found", "Oyun bulunamadı.");
      const changes: string[] = [];
      if (input.open !== undefined) changes.push(input.open ? "open" : "closed");
      if (input.random !== undefined) changes.push(input.random ? "pool_in" : "pool_out");
      audit(env, adminId, "game_switch", `${input.id}:${changes.join(",")}`);
      return send(res, 200, { ok: true, games: env.site.games() });
    }
    case "content/quests": {
      if (!isRecord(data) || !exactKeys(data, ["on"]) || typeof data.on !== "boolean") return invalid();
      env.site.setGunlukGorevler(data.on, env.now);
      audit(env, adminId, data.on ? "quests_on" : "quests_off", "");
      return send(res, 200, { ok: true, on: data.on });
    }
    case "announcement/set": {
      const input = parseAnnouncementInput(data, env.now);
      if (!input)
        return fail(
          res,
          400,
          "invalid_input",
          "Duyuru metni 1-140 karakter olmalı (< ve > yok); bitiş zamanı ileri bir an olmalı (en çok 30 gün).",
        );
      const a = env.site.setAnnouncement(input.text, input.kind, input.endsAt, env.now);
      audit(env, adminId, "announcement_set", input.kind);
      return send(res, 200, { ok: true, announcement: a });
    }
    case "announcement/clear": {
      if (!isRecord(data) || Object.keys(data).length !== 0) return invalid();
      env.site.clearAnnouncement();
      audit(env, adminId, "announcement_clear", "");
      return send(res, 200, { ok: true });
    }
    case "maintenance/set": {
      if (!isRecord(data) || !exactKeys(data, ["on"]) || typeof data.on !== "boolean") return invalid();
      env.site.setMaintenance(data.on, env.now);
      audit(env, adminId, data.on ? "maintenance_on" : "maintenance_off", "");
      return send(res, 200, { ok: true, on: data.on });
    }
    case "push/broadcast": {
      const input = parseBroadcastBody(data);
      if (!input)
        return fail(
          res,
          400,
          "invalid_input",
          "Başlık en çok 40, metin en çok 120 karakter olmalı (< ve > yok); bağlantı sitenin kendi yolu olmalı.",
        );
      const started = env.broadcaster.start(input);
      if (!started.ok) {
        const messages = {
          disabled: [503, "Bildirim gönderimi bu sunucuda kapalı."],
          running: [409, "Bir gönderim zaten sürüyor."],
          cooldown: [429, "Saatte en çok bir kez gönderilebilir."],
          empty: [409, "Bildirim açmış kimse yok."],
        } as const;
        const [status, message] = messages[started.reason];
        return fail(res, status, `broadcast_${started.reason}`, message);
      }
      audit(env, adminId, "push_broadcast", `${started.total}`);
      // Sonuç sayıları işlem kaydına gönderim bitince yazılır (başlık ve metin yazılmaz).
      void started.done.then((r) => {
        try {
          env.accounts.adminAudit(
            adminId,
            "push_broadcast_done",
            `${r.sent}/${r.failed}/${r.removed}`,
            env.clock.now(),
            null,
          );
        } catch (err) {
          log.error("accounts_error", { op: "admin_audit", error: String(err) });
        }
      });
      return send(res, 202, { ok: true, total: started.total });
    }
    default:
      return notFound(res);
  }
}

/** Yedek dosya adı: UTC `glix-yedek-20261027-2157.tar`. */
export function backupFileName(now: number): string {
  const d = new Date(now);
  const p = (n: number): string => String(n).padStart(2, "0");
  return `glix-yedek-${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}-${p(d.getUTCHours())}${p(d.getUTCMinutes())}.tar`;
}

async function downloadBackup(
  req: IncomingMessage,
  res: ServerResponse,
  env: AdminEnv,
  adminId: number,
  adminHash: string | null,
): Promise<void> {
  if (!env.limits.action(adminId)) return fail(res, 429, "rate_limited", "Biraz bekleyip tekrar dene.");
  const data = await readJson(req, MAX_BODY_BYTES);
  if (!isRecord(data) || !exactKeys(data, ["ack"]) || data.ack !== true)
    return fail(res, 400, "invalid_input", "Geçersiz istek.");
  // E-posta adresleri içerdiği için yedek yalnız yakın zamanda kodla girilmiş oturumda alınır.
  const createdAt = adminHash === null ? null : env.accounts.adminSessionCreatedAt(adminHash);
  if (createdAt === null || env.now - createdAt > BACKUP_FRESH_MS) {
    audit(env, adminId, "db_backup_denied", "fresh_required");
    return fail(res, 403, "fresh_required", "Yedek için giriş kodunu yeniden girmelisin.");
  }
  if (env.accounts.adminAuditCount("db_backup", env.now - DAY_MS).count >= BACKUP_PER_DAY)
    return fail(res, 429, "backup_limit", "Günde en çok 3 yedek alınabilir.");
  let backup: Awaited<ReturnType<BackupService["create"]>>;
  try {
    backup = await env.backup.create(env.now);
  } catch (err) {
    log.error("backup_failed", { error: String(err) });
    audit(env, adminId, "db_backup_failed", "");
    return fail(res, 500, "backup_failed", "Yedek alınamadı.");
  }
  if (!backup) return fail(res, 409, "backup_busy", "Başka bir yedek hazırlanıyor.");
  // Kayıt indirme başlamadan yazılır; indirme yarıda kesilse de hak harcanmış sayılır.
  audit(env, adminId, "db_backup", String(backup.files.length));
  res.writeHead(200, {
    "Content-Type": "application/x-tar",
    "Content-Length": String(backup.size),
    "Content-Disposition": `attachment; filename="${backupFileName(env.now)}"`,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  pipeline(backup.stream, res, (err) => {
    if (err) log.warn("backup_stream_ended", { error: String(err) });
  });
}

// ---- A4: moderasyon -----------------------------------------------------------------------------------------------

const MAX_MODERATION_BODY_BYTES = 1024;

/** Oda kodu: 5 karakter, büyük harf/rakam. Geçersizse null. */
export function parseRoomCode(v: unknown): string | null {
  if (typeof v !== "string" || v.length !== ROOM_CODE_LENGTH) return null;
  const code = v.toUpperCase();
  return /^[A-Z0-9]{5}$/.test(code) ? code : null;
}

const reportRowOf = (r: ReportRow): AdminReportRow => ({
  id: r.id,
  createdAt: r.createdAt,
  status: r.status,
  reason: r.reason,
  targetName: r.targetName,
  targetAccountId: r.targetAccountId,
  roomCode: r.roomCode,
  gameId: r.gameId,
});

async function reportsPage(res: ServerResponse, env: AdminEnv, q: URLSearchParams): Promise<void> {
  const rawStatus = q.get("status");
  const status = rawStatus === null || rawStatus === "" ? null : rawStatus;
  const rawBefore = q.get("before");
  const before = rawBefore === null ? null : parseId(rawBefore);
  const rawLimit = q.get("limit");
  const asked = rawLimit === null ? AUDIT_PAGE_DEFAULT : parseId(rawLimit);
  if (
    (status !== null && !isReportStatus(status)) ||
    (rawBefore !== null && before === null) ||
    asked === null
  )
    return fail(res, 400, "invalid_input", "Geçersiz istek.");
  const limit = Math.min(asked, AUDIT_PAGE_MAX);
  const rows = env.accounts.reportPage(status, before, limit + 1);
  const more = rows.length > limit;
  const page = more ? rows.slice(0, limit) : rows;
  const body: AdminReportPage = {
    reports: page.map(reportRowOf),
    nextBefore: more ? (page.at(-1)?.id ?? null) : null,
    counts: env.accounts.reportCounts(),
  };
  send(res, 200, body);
}

async function reportDetail(
  res: ServerResponse,
  env: AdminEnv,
  adminId: number,
  rawId: string | null,
): Promise<void> {
  const id = parseId(rawId);
  if (id === null) return fail(res, 400, "invalid_input", "Geçersiz bildirim.");
  if (!env.limits.search(adminId)) return fail(res, 429, "rate_limited", "Biraz bekleyip tekrar dene.");
  const r = env.accounts.reportGet(id);
  if (!r) return fail(res, 404, "not_found", "Bildirim bulunamadı.");
  const body: AdminReportDetail = {
    ...reportRowOf(r),
    reporterAccountId: r.reporterAccountId,
    note: r.note,
    evidence: r.evidence,
    adminNote: r.adminNote,
    reviewedAt: r.reviewedAt,
    targetPlayerId: r.targetPlayerId,
    inRoom: env.rooms.hasPlayer(r.roomCode, r.targetPlayerId),
    targetProtected: r.targetAccountId !== null && env.adminIds.has(r.targetAccountId),
  };
  send(res, 200, body);
}

async function roomPlayers(
  res: ServerResponse,
  env: AdminEnv,
  adminId: number,
  rawCode: string | null,
): Promise<void> {
  const code = parseRoomCode(rawCode);
  if (code === null) return fail(res, 400, "invalid_input", "Geçersiz oda kodu.");
  if (!env.limits.detail(adminId)) return fail(res, 429, "rate_limited", "Biraz bekleyip tekrar dene.");
  const found = env.rooms.players(code);
  if (!found) return fail(res, 404, "not_found", "Oda bulunamadı (kapanmış olabilir).");
  // Görünen adlar bu yanıtta olduğu için her açış kaydedilir (yanıttan önce).
  audit(env, adminId, "room_view", code);
  const body: AdminRoomPlayers = found;
  send(res, 200, body);
}

function bannedBody(env: AdminEnv): AdminBannedWords {
  return { words: env.banned.list(), max: BANNED_WORDS_MAX };
}

/** Listeye takılan mevcut hesaplar (salt okunur yardımcı); en çok bu kadar gösterilir. */
export const BANNED_ACCOUNTS_LIMIT = 50;
const SCAN_BATCH = 2000;
const SCAN_MAX_BATCHES = 100;

async function bannedAccounts(res: ServerResponse, env: AdminEnv, adminId: number): Promise<void> {
  if (!env.limits.search(adminId)) return fail(res, 429, "rate_limited", "Biraz bekleyip tekrar dene.");
  const found: { id: number; username: string }[] = [];
  let truncated = false;
  let after = 0;
  for (let i = 0; i < SCAN_MAX_BATCHES && !truncated; i++) {
    const batch = env.accounts.scanUsernames(after, SCAN_BATCH);
    if (batch.length === 0) break;
    for (const a of batch) {
      if (env.banned.matches(a.username)) {
        if (found.length >= BANNED_ACCOUNTS_LIMIT) {
          truncated = true;
          break;
        }
        found.push(a);
      }
    }
    after = batch[batch.length - 1]?.id ?? after;
    if (batch.length < SCAN_BATCH) break;
  }
  const body: AdminBannedAccounts = { accounts: found, truncated };
  send(res, 200, body);
}

type ModerationInput =
  | { op: "reports/status"; id: number; status: ReportStatus; note: string }
  | { op: "rooms/close"; code: string }
  | { op: "rooms/kick"; code: string; playerId: string }
  | { op: "banned-words/add"; word: string }
  | { op: "banned-words/remove"; word: string };

/** Yönetici notu: kırpılmış, ≤300 karakter, denetim karakteri yok; boş olabilir. */
export function cleanAdminNote(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const text = v.trim();
  // biome-ignore lint/suspicious/noControlCharactersInRegex: denetim karakterleri bilerek reddedilir
  if (Array.from(text).length > REPORT_ADMIN_NOTE_MAX || /[\u0000-\u001f\u007f]/.test(text)) return null;
  return text;
}

/** Moderasyon işlem gövdesi doğrulaması; geçersizse null. */
export function parseModeration(op: ModerationInput["op"], data: unknown): ModerationInput | null {
  if (!isRecord(data)) return null;
  switch (op) {
    case "reports/status": {
      if (!exactKeys(data, ["id", "status", "note"])) return null;
      const { id, status } = data;
      const note = cleanAdminNote(data.note);
      if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0) return null;
      if (!isReportStatus(status) || note === null) return null;
      return { op, id, status, note };
    }
    case "rooms/close": {
      if (!exactKeys(data, ["code"])) return null;
      const code = parseRoomCode(data.code);
      return code === null ? null : { op, code };
    }
    case "rooms/kick": {
      if (!exactKeys(data, ["code", "playerId"])) return null;
      const code = parseRoomCode(data.code);
      const playerId = data.playerId;
      if (code === null || typeof playerId !== "string" || !/^[0-9a-f]{12}$/.test(playerId)) return null;
      return { op, code, playerId };
    }
    case "banned-words/add":
    case "banned-words/remove": {
      if (!exactKeys(data, ["word"]) || typeof data.word !== "string" || data.word.length > 200) return null;
      return { op, word: data.word };
    }
  }
}

async function moderationAction(
  req: IncomingMessage,
  res: ServerResponse,
  env: AdminEnv,
  adminId: number,
  name: string,
): Promise<void> {
  if (!env.limits.action(adminId)) return fail(res, 429, "rate_limited", "Biraz bekleyip tekrar dene.");
  const input = parseModeration(
    name as ModerationInput["op"],
    await readJson(req, MAX_MODERATION_BODY_BYTES),
  );
  if (!input) return fail(res, 400, "invalid_input", "Geçersiz istek.");
  switch (input.op) {
    case "reports/status": {
      const report = env.accounts.reportGet(input.id);
      if (!report) return fail(res, 404, "not_found", "Bildirim bulunamadı.");
      env.accounts.reportSetStatus(input.id, input.status, input.note, env.now);
      // Not metni işlem kaydına yazılmaz; yalnız yeni durum.
      audit(env, adminId, "report_status", `${input.id}:${input.status}`, report.targetAccountId);
      return send(res, 200, { ok: true, status: input.status });
    }
    case "rooms/close": {
      if (!env.rooms.close(input.code))
        return fail(res, 404, "not_found", "Oda bulunamadı (kapanmış olabilir).");
      audit(env, adminId, "room_close", input.code);
      return send(res, 200, { ok: true });
    }
    case "rooms/kick": {
      // Yönetici hesabının oyuncusu atılamaz (hesap işlemleriyle aynı koruma).
      const target = env.rooms.accountIdOf(input.code, input.playerId);
      if (target !== null && env.adminIds.has(target))
        return fail(res, 403, "protected", "Yönetici hesaplarına bu işlem yapılamaz.");
      const done = env.rooms.kick(input.code, input.playerId);
      if (done === "no_room") return fail(res, 404, "not_found", "Oda bulunamadı (kapanmış olabilir).");
      if (done === "no_player") return fail(res, 404, "not_found", "Oyuncu artık odada değil.");
      audit(env, adminId, "room_kick", input.code, target);
      return send(res, 200, { ok: true });
    }
    case "banned-words/add": {
      const done = env.banned.add(input.word, env.now);
      if (done === "invalid")
        return fail(res, 400, "invalid_input", "Kelime 1-40 karakter olmalı ve en az iki harf içermeli.");
      if (done === "exists") return fail(res, 409, "exists", "Bu kelime zaten listede.");
      if (done === "full") return fail(res, 409, "full", `Liste dolu (en çok ${BANNED_WORDS_MAX} kelime).`);
      audit(env, adminId, "banned_word_add", input.word.trim().slice(0, 40));
      return send(res, 200, { ok: true, ...bannedBody(env) });
    }
    case "banned-words/remove": {
      if (!env.banned.remove(input.word)) return fail(res, 404, "not_found", "Kelime listede yok.");
      audit(env, adminId, "banned_word_remove", input.word.trim().slice(0, 40));
      return send(res, 200, { ok: true, ...bannedBody(env) });
    }
  }
}

// ---- A4: içerik havuzları -----------------------------------------------------------------------------------------

const POOL_FILTERS: readonly AdminPoolFilter[] = ["all", "builtin", "custom", "disabled"];
const MAX_POOL_BODY_BYTES = 2048;
/** Toplu doğrulama/ekleme gövdesi: 200 satır x 300 karakter (UTF-8 en çok 4 bayt/karakter için pay dahil). */
const MAX_POOL_BULK_BODY_BYTES = BULK_MAX_LINES * BULK_MAX_LINE_LENGTH * 2 + 1024;

async function poolEntries(
  res: ServerResponse,
  env: AdminEnv,
  adminId: number,
  q: URLSearchParams,
): Promise<void> {
  const poolId = q.get("pool") ?? "";
  const filter = q.get("filter") ?? "all";
  const text = q.get("q") ?? "";
  const rawPage = q.get("page");
  const page = rawPage === null ? 1 : parseId(rawPage);
  if (
    poolId === "" ||
    poolId.length > 64 ||
    !(POOL_FILTERS as readonly string[]).includes(filter) ||
    text.length > 80 ||
    page === null
  )
    return fail(res, 400, "invalid_input", "Geçersiz istek.");
  if (!env.limits.search(adminId)) return fail(res, 429, "rate_limited", "Biraz bekleyip tekrar dene.");
  const body = env.content.page(poolId, text, filter as AdminPoolFilter, page);
  if (!body) return fail(res, 404, "not_found", "Havuz bulunamadı.");
  send(res, 200, body);
}

type PoolInput =
  | { op: "pools/toggle"; pool: string; key: string; disabled: boolean }
  | { op: "pools/add"; pool: string; fields: Record<string, string> }
  | { op: "pools/edit"; pool: string; key: string; fields: Record<string, string> }
  | { op: "pools/delete"; pool: string; key: string }
  | { op: "pools/check" | "pools/bulk"; pool: string; lines: string[] };

const isPoolId = (v: unknown): v is string =>
  typeof v === "string" && /^[a-z0-9-]+\/[a-z0-9-]+$/.test(v) && v.length <= 64;
const isEntryKey = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 200;

function parseFieldValues(v: unknown): Record<string, string> | null {
  if (!isRecord(v)) return null;
  const keys = Object.keys(v);
  if (keys.length === 0 || keys.length > 4) return null;
  const out: Record<string, string> = {};
  for (const k of keys) {
    const value = v[k];
    if (typeof value !== "string" || value.length > 1000 || !/^[a-z]{1,12}$/.test(k)) return null;
    out[k] = value;
  }
  return out;
}

/** Havuz işlem gövdesi doğrulaması; geçersizse null. */
export function parsePoolInput(op: PoolInput["op"], data: unknown): PoolInput | null {
  if (!isRecord(data) || !isPoolId(data.pool)) return null;
  const pool = data.pool;
  switch (op) {
    case "pools/toggle":
      if (
        !exactKeys(data, ["pool", "key", "disabled"]) ||
        !isEntryKey(data.key) ||
        typeof data.disabled !== "boolean"
      )
        return null;
      return { op, pool, key: data.key, disabled: data.disabled };
    case "pools/add": {
      if (!exactKeys(data, ["pool", "fields"])) return null;
      const fields = parseFieldValues(data.fields);
      return fields === null ? null : { op, pool, fields };
    }
    case "pools/edit": {
      if (!exactKeys(data, ["pool", "key", "fields"]) || !isEntryKey(data.key)) return null;
      const fields = parseFieldValues(data.fields);
      return fields === null ? null : { op, pool, key: data.key, fields };
    }
    case "pools/delete":
      return exactKeys(data, ["pool", "key"]) && isEntryKey(data.key) ? { op, pool, key: data.key } : null;
    case "pools/check":
    case "pools/bulk": {
      if (!exactKeys(data, ["pool", "lines"]) || !Array.isArray(data.lines)) return null;
      if (data.lines.length === 0 || data.lines.length > BULK_MAX_LINES) return null;
      const lines: string[] = [];
      for (const l of data.lines) {
        if (typeof l !== "string" || l.length > BULK_MAX_LINE_LENGTH * 4) return null;
        lines.push(l);
      }
      return { op, pool, lines };
    }
  }
}

const POOL_STATUS: Record<string, number> = {
  unknown_pool: 404,
  not_found: 404,
  invalid: 400,
  banned: 400,
  exists: 409,
  full: 409,
  unchanged: 409,
  builtin: 400,
};

async function poolAction(
  req: IncomingMessage,
  res: ServerResponse,
  env: AdminEnv,
  adminId: number,
  name: string,
): Promise<void> {
  const op = name as PoolInput["op"];
  const bulk = op === "pools/check" || op === "pools/bulk";
  // Doğrulama (yazmaz) arama kovasını, değiştiren işlemler işlem kovasını kullanır.
  const allowed = op === "pools/check" ? env.limits.search(adminId) : env.limits.action(adminId);
  if (!allowed) return fail(res, 429, "rate_limited", "Biraz bekleyip tekrar dene.");
  const input = parsePoolInput(
    op,
    await readJson(req, bulk ? MAX_POOL_BULK_BODY_BYTES : MAX_POOL_BODY_BYTES),
  );
  if (!input) return fail(res, 400, "invalid_input", "Geçersiz istek.");
  const done = (
    r: { ok: true; id: string } | { ok: false; code: string; message: string },
    action: string,
    extra = "",
  ): void => {
    if (!r.ok) {
      fail(res, POOL_STATUS[r.code] ?? 400, r.code, r.message);
      return;
    }
    // Girdi metni işlem kaydına yazılmaz: havuz kimliği ve girdinin kısa özeti.
    audit(env, adminId, action, `${input.pool}:${r.id}${extra}`);
    send(res, 200, { ok: true, pool: env.content.summary(input.pool) });
  };
  switch (input.op) {
    case "pools/toggle":
      return done(
        env.content.toggle(input.pool, input.key, input.disabled, env.now),
        input.disabled ? "pool_disable" : "pool_enable",
      );
    case "pools/add":
      return done(env.content.add(input.pool, input.fields, env.now), "pool_add");
    case "pools/edit":
      return done(env.content.edit(input.pool, input.key, input.fields, env.now), "pool_edit");
    case "pools/delete":
      return done(env.content.remove(input.pool, input.key), "pool_delete");
    case "pools/check": {
      const r = env.content.check(input.pool, input.lines);
      return r ? send(res, 200, r) : fail(res, 404, "not_found", "Havuz bulunamadı.");
    }
    case "pools/bulk": {
      const r = env.content.bulk(input.pool, input.lines, env.now);
      if (!r) return fail(res, 404, "not_found", "Havuz bulunamadı.");
      audit(env, adminId, "pool_bulk", `${input.pool}:added=${r.added}:skipped=${r.lines.length - r.ok}`);
      return send(res, 200, r);
    }
  }
}
