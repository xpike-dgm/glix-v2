import { createSignal } from "solid-js";
import { KEYS, readStored, writeStored } from "../net/storage.js";
import { isIosSafari, pickInstallHint } from "./installHint.js";

/** Chromium'un `beforeinstallprompt` olayı (standart TS tiplerinde yok). */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const [waitingWorker, setWaitingWorker] = createSignal<ServiceWorker | null>(null);
const [online, setOnline] = createSignal(typeof navigator === "undefined" ? true : navigator.onLine);
const [promptEvent, setPromptEvent] = createSignal<InstallPromptEvent | null>(null);
const [dismissed, setDismissed] = createSignal(readStored(KEYS.installHint) === "1");
const [installed, setInstalled] = createSignal(false);

export const updateWaiting = (): boolean => waitingWorker() !== null;
export const isOnline = online;

function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

/** Ana sayfada gösterilecek kurulum ipucu. */
export function installHint() {
  return pickInstallHint({
    standalone: installed() || isStandalone(),
    dismissed: dismissed(),
    canPrompt: promptEvent() !== null,
    iosSafari: isIosSafari(navigator),
  });
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
  w.postMessage({ type: "SKIP_WAITING" });
}

function track(reg: ServiceWorkerRegistration): void {
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
  const check = (): void => {
    if (navigator.onLine) reg.update().catch(() => undefined);
  };
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") check();
  });
  setInterval(check, 60 * 60 * 1000);
}

/** Uygulama açılışında bir kez çağrılır: çevrimiçi durumu, kurulum olayları, hizmet çalışanı. */
export function initPwa(): void {
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
