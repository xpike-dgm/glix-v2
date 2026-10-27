import { createSignal } from "solid-js";
import { reconnectForAccount } from "./client.js";
import { type GoogleReturn, parseGoogleReturn } from "./googleRules.js";
import { goHome, setNickname, setState, state, toast } from "./store.js";

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
    if (isRecord(data)) {
      const providers = isRecord(data.providers) ? data.providers : {};
      const linked = isRecord(data.linked) ? data.linked : {};
      setState("google", { enabled: providers.google === true, linked: linked.google === true });
    }
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
  setGoogleNotice(null);
  void refreshAccount();
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
  setState("google", "linked", false);
  reconnectForAccount();
}

// ---- Google ile giriş -------------------------------------------------------------------------------------

/** Google'dan yeni kullanıcı olarak dönüldüyse: kullanıcı adı seçilene dek bekleyen kayıt. */
const [googlePending, setGooglePending] = createSignal<{ token: string; suggestion: string } | null>(null);

export { googlePending, setGooglePending };

/** Giriş ekranında kalıcı gösterilen Google hata metni (kısa toast'ta okunmayacak kadar uzun olabilir). */
const [googleNotice, setGoogleNotice] = createSignal<string | null>(null);

export { googleNotice, setGoogleNotice };

/** Tarayıcıyı sunucudaki Google başlangıç adresine götürür (yönlendirme zinciri sunucuda). */
export function startGoogle(): void {
  window.location.assign(`${BASE}google/start`);
}

/** Adres parçasındaki işareti uygular ve adres çubuğunu temizler. */
function applyGoogleReturn(found: GoogleReturn): void {
  if (found.kind === "yeni") {
    setGooglePending({ token: found.token, suggestion: found.suggestion });
    setState("nav", "googleAd");
    return;
  }
  if (state.account) toast(found.text, "error");
  else {
    setGoogleNotice(found.text);
    setState("nav", "login");
  }
}

/** Açılışta bir kez: Google'dan dönüş işareti varsa uygular. Hesap bilgisinden önce çağrılır. */
export function consumeGoogleReturn(): void {
  const found = parseGoogleReturn(window.location.hash);
  if (!found) return;
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
  applyGoogleReturn(found);
}

/** Kullanıcı adı seçimi: hesabı açar ve oturum başlatır. Başarısızsa kullanıcıya gösterilecek metin. */
export async function completeGoogle(username: string): Promise<AccountReply> {
  const pending = googlePending();
  if (!pending) return { ok: false, message: "Süre doldu. Google ile girişi baştan dene." };
  let data: unknown;
  try {
    data = await call("google/complete", "POST", { token: pending.token, username });
  } catch {
    return { ok: false, message: NETWORK_ERROR };
  }
  if (!isRecord(data)) return { ok: false, message: NETWORK_ERROR };
  const account = data.ok === true ? parseAccount(data.account) : null;
  if (!account) {
    // Süresi dolan ya da kullanılmış kayıt geri alınamaz; kullanıcı girişe döner.
    if (data.code === "google_expired" || data.code === "email_taken" || data.code === "google_linked") {
      setGooglePending(null);
      setGoogleNotice(typeof data.message === "string" ? data.message : null);
      setState("nav", "login");
    }
    return { ok: false, message: typeof data.message === "string" ? data.message : NETWORK_ERROR };
  }
  setGooglePending(null);
  setState("account", account);
  setState("google", "linked", true);
  if (!state.nickname) setNickname(account.username);
  reconnectForAccount();
  goHome();
  return { ok: true, message: "" };
}
