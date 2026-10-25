import { type ClientMessage, PERF_LIMITS, type PerfSample, type RoomSnapshot } from "@glix/engine";

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
  actionSent(seq: number): void;
  actionAcked(seq: number): void;
  interaction(durationMs: number): void;
  longTask(durationMs: number): void;
  /** Gönderilecek özet; hiç eylem/yavaşlık gözlenmediyse (sinyal yok) null. */
  sample(): PerfSample | null;
}

export function createPerfCollector(now: () => number): PerfCollector {
  let rtts: number[] = [];
  let sentAt = new Map<number, number>();
  let acks: number[] = [];
  let taps: number[] = [];
  let slowTaps = 0;
  let longTasks = 0;
  let longTaskMs = 0;
  return {
    reset() {
      sentAt = new Map();
      acks = [];
      taps = [];
      slowTaps = 0;
      longTasks = 0;
      longTaskMs = 0;
    },
    addRtt(ms) {
      if (!Number.isFinite(ms) || ms < 0) return;
      rtts = [...rtts, ms].slice(-RTT_SAMPLES);
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
      if (acks.length === 0 && slowTaps === 0 && longTasks === 0) return null;
      return {
        rttMs: clamp("rttMs", medianOf(rtts)),
        ackP50: clamp("ackP50", percentile(acks, 0.5)),
        ackP95: clamp("ackP95", percentile(acks, 0.95)),
        ackN: clamp("ackN", acks.length),
        slowTaps: clamp("slowTaps", slowTaps),
        tapP95: clamp("tapP95", percentile(taps, 0.95)),
        longTasks: clamp("longTasks", longTasks),
        longTaskMs: clamp("longTaskMs", longTaskMs),
      };
    },
  };
}

/** Geliştirme önizlemesinde (mock) ölçüm ve gönderim yapılmaz. */
const enabled = typeof window !== "undefined" && !import.meta.env.DEV;

export const perf = createPerfCollector(() => performance.now());

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
  if (!enabled) return;
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
    if (s) send({ type: "perf", gameId: m.gameId, ...s });
  }
}
