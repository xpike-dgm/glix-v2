/**
 * Üretilmiş (WebAudio) müzik zamanlayıcısı: lobi döngüsü ve oyun içi gerilim ritmi. Dosya yok; her nota
 * küçük bir osilatördür. Zamanlayıcı saf durumdur ve sahte bir AudioContext ile sınanır: `tick()` yalnız
 * önümüzdeki kısa pencereye (LOOKAHEAD_S) düşen notaları kurar; gerçek ortamda `setInterval` çağırır.
 */

export type MusicMode = "lobby" | "tension";

interface ParamLike {
  value: number;
  setValueAtTime(v: number, t: number): unknown;
  linearRampToValueAtTime(v: number, t: number): unknown;
  exponentialRampToValueAtTime(v: number, t: number): unknown;
  setTargetAtTime(v: number, t: number, tc: number): unknown;
}
interface NodeLike {
  connect(dest: unknown): unknown;
}
export interface OscLike extends NodeLike {
  type: string;
  frequency: ParamLike;
  start(t: number): void;
  stop(t: number): void;
}
export interface GainLike extends NodeLike {
  gain: ParamLike;
}
/** AudioContext'in kullandığımız küçük dilimi. */
export interface CtxLike {
  currentTime: number;
  createOscillator(): OscLike;
  createGain(): GainLike;
}

export const LOOKAHEAD_S = 0.6;
export const TICK_MS = 150;
/** Gerilim yatağı bu kadar saniye kala başlar. */
export const TENSION_START_S = 10;
const DUCK_LEVEL = 0.3;

const midi = (n: number): number => 440 * 2 ** ((n - 69) / 12);

/** Lobi: 4 ölçülük sakin Am – F – C – G; her ölçü 2,8 sn (~86 bpm). */
const BAR_S = 2.8;
const CHORDS: readonly (readonly number[])[] = [
  [57, 60, 64],
  [53, 57, 60],
  [48, 55, 64],
  [55, 59, 62],
];
const ARP_STEP_S = BAR_S / 8;

export interface MusicScheduler {
  readonly mode: MusicMode | null;
  readonly ducked: boolean;
  readonly intensity: number;
  start(mode: MusicMode): void;
  stop(): void;
  duck(on: boolean): void;
  /** 0..1: gerilimin yoğunluğu (nabız hızlanır). */
  setIntensity(v: number): void;
  tick(): void;
}

export interface SchedulerHost {
  ctx: CtxLike;
  /** Müzik düzeyi düğümü (kullanıcı müzik sürgüsü); zamanlayıcı onu ezmez, kendi duck düğümünü ekler. */
  out: unknown;
  setInterval?: (fn: () => void, ms: number) => unknown;
  clearInterval?: (h: unknown) => void;
}

export function createMusicScheduler(host: SchedulerHost): MusicScheduler {
  const { ctx } = host;
  const setIv = host.setInterval ?? ((fn, ms) => globalThis.setInterval(fn, ms));
  const clearIv = host.clearInterval ?? ((h) => globalThis.clearInterval(h as number));
  const bus = ctx.createGain();
  bus.gain.value = 1;
  bus.connect(host.out);

  let mode: MusicMode | null = null;
  let ducked = false;
  let intensity = 0;
  let handle: unknown = null;
  /** Bir sonraki kurulacak notanın zamanı ve sayacı. */
  let nextAt = 0;
  let step = 0;

  function note(freq: number, at: number, dur: number, peak: number, type: string, attack = 0.02): void {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, at);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(peak, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g);
    g.connect(bus);
    o.start(at);
    o.stop(at + dur + 0.05);
  }

  function lobbyStep(at: number, i: number): void {
    const chord = CHORDS[Math.floor(i / 8) % CHORDS.length] ?? CHORDS[0] ?? [];
    const pos = i % 8;
    if (pos === 0) {
      // Pad: her ölçü başında hafif ayrık iki katman, yavaş giriş.
      for (const n of chord) {
        note(midi(n), at, BAR_S * 1.05, 0.018, "sine", 0.7);
        note(midi(n) * 1.004, at, BAR_S * 1.05, 0.01, "triangle", 0.9);
      }
      const root = chord[0];
      if (root !== undefined) note(midi(root - 12), at, BAR_S, 0.03, "sine", 0.3);
    }
    // Arpej: akor sesleri + oktav, sekiz adımda yukarı-aşağı.
    const order = [0, 1, 2, 1, 0, 2, 1, 2];
    const idx = order[pos] ?? 0;
    const n = chord[idx % chord.length];
    if (n !== undefined && pos % 2 === 0) note(midi(n + 12), at, 0.5, 0.012, "triangle", 0.01);
  }

  function tensionStep(at: number, i: number): void {
    // Alçak yatak: sürekli tek nota; nabız: kısa alçak "dum" (yoğunlukla hızlanır).
    if (i % 4 === 0) note(55, at, 1.1, 0.03 + intensity * 0.03, "sine", 0.25);
    note(62, at, 0.16, 0.05 + intensity * 0.05, "sine", 0.01);
    if (intensity > 0.6) note(124, at + 0.01, 0.06, 0.02, "triangle", 0.005);
  }

  /** Gerilimde adım aralığı: 0,75 sn → 0,36 sn. */
  const tensionGap = (): number => 0.75 - 0.39 * Math.min(1, Math.max(0, intensity));

  function tick(): void {
    if (mode === null) return;
    const horizon = ctx.currentTime + LOOKAHEAD_S;
    // Geride kaldıysa (sekme donmuş) eski notaları yağdırma: ileri sar.
    if (nextAt < ctx.currentTime) nextAt = ctx.currentTime + 0.05;
    while (nextAt < horizon) {
      if (mode === "lobby") {
        lobbyStep(nextAt, step);
        nextAt += ARP_STEP_S;
      } else {
        tensionStep(nextAt, step);
        nextAt += tensionGap();
      }
      step += 1;
    }
  }

  function halt(): void {
    if (handle !== null) clearIv(handle);
    handle = null;
  }

  return {
    get mode() {
      return mode;
    },
    get ducked() {
      return ducked;
    },
    get intensity() {
      return intensity;
    },
    start(m) {
      if (mode === m && handle !== null) return;
      halt();
      mode = m;
      step = 0;
      nextAt = ctx.currentTime + 0.05;
      bus.gain.setTargetAtTime(ducked ? DUCK_LEVEL : 1, ctx.currentTime, 0.05);
      tick();
      handle = setIv(tick, TICK_MS);
    },
    stop() {
      halt();
      mode = null;
      intensity = 0;
      // Önceden kurulmuş uzun pad notaları da susar; `start` veriyolunu yeniden açar.
      bus.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.08);
    },
    duck(on) {
      ducked = on;
      if (mode !== null) bus.gain.setTargetAtTime(on ? DUCK_LEVEL : 1, ctx.currentTime, 0.08);
    },
    setIntensity(v) {
      intensity = Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));
    },
    tick,
  };
}
