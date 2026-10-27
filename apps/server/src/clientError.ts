import type { IncomingMessage, ServerResponse } from "node:http";
import { scrubText, toStoredError } from "./errorScrub.js";
import { log } from "./log.js";
import type { IpLimiter } from "./ratelimit.js";
import { SECURITY_HEADERS } from "./static.js";
import { noopStats, type StatsStore } from "./statsStore.js";

export const CLIENT_ERROR_PATH = "/api/client-error";
export const MAX_CLIENT_ERROR_BYTES = 4 * 1024;
const MAX_MESSAGE = 500;
const MAX_STACK = 2048;
const MAX_URL = 200;
const MAX_VERSION = 32;
const MAX_UA = 200;
const KEYS = new Set(["message", "stack", "url", "version", "ua"]);

export interface ClientErrorEnv {
  allowedOrigins: readonly string[] | null;
  limiter: IpLimiter;
  ip: string;
  /** Kalıcı kayıt (yönetici paneli); verilmezse yalnız günlük. */
  stats?: StatsStore;
  /** Sunucu saati (ms); verilmezse sistem saati. */
  now?: number;
}

function reply(res: ServerResponse, status: number, extra: Record<string, string> = {}): void {
  res.writeHead(status, { "Cache-Control": "no-store", ...extra, ...SECURITY_HEADERS });
  res.end();
}

function str(value: unknown, max: number, required: boolean): string | null | undefined {
  if (value === undefined) return required ? undefined : null;
  if (typeof value !== "string") return undefined;
  return value.slice(0, max);
}

/** Yalnız yol kısmı: sorgu/parça/alan adı atılır (belirteç ya da oda kodu sızmasın diye sorgu zaten gitmez). */
function pathOnly(value: string): string | null {
  if (!value.startsWith("/")) return null;
  return (value.split(/[?#]/)[0] ?? "").slice(0, MAX_URL);
}

export interface ValidClientError {
  message: string;
  stack: string | null;
  url: string | null;
  version: string;
  ua: string | null;
}

export function validateClientError(data: unknown): ValidClientError | null {
  if (typeof data !== "object" || data === null || Array.isArray(data)) return null;
  const rec = data as Record<string, unknown>;
  if (!Object.keys(rec).every((k) => KEYS.has(k))) return null;
  const message = str(rec.message, MAX_MESSAGE, true);
  const version = str(rec.version, MAX_VERSION, true);
  const stack = str(rec.stack, MAX_STACK, false);
  const url = str(rec.url, MAX_URL + 64, false);
  const ua = str(rec.ua, MAX_UA, false);
  if (!message || !version || stack === undefined || url === undefined || ua === undefined) return null;
  let path: string | null = null;
  if (url !== null) {
    path = pathOnly(url);
    if (path === null) return null;
  }
  return { message, stack, url: path, version, ua };
}

/** `POST /api/client-error`. Gövde 4 KB'ı aşarsa akış kesilir. IP günlüğe yazılmaz. */
export function handleClientError(req: IncomingMessage, res: ServerResponse, env: ClientErrorEnv): void {
  if (req.method !== "POST") {
    reply(res, 405, { Allow: "POST" });
    return;
  }
  const origin = req.headers.origin;
  if (origin !== undefined && env.allowedOrigins && !env.allowedOrigins.includes(origin)) {
    reply(res, 403);
    return;
  }
  if (!env.limiter.takeReport(env.ip)) {
    reply(res, 429, { "Retry-After": "60" });
    req.resume();
    return;
  }
  const type = (req.headers["content-type"] ?? "").split(";")[0]?.trim().toLowerCase();
  if (type !== "application/json") {
    reply(res, 415);
    req.resume();
    return;
  }
  const declared = Number(req.headers["content-length"]);
  if (Number.isFinite(declared) && declared > MAX_CLIENT_ERROR_BYTES) {
    reply(res, 413, { Connection: "close" });
    req.resume();
    return;
  }
  const chunks: Buffer[] = [];
  let size = 0;
  let done = false;
  req.on("data", (chunk: Buffer) => {
    if (done) return;
    size += chunk.length;
    if (size > MAX_CLIENT_ERROR_BYTES) {
      done = true;
      reply(res, 413, { Connection: "close" });
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });
  req.on("error", () => {
    done = true;
  });
  req.on("end", () => {
    if (done) return;
    done = true;
    let data: unknown;
    try {
      data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      reply(res, 400);
      return;
    }
    const report = validateClientError(data);
    if (!report) {
      reply(res, 400);
      return;
    }
    // Günlükte de e-posta, IP ve belirteç benzeri diziler maskelenir; uzunluk sınırları doğrulamadakiyle aynı.
    log.warn("client_error", {
      ...report,
      message: scrubText(report.message, 500),
      ...(report.stack ? { stack: scrubText(report.stack, 2048) } : {}),
    });
    (env.stats ?? noopStats).clientError(env.now ?? Date.now(), toStoredError(report));
    reply(res, 204);
  });
}
