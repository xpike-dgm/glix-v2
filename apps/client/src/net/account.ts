import { reconnectForAccount } from "./client.js";
import { goHome, setNickname, setState, state } from "./store.js";

const BASE = "/api/auth/";
const NETWORK_ERROR = "Bağlantı kurulamadı, tekrar dene.";

export interface AccountReply {
  ok: boolean;
  /** Kullanıcıya gösterilecek Türkçe metin (başarısızsa). */
  message: string;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Sunucunun döndürdüğü hesap nesnesini doğrular; geçersizse null. */
export function parseAccount(v: unknown): { username: string; email: string } | null {
  if (!isRecord(v) || typeof v.username !== "string" || typeof v.email !== "string") return null;
  return { username: v.username, email: v.email };
}

async function call(path: string, method: "GET" | "POST", body?: unknown): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    credentials: "same-origin",
    ...(body === undefined
      ? {}
      : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  });
  try {
    return await res.json();
  } catch {
    return null;
  }
}

/** Açılışta çerezdeki oturumun hesabını öğrenir. Hata olursa misafir kalır. */
export async function refreshAccount(): Promise<void> {
  try {
    const data = await call("me", "GET");
    const account = isRecord(data) ? parseAccount(data.account) : null;
    setState("account", account);
    if (account && !state.nickname) setNickname(account.username);
  } catch {
    // ağ yok: misafir gibi devam
  }
}

async function enter(path: "login" | "register", body: unknown): Promise<AccountReply> {
  let data: unknown;
  try {
    data = await call(path, "POST", body);
  } catch {
    return { ok: false, message: NETWORK_ERROR };
  }
  if (!isRecord(data)) return { ok: false, message: NETWORK_ERROR };
  const account = data.ok === true ? parseAccount(data.account) : null;
  if (!account) {
    return { ok: false, message: typeof data.message === "string" ? data.message : NETWORK_ERROR };
  }
  setState("account", account);
  // Takma ad boşsa varsayılan kullanıcı adı olur; sonradan serbestçe değiştirilebilir.
  if (!state.nickname) setNickname(account.username);
  reconnectForAccount();
  goHome();
  return { ok: true, message: "" };
}

export const login = (loginName: string, password: string): Promise<AccountReply> =>
  enter("login", { login: loginName.trim(), password });

export const register = (username: string, email: string, password: string): Promise<AccountReply> =>
  enter("register", { username, email: email.trim(), password });

export async function logout(): Promise<void> {
  try {
    await call("logout", "POST", {});
  } catch {
    // çevrimdışıysa da yerel durum temizlenir; çerez sunucuda süresiyle düşer
  }
  setState("account", null);
  reconnectForAccount();
}
