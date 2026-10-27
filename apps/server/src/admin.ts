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
  type AdminAccountDetail,
  type AdminAccountSearch,
  type AdminAuditPage,
  type AdminContent,
  type AdminLive,
  type AdminMaintenance,
  ANNOUNCEMENT_MAX_AHEAD_MS,
  type AnnouncementKind,
  BROADCAST_BODY_MAX,
  BROADCAST_TITLE_MAX,
  cleanAnnouncementText,
  cleanPlainText,
  cleanSitePath,
  isAnnouncementKind,
} from "@glix/engine";
import { type AccountStore, ADMIN_SEARCH_LIMIT, type AdminSearchQuery } from "./accountStore.js";
import { buildAccounts, buildErrors, buildReleases, buildStats } from "./adminData.js";
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
import type { GoogleAuth } from "./google.js";
import { confirmMatches } from "./kvkk.js";
import { log } from "./log.js";
import { adminCodeMessage, type MailService, type MailThrottle } from "./mail.js";
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
  "content/game",
  "announcement/set",
  "announcement/clear",
  "push/broadcast",
  "maintenance/set",
  "backup",
]);
const GET_ROUTES: ReadonlySet<string> = new Set([
  "status",
  "live",
  "stats",
  "errors",
  "accounts",
  "accounts/search",
  "accounts/detail",
  "audit",
  "content",
  "maintenance",
  "push/status",
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
    case "accounts/search":
      return searchAccounts(res, env, account.id, url.searchParams.get("q"));
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
    case "content/game":
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
  const body: AdminAccountDetail = { ...found, protected: env.adminIds.has(id) };
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
  | { op: "logout-all"; id: number };

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
      env.social.accountSignedOut(id, related);
      // Sebep hesap satırında durur (hesapla birlikte silinir); işlem kaydına yalnız süre yazılır.
      audit(env, adminId, "account_suspend", input.duration, id);
      return send(res, 200, { ok: true, until });
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
  return { games: env.site.games(), announcement: env.site.announcement() };
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
