import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { GOOGLE_CALLBACK_PATH, type GoogleConfig } from "./google.js";
import type { MailConfig } from "./mail.js";
import type { VapidConfig } from "./webpush.js";

export interface Config {
  host: string;
  port: number;
  clientDir: string;
  /** Oyun ansiklopedisi içerik klasörü (`WIKI_DIR`; yönetici wiki'si). */
  wikiDir: string;
  allowedOrigins: string[] | null;
  revision: string;
  /** SIGTERM sonrası maçların bitmesi için en çok beklenecek süre (ms). */
  drainTimeoutMs: number;
  limits: ServerLimits;
  /** İstatistik SQLite yolu; null ise istatistik kapalı. */
  statsDb: string | null;
  /** Hesap SQLite yolu; varsayılan istatistik dosyası. Hiçbiri yoksa null (bellekte, kalıcı değil). */
  accountsDb: string | null;
  /** Web bildirimi VAPID anahtarları; üçü de yoksa null (bildirim kapalı). Geçerliliği sunucu açılırken denetlenir. */
  vapid: VapidConfig | null;
  /** Google ile giriş; kimlik, sır ve genel adres yoksa null (düğme gizlenir). */
  google: GoogleConfig | null;
  /** E-posta (doğrulama, şifre sıfırlama); anahtar, gönderen ve genel adres yoksa null (özellik kapalı). */
  mail: MailConfig | null;
  /** Yönetici paneline girebilen hesap kimlikleri (`GLIX_ADMIN_ACCOUNT_IDS`); boşsa panel kapalıdır (/admin 404). */
  adminAccountIds: ReadonlySet<number>;
  /**
   * TASLAK oyunları açar (`GLIX_TASLAK_OYUNLAR=1`; yalnız geliştirme/önizleme): sahip onayı bekleyen oyunlar lobide
   * elle seçilebilir olur, yine de rastgele havuza girmez. Varsayılan kapalı; üretimde ayarlanmaz.
   */
  draftGames: boolean;
}

export interface ServerLimits {
  maxSockets: number;
  maxSocketsPerIp: number;
  maxRooms: number;
  /** IP başına art arda kurulabilecek oda sayısı (sonrası 6 sn'de 1). */
  roomCreateBurst: number;
  /** Odaya girmemiş soket bu sürede (ms) kapatılır (kod 4000). */
  idleUnjoinedMs: number;
  /** Ters vekil (Caddy) arkasında `X-Forwarded-For` son girdisine güvenilir. */
  trustProxy: boolean;
}

export const DEFAULT_LIMITS: ServerLimits = {
  maxSockets: 3000,
  maxSocketsPerIp: 40,
  maxRooms: 1000,
  roomCreateBurst: 10,
  idleUnjoinedMs: 60_000,
  trustProxy: false,
};

function positiveInt(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const raw = env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) throw new Error(`${name} geçersiz`);
  return n;
}

/** `GLIX_VAPID_PUBLIC`, `GLIX_VAPID_PRIVATE`, `GLIX_VAPID_SUBJECT`; eksik biri varsa bildirim kapalı. */
export function loadVapid(env: NodeJS.ProcessEnv): VapidConfig | null {
  const publicKey = env.GLIX_VAPID_PUBLIC?.trim();
  const privateKey = env.GLIX_VAPID_PRIVATE?.trim();
  const subject = env.GLIX_VAPID_SUBJECT?.trim();
  return publicKey && privateKey && subject ? { publicKey, privateKey, subject } : null;
}

/**
 * `GLIX_GOOGLE_CLIENT_ID` ve `GLIX_GOOGLE_CLIENT_SECRET` birlikte verilir ya da hiç verilmez.
 * Yönlendirme adresi `GLIX_PUBLIC_URL` (örn. https://glix.dgmcraft.online) + `/api/auth/google/callback`;
 * Google Cloud'daki "yetkili yönlendirme URI'si" bununla birebir aynı olmalı.
 */
export function loadGoogle(env: NodeJS.ProcessEnv): GoogleConfig | null {
  const clientId = env.GLIX_GOOGLE_CLIENT_ID?.trim() ?? "";
  const clientSecret = env.GLIX_GOOGLE_CLIENT_SECRET?.trim() ?? "";
  if (!clientId && !clientSecret) return null;
  if (!clientId || !clientSecret)
    throw new Error("GLIX_GOOGLE_CLIENT_ID ve GLIX_GOOGLE_CLIENT_SECRET birlikte verilmeli");
  let base: URL;
  try {
    base = new URL(env.GLIX_PUBLIC_URL?.trim() ?? "");
  } catch {
    throw new Error("GLIX_PUBLIC_URL geçersiz (Google ile giriş için gerekli)");
  }
  if (base.protocol !== "https:" && base.protocol !== "http:") throw new Error("GLIX_PUBLIC_URL geçersiz");
  return { clientId, clientSecret, redirectUri: `${base.origin}${GOOGLE_CALLBACK_PATH}` };
}

/**
 * `GLIX_RESEND_API_KEY` ve `GLIX_MAIL_FROM` ikisi de doluysa ve `GLIX_PUBLIC_URL` geçerliyse e-posta açıktır;
 * aksi halde null: kayıt çalışır (doğrulanmamış), şifre sıfırlama gizlenir.
 */
export function loadMail(env: NodeJS.ProcessEnv): MailConfig | null {
  const apiKey = env.GLIX_RESEND_API_KEY?.trim() ?? "";
  const from = env.GLIX_MAIL_FROM?.trim() ?? "";
  if (!apiKey || !from) return null;
  try {
    const base = new URL(env.GLIX_PUBLIC_URL?.trim() ?? "");
    if (base.protocol !== "https:" && base.protocol !== "http:") return null;
    return { apiKey, from, publicUrl: base.origin };
  } catch {
    return null;
  }
}

/** `GLIX_ADMIN_ACCOUNT_IDS`: virgülle ayrılmış pozitif tam sayı hesap kimlikleri. Boş = panel kapalı; bozuk değer açılışı durdurur. */
export function loadAdminIds(env: NodeJS.ProcessEnv): Set<number> {
  const ids = new Set<number>();
  for (const part of (env.GLIX_ADMIN_ACCOUNT_IDS ?? "").split(",")) {
    const text = part.trim();
    if (!text) continue;
    if (!/^[1-9]\d{0,9}$/.test(text)) throw new Error("GLIX_ADMIN_ACCOUNT_IDS geçersiz");
    ids.add(Number(text));
  }
  return ids;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const port = Number(env.PORT ?? 3900);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error("PORT geçersiz");
  const origins = (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  let allowedOrigins: string[] | null = null;
  if (origins.length > 0) allowedOrigins = origins;
  else if (env.NODE_ENV === "production") allowedOrigins = [];
  const drainTimeoutMs = Number(env.DRAIN_TIMEOUT_MS ?? 600_000);
  if (!Number.isFinite(drainTimeoutMs) || drainTimeoutMs < 0) throw new Error("DRAIN_TIMEOUT_MS geçersiz");
  const statsDb = env.STATS_DB || (env.NODE_ENV === "production" ? "/data/glix.db" : null);
  const trust = (env.TRUST_PROXY ?? "").toLowerCase();
  return {
    limits: {
      maxSockets: positiveInt(env, "MAX_SOCKETS", DEFAULT_LIMITS.maxSockets),
      maxSocketsPerIp: positiveInt(env, "MAX_SOCKETS_PER_IP", DEFAULT_LIMITS.maxSocketsPerIp),
      maxRooms: positiveInt(env, "MAX_ROOMS", DEFAULT_LIMITS.maxRooms),
      roomCreateBurst: positiveInt(env, "ROOM_CREATE_BURST", DEFAULT_LIMITS.roomCreateBurst),
      idleUnjoinedMs: positiveInt(env, "IDLE_UNJOINED_MS", DEFAULT_LIMITS.idleUnjoinedMs),
      trustProxy: trust === "1" || trust === "true",
    },
    drainTimeoutMs,
    host: env.HOST || "0.0.0.0",
    port,
    clientDir: env.CLIENT_DIR || resolve(fileURLToPath(new URL("../../client/dist", import.meta.url))),
    wikiDir: env.WIKI_DIR || resolve(fileURLToPath(new URL("../../../docs/wiki", import.meta.url))),
    allowedOrigins,
    revision: env.GIT_SHA || env.REVISION || "dev",
    vapid: loadVapid(env),
    google: loadGoogle(env),
    mail: loadMail(env),
    adminAccountIds: loadAdminIds(env),
    draftGames: env.GLIX_TASLAK_OYUNLAR === "1",
    statsDb,
    accountsDb: env.ACCOUNTS_DB || statsDb,
  };
}
