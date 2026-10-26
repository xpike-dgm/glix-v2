import { createSignal } from "solid-js";
import { KEYS, readStored, writeStored } from "../net/storage.js";
import type { ScreenId } from "../screens/route.js";
import { dataSaver, wifiOnly } from "../settings/settings.js";
import {
  cacheStore,
  loadManifest,
  networkFetch,
  PACK_CACHE,
  type PackManifest,
  type PackProgress,
  type PackResult,
  pendingFor,
  pruneChanged,
  requestPersistence,
  runPack,
} from "./contentPack.js";
import {
  BACKGROUND_CONCURRENCY,
  BACKGROUND_DELAY_MS,
  FOREGROUND_CONCURRENCY,
  isStandalone,
  mayRun,
  planLaunch,
  RETRY_COOLDOWN_MS,
  readNetwork,
} from "./packPolicy.js";
import { isOnline } from "./pwa.js";
import { isSafeScreen } from "./updatePolicy.js";

/**
 * İçerik paketi denetleyicisi: ne zaman, hangi kısıtla indirileceğine karar verir ve ilerlemeyi arayüze verir.
 * İndirme mantığı `contentPack.ts`, kurallar `packPolicy.ts` içindedir; burada yalnız bağlama vardır.
 */

/** checking: bildirim okunuyor · ask: mobil veri/veri tasarrufu, soruluyor · downloading · failed: bağlantı koptu. */
export type PackPhase = "idle" | "checking" | "ask" | "downloading" | "failed";

const [phase, setPhase] = createSignal<PackPhase>("idle");
const [screenOpen, setScreenOpen] = createSignal(false);
const [progress, setProgress] = createSignal<PackProgress | null>(null);
/** İndirilecek (eksik/değişen) toplam bayt; "ask" ekranında gösterilir. */
const [pendingBytes, setPendingBytes] = createSignal(0);
const [running, setRunning] = createSignal(false);
/** Son çalıştırmada ağdan inen dosya sayısı; hiç çalışmadıysa null. */
const [lastDownloaded, setLastDownloaded] = createSignal<number | null>(null);
/** Her indirme/temizlemeden sonra artar: depolama tahmini bunu izleyip yenilenir. */
const [storageEpoch, setStorageEpoch] = createSignal(0);

export {
  lastDownloaded,
  pendingBytes,
  phase as packPhase,
  progress as packProgress,
  running as packRunning,
  screenOpen as packScreenOpen,
  storageEpoch,
};

type Want = "none" | "background" | "foreground";
let manifest: PackManifest | null = null;
let want: Want = "none";
let requireWifi = false;
let screen: ScreenId = "home";
let blockedUntil = 0;
let controller: AbortController | null = null;
let runMode: Want = "none";
let runPromise: Promise<PackResult | null> | null = null;
let startTimer: ReturnType<typeof setTimeout> | undefined;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let backgroundStarted = false;
let failures = 0;
/** Bildirim okundu, eski görsel temizliği güvenli ekranı bekliyor. */
let prunePending = false;
const MAX_AUTO_FAILURES = 3;

const complete = (): void => {
  want = "none";
  setPhase("idle");
  setScreenOpen(false);
};

function gateOpen(): boolean {
  return mayRun({
    foreground: want === "foreground",
    dataSaver: dataSaver(),
    wifiOnly: wifiOnly(),
    requireWifi,
    net: readNetwork(),
    online: isOnline(),
    screen,
    cooledDown: Date.now() >= blockedUntil,
  });
}

async function execute(mode: Want): Promise<PackResult | null> {
  if (!manifest) return null;
  const abort = new AbortController();
  controller = abort;
  runMode = mode;
  setRunning(true);
  if (screenOpen() && phase() !== "ask") setPhase("downloading");
  void requestPersistence();
  await prune();
  let result: PackResult | null = null;
  try {
    result = await runPack(manifest, cacheStore(), {
      concurrency: mode === "foreground" ? FOREGROUND_CONCURRENCY : BACKGROUND_CONCURRENCY,
      signal: abort.signal,
      onProgress: setProgress,
      fetchFile: networkFetch(mode !== "foreground"),
    });
  } catch {
    result = null;
  }
  controller = null;
  runMode = "none";
  setRunning(false);
  if (result) setLastDownloaded(result.downloaded);
  setStorageEpoch((n) => n + 1);
  if (result?.complete) {
    failures = 0;
    writeStored(KEYS.packState, manifest.version);
    // Çubuk dolu görünsün, sonra ekran kapansın.
    if (screenOpen()) setTimeout(complete, 700);
    else complete();
  } else if (!result?.aborted) {
    failures++;
    blockedUntil = Date.now() + RETRY_COOLDOWN_MS;
    if (screenOpen()) setPhase("failed");
    // Kullanıcının bilerek başlattığı indirme kendiliğinden yeniden denenmez ("Tekrar dene" ister);
    // arka plandakiler birkaç kez, aralıklı denenir.
    if (mode === "foreground" || failures >= MAX_AUTO_FAILURES) want = "none";
    else {
      clearTimeout(retryTimer);
      retryTimer = setTimeout(evaluate, RETRY_COOLDOWN_MS + 50);
    }
  }
  evaluate();
  return result;
}

function start(mode: Want): Promise<PackResult | null> {
  runPromise = execute(mode);
  return runPromise;
}

/** Değişen/düşen görsellerin eski kayıtlarını siler (indirme yok); yalnız güvenli ekranda, bir kez. */
async function prune(): Promise<void> {
  if (!prunePending || !manifest || !isSafeScreen(screen)) return;
  prunePending = false;
  try {
    if (await pruneChanged(manifest, cacheStore()).then((d) => d.length > 0)) setStorageEpoch((n) => n + 1);
  } catch {
    // önemsiz
  }
}

/** Durum her değiştiğinde (ekran, ağ, ayar, çevrimiçi) çağrılır: çalışanı durdurur ya da başlatır. */
export function evaluate(): void {
  void prune();
  const ok = manifest !== null && want !== "none" && gateOpen();
  if (controller) {
    // Yanlış kipte çalışan (arka plan, kullanıcı "şimdi indir" dedi) ya da artık izin olmayan indirme durur;
    // `execute` bittiğinde yeniden değerlendirilir ve uygunsa kaldığı yerden sürer.
    if (!ok || (want === "foreground" && runMode !== "foreground")) controller.abort();
    return;
  }
  if (!ok) {
    clearTimeout(startTimer);
    startTimer = undefined;
    return;
  }
  if (startTimer !== undefined) return;
  const delay = want === "background" && !backgroundStarted ? BACKGROUND_DELAY_MS : 0;
  startTimer = setTimeout(() => {
    startTimer = undefined;
    if (controller || !manifest || want === "none" || !gateOpen()) return;
    backgroundStarted = true;
    void start(want);
  }, delay);
}

/** App her ekran değişiminde bildirir. */
export function notifyScreen(next: ScreenId): void {
  screen = next;
  evaluate();
}

export interface LaunchContext {
  /** `?oda=` ile geldi. */
  guest: boolean;
}

/** Uygulama açılışında bir kez: bildirimi okur, planı seçer. Hata verirse sessizce hiçbir şey yapmaz. */
export async function initContentPack(ctx: LaunchContext): Promise<void> {
  if (typeof caches === "undefined") return;
  const saved = readStored(KEYS.packState);
  const standalone = isStandalone();
  const firstTime = saved === null;
  // Ana ekrandan ilk açılışta bildirim gelene dek ekran hazır dursun (ana sayfa bir an görünüp kaybolmasın).
  const early = standalone && !ctx.guest && firstTime;
  if (early) {
    setPhase("checking");
    setScreenOpen(true);
  }
  try {
    manifest = await loadManifest();
    if (!manifest) return complete();
    prunePending = true;
    await prune();
    const todo = await pendingFor(manifest);
    if (todo.files === 0) {
      writeStored(KEYS.packState, manifest.version);
      return complete();
    }
    setPendingBytes(todo.bytes);
    const plan = planLaunch({
      standalone,
      guest: ctx.guest,
      firstTime,
      optedOut: saved === "off",
      dataSaver: dataSaver(),
      net: readNetwork(),
      complete: false,
    });
    if (plan === "none") return complete();
    if (plan === "background") {
      want = "background";
      setPhase("idle");
      setScreenOpen(false);
    } else if (plan === "ask") {
      want = "none";
      setPhase("ask");
      setScreenOpen(true);
    } else {
      want = "foreground";
      setPhase("downloading");
      setScreenOpen(true);
    }
    evaluate();
  } catch {
    complete();
  }
}

/** "Şimdi indir". */
export function chooseNow(): void {
  want = "foreground";
  setPhase("downloading");
  evaluate();
}

/** "Wi-Fi'yi bekle": ekran kapanır; Wi-Fi'ye geçince sessizce iner (veri tasarrufu açıksa hiç). */
export function chooseWifi(): void {
  want = "background";
  requireWifi = true;
  setScreenOpen(false);
  setPhase("idle");
  evaluate();
}

/** "Atla": ekran kapanır. Zaten başlamış indirme, izin varsa arka planda sürer. */
export function skipPackScreen(): void {
  setScreenOpen(false);
  // Başlamış ya da kopmuş indirme arka planda sürebilir; sorulmamış ya da hazırlanan sürmez.
  want = phase() === "downloading" || phase() === "failed" ? "background" : "none";
  setPhase("idle");
  evaluate();
}

/** Bağlantı koptuktan sonra "Tekrar dene". */
export function retryPack(): void {
  blockedUntil = 0;
  failures = 0;
  want = "foreground";
  setPhase("downloading");
  evaluate();
}

/** Ayarlar: "Tüm içeriği indir". Biten çalıştırmanın sonucunu verir (bildirim alınamadıysa null). */
export async function downloadAll(): Promise<PackResult | null> {
  if (!manifest) {
    manifest = await loadManifest();
    prunePending = manifest !== null;
  }
  if (!manifest) return null;
  blockedUntil = 0;
  failures = 0;
  want = "foreground";
  if (controller) {
    controller.abort();
    await runPromise;
  }
  if (controller) return runPromise;
  const result = await start("foreground");
  return result;
}

/** Ayarlar: "Önbelleği temizle". Kullanıcı bilerek sildiği için kendiliğinden indirme durur. */
export async function clearPack(): Promise<void> {
  want = "none";
  controller?.abort();
  await runPromise;
  try {
    await caches.delete(PACK_CACHE);
  } catch {
    // önemsiz
  }
  writeStored(KEYS.packState, "off");
  setProgress(null);
  setLastDownloaded(null);
  setStorageEpoch((n) => n + 1);
}

/** Yalnız geliştirme (arayüz denetimi): ekranı sahte veriyle gösterir. */
export function mockPackView(p: PackPhase, prog: PackProgress | null, bytes: number): void {
  setPhase(p);
  setProgress(prog);
  setPendingBytes(bytes);
  setScreenOpen(true);
}

/** Ağ türü değişince yeniden değerlendirilsin. */
export function watchNetwork(): void {
  const c = (navigator as Navigator & { connection?: EventTarget }).connection;
  c?.addEventListener("change", evaluate);
}
