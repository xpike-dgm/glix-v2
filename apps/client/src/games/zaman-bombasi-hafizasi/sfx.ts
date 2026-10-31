/**
 * Zaman Bombası Hafızası ses seti (ZB-U9): dolgun tuş notaları, fitil cızırtısı ve tiki, "TEMİZ!" zili, bomba
 * fırlatma ve patlama. Ortak ses altyapısını (`fx/sound.ts`) kullanır; sessizde ve ses açılmadan hiçbiri çalmaz.
 */
import { effectsBus, play } from "../../fx/sound.js";

/** Kısa beyaz gürültü patlaması (cızırtı, patlama gövdesi): bant geçiren süzgeçle renklendirilir. */
function noise(durSec: number, gain: number, freq: number, q = 0.8, at = 0): void {
  const bus = effectsBus();
  if (!bus) return;
  const { ctx, out } = bus;
  const len = Math.max(1, Math.floor(ctx.sampleRate * durSec));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = freq;
  filter.Q.value = q;
  const g = ctx.createGain();
  const t0 = ctx.currentTime + at;
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + durSec);
  src.connect(filter).connect(g).connect(out);
  src.start(t0);
  src.stop(t0 + durSec + 0.02);
}

/** Tuş notası: üçgen gövde + bir oktav üst + beşli; kısa ışıkta bile dolgun duyulur. */
export function padNote(freq: number, durMs: number): void {
  const dur = Math.min(0.55, Math.max(0.14, durMs / 1000));
  play([
    { freq, dur, type: "triangle", gain: 0.14 },
    { freq: freq * 2, dur: dur * 0.7, type: "sine", gain: 0.045 },
    { freq: freq * 1.5, dur: dur * 0.5, type: "sine", gain: 0.025 },
    { freq: freq / 2, dur: dur * 0.8, type: "sine", gain: 0.05 },
  ]);
}

/** Fitil tiki; `rush` (son 2 sn) daha tiz ve keskin. */
export function fuseTick(rush: boolean): void {
  play([{ freq: rush ? 1250 : 900, dur: 0.045, type: "square", gain: rush ? 0.05 : 0.035 }]);
  noise(0.05, rush ? 0.06 : 0.035, 5200, 1.4);
}

/** "TEMİZ!" zili: parlak üç nota. */
export function cleanChime(): void {
  play([
    { freq: 784, dur: 0.16, type: "triangle", gain: 0.11 },
    { freq: 1047, dur: 0.2, at: 0.08, type: "triangle", gain: 0.11 },
    { freq: 1568, dur: 0.42, at: 0.16, type: "sine", gain: 0.08 },
    { freq: 2093, dur: 0.3, at: 0.2, type: "sine", gain: 0.03 },
  ]);
}

/** Seçim onayı (renk ya da hedef dokunuşu). */
export function pickBlip(): void {
  play([{ freq: 660, to: 990, dur: 0.09, type: "triangle", gain: 0.09 }]);
}

/** Bomba fırlatma "vuuş". */
export function whoosh(): void {
  noise(0.42, 0.16, 900, 0.6);
  play([{ freq: 520, to: 180, dur: 0.4, type: "sine", gain: 0.05 }]);
}

/** Sıra sana geçti: iki kez yükselen alarm. */
export function turnAlarm(): void {
  play([
    { freq: 660, to: 990, dur: 0.16, type: "square", gain: 0.06 },
    { freq: 660, to: 1180, dur: 0.22, at: 0.2, type: "square", gain: 0.07 },
  ]);
}

/** Patlama: derin vuruş + gürültü gövdesi. */
export function boom(): void {
  play([
    { freq: 120, to: 38, dur: 0.6, type: "sine", gain: 0.28 },
    { freq: 220, to: 60, dur: 0.25, type: "square", gain: 0.06 },
  ]);
  noise(0.7, 0.32, 420, 0.5);
  noise(0.3, 0.18, 2400, 0.7, 0.02);
}
