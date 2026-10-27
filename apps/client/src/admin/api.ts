import type {
  AdminAccountDetail,
  AdminAccountSearch,
  AdminAccounts,
  AdminAuditPage,
  AdminBannedAccounts,
  AdminBannedWords,
  AdminBroadcastStatus,
  AdminContent,
  AdminErrors,
  AdminGameSwitch,
  AdminLive,
  AdminMaintenance,
  AdminPoolBulk,
  AdminPoolFilter,
  AdminPoolPage,
  AdminPoolSummary,
  AdminPools,
  AdminReportDetail,
  AdminReportPage,
  AdminRoomPlayers,
  AdminStats,
  ReportStatus,
} from "@glix/engine";
import {
  parseAccounts,
  parseAuditPage,
  parseBannedAccounts,
  parseBannedWords,
  parseContent,
  parseDetail,
  parseErrors,
  parseGameList,
  parseLive,
  parseMaintenance,
  parsePoolBulk,
  parsePoolPage,
  parsePoolSummary,
  parsePools,
  parsePushStatus,
  parseReportDetail,
  parseReportPage,
  parseRoomPlayers,
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

// ---- A4: moderasyon -------------------------------------------------------------------------------------------

export const fetchReports = (
  status: ReportStatus | "all",
  before: number | null,
): Promise<Fetched<AdminReportPage>> => {
  const q = new URLSearchParams();
  if (status !== "all") q.set("status", status);
  if (before !== null) q.set("before", String(before));
  const qs = q.toString();
  return fetched(`reports${qs === "" ? "" : `?${qs}`}`, parseReportPage);
};
export const fetchReport = (id: number): Promise<Fetched<AdminReportDetail>> =>
  fetched(`reports/detail?id=${id}`, parseReportDetail);
export const setReportStatus = (id: number, status: ReportStatus, note: string): Promise<ActionResult> =>
  action("reports/status", { id, status, note }, "Bildirim güncellendi.");

/** Tek odanın oyuncuları (görünen adlar burada; açmak işlem kaydına yazılır). */
export const fetchRoomPlayers = (code: string): Promise<Fetched<AdminRoomPlayers>> =>
  fetched(`rooms/players?code=${encodeURIComponent(code)}`, parseRoomPlayers);
export const closeRoom = (code: string): Promise<ActionResult> =>
  action("rooms/close", { code }, "Oda kapatıldı.");
export const kickPlayer = (code: string, playerId: string): Promise<ActionResult> =>
  action("rooms/kick", { code, playerId }, "Oyuncu odadan atıldı.");

export const fetchBannedWords = (): Promise<Fetched<AdminBannedWords>> =>
  fetched("banned-words", parseBannedWords);
export const fetchBannedAccounts = (): Promise<Fetched<AdminBannedAccounts>> =>
  fetched("banned-words/accounts", parseBannedAccounts);
export const addBannedWord = (word: string): Promise<ActionResult> =>
  action("banned-words/add", { word }, "Kelime eklendi.");
export const removeBannedWord = (word: string): Promise<ActionResult> =>
  action("banned-words/remove", { word }, "Kelime silindi.");

// ---- A4: içerik havuzları ---------------------------------------------------------------------------------------

export const fetchPools = (): Promise<Fetched<AdminPools>> => fetched("pools", parsePools);
export const fetchPoolPage = (
  pool: string,
  q: string,
  filter: AdminPoolFilter,
  page: number,
): Promise<Fetched<AdminPoolPage>> => {
  const qs = new URLSearchParams({ pool, filter, page: String(page) });
  if (q.trim() !== "") qs.set("q", q.trim());
  return fetched(`pools/entries?${qs.toString()}`, parsePoolPage);
};

export type PoolResult = { ok: true; pool: AdminPoolSummary | null } | { ok: false; message: string };

async function poolPost(path: string, body: unknown): Promise<PoolResult> {
  try {
    const r = await raw("POST", path, body);
    if (r.status !== 200) return { ok: false, message: messageOf(r.json, "İşlem yapılamadı.") };
    const pool =
      typeof r.json === "object" && r.json !== null
        ? tryParse(parsePoolSummary, (r.json as { pool?: unknown }).pool)
        : null;
    return { ok: true, pool };
  } catch {
    return { ok: false, message: NETWORK_ERROR };
  }
}

export const togglePoolEntry = (pool: string, key: string, disabled: boolean): Promise<PoolResult> =>
  poolPost("pools/toggle", { pool, key, disabled });
export const addPoolEntry = (pool: string, fields: Record<string, string>): Promise<PoolResult> =>
  poolPost("pools/add", { pool, fields });
export const editPoolEntry = (
  pool: string,
  key: string,
  fields: Record<string, string>,
): Promise<PoolResult> => poolPost("pools/edit", { pool, key, fields });
export const deletePoolEntry = (pool: string, key: string): Promise<PoolResult> =>
  poolPost("pools/delete", { pool, key });

/** Toplu satırları doğrular (`save` false) ya da geçerli olanları kaydeder (`save` true). */
export async function sendPoolLines(
  pool: string,
  lines: string[],
  save: boolean,
): Promise<{ ok: true; data: AdminPoolBulk } | { ok: false; message: string }> {
  try {
    const r = await raw("POST", save ? "pools/bulk" : "pools/check", { pool, lines });
    if (r.status !== 200) return { ok: false, message: messageOf(r.json, "İşlem yapılamadı.") };
    const data = tryParse(parsePoolBulk, r.json);
    return data ? { ok: true, data } : { ok: false, message: BAD_REPLY };
  } catch {
    return { ok: false, message: NETWORK_ERROR };
  }
}
