import { createSignal } from "solid-js";
import { isStandalone } from "../pwa/packPolicy.js";
import { parseAvailableAt } from "./accountRules.js";
import { reconnectForAccount, sendPushUnsubscribe } from "./client.js";
import { loadFriends, resetFriends } from "./friends.js";
import { type GoogleReturn, parseGoogleReturn } from "./googleRules.js";
import {
  type DeleteForm,
  deleteBody,
  exportDoneText,
  exportFileName,
  fileNameFromDisposition,
  type SaveMethod,
  saveMethod,
} from "./kvkkRules.js";
import { resetLeaderboard } from "./leaderboard.js";
import { parseMailReturn } from "./mailRules.js";
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
    setState(
      "usernameAvailableAt",
      account && isRecord(data) ? parseAvailableAt(data.usernameAvailableAt) : null,
    );
    if (isRecord(data)) {
      const providers = isRecord(data.providers) ? data.providers : {};
      const linked = isRecord(data.linked) ? data.linked : {};
      setState("google", { enabled: providers.google === true, linked: linked.google === true });
      setState("mail", {
        enabled: providers.mail === true,
        verified: account !== null && data.verified === true,
        hasPassword: linked.password === true,
      });
    }
    if (account && !state.nickname) setNickname(account.username);
    if (account) void loadFriends();
    else {
      resetFriends();
      resetLeaderboard();
    }
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
  if (path === "register" && state.mail.enabled)
    toast("Doğrulama maili gönderildi. Gelmezse spam klasörüne bak.");
  return { ok: true, message: "" };
}

export const login = (loginName: string, password: string): Promise<AccountReply> =>
  enter("login", { login: loginName.trim(), password });

export const register = (username: string, email: string, password: string): Promise<AccountReply> =>
  enter("register", { username, email: email.trim(), password });

export async function logout(): Promise<void> {
  // Bu cihazın bildirim aboneliği hesaptan ayrılır (davetler artık bu cihaza gitmesin); soket hâlâ hesaba bağlıyken bildirilir.
  sendPushUnsubscribe();
  resetFriends();
  resetLeaderboard();
  try {
    await call("logout", "POST", {});
  } catch {
    // çevrimdışıysa da yerel durum temizlenir; çerez sunucuda süresiyle düşer
  }
  setState("account", null);
  setState("usernameAvailableAt", null);
  setState("google", "linked", false);
  setState("mail", { verified: false, hasPassword: false });
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

// ---- E-posta doğrulama, şifre sıfırlama ve değiştirme -----------------------------------------------------

/** Sıfırlama bağlantısından gelen belirteç; "Yeni şifre" ekranı bunu kullanır. */
const [resetToken, setResetToken] = createSignal<string | null>(null);

export { resetToken };

/** Açılışta bir kez: e-postadan dönüş işareti varsa uygular ve adres çubuğunu temizler. */
export function consumeMailReturn(): void {
  const found = parseMailReturn(window.location.hash);
  if (!found) return;
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
  if (found.kind === "dogrulama") {
    toast(found.text, found.ok ? "success" : "error");
    return;
  }
  setResetToken(found.token);
  setState("nav", "yeniSifre");
}

/** Genel istek: başarıda `{ok:true, data}`, değilse sunucunun Türkçe metni. */
async function plain(path: string, body: unknown): Promise<{ ok: boolean; message: string; data: unknown }> {
  let data: unknown;
  try {
    data = await call(path, "POST", body);
  } catch {
    return { ok: false, message: NETWORK_ERROR, data: null };
  }
  if (!isRecord(data)) return { ok: false, message: NETWORK_ERROR, data };
  if (data.ok === true) return { ok: true, message: "", data };
  return { ok: false, message: typeof data.message === "string" ? data.message : NETWORK_ERROR, data };
}

/** Doğrulama e-postasını yeniden ister (Ayarlar). */
export async function resendVerification(): Promise<void> {
  const r = await plain("verify/resend", {});
  if (!r.ok) return toast(r.message, "error");
  if (isRecord(r.data) && r.data.verified === true) {
    setState("mail", "verified", true);
    return toast("E-postan zaten doğrulanmış.");
  }
  toast("Doğrulama maili gönderildi. Gelmezse spam klasörüne bak.", "success");
}

/** Şifre sıfırlama bağlantısı ister. Hesap olsun olmasın sunucu aynı yanıtı verir. */
export async function requestReset(email: string): Promise<AccountReply> {
  const r = await plain("reset/request", { email: email.trim() });
  return { ok: r.ok, message: r.message };
}

/** Yeni şifreyi belirler; başarıda kullanıcı yeni oturumla girmiş olur. */
export async function confirmReset(password: string): Promise<AccountReply> {
  const token = resetToken();
  if (!token) return { ok: false, message: "Bağlantı geçersiz ya da süresi dolmuş. Yeniden iste." };
  let data: unknown;
  try {
    data = await call("reset/confirm", "POST", { token, password });
  } catch {
    return { ok: false, message: NETWORK_ERROR };
  }
  if (!isRecord(data)) return { ok: false, message: NETWORK_ERROR };
  const account = data.ok === true ? parseAccount(data.account) : null;
  if (!account) {
    return { ok: false, message: typeof data.message === "string" ? data.message : NETWORK_ERROR };
  }
  setResetToken(null);
  setState("account", account);
  if (!state.nickname) setNickname(account.username);
  void refreshAccount();
  reconnectForAccount();
  goHome();
  toast("Şifren değişti.", "success");
  return { ok: true, message: "" };
}

/** Oturumdaki hesabın şifresini değiştirir; diğer cihazlardaki oturumlar kapanır. */
export async function changePassword(current: string, password: string): Promise<AccountReply> {
  const r = await plain("password", { current, password });
  return { ok: r.ok, message: r.message };
}

/**
 * Kullanıcı adını değiştirir (7 günde bir). Başarıda yeni ad hemen yazılır; odadaysan sunucu oyuncu adını
 * odaya yayar, arkadaşlarının listesi kendiliğinden yenilenir. Kilitliyken sunucu tarihi Türkçe söyler.
 */
export async function changeUsername(username: string): Promise<AccountReply> {
  const r = await plain("username", { username });
  if (!r.ok) {
    if (isRecord(r.data)) {
      const at = parseAvailableAt(r.data.availableAt);
      if (at !== null) setState("usernameAvailableAt", at);
    }
    return { ok: false, message: r.message };
  }
  const account = isRecord(r.data) ? parseAccount(r.data.account) : null;
  if (!account) return { ok: false, message: NETWORK_ERROR };
  setState("account", account);
  setState("usernameAvailableAt", isRecord(r.data) ? parseAvailableAt(r.data.usernameAvailableAt) : null);
  return { ok: true, message: "" };
}

// ---- KVKK: verimi indir, hesabımı sil (H10) ---------------------------------------------------------------

const KVKK_BASE = "/api/account/";

/** "Verimi indir" sürerken düğme kilitlenir. */
const [exportBusy, setExportBusy] = createSignal(false);

export { exportBusy, setExportBusy };

function deviceSaveMethod(): SaveMethod {
  return saveMethod({
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints,
    standalone: isStandalone(),
  });
}

/** Blob adresini görünmez bir bağlantıyla indirir. */
function clickDownload(url: string, name: string): void {
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Hesabın verilerini JSON dosyası olarak indirir (fetch + blob + bağlantı). iOS ana ekran uygulaması indirmeyi
 * tutmadığı için orada dosya yeni sekmede açılır; sekme, kullanıcı dokunuşu bitmeden (fetch'ten önce) açılır.
 * Doğrudan bir dokunuş işleyicisinden çağrılmalıdır.
 */
export async function downloadMyData(): Promise<void> {
  if (exportBusy()) return;
  setExportBusy(true);
  const method = deviceSaveMethod();
  const tab = method === "tab" ? window.open("", "_blank") : null;
  try {
    const res = await fetch(`${KVKK_BASE}export`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    if (!res.ok) {
      let message = NETWORK_ERROR;
      try {
        const body: unknown = await res.json();
        if (isRecord(body) && typeof body.message === "string") message = body.message;
      } catch {
        // gövde okunamadı
      }
      tab?.close();
      toast(message, "error");
      return;
    }
    const name = fileNameFromDisposition(res.headers.get("Content-Disposition"), exportFileName(Date.now()));
    const url = URL.createObjectURL(new Blob([await res.blob()], { type: "application/json" }));
    setTimeout(() => URL.revokeObjectURL(url), 120_000);
    if (method === "tab") {
      if (tab) tab.location.href = url;
      else if (!window.open(url, "_blank")) clickDownload(url, name);
    } else clickDownload(url, name);
    toast(exportDoneText(method), "success");
  } catch {
    tab?.close();
    toast(NETWORK_ERROR, "error");
  } finally {
    setExportBusy(false);
  }
}

/**
 * Hesabı kalıcı siler. Başarıda oturum ve yerel hesap durumu temizlenir; soket yeniden bağlanır (odadaysan misafir
 * olarak oyunda kalırsın). Başarısızsa kullanıcıya gösterilecek metin.
 */
export async function deleteMyAccount(form: DeleteForm): Promise<AccountReply> {
  let data: unknown;
  try {
    const res = await fetch(`${KVKK_BASE}delete`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(deleteBody(form)),
    });
    data = await res.json();
  } catch {
    return { ok: false, message: NETWORK_ERROR };
  }
  if (!isRecord(data)) return { ok: false, message: NETWORK_ERROR };
  if (data.ok !== true)
    return { ok: false, message: typeof data.message === "string" ? data.message : NETWORK_ERROR };
  sendPushUnsubscribe();
  resetFriends();
  resetLeaderboard();
  setState("account", null);
  setState("usernameAvailableAt", null);
  setState("google", "linked", false);
  setState("mail", { verified: false, hasPassword: false });
  reconnectForAccount();
  return { ok: true, message: "" };
}
