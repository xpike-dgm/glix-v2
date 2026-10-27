import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Account, AccountStore, Suspension } from "./accountStore.js";
import { SESSION_TTL_MS } from "./accountStore.js";
import { isPrivateOrLoopback, normalizeIp } from "./clientIp.js";
import {
  authorizeUrl,
  exchangeCode,
  GOOGLE_COOKIE,
  GOOGLE_FLOW_TTL_MS,
  type GoogleAuth,
  safeReturnTo,
  sameText,
  suggestUsername,
} from "./google.js";
import { log } from "./log.js";
import { type MailService, resetMessage, verifyMessage } from "./mail.js";
import type { BannedWords } from "./moderation.js";
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

export function readCookie(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0 || part.slice(0, eq).trim() !== name) continue;
    const value = part.slice(eq + 1).trim();
    return TOKEN_PATTERN.test(value) ? value : null;
  }
  return null;
}

export function readSessionToken(cookieHeader: string | undefined): string | null {
  return readCookie(cookieHeader, SESSION_COOKIE);
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

export function clearedCookie(secure: boolean): string {
  return `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure ? "; Secure" : ""}`;
}

/** Google akışının kısa ömürlü çerezi: yalnız sunucudaki akış kaydına opak bir başvuru taşır. */
function oauthCookie(ref: string, secure: boolean, maxAgeSec: number): string {
  return `${GOOGLE_COOKIE}=${ref}; HttpOnly; SameSite=Lax; Path=/api/auth/google; Max-Age=${maxAgeSec}${secure ? "; Secure" : ""}`;
}

// ---- HTTP uçları ------------------------------------------------------------------------------------------

export interface AuthEnv {
  accounts: AccountStore;
  limiter: IpLimiter;
  ip: string;
  now: number;
  trustProxy: boolean;
  allowedOrigins: readonly string[] | null;
  /** Google ile giriş; ayarlı değilse null (uçlar kapalı, `me` bunu bildirir). */
  google: GoogleAuth | null;
  /** E-posta (doğrulama, şifre sıfırlama); ayarlı değilse null. */
  mail: MailService | null;
  /** Yönetici yasaklı kelime listesi (kayıt, ad değiştirme, Google kaydı); verilmezse denetim yok. */
  bannedWords?: BannedWords;
  /** Kullanıcı adı değişince çalışma zamanını (oda adı, arkadaş listeleri) günceller; testlerde verilmeyebilir. */
  onRenamed?: (accountId: number, username: string) => void;
}

export function send(
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

/** Yasaklı kelimeye takılan kullanıcı adı. */
const BANNED_NAME_TEXT = "Bu ad kullanılamaz.";

const FIELD_TEXT: Record<ValidationField, string> = {
  username: "Kullanıcı adı 3-20 karakter olmalı; yalnız harf, rakam ve alt çizgi.",
  email: "Geçerli bir e-posta adresi yaz.",
  password: `Şifre ${PASSWORD_MIN}-${PASSWORD_MAX} karakter olmalı.`,
  login: "Kullanıcı adı/e-posta ya da şifre hatalı.",
};

/**
 * Askıdaki hesap girişi: yalnız doğru şifre/Google kimliği kanıtlandıktan sonra söylenir (hesap varlığı sızmaz).
 * Yönetici notu (sebep) kullanıcıya gösterilmez; hesap sahibi "Verimi indir" dökümünde görür.
 */
export function suspendedMessage(s: Suspension): string {
  return s.until === null
    ? "Hesabın askıya alındı."
    : `Hesabın ${turkishDateTime(s.until)} tarihine kadar askıya alındı.`;
}

function suspended(res: ServerResponse, s: Suspension): void {
  send(res, 403, {
    ok: false,
    code: "account_suspended",
    message: suspendedMessage(s),
    until: s.until,
  });
}

/** Kullanıcı adı/e-posta ya da şifre yanlış: hesabın var olup olmadığı belli edilmez. */
function badCredentials(res: ServerResponse): void {
  fail(res, 401, "bad_credentials", "Kullanıcı adı/e-posta ya da şifre hatalı.");
}

/** Gövde bayt sınırıyla okunur; fazlası ya da bozuk JSON null. */
export function readJson(req: IncomingMessage): Promise<unknown> {
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

/** Oturumu kaydeder; gönderilecek `Set-Cookie` değerini döner. */
function issueSession(env: AuthEnv, req: IncomingMessage, account: Account): string {
  const token = randomBytes(32).toString("base64url");
  env.accounts.createSession(account.id, hashToken(token), env.now);
  return sessionCookie(token, isSecureRequest(req, env.trustProxy));
}

async function startSession(
  res: ServerResponse,
  env: AuthEnv,
  req: IncomingMessage,
  account: Account,
): Promise<void> {
  send(
    res,
    200,
    { ok: true, account: { username: account.username, email: account.email } },
    { "Set-Cookie": issueSession(env, req, account) },
  );
}

async function register(req: IncomingMessage, res: ServerResponse, env: AuthEnv): Promise<void> {
  const input = parseRegister(await readJson(req));
  if (typeof input === "string") {
    fail(res, 400, "invalid_input", FIELD_TEXT[input], input);
    return;
  }
  if (env.bannedWords?.matches(input.username)) {
    fail(res, 400, "invalid_input", BANNED_NAME_TEXT, "username");
    return;
  }
  const hash = await hashPassword(input.password);
  const made = env.accounts.create(input.username, input.email, hash, env.now);
  if (!made.ok) {
    if (made.field === "username") fail(res, 409, "username_taken", "Bu kullanıcı adı alınmış.", "username");
    else fail(res, 409, "email_taken", "Bu e-posta ile zaten bir hesap var.", "email");
    return;
  }
  // Kayıttaki ilk e-posta da yeniden gönderim sınırına sayılır.
  env.mail?.throttle.allow(`verify:${made.account.id}`, env.now, MINUTE_MS, DAY_LIMIT);
  sendVerification(env, made.account);
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
  const hold = env.accounts.suspension(found.id, env.now);
  if (hold) return suspended(res, hold);
  await startSession(res, env, req, found);
}

const MONTHS = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];
/** Türkiye saati (UTC+3, yaz saati yok) ile "3 Kasım 2026 14:05". */
export function turkishDateTime(ms: number): string {
  const d = new Date(ms + 3 * 3600 * 1000);
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** `{username}` gövdesi; geçerliyse kullanıcı adı, değilse null. */
export function parseUsernameChange(data: unknown): string | null {
  if (!isRecord(data) || !exactKeys(data, ["username"])) return null;
  const name = data.username;
  return typeof name === "string" && USERNAME_PATTERN.test(name) ? name : null;
}

async function changeUsername(req: IncomingMessage, res: ServerResponse, env: AuthEnv): Promise<void> {
  const account = accountFromCookie(env.accounts, req.headers.cookie, env.now);
  if (!account) return fail(res, 401, "login_required", "Önce giriş yap.");
  const username = parseUsernameChange(await readJson(req));
  if (username === null) return fail(res, 400, "invalid_input", FIELD_TEXT.username, "username");
  if (username === account.username)
    return fail(res, 400, "username_same", "Bu zaten kullanıcı adın.", "username");
  if (env.bannedWords?.matches(username))
    return fail(res, 400, "invalid_input", BANNED_NAME_TEXT, "username");
  const done = env.accounts.changeUsername(account.id, username, env.now);
  if (!done.ok) {
    if (done.reason === "cooldown") {
      send(res, 429, {
        ok: false,
        code: "username_cooldown",
        message: `Kullanıcı adını ${turkishDateTime(done.availableAt)} tarihinde tekrar değiştirebilirsin.`,
        availableAt: done.availableAt,
      });
      return;
    }
    if (done.reason === "taken")
      return fail(res, 409, "username_taken", "Bu kullanıcı adı alınmış.", "username");
    return fail(res, 401, "login_required", "Önce giriş yap.");
  }
  // Oturum kaydı hesap kimliğine bağlıdır: çerez ve diğer cihazlar yeni adı kendiliğinden görür.
  env.onRenamed?.(account.id, done.account.username);
  send(res, 200, {
    ok: true,
    account: { username: done.account.username, email: done.account.email },
    usernameAvailableAt: done.availableAt,
  });
}

function logout(req: IncomingMessage, res: ServerResponse, env: AuthEnv): void {
  const token = readSessionToken(req.headers.cookie);
  if (token) {
    // Çıkış yapan cihaza bildirim gitmesin: hesaba bağlı kalıcı abonelik de silinir (istemci ayrıca bildirir).
    const account = env.accounts.resolveSession(hashToken(token), env.now);
    if (account) env.accounts.pushDelete(account.id);
    env.accounts.deleteSession(hashToken(token));
  }
  send(res, 200, { ok: true }, { "Set-Cookie": clearedCookie(isSecureRequest(req, env.trustProxy)) });
}

function me(req: IncomingMessage, res: ServerResponse, env: AuthEnv): void {
  const account = accountFromCookie(env.accounts, req.headers.cookie, env.now);
  send(res, 200, {
    ok: true,
    account: account ? { username: account.username, email: account.email } : null,
    // İstemci Google düğmesini ve "Google hesabını bağla" satırını buna göre gösterir.
    providers: { google: env.google !== null, mail: env.mail !== null },
    linked: {
      google: account ? env.accounts.hasGoogle(account.id) : false,
      password: account ? env.accounts.passwordHash(account.id) !== null : false,
    },
    verified: account ? env.accounts.isVerified(account.id) : false,
    // Kullanıcı adı değişikliği bu ana dek kapalıysa açılacağı an (ms); serbestse null.
    usernameAvailableAt: account ? env.accounts.usernameAvailableAt(account.id, env.now) : null,
  });
}

// ---- E-posta doğrulama ve şifre sıfırlama -----------------------------------------------------------------

const VERIFY_TTL_MS = 24 * 3600 * 1000;
const RESET_TTL_MS = 3600 * 1000;
const MINUTE_MS = 60 * 1000;
const DAY_LIMIT = 5;

/** Yeni belirteç üretir (ham değer yalnız e-postaya gider), özetini saklar. */
function issueToken(env: AuthEnv, kind: "verify" | "reset", accountId: number): string {
  const token = randomBytes(32).toString("base64url");
  const ttl = kind === "verify" ? VERIFY_TTL_MS : RESET_TTL_MS;
  env.accounts.createToken(kind, accountId, hashToken(token), env.now + ttl);
  return token;
}

/** Doğrulama e-postasını arka planda gönderir; hata kaydı bozmaz. */
function sendVerification(env: AuthEnv, account: Account): void {
  const mail = env.mail;
  if (!mail) return;
  try {
    const link = `${mail.publicUrl}${AUTH_PREFIX}verify?t=${issueToken(env, "verify", account.id)}`;
    void mail.mailer.send(verifyMessage(account.email, link));
  } catch {
    log.warn("mail_failed");
  }
}

async function verifyLink(req: IncomingMessage, res: ServerResponse, env: AuthEnv): Promise<void> {
  const bounce = (code: "dogrulandi" | "gecersiz"): void => redirect(res, `/#eposta=${code}`);
  if (!env.limiter.takeAuth(env.ip)) return bounce("gecersiz");
  const t = new URL(req.url ?? "", "http://x").searchParams.get("t");
  if (!t || !TOKEN_PATTERN.test(t)) return bounce("gecersiz");
  const id = env.accounts.consumeToken("verify", hashToken(t), env.now);
  if (id === null) return bounce("gecersiz");
  env.accounts.markVerified(id);
  bounce("dogrulandi");
}

async function resendVerification(req: IncomingMessage, res: ServerResponse, env: AuthEnv): Promise<void> {
  const mail = env.mail;
  if (!mail) return fail(res, 404, "mail_disabled", "E-posta gönderimi şu an kapalı.");
  const account = accountFromCookie(env.accounts, req.headers.cookie, env.now);
  if (!account) return fail(res, 401, "login_required", "Önce giriş yap.");
  if (env.accounts.isVerified(account.id)) return send(res, 200, { ok: true, verified: true });
  if (!mail.throttle.allow(`verify:${account.id}`, env.now, MINUTE_MS, DAY_LIMIT))
    return fail(res, 429, "rate_limited", "Biraz bekleyip tekrar dene.");
  sendVerification(env, account);
  send(res, 200, { ok: true, verified: false });
}

async function resetRequest(req: IncomingMessage, res: ServerResponse, env: AuthEnv): Promise<void> {
  const mail = env.mail;
  if (!mail) return fail(res, 404, "mail_disabled", "E-posta gönderimi şu an kapalı.");
  const data = await readJson(req);
  const email = isRecord(data) && exactKeys(data, ["email"]) ? normalizeEmail(data.email) : null;
  if (email === null) return fail(res, 400, "invalid_input", FIELD_TEXT.email, "email");
  // IP başına günde 20 istek; adres başına dakikada 1 / günde 5. Aşılınca da hesap bilgisi sızmasın diye yanıt aynı.
  if (!mail.throttle.allow(`reset-ip:${env.ip}`, env.now, 0, 20))
    return fail(res, 429, "rate_limited", "Çok fazla deneme yaptın, biraz bekleyip tekrar dene.");
  if (mail.throttle.allow(`reset:${email}`, env.now, MINUTE_MS, DAY_LIMIT)) {
    // Şifresiz (yalnız Google) hesap da bağlantıyla ilk şifresini belirleyebilir.
    const account = env.accounts.findByEmail(email);
    if (account) {
      try {
        const link = `${mail.publicUrl}/#sifre-sifirla=${issueToken(env, "reset", account.id)}`;
        void mail.mailer.send(resetMessage(account.email, link));
      } catch {
        log.warn("mail_failed");
      }
    }
  }
  send(res, 200, { ok: true });
}

async function resetConfirm(req: IncomingMessage, res: ServerResponse, env: AuthEnv): Promise<void> {
  const data = await readJson(req);
  if (!isRecord(data) || !exactKeys(data, ["token", "password"]) || typeof data.token !== "string")
    return fail(res, 400, "invalid_input", "Geçersiz istek.");
  if (!validPassword(data.password)) return fail(res, 400, "invalid_input", FIELD_TEXT.password, "password");
  const expired = (): void =>
    fail(res, 410, "token_invalid", "Bağlantı geçersiz ya da süresi dolmuş. Yeniden iste.");
  if (!TOKEN_PATTERN.test(data.token)) return expired();
  const hash = await hashPassword(data.password);
  const id = env.accounts.consumeToken("reset", hashToken(data.token), env.now);
  if (id === null) return expired();
  // Bağlantı e-postaya ulaşıldığını kanıtlar; tüm oturumlar düşer, kullanıcı yeni oturumla girer.
  env.accounts.replacePassword(id, hash, null);
  env.accounts.markVerified(id);
  const account = env.accounts.findById(id);
  if (!account) return expired();
  const hold = env.accounts.suspension(id, env.now);
  if (hold) return suspended(res, hold);
  await startSession(res, env, req, account);
}

async function changePassword(req: IncomingMessage, res: ServerResponse, env: AuthEnv): Promise<void> {
  const token = readSessionToken(req.headers.cookie);
  const account = accountFromCookie(env.accounts, req.headers.cookie, env.now);
  if (!account || !token) return fail(res, 401, "login_required", "Önce giriş yap.");
  const data = await readJson(req);
  if (!isRecord(data) || !exactKeys(data, ["current", "password"]) || typeof data.current !== "string")
    return fail(res, 400, "invalid_input", "Geçersiz istek.");
  if (!validPassword(data.password)) return fail(res, 400, "invalid_input", FIELD_TEXT.password, "password");
  const stored = env.accounts.passwordHash(account.id);
  if (!stored)
    return fail(
      res,
      409,
      "no_password",
      "Hesabında şifre yok. Şifremi unuttum ile bir şifre belirleyebilirsin.",
    );
  const key = `pw:${account.id}`;
  if (!env.limiter.canTryLogin(key))
    return fail(res, 429, "rate_limited", "Çok fazla deneme yaptın, biraz bekleyip tekrar dene.");
  if (!(await verifyPassword(data.current, stored))) {
    env.limiter.recordFailedLogin(key);
    return fail(res, 401, "bad_credentials", "Mevcut şifre hatalı.", "current");
  }
  env.accounts.replacePassword(account.id, await hashPassword(data.password), hashToken(token));
  send(res, 200, { ok: true });
}

// ---- Google ile giriş -------------------------------------------------------------------------------------

function redirect(res: ServerResponse, location: string, cookies: string[] = []): void {
  res.writeHead(302, {
    Location: location,
    "Cache-Control": "no-store",
    ...(cookies.length > 0 ? { "Set-Cookie": cookies } : {}),
    ...SECURITY_HEADERS,
  });
  res.end();
}

/** Hata uygulamaya kısa bir kodla döner; istemci Türkçe metne çevirir (`#google-hata=<kod>`). */
const googleError = (code: string): string => `/#google-hata=${code}`;

function googleStart(req: IncomingMessage, res: ServerResponse, env: AuthEnv): void {
  if (!env.google) {
    redirect(res, googleError("kapali"));
    return;
  }
  if (!env.limiter.takeAuth(env.ip)) {
    redirect(res, googleError("cok_deneme"));
    return;
  }
  const q = new URL(req.url ?? "", "http://x").searchParams;
  const flow = env.google.flows.begin(env.now, safeReturnTo(q.get("returnTo")));
  const secure = isSecureRequest(req, env.trustProxy);
  redirect(res, authorizeUrl(env.google.config, flow), [
    oauthCookie(flow.ref, secure, Math.floor(GOOGLE_FLOW_TTL_MS / 1000)),
  ]);
}

/** Kullanıcı adı önerisi: alınmışsa sonuna rakam eklenir. */
function freeSuggestion(env: AuthEnv, email: string): string {
  const base = suggestUsername(email);
  if (!env.accounts.findByLogin(base)) return base;
  for (let i = 0; i < 8; i++) {
    const candidate = `${base.slice(0, 16)}${100 + Math.floor(Math.random() * 900)}`;
    if (!env.accounts.findByLogin(candidate)) return candidate;
  }
  return base;
}

async function googleCallback(req: IncomingMessage, res: ServerResponse, env: AuthEnv): Promise<void> {
  const secure = isSecureRequest(req, env.trustProxy);
  const clear = oauthCookie("", secure, 0);
  const bounce = (code: string): void => redirect(res, googleError(code), [clear]);
  const google = env.google;
  if (!google) return bounce("kapali");
  if (!env.limiter.takeAuth(env.ip)) return bounce("cok_deneme");
  const flow = google.flows.take(readCookie(req.headers.cookie, GOOGLE_COOKIE), env.now);
  if (!flow) return bounce("gecersiz");
  const q = new URL(req.url ?? "", "http://x").searchParams;
  const state = q.get("state");
  if (!state || !sameText(state, flow.state)) return bounce("gecersiz");
  if (q.has("error")) return bounce(q.get("error") === "access_denied" ? "iptal" : "dogrulanamadi");
  const code = q.get("code");
  if (!code || code.length > 2048) return bounce("gecersiz");
  const id = await exchangeCode(google.config, code, flow, env.now);
  if (id === "unverified") return bounce("eposta_dogrulanmamis");
  if (typeof id === "string") return bounce("dogrulanamadi");

  const current = accountFromCookie(env.accounts, req.headers.cookie, env.now);
  const owner = env.accounts.findByGoogleSub(id.sub);
  if (owner) {
    // Açık oturum başka bir hesaba aitse sessizce hesap değiştirilmez.
    if (current && current.id !== owner.id) return bounce("baska_hesap");
    const hold = env.accounts.suspension(owner.id, env.now);
    if (hold) {
      // Bitiş anı adres parçasında taşınır (süresizde yok); sebep taşınmaz.
      const until = hold.until === null ? "" : `&bitis=${hold.until}`;
      return redirect(res, `${googleError("askida")}${until}`, [clear]);
    }
    return redirect(res, flow.returnTo, current ? [clear] : [clear, issueSession(env, req, owner)]);
  }
  if (current) {
    if (!env.accounts.linkGoogle(current.id, id.sub)) return bounce("zaten_bagli");
    return redirect(res, flow.returnTo, [clear]);
  }
  // Aynı e-postayla şifreli bir hesap varsa otomatik birleştirilmez: önce şifreyle girip Ayarlar'dan bağlanır.
  if (env.accounts.findByEmail(id.email)) return bounce("eposta_kayitli");
  const token = google.flows.addPending(env.now, id.sub, id.email);
  const hint = encodeURIComponent(freeSuggestion(env, id.email));
  redirect(res, `/#google-yeni=${token}&u=${hint}`, [clear]);
}

/** `complete` gövdesi: `{token, username}`; geçerliyse veri, değilse hatalı alan. */
function parseComplete(data: unknown): { token: string; username: string } | "token" | "username" {
  if (!isRecord(data) || !exactKeys(data, ["token", "username"])) return "token";
  if (typeof data.token !== "string" || !TOKEN_PATTERN.test(data.token)) return "token";
  if (typeof data.username !== "string" || !USERNAME_PATTERN.test(data.username)) return "username";
  return { token: data.token, username: data.username };
}

async function googleComplete(req: IncomingMessage, res: ServerResponse, env: AuthEnv): Promise<void> {
  const google = env.google;
  if (!google) return fail(res, 404, "google_disabled", "Google ile giriş şu an kapalı.");
  const input = parseComplete(await readJson(req));
  if (input === "username") return fail(res, 400, "invalid_input", FIELD_TEXT.username, "username");
  if (input === "token") return fail(res, 400, "invalid_input", "Geçersiz istek.");
  const pending = google.flows.peekPending(input.token, env.now);
  if (!pending)
    return fail(res, 410, "google_expired", "Süre doldu. Google ile girişi baştan dene.", "token");
  if (env.bannedWords?.matches(input.username))
    return fail(res, 400, "invalid_input", BANNED_NAME_TEXT, "username");
  const made = env.accounts.createGoogle(input.username, pending.email, pending.sub, env.now);
  if (!made.ok) {
    if (made.field === "username")
      return fail(res, 409, "username_taken", "Bu kullanıcı adı alınmış.", "username");
    google.flows.dropPending(input.token);
    return fail(
      res,
      409,
      made.field === "email" ? "email_taken" : "google_linked",
      "Bu Google hesabıyla zaten bir hesap var. Şifrenle girip Ayarlar'dan bağla.",
    );
  }
  google.flows.dropPending(input.token);
  await startSession(res, env, req, made.account);
}

/** `/api/auth/*` isteğini işler. Yol bu önekle başlamıyorsa false döner (başkası ilgilensin). */
export function handleAuth(req: IncomingMessage, res: ServerResponse, env: AuthEnv): boolean {
  const path = (req.url ?? "").split("?")[0] ?? "";
  if (!path.startsWith(AUTH_PREFIX)) return false;
  const name = path.slice(AUTH_PREFIX.length);
  const method = req.method ?? "GET";
  const run = async (): Promise<void> => {
    if (name === "google/start" || name === "google/callback") {
      if (method !== "GET") return fail(res, 405, "method_not_allowed", "Geçersiz istek.");
      return name === "google/start" ? googleStart(req, res, env) : googleCallback(req, res, env);
    }
    if (name === "verify") {
      if (method !== "GET") return fail(res, 405, "method_not_allowed", "Geçersiz istek.");
      return verifyLink(req, res, env);
    }
    if (name === "me") {
      if (method !== "GET") return fail(res, 405, "method_not_allowed", "Geçersiz istek.");
      return me(req, res, env);
    }
    const posts = ["register", "login", "logout", "google/complete", "verify/resend", "reset/request"];
    if (!posts.includes(name) && name !== "reset/confirm" && name !== "password" && name !== "username")
      return fail(res, 404, "not_found", "Bulunamadı.");
    if (method !== "POST") return fail(res, 405, "method_not_allowed", "Geçersiz istek.");
    if (!originAllowed(req, env.allowedOrigins)) return fail(res, 403, "forbidden", "İstek reddedildi.");
    if (name === "logout") return logout(req, res, env);
    if (!req.headers["content-type"]?.toLowerCase().startsWith("application/json"))
      return fail(res, 400, "invalid_input", "Geçersiz istek.");
    if (!env.limiter.takeAuth(env.ip))
      return fail(res, 429, "rate_limited", "Çok fazla deneme yaptın, biraz bekleyip tekrar dene.");
    if (name === "google/complete") return googleComplete(req, res, env);
    if (name === "verify/resend") return resendVerification(req, res, env);
    if (name === "reset/request") return resetRequest(req, res, env);
    if (name === "reset/confirm") return resetConfirm(req, res, env);
    if (name === "password") return changePassword(req, res, env);
    if (name === "username") return changeUsername(req, res, env);
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
