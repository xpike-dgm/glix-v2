import type { AdminErrors, AdminLive, AdminStats } from "@glix/engine";
import { parseErrors, parseLive, parseState, parseStats, tryParse } from "./parse.js";

const BASE = "/api/admin/";
export const NETWORK_ERROR = "Bağlantı kurulamadı. Biraz sonra tekrar dene.";
export const BAD_REPLY = "Sunucudan beklenmeyen bir yanıt geldi.";

interface Raw {
  status: number;
  json: unknown;
}

async function raw(method: "GET" | "POST", path: string, body?: unknown): Promise<Raw> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: "no-store",
  });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

function messageOf(json: unknown, fallback: string): string {
  if (typeof json === "object" && json !== null) {
    const m = (json as { message?: unknown }).message;
    if (typeof m === "string" && m) return m;
  }
  return fallback;
}

export type Gate = "login" | "notfound" | "need_otp" | "ready" | "error";

/** Oturum ve kod durumu. */
export async function loadGate(): Promise<Gate> {
  try {
    const r = await raw("GET", "status");
    if (r.status === 401) return "login";
    if (r.status === 404) return "notfound";
    if (r.status !== 200) return "error";
    return parseState(r.json) ?? "error";
  } catch {
    return "error";
  }
}

export interface ActionResult {
  ok: boolean;
  message: string;
}

async function action(path: string, body: unknown, okText: string): Promise<ActionResult> {
  try {
    const r = await raw("POST", path, body);
    if (r.status === 200) return { ok: true, message: okText };
    return { ok: false, message: messageOf(r.json, "İşlem yapılamadı.") };
  } catch {
    return { ok: false, message: NETWORK_ERROR };
  }
}

export const sendCode = (): Promise<ActionResult> =>
  action("otp/request", undefined, "Kod e-postana gönderildi.");
export const verifyCode = (code: string): Promise<ActionResult> => action("otp/verify", { code }, "");
export const logout = (): Promise<ActionResult> => action("logout", undefined, "");

export type Fetched<T> = { kind: "ok"; data: T } | { kind: "otp" } | { kind: "error"; message: string };

async function fetched<T>(path: string, parse: (v: unknown) => T): Promise<Fetched<T>> {
  try {
    const r = await raw("GET", path);
    if (r.status === 403 || r.status === 401 || r.status === 404) return { kind: "otp" };
    if (r.status !== 200) return { kind: "error", message: messageOf(r.json, "Veri alınamadı.") };
    const data = tryParse(parse, r.json);
    return data === null ? { kind: "error", message: BAD_REPLY } : { kind: "ok", data };
  } catch {
    return { kind: "error", message: NETWORK_ERROR };
  }
}

export const fetchLive = (): Promise<Fetched<AdminLive>> => fetched("live", parseLive);
export const fetchStats = (): Promise<Fetched<AdminStats>> => fetched("stats", parseStats);
export const fetchErrors = (): Promise<Fetched<AdminErrors>> => fetched("errors", parseErrors);
