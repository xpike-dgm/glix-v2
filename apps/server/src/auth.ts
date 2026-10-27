import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Account, AccountStore } from "./accountStore.js";
import { SESSION_TTL_MS } from "./accountStore.js";
import { isPrivateOrLoopback, normalizeIp } from "./clientIp.js";
import { log } from "./log.js";
import type { IpLimiter } from "./ratelimit.js";
import { SECURITY_HEADERS } from "./static.js";

export const AUTH_PREFIX = "/api/auth/";
export const SESSION_COOKIE = "glix_sess";
export const MAX_AUTH_BODY_BYTES = 2 * 1024;

export const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;
const EMAIL_MAX = 254;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

// ---- Şifre özeti (scrypt) ---------------------------------------------------------------------------------

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 64;
/** Veritabanından okunan parametrelere üst sınır: bozuk satır sunucuyu kilitlemesin. */
const MAX_SCRYPT_N = 1 << 17;

function scryptAsync(password: string, salt: Buffer, n: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, KEY_LEN, { N: n, r, p, maxmem: 256 * n * r }, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}

/** `scrypt$N$r$p$tuz$özet` (tuz ve özet base64url): parametreler özetle birlikte saklanır. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, SCRYPT_N, SCRYPT_R, SCRYPT_P);
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [n, r, p] = [Number(parts[1]), Number(parts[2]), Number(parts[3])];
  if (![n, r, p].every(Number.isInteger) || n < 2 || n > MAX_SCRYPT_N || r < 1 || r > 16 || p < 1 || p > 4)
    return false;
  const salt = Buffer.from(parts[4] ?? "", "base64url");
  const want = Buffer.from(parts[5] ?? "", "base64url");
  if (salt.length === 0 || want.length !== KEY_LEN) return false;
  const got = await scryptAsync(password, salt, n, r, p);
  return timingSafeEqual(got, want);
}

/** Bilinmeyen kullanıcıda da aynı işi yapmak için (süre farkıyla hesap varlığı sızmasın). */
let dummyHash: Promise<string> | null = null;
function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword("glix-bos-sifre");
  return dummyHash;
}

// ---- Doğrulama --------------------------------------------------------------------------------------------

export type ValidationField = "username" | "email" | "password" | "login";

export interface RegisterInput {
  username: string;
  email: string;
  password: string;
}
export interface LoginInput {
  login: string;
  password: string;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function exactKeys(obj: Record<string, unknown>, keys: readonly string[]): boolean {
  const own = Object.keys(obj);
  return own.length === keys.length && keys.every((k) => own.includes(k));
}

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length <= EMAIL_MAX && EMAIL_PATTERN.test(email) ? email : null;
}

export function validPassword(value: unknown): value is string {
  return typeof value === "string" && value.length >= PASSWORD_MIN && value.length <= PASSWORD_MAX;
}

/** Geçerliyse veri, değilse hatalı alan adı. */
export function parseRegister(data: unknown): RegisterInput | ValidationField {
  if (!isRecord(data) || !exactKeys(data, ["username", "email", "password"])) return "username";
  const username = data.username;
  if (typeof username !== "string" || !USERNAME_PATTERN.test(username)) return "username";
  const email = normalizeEmail(data.email);
  if (email === null) return "email";
  if (!validPassword(data.password)) return "password";
  return { username, email, password: data.password };
}

export function parseLogin(data: unknown): LoginInput | ValidationField {
  if (!isRecord(data) || !exactKeys(data, ["login", "password"])) return "login";
  const login = typeof data.login === "string" ? data.login.trim() : "";
  if (login.length < 3 || login.length > EMAIL_MAX) return "login";
  // Parola uzunluğu denetimi kayıttakiyle aynı: kısa/uzun parola zaten hiçbir hesapta olamaz.
  if (!validPassword(data.password)) return "login";
  return { login, password: data.password };
}

// ---- Çerez ve oturum --------------------------------------------------------------------------------------

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function readSessionToken(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0 || part.slice(0, eq).trim() !== SESSION_COOKIE) continue;
    const value = part.slice(eq + 1).trim();
    return TOKEN_PATTERN.test(value) ? value : null;
  }
  return null;
}

/** Çerezdeki oturumu hesaba çözer (WS yükseltmesi ve `me` kullanır). Hata olursa misafir sayılır. */
export function accountFromCookie(
  accounts: AccountStore,
  cookieHeader: string | undefined,
  now: number,
): Account | null {
  const token = readSessionToken(cookieHeader);
  if (!token) return null;
  try {
    return accounts.resolveSession(hashToken(token), now);
  } catch (err) {
    log.error("accounts_error", { op: "resolve", error: String(err) });
    return null;
  }
}

/** İstek https mi: doğrudan TLS ya da bizim ters vekilimizin `X-Forwarded-Proto: https` bildirimi. */
export function isSecureRequest(req: IncomingMessage, trustProxy: boolean): boolean {
  if ((req.socket as { encrypted?: boolean }).encrypted) return true;
  if (!trustProxy || !isPrivateOrLoopback(normalizeIp(req.socket.remoteAddress ?? ""))) return false;
  const proto = req.headers["x-forwarded-proto"];
  const last = (Array.isArray(proto) ? proto.join(",") : (proto ?? "")).split(",").at(-1)?.trim();
  return last === "https";
}

function sessionCookie(token: string, secure: boolean): string {
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  return `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}

function clearedCookie(secure: boolean): string {
  return `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure ? "; Secure" : ""}`;
}

// ---- HTTP uçları ------------------------------------------------------------------------------------------

export interface AuthEnv {
  accounts: AccountStore;
  limiter: IpLimiter;
  ip: string;
  now: number;
  trustProxy: boolean;
  allowedOrigins: readonly string[] | null;
}

function send(
  res: ServerResponse,
  status: number,
  body: unknown,
  extra: Record<string, string | string[]> = {},
): void {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...extra,
    ...SECURITY_HEADERS,
  });
  res.end(JSON.stringify(body));
}

function fail(res: ServerResponse, status: number, code: string, message: string, field?: string): void {
  send(res, status, { ok: false, code, message, ...(field ? { field } : {}) });
}

const FIELD_TEXT: Record<ValidationField, string> = {
  username: "Kullanıcı adı 3-20 karakter olmalı; yalnız harf, rakam ve alt çizgi.",
  email: "Geçerli bir e-posta adresi yaz.",
  password: `Şifre ${PASSWORD_MIN}-${PASSWORD_MAX} karakter olmalı.`,
  login: "Kullanıcı adı/e-posta ya da şifre hatalı.",
};

/** Kullanıcı adı/e-posta ya da şifre yanlış: hesabın var olup olmadığı belli edilmez. */
function badCredentials(res: ServerResponse): void {
  fail(res, 401, "bad_credentials", "Kullanıcı adı/e-posta ya da şifre hatalı.");
}

/** Gövde bayt sınırıyla okunur; fazlası ya da bozuk JSON null. */
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
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > MAX_AUTH_BODY_BYTES) {
        finish(undefined);
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      try {
        finish(JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown);
      } catch {
        finish(undefined);
      }
    });
    req.on("error", () => finish(undefined));
  });
}

/** CSRF: Origin zorunlu, Host ile aynı olmalı (ve izinli kaynak listesi varsa onda olmalı). */
export function originAllowed(req: IncomingMessage, allowedOrigins: readonly string[] | null): boolean {
  const origin = req.headers.origin;
  const host = req.headers.host;
  if (!origin || !host) return false;
  try {
    if (new URL(origin).host !== host) return false;
  } catch {
    return false;
  }
  return !allowedOrigins || allowedOrigins.includes(origin);
}

async function startSession(
  res: ServerResponse,
  env: AuthEnv,
  req: IncomingMessage,
  account: Account,
): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  env.accounts.createSession(account.id, hashToken(token), env.now);
  const secure = isSecureRequest(req, env.trustProxy);
  send(
    res,
    200,
    { ok: true, account: { username: account.username, email: account.email } },
    { "Set-Cookie": sessionCookie(token, secure) },
  );
}

async function register(req: IncomingMessage, res: ServerResponse, env: AuthEnv): Promise<void> {
  const input = parseRegister(await readJson(req));
  if (typeof input === "string") {
    fail(res, 400, "invalid_input", FIELD_TEXT[input], input);
    return;
  }
  const hash = await hashPassword(input.password);
  const made = env.accounts.create(input.username, input.email, hash, env.now);
  if (!made.ok) {
    if (made.field === "username") fail(res, 409, "username_taken", "Bu kullanıcı adı alınmış.", "username");
    else fail(res, 409, "email_taken", "Bu e-posta ile zaten bir hesap var.", "email");
    return;
  }
  await startSession(res, env, req, made.account);
}

async function login(req: IncomingMessage, res: ServerResponse, env: AuthEnv): Promise<void> {
  const input = parseLogin(await readJson(req));
  if (typeof input === "string") {
    fail(res, 400, "invalid_input", FIELD_TEXT[input], input);
    return;
  }
  const key = input.login.toLowerCase();
  if (!env.limiter.canTryLogin(key)) {
    fail(res, 429, "rate_limited", "Çok fazla deneme yaptın, biraz bekleyip tekrar dene.");
    return;
  }
  const found = env.accounts.findByLogin(key);
  const ok = await verifyPassword(input.password, found?.passHash ?? (await getDummyHash()));
  if (!found?.passHash || !ok) {
    env.limiter.recordFailedLogin(key);
    badCredentials(res);
    return;
  }
  await startSession(res, env, req, found);
}

function logout(req: IncomingMessage, res: ServerResponse, env: AuthEnv): void {
  const token = readSessionToken(req.headers.cookie);
  if (token) env.accounts.deleteSession(hashToken(token));
  send(res, 200, { ok: true }, { "Set-Cookie": clearedCookie(isSecureRequest(req, env.trustProxy)) });
}

function me(req: IncomingMessage, res: ServerResponse, env: AuthEnv): void {
  const account = accountFromCookie(env.accounts, req.headers.cookie, env.now);
  send(res, 200, {
    ok: true,
    account: account ? { username: account.username, email: account.email } : null,
  });
}

/** `/api/auth/*` isteğini işler. Yol bu önekle başlamıyorsa false döner (başkası ilgilensin). */
export function handleAuth(req: IncomingMessage, res: ServerResponse, env: AuthEnv): boolean {
  const path = (req.url ?? "").split("?")[0] ?? "";
  if (!path.startsWith(AUTH_PREFIX)) return false;
  const name = path.slice(AUTH_PREFIX.length);
  const method = req.method ?? "GET";
  const run = async (): Promise<void> => {
    if (name === "me") {
      if (method !== "GET") return fail(res, 405, "method_not_allowed", "Geçersiz istek.");
      return me(req, res, env);
    }
    if (name !== "register" && name !== "login" && name !== "logout")
      return fail(res, 404, "not_found", "Bulunamadı.");
    if (method !== "POST") return fail(res, 405, "method_not_allowed", "Geçersiz istek.");
    if (!originAllowed(req, env.allowedOrigins)) return fail(res, 403, "forbidden", "İstek reddedildi.");
    if (name === "logout") return logout(req, res, env);
    if (!req.headers["content-type"]?.toLowerCase().startsWith("application/json"))
      return fail(res, 400, "invalid_input", "Geçersiz istek.");
    if (!env.limiter.takeAuth(env.ip))
      return fail(res, 429, "rate_limited", "Çok fazla deneme yaptın, biraz bekleyip tekrar dene.");
    if (name === "register") return register(req, res, env);
    return login(req, res, env);
  };
  run().catch((err: unknown) => {
    log.error("auth_failed", { path: name, error: String(err) });
    if (!res.headersSent) fail(res, 500, "server_error", "Bir sorun çıktı, biraz sonra tekrar dene.");
    else res.end();
  });
  return true;
}
