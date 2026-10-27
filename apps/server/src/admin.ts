/**
 * Yönetici paneli uçları (U16 A1, salt okunur): erişim denetimi ve üç veri ucu.
 * Erişim = geçerli hesap oturumu + `GLIX_ADMIN_ACCOUNT_IDS` listesinde hesap + e-postayla gelen tek kullanımlık kodla
 * alınmış `glix_admin` çerezi. Kod ve belirteçler asla günlüğe yazılmaz; veritabanında yalnız özetleri durur.
 */
import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AdminLive } from "@glix/engine";
import type { AccountStore } from "./accountStore.js";
import { buildErrors, buildStats } from "./adminData.js";
import { hashToken, isSecureRequest, originAllowed, readCookie, readSessionToken, send } from "./auth.js";
import { log } from "./log.js";
import { adminCodeMessage, type MailService, type MailThrottle } from "./mail.js";
import type { IpLimiter } from "./ratelimit.js";
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

/** Gövdeyi en çok `MAX_BODY_BYTES` okur; geçersiz/büyükse null. */
function readJson(req: IncomingMessage): Promise<unknown> {
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
      if (size > MAX_BODY_BYTES) {
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

function audit(env: AdminEnv, accountId: number, action: string, detail: string): void {
  try {
    env.accounts.adminAudit(accountId, action, detail, env.now);
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

async function route(req: IncomingMessage, res: ServerResponse, env: AdminEnv): Promise<void> {
  // Kapalıyken uçlar yok sayılır: hiçbir şey sızmaz.
  if (env.adminIds.size === 0) return notFound(res);
  const name = (req.url ?? "").split("?")[0]?.slice(ADMIN_PREFIX.length) ?? "";
  const isPost = name === "otp/request" || name === "otp/verify" || name === "logout";
  const isGet = name === "status" || name === "live" || name === "stats" || name === "errors";
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
  if (name === "live") send(res, 200, env.live());
  else if (name === "stats") send(res, 200, buildStats(env.stats, env.accounts, env.now));
  else send(res, 200, buildErrors(env.stats, env.now));
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
