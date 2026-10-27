import type { IncomingMessage, ServerResponse } from "node:http";
import type { AccountStore } from "./accountStore.js";
import {
  accountFromCookie,
  clearedCookie,
  hashToken,
  isSecureRequest,
  originAllowed,
  readJson,
  readSessionToken,
  verifyPassword,
} from "./auth.js";
import { badgeById } from "./badges.js";
import { resolveClientIp } from "./clientIp.js";
import type { Clock } from "./clock.js";
import type { GoogleAuth } from "./google.js";
import { log } from "./log.js";
import { type IpLimiter, TokenBucket } from "./ratelimit.js";
import type { Social } from "./social.js";
import { SECURITY_HEADERS } from "./static.js";

/** KVKK uçları (H10): `POST /api/account/export` ve `POST /api/account/delete`. */
export const ACCOUNT_PATH = "/api/account/";

/** Şifresiz (yalnız Google) hesap silerken oturumun en çok bu kadar eski olması gerekir. */
export const FRESH_LOGIN_MS = 10 * 60 * 1000;
/** Hesap başına günde en çok bu kadar döküm indirilebilir. */
export const EXPORT_PER_DAY = 3;
/** Hesap başına silme denemesi: 5 ani, saatte 5 (yanlış kullanıcı adı/şifre denemeleri de sayılır). */
export const DELETE_PER_HOUR = 5;
const DAY_S = 24 * 3600;
const HOUR_S = 3600;

export const PASSWORD_NOTE = "Şifre özeti saklanır, güvenlik nedeniyle dosyaya konmaz.";
export const NO_PASSWORD_NOTE = "Bu hesapta şifre yok (Google ile giriş).";

export interface AccountApiEnv {
  accounts: AccountStore;
  social: Social;
  /** Google akışları; kapalıysa null. Silinen hesabın bekleyen kayıtları buradan düşer. */
  google: GoogleAuth | null;
  limiter: IpLimiter;
  clock: Clock;
  trustProxy: boolean;
  allowedOrigins: readonly string[] | null;
}

interface Failure {
  status: 400 | 401 | 403 | 404 | 405 | 429 | 500;
  code: string;
  message: string;
  field?: string;
}

const fail = (status: Failure["status"], code: string, message: string, field?: string): Failure => ({
  status,
  code,
  message,
  ...(field ? { field } : {}),
});

const TOO_FAST = fail(429, "rate_limited", "Çok fazla deneme yaptın, biraz bekleyip tekrar dene.");

function sendJson(
  res: ServerResponse,
  status: number,
  body: unknown,
  extra: Record<string, string> = {},
): void {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...extra,
    ...SECURITY_HEADERS,
  });
  res.end(JSON.stringify(body));
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** `{confirm, password?}` gövdesi; geçersizse null. */
export function parseDelete(data: unknown): { confirm: string; password: string | null } | null {
  if (!isRecord(data)) return null;
  const keys = Object.keys(data);
  if (!keys.includes("confirm") || keys.some((k) => k !== "confirm" && k !== "password")) return null;
  if (typeof data.confirm !== "string" || data.confirm.length > 64) return null;
  if (data.password !== undefined && (typeof data.password !== "string" || data.password.length > 128))
    return null;
  return { confirm: data.confirm, password: typeof data.password === "string" ? data.password : null };
}

/** Yazılan kullanıcı adı hesabınkiyle uyuşuyor mu (büyük/küçük harf ve baştaki/sondaki boşluk önemsiz). */
export function confirmMatches(typed: string, username: string): boolean {
  return typed.trim().toLowerCase() === username.toLowerCase();
}

/** "2026-10-27": döküm dosya adındaki tarih (Türkiye saati, UTC+3). */
export function exportDay(ms: number): string {
  return new Date(ms + 3 * 3600 * 1000).toISOString().slice(0, 10);
}

const iso = (ms: number): string => new Date(ms).toISOString();
const isoOrNull = (ms: number | null): string | null => (ms === null ? null : iso(ms));

/**
 * "Verimi indir" içeriği: hesap hakkında tuttuğumuz her şey. Şifre özeti ve oturum belirteci özetleri dışarı
 * verilmez. Anahtarlar İngilizce ve açık; en üstte kısa Türkçe açıklama vardır. Hesap yoksa null.
 */
export function buildExport(
  accounts: AccountStore,
  social: Social,
  accountId: number,
  now: number,
): Record<string, unknown> | null {
  const data = accounts.exportData(accountId);
  if (!data) return null;
  const lists = accounts.friendLists(accountId);
  return {
    aciklama:
      "GLIX hesabın hakkında sunucuda tuttuğumuz bilgiler. Misafir olarak oynarken kişisel veri saklamayız; " +
      "anonim ölçümler (maç süresi, hata kaydı) seninle ilişkilendirilmediği için bu dosyada yoktur. " +
      "Tarihler UTC saatiyle yazılmıştır.",
    exported_at: iso(now),
    account: {
      username: data.username,
      email: data.email,
      email_verified: data.emailVerified,
      google_linked: data.googleSub !== null,
      google_sub: data.googleSub,
      password: data.hasPassword ? PASSWORD_NOTE : NO_PASSWORD_NOTE,
      created_at: iso(data.createdAt),
      username_changed_at: isoOrNull(data.usernameChangedAt),
    },
    sessions: data.sessions.map((s) => ({ created_at: iso(s.createdAt), last_seen: iso(s.lastSeen) })),
    stats: {
      games: data.games.map((g) => ({
        game_id: g.gameId,
        ended_at: iso(g.endedAt),
        players: g.players,
        mini_score: g.miniScore,
        rank: g.rank,
        won: g.won,
      })),
      matches: data.matches.map((m) => ({
        ended_at: iso(m.endedAt),
        players: m.players,
        games: m.games,
        score: m.score,
        place: m.place,
        won: m.won,
      })),
      coplay: data.coplay.map((c) => ({
        username: c.username,
        matches: c.matches,
        last_at: iso(c.lastAt),
      })),
    },
    friends: {
      friends: lists.friends.map((f) => ({ username: f.username, since: iso(f.at) })),
      incoming_requests: lists.incoming.map((f) => ({ username: f.username, requested_at: iso(f.at) })),
      outgoing_requests: lists.outgoing.map((f) => ({ username: f.username, requested_at: iso(f.at) })),
      blocked: lists.blocked.map((f) => ({ username: f.username, blocked_at: iso(f.at) })),
    },
    badges: accounts.earnedBadges(accountId).map((b) => ({
      id: b.badgeId,
      name: badgeById(b.badgeId)?.name ?? null,
      earned_at: iso(b.earnedAt),
    })),
    push_subscription: social.hasPush(accountId),
  };
}

/**
 * KVKK uçları. İkisi de POST: oturum, Origin denetimi ve hesap başına hız sınırı şart.
 * Silme anında ve kalıcıdır; odadaki oyuncu misafir olarak mevcut adıyla oyunda kalır (bkz. `Social.accountDeleted`).
 */
export function createAccountApi(env: AccountApiEnv): (req: IncomingMessage, res: ServerResponse) => void {
  const { accounts, social, clock } = env;
  const exports = new Map<number, TokenBucket>();
  const deletes = new Map<number, TokenBucket>();

  const take = (map: Map<number, TokenBucket>, id: number, capacity: number, perSec: number): boolean => {
    let b = map.get(id);
    if (!b) {
      if (map.size > 5000) for (const [k, v] of map) if (v.isFull()) map.delete(k);
      b = new TokenBucket(clock, capacity, perSec);
      map.set(id, b);
    }
    return b.take();
  };

  function fresh(token: string): boolean {
    const at = accounts.sessionCreatedAt(hashToken(token));
    return at !== null && clock.now() - at <= FRESH_LOGIN_MS;
  }

  async function remove(req: IncomingMessage, res: ServerResponse): Promise<Failure | null> {
    const token = readSessionToken(req.headers.cookie);
    const account = accountFromCookie(accounts, req.headers.cookie, clock.now());
    if (!account || !token) return fail(401, "login_required", "Önce giriş yap.");
    if (!req.headers["content-type"]?.toLowerCase().startsWith("application/json"))
      return fail(400, "invalid_input", "Geçersiz istek.");
    const input = parseDelete(await readJson(req));
    if (input === null) return fail(400, "invalid_input", "Geçersiz istek.");
    if (!take(deletes, account.id, DELETE_PER_HOUR, DELETE_PER_HOUR / HOUR_S)) return TOO_FAST;
    if (!confirmMatches(input.confirm, account.username))
      return fail(400, "confirm_mismatch", "Kullanıcı adını doğru yaz.", "confirm");
    const stored = accounts.passwordHash(account.id);
    if (stored) {
      // Şifreli hesap: şifre şart; yanlış denemeler giriş denemeleriyle aynı hesap-başı kovaya sayılır.
      if (input.password === null || input.password.length === 0)
        return fail(400, "invalid_input", "Şifreni yaz.", "password");
      const key = `pw:${account.id}`;
      if (!env.limiter.canTryLogin(key)) return TOO_FAST;
      if (!(await verifyPassword(input.password, stored))) {
        env.limiter.recordFailedLogin(key);
        return fail(401, "bad_credentials", "Şifre hatalı.", "password");
      }
    } else if (!fresh(token)) {
      // Yalnız Google hesabı: şifre yok, yakın zamanda giriş yapılmış olmalı.
      return fail(403, "fresh_login_required", "Güvenlik için çıkış yapıp tekrar giriş yap, sonra sil.");
    }
    // Silmeden önce topla: sonrasında ilişki ve Google kimliği okunamaz.
    const related = accounts.relatedAccountIds(account.id);
    const sub = accounts.exportData(account.id)?.googleSub ?? null;
    if (!accounts.deleteAccount(account.id)) return fail(404, "not_found", "Hesap bulunamadı.");
    social.accountDeleted(account.id, related);
    env.google?.flows.dropPendingFor(sub, account.email);
    log.info("account_deleted");
    sendJson(res, 200, { ok: true }, { "Set-Cookie": clearedCookie(isSecureRequest(req, env.trustProxy)) });
    return null;
  }

  function download(req: IncomingMessage, res: ServerResponse): Failure | null {
    const account = accountFromCookie(accounts, req.headers.cookie, clock.now());
    if (!account) return fail(401, "login_required", "Önce giriş yap.");
    if (!take(exports, account.id, EXPORT_PER_DAY, EXPORT_PER_DAY / DAY_S))
      return fail(429, "rate_limited", "Bugünlük indirme hakkın doldu. Yarın tekrar deneyebilirsin.");
    const now = clock.now();
    const body = buildExport(accounts, social, account.id, now);
    if (!body) return fail(404, "not_found", "Hesap bulunamadı.");
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="glix-verilerim-${exportDay(now)}.json"`,
      "Cache-Control": "no-store",
      ...SECURITY_HEADERS,
    });
    res.end(JSON.stringify(body, null, 2));
    return null;
  }

  async function resolve(req: IncomingMessage, res: ServerResponse): Promise<Failure | null> {
    const name = (req.url ?? "").split("?")[0]?.slice(ACCOUNT_PATH.length) ?? "";
    if (name !== "export" && name !== "delete") return fail(404, "not_found", "Bulunamadı.");
    if (req.method !== "POST") return fail(405, "method_not_allowed", "Geçersiz istek.");
    if (!originAllowed(req, env.allowedOrigins)) return fail(403, "forbidden", "İstek reddedildi.");
    const ip = resolveClientIp(req.socket.remoteAddress, req.headers["x-forwarded-for"], env.trustProxy);
    if (!env.limiter.takeAuth(ip)) return TOO_FAST;
    if (name === "export") {
      req.resume();
      return download(req, res);
    }
    return remove(req, res);
  }

  return (req, res) => {
    resolve(req, res)
      .then((out) => {
        if (out)
          sendJson(res, out.status, {
            ok: false,
            code: out.code,
            message: out.message,
            ...(out.field ? { field: out.field } : {}),
          });
      })
      .catch((err: unknown) => {
        log.error("account_api_failed", { error: String(err) });
        if (!res.headersSent)
          sendJson(res, 500, {
            ok: false,
            code: "server_error",
            message: "Bir sorun oluştu, biraz sonra tekrar dene.",
          });
        else res.end();
      });
  };
}
