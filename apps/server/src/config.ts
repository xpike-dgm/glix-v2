import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface Config {
  host: string;
  port: number;
  clientDir: string;
  allowedOrigins: string[] | null;
  revision: string;
  /** SIGTERM sonrası maçların bitmesi için en çok beklenecek süre (ms). */
  drainTimeoutMs: number;
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
  return {
    drainTimeoutMs,
    host: env.HOST || "0.0.0.0",
    port,
    clientDir: env.CLIENT_DIR || resolve(fileURLToPath(new URL("../../client/dist", import.meta.url))),
    allowedOrigins,
    revision: env.GIT_SHA || "dev",
  };
}
