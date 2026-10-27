import { createSignal } from "solid-js";
import { KEYS, readStored, writeStored } from "../net/storage.js";
import { toast } from "../net/store.js";
import { isIosSafari, pickInstallHint } from "./installHint.js";
import { isStandalone } from "./packPolicy.js";
import { consumeUpdated, markUpdated } from "./updateFlag.js";
import { shouldCheckNow } from "./updatePolicy.js";

/** Chromium'un `beforeinstallprompt` olayı (standart TS tiplerinde yok). */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const [waitingWorker, setWaitingWorker] = createSignal<ServiceWorker | null>(null);
const [online, setOnline] = createSignal(typeof navigator === "undefined" ? true : navigator.onLine);
const [promptEvent, setPromptEvent] = createSignal<InstallPromptEvent | null>(null);
const [dismissed, setDismissed] = createSignal(readStored(KEYS.installHint) === "1");
const [firstMatchDone, setFirstMatchDone] = createSignal(readStored(KEYS.firstMatch) === "1");
const [installed, setInstalled] = createSignal(false);

export const updateWaiting = (): boolean => waitingWorker() !== null;
export const isOnline = online;

/** Ana sayfada gösterilecek kurulum ipucu. */
export function installHint() {
  return pickInstallHint({
    standalone: installed() || isStandalone(),
    dismissed: dismissed(),
    canPrompt: promptEvent() !== null,
    iosSafari: isIosSafari(navigator),
    firstMatchDone: firstMatchDone(),
  });
}

/** Final ekranı gösterildi: kurulum ipucu artık ana sayfada (ya da bir sonraki açılışta) çıkabilir. */
export function noteMatchFinished(): void {
  if (firstMatchDone()) return;
  setFirstMatchDone(true);
  writeStored(KEYS.firstMatch, "1");
}

export function dismissInstallHint(): void {
  setDismissed(true);
  writeStored(KEYS.installHint, "1");
}

export async function promptInstall(): Promise<void> {
  const ev = promptEvent();
  if (!ev) return;
  setPromptEvent(null);
  try {
    await ev.prompt();
    const { outcome } = await ev.userChoice;
    if (outcome === "dismissed") dismissInstallHint();
  } catch {
    // istem açılamadı; ipucu geri gelmez
  }
}

let reloading = false;
/** Bekleyen sürümü etkinleştirir; yeni hizmet çalışanı denetimi alınca sayfa yenilenir. */
export function applyUpdate(): void {
  const w = waitingWorker();
  if (!w) return;
  reloading = true;
  markUpdated();
  w.postMessage({ type: "SKIP_WAITING" });
}

let registration: ServiceWorkerRegistration | null = null;
let lastCheck: number | null = null;

/** Kayıttaki "indi, bekliyor" durumuna ulaşılmasını (en çok `timeoutMs`) bekler. */
function waitForWaiting(reg: ServiceWorkerRegistration, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    if (reg.waiting) return resolve(true);
    let done = false;
    const finish = (ok: boolean): void => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(ok);
    };
    const timer = setTimeout(() => finish(reg.waiting !== null), timeoutMs);
    const watch = (w: ServiceWorker | null): void => {
      if (!w) {
        finish(reg.waiting !== null);
        return;
      }
      w.addEventListener("statechange", () => {
        if (w.state === "installed") finish(true);
        else if (w.state === "redundant") finish(false);
      });
    };
    // update() döndüğünde yeni sürüm bulunduysa `installing` doludur; boşsa yeni sürüm yoktur.
    if (reg.installing) watch(reg.installing);
    else finish(false);
  });
}

/**
 * Yeni sürüm var mı diye sunucuya sorar. Sürüm bulunursa `waitingWorker` dolar; uygulanması güvenli ana
 * kalmışsa `useUpdateFlow` halleder. Aralık sınırı (5 dk) `force` ile aşılır.
 */
async function pollForUpdate(force: boolean): Promise<boolean> {
  const reg = registration;
  if (!reg) return false;
  if (!shouldCheckNow(Date.now(), lastCheck, force)) return waitingWorker() !== null;
  if (!navigator.onLine) return waitingWorker() !== null;
  lastCheck = Date.now();
  try {
    await reg.update();
  } catch {
    return waitingWorker() !== null;
  }
  return waitForWaiting(reg, 10_000);
}

/** Sunucu yeniden başladı ya da sürüm değişti: bir deploy olmuş demektir; aralığı beklemeden denetle. */
export function noteServerRestart(): void {
  void pollForUpdate(true);
}

/**
 * "Güncellemeleri denetle" (Ayarlar): yeni sürüm indiyse "updating" (güvenli anda kendiliğinden uygulanır,
 * sayfa yenilenir), yoksa "latest" döner. Geliştirmede ve hizmet çalışanı yokken her zaman "latest".
 */
export async function checkForUpdate(): Promise<"latest" | "updating"> {
  const found = await pollForUpdate(true);
  return found || waitingWorker() !== null ? "updating" : "latest";
}

/** Sert yenilemenin eklediği geçici parametreyi adres çubuğundan siler. */
function stripReloadParam(): void {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("_g")) return;
    url.searchParams.delete("_g");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  } catch {
    // önemsiz
  }
}

/** Önbelleği ve hizmet çalışanlarını atıp sayfayı ağdan yeniden yükler (son çare). */
async function hardReload(): Promise<void> {
  try {
    const regs = await navigator.serviceWorker?.getRegistrations();
    await Promise.all((regs ?? []).map((r) => r.unregister()));
    if ("caches" in window) await Promise.all((await caches.keys()).map((k) => caches.delete(k)));
  } catch {
    // yine de yeniden yükle
  }
  markUpdated();
  const url = new URL(window.location.href);
  url.searchParams.set("_g", String(Date.now()));
  window.location.replace(url.toString());
}

/**
 * Zorunlu güncelleme düğmesi. Bekleyen sürüm varsa etkinleştirir; yoksa önce denetler (`registration.update()`),
 * indirileni etkinleştirir; hiçbiri olmazsa önbelleği atıp sert yeniler. İnternet yoksa "offline" döner.
 */
export async function forceUpdate(): Promise<"reloading" | "offline"> {
  if (!navigator.onLine) return "offline";
  if (waitingWorker()) {
    applyUpdate();
    scheduleHardFallback();
    return "reloading";
  }
  if (registration && (await pollForUpdate(true)) && waitingWorker()) {
    applyUpdate();
    scheduleHardFallback();
    return "reloading";
  }
  await hardReload();
  return "reloading";
}

/** Etkinleştirme 6 sn içinde sayfayı yenilemezse sert yenileme. */
function scheduleHardFallback(): void {
  setTimeout(() => void hardReload(), 6000);
}

/** Yeni sürüme geçildikten sonra bir kez "Yeni sürüm yüklendi" bildirimi. */
export function announceUpdateIfAny(): void {
  if (consumeUpdated()) toast("Yeni sürüm yüklendi", "success");
}

function track(reg: ServiceWorkerRegistration): void {
  registration = reg;
  const consider = (w: ServiceWorker | null): void => {
    // İlk kurulumda (denetleyen çalışan yokken) "yeni sürüm" denmez.
    if (w && navigator.serviceWorker.controller) setWaitingWorker(w);
  };
  consider(reg.waiting);
  reg.addEventListener("updatefound", () => {
    const next = reg.installing;
    next?.addEventListener("statechange", () => {
      if (next.state === "installed") consider(next);
    });
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void pollForUpdate(false);
  });
  setInterval(() => void pollForUpdate(false), 60 * 60 * 1000);
  void pollForUpdate(true);
}

/** Uygulama açılışında bir kez çağrılır: çevrimiçi durumu, kurulum olayları, hizmet çalışanı. */
export function initPwa(): void {
  stripReloadParam();
  window.addEventListener("online", () => setOnline(true));
  window.addEventListener("offline", () => setOnline(false));
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    setPromptEvent(e as InstallPromptEvent);
  });
  window.addEventListener("appinstalled", () => {
    setPromptEvent(null);
    setInstalled(true);
  });

  if (import.meta.env.DEV || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) window.location.reload();
  });
  const register = (): void => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then(track)
      .catch(() => undefined);
  };
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}
