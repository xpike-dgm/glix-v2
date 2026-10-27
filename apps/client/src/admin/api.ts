import type {
  AdminAccountDetail,
  AdminAccountSearch,
  AdminAccounts,
  AdminAuditPage,
  AdminBroadcastStatus,
  AdminContent,
  AdminErrors,
  AdminGameSwitch,
  AdminLive,
  AdminMaintenance,
  AdminStats,
} from "@glix/engine";
import {
  parseAccounts,
  parseAuditPage,
  parseContent,
  parseDetail,
  parseErrors,
  parseGameList,
  parseLive,
  parseMaintenance,
  parsePushStatus,
  parseSearch,
  parseState,
  parseStats,
  tryParse,
} from "./parse.js";

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

export const fetchAccounts = (): Promise<Fetched<AdminAccounts>> => fetched("accounts", parseAccounts);
export const searchAccounts = (q: string): Promise<Fetched<AdminAccountSearch>> =>
  fetched(`accounts/search?q=${encodeURIComponent(q)}`, parseSearch);
export const fetchDetail = (id: number): Promise<Fetched<AdminAccountDetail>> =>
  fetched(`accounts/detail?id=${id}`, parseDetail);
export const fetchAudit = (before: number | null): Promise<Fetched<AdminAuditPage>> =>
  fetched(`audit${before === null ? "" : `?before=${before}`}`, parseAuditPage);

/** Hesap işlemleri (hepsi POST; sunucu Origin, hız sınırı ve işlem kaydını uygular). */
export type AccountAction =
  | { op: "rename"; id: number; username: string }
  | { op: "suspend"; id: number; duration: "1d" | "7d" | "forever"; reason: string }
  | { op: "unsuspend"; id: number }
  | { op: "delete"; id: number; confirm: string }
  | { op: "logout-all"; id: number };

const OK_TEXT: Record<AccountAction["op"], string> = {
  rename: "Kullanıcı adı değiştirildi.",
  suspend: "Hesap askıya alındı.",
  unsuspend: "Askı kaldırıldı.",
  delete: "Hesap silindi.",
  "logout-all": "Tüm oturumlar kapatıldı.",
};

export function runAccountAction(a: AccountAction): Promise<ActionResult> {
  const { op, ...body } = a;
  return action(`accounts/${op}`, body, OK_TEXT[op]);
}

// ---- A3: içerik, bildirim ve bakım ------------------------------------------------------------------------

export const fetchContent = (): Promise<Fetched<AdminContent>> => fetched("content", parseContent);
export const fetchMaintenance = (): Promise<Fetched<AdminMaintenance>> =>
  fetched("maintenance", parseMaintenance);
export const fetchPushStatus = (): Promise<Fetched<AdminBroadcastStatus>> =>
  fetched("push/status", parsePushStatus);

/** Oyun anahtarı: `open` (açık/kapalı) ve/veya `random` (rastgele havuz). Başarıda güncel liste döner. */
export async function setGameSwitch(
  id: string,
  patch: { open?: boolean; random?: boolean },
): Promise<{ ok: true; games: AdminGameSwitch[] } | { ok: false; message: string }> {
  try {
    const r = await raw("POST", "content/game", { id, ...patch });
    if (r.status !== 200) return { ok: false, message: messageOf(r.json, "İşlem yapılamadı.") };
    const games = tryParse(parseGameList, r.json);
    return games ? { ok: true, games } : { ok: false, message: BAD_REPLY };
  } catch {
    return { ok: false, message: NETWORK_ERROR };
  }
}

export const publishAnnouncement = (body: {
  text: string;
  kind: "bilgi" | "uyari";
  endsAt: number | null;
}): Promise<ActionResult> => action("announcement/set", body, "Duyuru yayında.");
export const clearAnnouncement = (): Promise<ActionResult> =>
  action("announcement/clear", {}, "Duyuru kaldırıldı.");
export const startBroadcast = (body: {
  title: string;
  body: string;
  url: string | null;
}): Promise<ActionResult> => action("push/broadcast", body, "Gönderim başladı.");
export const setMaintenance = (on: boolean): Promise<ActionResult> =>
  action("maintenance/set", { on }, on ? "Bakım kipi açıldı." : "Bakım kipi kapandı.");

export interface BackupResult extends ActionResult {
  /** Sunucu hata kodu (ör. `fresh_required`); panel buna göre yönlendirir. */
  code?: string;
}

/** Yedeği indirir (POST; tar dosyası tarayıcıya kaydedilir). */
export async function downloadBackup(): Promise<BackupResult> {
  try {
    const res = await fetch(`${BASE}backup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ack: true }),
      cache: "no-store",
    });
    if (res.status !== 200) {
      let json: unknown = null;
      try {
        json = await res.json();
      } catch {
        json = null;
      }
      const code = typeof json === "object" && json !== null ? (json as { code?: unknown }).code : undefined;
      return {
        ok: false,
        message: messageOf(json, "Yedek alınamadı."),
        ...(typeof code === "string" ? { code } : {}),
      };
    }
    const blob = await res.blob();
    const name = /filename="([A-Za-z0-9._-]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1];
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name ?? "glix-yedek.tar";
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return { ok: true, message: "Yedek indirildi." };
  } catch {
    return { ok: false, message: NETWORK_ERROR };
  }
}
