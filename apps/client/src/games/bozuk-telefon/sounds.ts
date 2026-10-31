import { hapticMatch, hapticTap, hapticTick } from "../../fx/haptics.js";
import { effectsBus, play } from "../../fx/sound.js";

/**
 * Bozuk Telefon ses seti (BT-U8): kod içinde üretilir, dosya yok. Kalem ve kâğıt sesleri süzülmüş gürültüyle,
 * daktilo/kahkaha/zincir sesleri kısa tonlarla. Ses kapalıysa ya da bağlam açılmadıysa sessizce geçer.
 */

let noise: AudioBuffer | null = null;
function noiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noise && noise.sampleRate === ctx.sampleRate) return noise;
  const len = Math.floor(ctx.sampleRate * 0.6);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  noise = buf;
  return buf;
}

interface NoiseShape {
  dur: number;
  freq: number;
  to?: number;
  q?: number;
  gain: number;
  at?: number;
  type?: BiquadFilterType;
}

function burst(shapes: NoiseShape[]): void {
  const bus = effectsBus();
  if (!bus) return;
  const { ctx, out } = bus;
  const t0 = ctx.currentTime;
  for (const sh of shapes) {
    const start = t0 + (sh.at ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx);
    const f = ctx.createBiquadFilter();
    f.type = sh.type ?? "bandpass";
    f.Q.value = sh.q ?? 1.2;
    f.frequency.setValueAtTime(sh.freq, start);
    if (sh.to) f.frequency.exponentialRampToValueAtTime(sh.to, start + sh.dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(sh.gain, start + Math.min(0.02, sh.dur / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, start + sh.dur);
    src.connect(f).connect(g).connect(out);
    src.start(start, Math.random() * 0.3);
    src.stop(start + sh.dur + 0.02);
  }
}

let lastScratch = 0;
/** Kalem sürtünmesi: çizerken hafif, sık çalmasın diye seyreltilir. */
export function penScratch(): void {
  const now = performance.now();
  if (now - lastScratch < 90) return;
  lastScratch = now;
  burst([{ dur: 0.07, freq: 2600 + Math.random() * 1400, q: 2.5, gain: 0.025 }]);
}

/** Kâğıt kayması: yeni adım kartı akışa girerken. */
export function paperSlide(): void {
  burst([{ dur: 0.26, freq: 900, to: 2600, q: 0.8, gain: 0.05 }]);
  hapticTick();
}

let lastKey = 0;
/** Daktilo tuşu: yazı açılırken (seyreltilmiş). */
export function typeKey(): void {
  const now = performance.now();
  if (now - lastKey < 55) return;
  lastKey = now;
  play([{ freq: 1900 + Math.random() * 500, dur: 0.018, type: "square", gain: 0.022 }]);
  burst([{ dur: 0.03, freq: 4200, q: 3, gain: 0.02 }]);
}

let lastPencil = 0;
/** Yeniden çizim kalemi: çizim gözünün önünde çizilirken. */
export function replayPencil(): void {
  const now = performance.now();
  if (now - lastPencil < 120) return;
  lastPencil = now;
  burst([{ dur: 0.11, freq: 3200 + Math.random() * 1600, q: 3, gain: 0.018 }]);
}

/** Oyda kahkaha: aşağı inen üç "ha". */
export function laugh(): void {
  play([
    { freq: 620, to: 520, dur: 0.09, type: "triangle", gain: 0.08 },
    { freq: 580, to: 480, dur: 0.09, at: 0.12, type: "triangle", gain: 0.07 },
    { freq: 540, to: 420, dur: 0.12, at: 0.24, type: "triangle", gain: 0.06 },
  ]);
  hapticTap();
}

/** Sağlam zincir: metal halkaların şakırtısı. */
export function chainClink(): void {
  play([
    { freq: 2350, dur: 0.12, type: "triangle", gain: 0.05 },
    { freq: 3130, dur: 0.1, at: 0.09, type: "sine", gain: 0.05 },
    { freq: 2790, dur: 0.18, at: 0.2, type: "triangle", gain: 0.05 },
    { freq: 4180, dur: 0.22, at: 0.3, type: "sine", gain: 0.03 },
  ]);
  burst([{ dur: 0.05, freq: 6000, q: 4, gain: 0.03, at: 0.3 }]);
  hapticMatch();
}

/** Cümle kablodan sıradakine gider: kısa yükselen "vınn". */
export function cableSend(): void {
  play([
    { freq: 300, to: 1200, dur: 0.45, type: "sine", gain: 0.05 },
    { freq: 900, to: 2400, dur: 0.3, at: 0.25, type: "triangle", gain: 0.03 },
  ]);
}
