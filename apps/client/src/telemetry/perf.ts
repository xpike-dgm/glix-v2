import {
  type ClientMessage,
  PERF_LIMITS,
  PERF_META_LIMITS,
  type PerfPlatform,
  type PerfSample,
  type RoomSnapshot,
} from "@glix/engine";

import { telemetry } from "../settings/settings.js";

interface UaInput {
  userAgent: string;
  platform?: string;
  maxTouchPoints?: number;
}

/** UA'dan kaba platform grubu. iPadOS 13+ kendini Macintosh diye tanıtır; dokunmatik olması ayırır. Model/sürüm tutulmaz. */
export function platformGroup({ userAgent, platform = "", maxTouchPoints = 0 }: UaInput): PerfPlatform {
  if (/iPhone|iPad|iPod/.test(userAgent) || (platform === "MacIntel" && maxTouchPoints > 1)) return "ios";
  if (/Android/.test(userAgent)) return "android";
  return "diger";
}

const clampMeta = (key: keyof typeof PERF_META_LIMITS, v: number): number =>
  Math.min(PERF_META_LIMITS[key], Math.max(0, Math.round(Number.isFinite(v) ? v : 0)));

/** Bu sekme oturumunda sayfa kaç kez yeniden yüklendi (yenile ya da iOS'un sekmeyi bellekten atması). */
export function nextReloadCount(prev: number, navType: string | undefined, wasDiscarded: boolean): number {
  return navType === "reload" || wasDiscarded ? prev + 1 : prev;
}

/** Aynı anda bekleyen en çok bu kadar eylem zamanlanır; fazlası en eskiden başlayarak atılır. */
export const MAX_PENDING_ACKS = 256;
/** Ölçülen en çok bu kadar onay gecikmesi tutulur (bir oyun için fazlasıyla yeter). */
const MAX_ACK_SAMPLES = 2000;
const MAX_INTERACTIONS = 500;
const RTT_SAMPLES = 9;
/** Event Timing: bundan kısa etkileşimler hiç bildirilmez. */
export const EVENT_DURATION_THRESHOLD_MS = 40;
/** Bundan uzun süren etkileşim "yavaş dokunma" sayılır. */
export const SLOW_TAP_MS = 200;

/** En yakın sıra yöntemiyle yüzdelik; boşsa 0. `p` 0..1. */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil(s.length * p) - 1))] ?? 0;
}

export function medianOf(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  const hi = s[mid] ?? 0;
  return s.length % 2 === 1 ? hi : ((s[mid - 1] ?? hi) + hi) / 2;
}

const clamp = (key: keyof PerfSample, v: number): number =>
  Math.min(PERF_LIMITS[key], Math.max(0, Math.round(Number.isFinite(v) ? v : 0)));

export interface PerfCollector {
  /** Yeni oyunun başında: onay, etkileşim ve uzun görev sayaçlarını sıfırlar (RTT örnekleri kalır). */
  reset(): void;
  /** Ping/pong gidiş-dönüş süresi (ms). */
  addRtt(ms: number): void;
  /** Soket koptuktan sonra yeniden açıldı (oyun başına sayılır). */
  reconnect(): void;
  actionSent(seq: number): void;
  actionAcked(seq: number): void;
  interaction(durationMs: number): void;
  longTask(durationMs: number): void;
  /** Gönderilecek özet; hiç eylem/yavaşlık gözlenmediyse (sinyal yok) null. */
  sample(): (PerfSample & { reconnects: number }) | null;
}

export function createPerfCollector(now: () => number): PerfCollector {
  let rtts: number[] = [];
  let sentAt = new Map<number, number>();
  let acks: number[] = [];
  let taps: number[] = [];
  let slowTaps = 0;
  let longTasks = 0;
  let longTaskMs = 0;
  let reconnects = 0;
  return {
    reset() {
      sentAt = new Map();
      acks = [];
      taps = [];
      slowTaps = 0;
      longTasks = 0;
      longTaskMs = 0;
      reconnects = 0;
    },
    addRtt(ms) {
      if (!Number.isFinite(ms) || ms < 0) return;
      rtts = [...rtts, ms].slice(-RTT_SAMPLES);
    },
    reconnect() {
      reconnects += 1;
    },
    actionSent(seq) {
      sentAt.set(seq, now());
      if (sentAt.size > MAX_PENDING_ACKS) {
        const oldest = sentAt.keys().next();
        if (!oldest.done) sentAt.delete(oldest.value);
      }
    },
    actionAcked(seq) {
      const t = sentAt.get(seq);
      if (t === undefined) return;
      sentAt.delete(seq);
      if (acks.length < MAX_ACK_SAMPLES) acks.push(Math.max(0, now() - t));
    },
    interaction(durationMs) {
      if (durationMs > SLOW_TAP_MS) slowTaps += 1;
      if (taps.length < MAX_INTERACTIONS) taps.push(durationMs);
    },
    longTask(durationMs) {
      longTasks += 1;
      longTaskMs += durationMs;
    },
    sample() {
      if (acks.length === 0 && slowTaps === 0 && longTasks === 0 && reconnects === 0) return null;
      return {
        rttMs: clamp("rttMs", medianOf(rtts)),
        ackP50: clamp("ackP50", percentile(acks, 0.5)),
        ackP95: clamp("ackP95", percentile(acks, 0.95)),
        ackN: clamp("ackN", acks.length),
        slowTaps: clamp("slowTaps", slowTaps),
        tapP95: clamp("tapP95", percentile(taps, 0.95)),
        longTasks: clamp("longTasks", longTasks),
        longTaskMs: clamp("longTaskMs", longTaskMs),
        reconnects: clampMeta("reconnects", reconnects),
      };
    },
  };
}

/** Geliştirme önizlemesinde (mock) ölçüm ve gönderim yapılmaz. */
const enabled = typeof window !== "undefined" && !import.meta.env.DEV;

export const perf = createPerfCollector(() => performance.now());

const RELOADS_KEY = "glix.reloads";

/** Sekme oturumu başına sayfa yenileme sayısı (sessionStorage; yoksa 0). Açılışta bir kez hesaplanır. */
function countReloads(): number {
  if (!enabled) return 0;
  try {
    const prev = Number(sessionStorage.getItem(RELOADS_KEY) ?? "0") || 0;
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    const wasDiscarded = (document as Document & { wasDiscarded?: boolean }).wasDiscarded === true;
    const next = nextReloadCount(prev, nav?.type, wasDiscarded);
    if (next !== prev) sessionStorage.setItem(RELOADS_KEY, String(next));
    return next;
  } catch {
    return 0;
  }
}
const reloads = countReloads();
const platform: PerfPlatform = typeof navigator === "undefined" ? "diger" : platformGroup(navigator);

interface EventTimingEntry extends PerformanceEntry {
  interactionId?: number;
}

let observing = false;

/** Event Timing ve Long Tasks gözlemcilerini kurar. Desteklemeyen tarayıcıda (ör. iOS) sayaçlar sıfır kalır. */
export function installPerfObservers(): void {
  if (!enabled || observing || typeof PerformanceObserver === "undefined") return;
  observing = true;
  const observe = (type: string, onEntry: (e: PerformanceEntry) => void, init: object = {}): void => {
    try {
      if (!PerformanceObserver.supportedEntryTypes?.includes(type)) return;
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) onEntry(e);
      }).observe({ type, buffered: false, ...init } as PerformanceObserverInit);
    } catch {
      // desteklenmiyor ya da engelli: sayaçlar sıfır kalır
    }
  };
  observe(
    "event",
    (e) => {
      const id = (e as EventTimingEntry).interactionId;
      if (id === undefined || id > 0) perf.interaction(e.duration);
    },
    { durationThreshold: EVENT_DURATION_THRESHOLD_MS },
  );
  observe("longtask", (e) => perf.longTask(e.duration));
}

let playingKey: string | null = null;
let sentKey: string | null = null;

/**
 * Her yeni snapshot'ta çağrılır: oyunun `playing` aşaması başlayınca sayaçlar sıfırlanır, aynı oyun `results`
 * aşamasına geçince özet bir kez gönderilir. Oyuncu katılımcı değilse ya da sinyal yoksa gönderilmez.
 */
export function trackPerf(snapshot: RoomSnapshot, send: (msg: ClientMessage) => boolean): void {
  if (!enabled || !telemetry()) return;
  const m = snapshot.match;
  if (!m) {
    playingKey = null;
    return;
  }
  const key = `${snapshot.code}:${m.round}:${m.gameId}`;
  if (snapshot.phase === "playing") {
    if (playingKey !== key) {
      playingKey = key;
      perf.reset();
    }
    return;
  }
  if (snapshot.phase === "results" && playingKey === key && sentKey !== key) {
    sentKey = key;
    if (!m.participants.includes(snapshot.selfId)) return;
    const s = perf.sample();
    if (s) send({ type: "perf", gameId: m.gameId, ...s, platform, reloads: clampMeta("reloads", reloads) });
  }
}
