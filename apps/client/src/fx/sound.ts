import { createSignal } from "solid-js";
import { KEYS, readStored, writeStored } from "../net/storage.js";

const [muted, setMutedSignal] = createSignal(readStored(KEYS.muted) === "1");

export { muted };

export function toggleMute(): void {
  const next = !muted();
  setMutedSignal(next);
  writeStored(KEYS.muted, next ? "1" : "0");
  if (!next) tap();
}

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
  } catch {
    return null;
  }
  return ctx;
}

/** Tarayıcılar sesi ancak dokunuştan sonra açar. */
export function unlockAudio(): void {
  const c = audio();
  if (c && c.state === "suspended") void c.resume();
}

interface Tone {
  freq: number;
  dur: number;
  at?: number;
  to?: number;
  type?: OscillatorType;
  gain?: number;
}

function play(tones: Tone[]): void {
  if (muted()) return;
  const c = audio();
  if (!c) return;
  if (c.state === "suspended") void c.resume();
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
    osc.connect(g).connect(c.destination);
    osc.start(start);
    osc.stop(start + t.dur + 0.02);
  }
}

export const tap = (): void => play([{ freq: 880, to: 520, dur: 0.05, type: "triangle", gain: 0.08 }]);
export const match = (): void =>
  play([
    { freq: 660, dur: 0.11, type: "sine", gain: 0.1 },
    { freq: 990, dur: 0.16, at: 0.09, type: "sine", gain: 0.1 },
  ]);
export const solo = (): void => play([{ freq: 220, to: 90, dur: 0.24, type: "sawtooth", gain: 0.07 }]);
export const tick = (): void => play([{ freq: 760, dur: 0.08, type: "square", gain: 0.05 }]);
export const go = (): void => play([{ freq: 1180, dur: 0.28, type: "square", gain: 0.06 }]);
export const fanfare = (): void =>
  play([
    { freq: 523, dur: 0.14, at: 0, type: "triangle", gain: 0.1 },
    { freq: 659, dur: 0.14, at: 0.12, type: "triangle", gain: 0.1 },
    { freq: 784, dur: 0.14, at: 0.24, type: "triangle", gain: 0.1 },
    { freq: 1047, dur: 0.5, at: 0.36, type: "triangle", gain: 0.12 },
    { freq: 784, dur: 0.5, at: 0.36, type: "sine", gain: 0.06 },
  ]);
