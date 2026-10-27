import { createSignal } from "solid-js";
import { sendPushSubscribe, sendPushUnsubscribe, setSessionHook } from "../net/client.js";
import { state } from "../net/store.js";
import { notifyOn, setNotifyOn } from "../settings/settings.js";
import { type PushToggleMode, pushToggleMode } from "../settings/support.js";
import { isStandalone } from "./packPolicy.js";

/** Web bildirimleri: izin, tarayıcı aboneliği ve sunucuya bildirme. İzin yalnız oyuncunun açma dokunuşunda istenir. */

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

const permissionNow = (): NotificationPermission =>
  typeof Notification === "undefined" ? "default" : Notification.permission;

const [permission, setPermission] = createSignal<NotificationPermission>(permissionNow());

/** Ayarlar'daki satırın durumu (sunucu anahtarı, tarayıcı desteği ve izin birlikte). */
export function pushMode(): PushToggleMode {
  return pushToggleMode({
    serverEnabled: state.pushKey !== null,
    hasPushManager: typeof window !== "undefined" && "PushManager" in window,
    hasServiceWorker: typeof navigator !== "undefined" && "serviceWorker" in navigator,
    hasNotification: typeof Notification !== "undefined",
    ios: isIos(),
    standalone: isStandalone(),
    permission: permission(),
  });
}

/** VAPID genel anahtarı (base64url) → `applicationServerKey` baytları. */
function keyBytes(key: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (key.length % 4)) % 4);
  const raw = atob((key + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function sameKey(a: ArrayBuffer | null, b: Uint8Array): boolean {
  if (!a || a.byteLength !== b.length) return false;
  const x = new Uint8Array(a);
  return x.every((v, i) => v === b[i]);
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  // Geliştirmede hizmet çalışanı yoktur; `ready` sonsuza dek beklemesin.
  const existing = await navigator.serviceWorker.getRegistration();
  return existing ? navigator.serviceWorker.ready : null;
}

/** Tarayıcı aboneliğini verir; yoksa (izin varsa) oluşturur. Sunucu anahtarı değiştiyse eskisi atılıp yenilenir. */
async function ensureSubscription(create: boolean): Promise<PushSubscription | null> {
  const key = state.pushKey;
  const reg = await registration();
  if (!key || !reg) return null;
  const bytes = keyBytes(key);
  let sub = await reg.pushManager.getSubscription();
  if (sub && !sameKey(sub.options.applicationServerKey, bytes)) {
    await sub.unsubscribe();
    sub = null;
  }
  if (!sub && create)
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes });
  return sub;
}

/** Aboneliği sunucuya (oturumuna) bildirir. Odada değilse hiçbir şey yapmaz; oturum açılınca yeniden denenir. */
function announce(sub: PushSubscription): void {
  const json = sub.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!p256dh || !auth) return;
  sendPushSubscribe({ endpoint: sub.endpoint, p256dh, auth });
}

export type EnableResult = "ok" | "denied" | "failed";

/** Anahtar açıldı: izin iste (yalnız burada), abone ol, sunucuya bildir. */
export async function enablePush(): Promise<EnableResult> {
  try {
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result !== "granted") return result === "denied" ? "denied" : "failed";
    const sub = await ensureSubscription(true);
    if (!sub) return "failed";
    setNotifyOn(true);
    if (state.session) announce(sub);
    return "ok";
  } catch {
    return "failed";
  }
}

/** Anahtar kapandı: sunucudaki ve tarayıcıdaki abonelik silinir. */
export async function disablePush(): Promise<void> {
  setNotifyOn(false);
  sendPushUnsubscribe();
  try {
    const sub = await ensureSubscription(false);
    await sub?.unsubscribe();
  } catch {
    // tarayıcıda kalan abonelik zararsızdır; sunucu tarafı zaten silindi
  }
}

/** Odaya (yeniden) girildi: bildirim açıksa abonelik bu oturuma bağlanır. Sunucu yeniden başlayınca da böyle geri gelir. */
async function resyncOnSession(): Promise<void> {
  if (!notifyOn() || permissionNow() !== "granted" || state.pushKey === null) return;
  try {
    const sub = await ensureSubscription(true);
    if (sub) announce(sub);
  } catch {
    // sessizce vazgeç; oyuncu Ayarlar'dan yeniden açabilir
  }
}

/** Uygulama açılışında bir kez. */
export function initPush(): void {
  setSessionHook(() => void resyncOnSession());
}
