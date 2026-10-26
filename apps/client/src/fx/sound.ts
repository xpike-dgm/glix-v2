import { createSignal } from "solid-js";
import { KEYS, readStored, writeStored } from "../net/storage.js";
import { applyAudioSession } from "./audioSession.js";

/**
 * WebAudio ile kod içinde üretilen kısa sesler (dosya yok). Tek ana ses düzeyi (`volume`) ve kalıcı sessiz
 * tercihi var. Tarayıcılar (özellikle iOS) sesi yalnız ilk dokunuştan sonra açar: `installAudioUnlock`
 * ilk jestte bağlamı başlatır.
 */

const [muted, setMutedSignal] = createSignal(readStored(KEYS.muted) === "1");

function readVolume(): number {
  const raw = Number(readStored(KEYS.volume));
  return Number.isFinite(raw) && raw >= 0 && raw <= 1 && readStored(KEYS.volume) !== null ? raw : 0.8;
}
const [volume, setVolumeSignal] = createSignal(readVolume());

export { muted, volume };

let ctx: AudioContext | null = null;
const resuming = new WeakSet<object>();

/**
 * Çalmıyorsa ("suspended" ya da iOS'un "interrupted" durumu) bağlamı sürdürür. Art arda çağrılması
 * zararsızdır: aynı bağlam için tek bir `resume` havada kalır. true: bir `resume` başlatıldı.
 */
export function resumeContext(c: Pick<AudioContext, "state" | "resume">): boolean {
  if (c.state === "running" || resuming.has(c)) return false;
  resuming.add(c);
  const done = (): void => void resuming.delete(c);
  try {
    c.resume().then(done, done);
  } catch {
    done();
  }
  return true;
}
let master: GainNode | null = null;

export function toggleMute(): void {
  const next = !muted();
  setMutedSignal(next);
  writeStored(KEYS.muted, next ? "1" : "0");
  if (!next) tap();
}

/** Ana ses düzeyi, 0–1. Kalıcıdır. */
export function setVolume(v: number): void {
  const clean = Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0.8));
  setVolumeSignal(clean);
  writeStored(KEYS.volume, String(clean));
  if (master && ctx) master.gain.setTargetAtTime(clean, ctx.currentTime, 0.02);
}

function audio(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor({ latencyHint: "interactive" });
    master = ctx.createGain();
    master.gain.value = volume();
    // Üst üste binen sesler patlamasın diye hafif sıkıştırıcı.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 6;
    master.connect(comp).connect(ctx.destination);
  } catch {
    ctx = null;
    master = null;
    return null;
  }
  return ctx;
}

/** Bağlamı başlatır; iOS için sessiz bir tampon çalar. Dokunuş işleyicisinin içinden çağrılmalıdır. */
export function unlockAudio(): void {
  const c = audio();
  if (!c) return;
  if (c.state === "running") return;
  resumeContext(c);
  try {
    const src = c.createBufferSource();
    src.buffer = c.createBuffer(1, 1, 22050);
    src.connect(c.destination);
    src.start(0);
  } catch {
    // sessiz tampon çalınamadı: önemli değil
  }
}

/** İlk kullanıcı jestinde sesi açar (dokunma, tuş); açılınca dinleyicileri bırakır. */
export function installAudioUnlock(target: Window = window): () => void {
  const events = ["pointerdown", "touchend", "keydown"] as const;
  // Dinleyiciler kalıcıdır: kilit/arka plan sonrası iOS bağlamı yine askıya alır, sonraki dokunuş açar.
  const onGesture = (): void => unlockAudio();
  const onVisible = (): void => {
    // iOS, uygulama arka plana gidince bağlamı "interrupted" yapar.
    if (!document.hidden && ctx) resumeContext(ctx);
  };
  const off = (): void => {
    for (const e of events) target.removeEventListener(e, onGesture, true);
  };
  applyAudioSession();
  for (const e of events) target.addEventListener(e, onGesture, { capture: true, passive: true });
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    off();
    document.removeEventListener("visibilitychange", onVisible);
  };
}

export interface Tone {
  freq: number;
  dur: number;
  at?: number;
  to?: number;
  type?: OscillatorType;
  gain?: number;
}

export function play(tones: Tone[]): void {
  if (muted()) return;
  // Bağlamı yalnız kullanıcı jesti açar (`unlockAudio`); jestten önce çalmak boşuna uyarı üretir.
  const c = ctx;
  if (!c || !master) return;
  resumeContext(c);
  const t0 = c.currentTime;
  for (const t of tones) {
    const start = t0 + (t.at ?? 0);
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = t.type ?? "sine";
    osc.frequency.setValueAtTime(t.freq, start);
    if (t.to) osc.frequency.exponentialRampToValueAtTime(t.to, start + t.dur);
    const peak = t.gain ?? 0.1;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(peak, start + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, start + t.dur);
    osc.connect(g).connect(master);
    osc.start(start);
    osc.stop(start + t.dur + 0.02);
  }
}

/** Dokunma: kısa, kuru "tık". */
export const tap = (): void => play([{ freq: 880, to: 520, dur: 0.05, type: "triangle", gain: 0.08 }]);

/** Hazırım: alçak, kararlı iki basamak ("tak-tak"). */
export const ready = (): void =>
  play([
    { freq: 262, to: 330, dur: 0.1, type: "triangle", gain: 0.12 },
    { freq: 392, to: 523, dur: 0.16, at: 0.08, type: "triangle", gain: 0.12 },
    { freq: 784, dur: 0.06, at: 0.08, type: "sine", gain: 0.03 },
  ]);

/** Geri sayım tıkı: kısa kare dalga. */
export const tick = (): void => play([{ freq: 760, dur: 0.08, type: "square", gain: 0.05 }]);

/** Başla: yükselen tarama + parlak vuruş. */
export const go = (): void =>
  play([
    { freq: 520, to: 1500, dur: 0.22, type: "sawtooth", gain: 0.035 },
    { freq: 1180, dur: 0.3, at: 0.12, type: "square", gain: 0.06 },
    { freq: 1770, dur: 0.22, at: 0.12, type: "sine", gain: 0.04 },
  ]);

/** Eşleşme (+): yükselen iki nota ve ışıltı. */
export const match = (): void =>
  play([
    { freq: 660, dur: 0.11, type: "sine", gain: 0.1 },
    { freq: 990, dur: 0.16, at: 0.09, type: "sine", gain: 0.1 },
    { freq: 1480, dur: 0.14, at: 0.2, type: "sine", gain: 0.04 },
  ]);

/** Tek kalma (−): alçalan "bzzt". */
export const solo = (): void =>
  play([
    { freq: 220, to: 90, dur: 0.24, type: "sawtooth", gain: 0.07 },
    { freq: 110, to: 60, dur: 0.2, type: "square", gain: 0.04 },
  ]);

/** Tur sonucu: üç basamaklı kısa çıkış, sonda duran nota. */
export const roundResult = (): void =>
  play([
    { freq: 392, dur: 0.1, at: 0, type: "triangle", gain: 0.09 },
    { freq: 494, dur: 0.1, at: 0.1, type: "triangle", gain: 0.09 },
    { freq: 587, dur: 0.1, at: 0.2, type: "triangle", gain: 0.09 },
    { freq: 784, dur: 0.34, at: 0.3, type: "triangle", gain: 0.11 },
    { freq: 392, dur: 0.34, at: 0.3, type: "sine", gain: 0.05 },
  ]);

/** Final: tam do majör çıkışı, akor ve parıltı. */
export const fanfare = (): void =>
  play([
    { freq: 523, dur: 0.14, at: 0, type: "triangle", gain: 0.1 },
    { freq: 659, dur: 0.14, at: 0.12, type: "triangle", gain: 0.1 },
    { freq: 784, dur: 0.14, at: 0.24, type: "triangle", gain: 0.1 },
    { freq: 1047, dur: 0.5, at: 0.36, type: "triangle", gain: 0.12 },
    { freq: 784, dur: 0.5, at: 0.36, type: "sine", gain: 0.06 },
    { freq: 659, dur: 0.5, at: 0.36, type: "sine", gain: 0.05 },
    { freq: 2093, dur: 0.3, at: 0.5, type: "sine", gain: 0.03 },
  ]);

/** Hata: iki alçak, uyumsuz "ıh-ıh". */
export const fail = (): void =>
  play([
    { freq: 311, dur: 0.1, at: 0, type: "square", gain: 0.05 },
    { freq: 233, dur: 0.18, at: 0.11, type: "square", gain: 0.05 },
    { freq: 117, dur: 0.18, at: 0.11, type: "sawtooth", gain: 0.03 },
  ]);
