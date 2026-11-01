import { effectsBus, play } from "../../fx/sound.js";

/*
 * GH-U15: ele vermeyen ses seti. Kod içinde üretilen geçici sesler (dosyalar gelene kadar; docs/oneriler/
 * GORSEL-IHTIYACLARI.md "Gizli Hırsız" ses notu). Karar anında (ÇAL / ÇALMA) hiç ses yoktur; her ses herkeste aynıdır.
 */

/** GH-U3: kadran tıkırtısı: çok kısık, kuru bir tık. */
export const dialClick = (): void =>
  play([{ freq: 1900, to: 1400, dur: 0.018, type: "square", gain: 0.012 }]);

/** GH-U7: son 5 sn tik (kabuk saatinin tikine eşlik eden alçak vuruş). */
export const lastTick = (): void => play([{ freq: 120, to: 90, dur: 0.09, type: "sine", gain: 0.07 }]);

/** GH-U9: kasa dinleniyor (stetoskop): kısa, boğuk iki vuruş. */
export const listen = (): void =>
  play([
    { freq: 300, to: 200, dur: 0.12, type: "sine", gain: 0.05 },
    { freq: 300, to: 200, dur: 0.12, at: 0.28, type: "sine", gain: 0.05 },
  ]);

/** GH-U9: "Kasa sessiz": sakin tek nota. */
export const quietNote = (): void => play([{ freq: 392, dur: 0.5, type: "sine", gain: 0.06 }]);

/** GH-U9: "Kasada kıpırtı var!": kısa kalp çarpıntısı. */
export const stirBeat = (): void =>
  play([
    { freq: 70, to: 50, dur: 0.14, type: "sine", gain: 0.16 },
    { freq: 70, to: 50, dur: 0.14, at: 0.18, type: "sine", gain: 0.13 },
    { freq: 70, to: 50, dur: 0.14, at: 0.62, type: "sine", gain: 0.16 },
    { freq: 70, to: 50, dur: 0.14, at: 0.8, type: "sine", gain: 0.13 },
  ]);

/** GH-U5: süre doldu, kasa mekanizması döner. */
export const mechanism = (): void =>
  play([
    { freq: 140, to: 90, dur: 0.2, type: "square", gain: 0.05 },
    { freq: 900, dur: 0.03, at: 0.18, type: "square", gain: 0.03 },
    { freq: 760, dur: 0.03, at: 0.3, type: "square", gain: 0.03 },
    { freq: 180, to: 120, dur: 0.35, at: 0.42, type: "sawtooth", gain: 0.04 },
  ]);

/** GH-U5: parmak izi sayacının her rakamında tık. */
export const countTick = (): void => play([{ freq: 1200, dur: 0.035, type: "triangle", gain: 0.05 }]);

/** Kasa açıldı (tek hırsız): temiz, yükselen notalar ve para şıkırtısı. */
export const vaultOpen = (): void =>
  play([
    { freq: 523, dur: 0.12, type: "triangle", gain: 0.09 },
    { freq: 784, dur: 0.12, at: 0.1, type: "triangle", gain: 0.09 },
    { freq: 1047, dur: 0.32, at: 0.2, type: "sine", gain: 0.08 },
    { freq: 2637, dur: 0.05, at: 0.34, type: "square", gain: 0.02 },
    { freq: 3136, dur: 0.05, at: 0.42, type: "square", gain: 0.02 },
    { freq: 2794, dur: 0.05, at: 0.5, type: "square", gain: 0.02 },
  ]);

/** Alarm: sert siren ve kelepçe şakırtısı. */
export const alarm = (): void =>
  play([
    { freq: 440, to: 820, dur: 0.22, type: "sawtooth", gain: 0.07 },
    { freq: 440, to: 820, dur: 0.22, at: 0.26, type: "sawtooth", gain: 0.07 },
    { freq: 90, to: 60, dur: 0.4, at: 0.05, type: "square", gain: 0.04 },
    { freq: 1500, to: 1100, dur: 0.04, at: 0.6, type: "square", gain: 0.03 },
    { freq: 1500, to: 1100, dur: 0.04, at: 0.68, type: "square", gain: 0.03 },
  ]);

/** Boş kasa: alçak, tek ve sakin (rüzgâr yerine). */
export const hollow = (): void =>
  play([
    { freq: 196, to: 150, dur: 0.4, type: "sine", gain: 0.06 },
    { freq: 420, to: 300, dur: 0.8, at: 0.1, type: "triangle", gain: 0.012 },
  ]);

export interface Ambience {
  /** Uğultuyu açar (ses açılmışsa); son saniyelerde lazer vızıltısı hızlanır. */
  set(on: boolean, urgent: boolean): void;
  stop(): void;
}

/**
 * GH-U15: oyun boyu alçak alarm uğultusu ve lazer vızıltısı (herkeste aynı). Tek sürekli osilatör çifti; sessizdeyse
 * ya da ses henüz açılmadıysa çalmaz.
 */
export function createAmbience(): Ambience {
  let nodes: {
    ctx: AudioContext;
    hum: OscillatorNode;
    buzz: OscillatorNode;
    lfo: OscillatorNode;
    gain: GainNode;
  } | null = null;

  const ensure = (): typeof nodes => {
    if (nodes) return nodes;
    const bus = effectsBus();
    if (!bus) return null;
    try {
      const { ctx } = bus;
      const hum = ctx.createOscillator();
      const buzz = ctx.createOscillator();
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      const buzzGain = ctx.createGain();
      const gain = ctx.createGain();
      hum.type = "sine";
      hum.frequency.value = 55;
      buzz.type = "sawtooth";
      buzz.frequency.value = 220;
      lfo.frequency.value = 0.6;
      lfoGain.gain.value = 0.004;
      buzzGain.gain.value = 0.006;
      gain.gain.value = 0;
      lfo.connect(lfoGain).connect(buzzGain.gain);
      buzz.connect(buzzGain).connect(gain);
      hum.connect(gain);
      gain.connect(bus.out);
      hum.start();
      buzz.start();
      lfo.start();
      nodes = { ctx, hum, buzz, lfo, gain };
    } catch {
      nodes = null;
    }
    return nodes;
  };

  const stop = (): void => {
    if (!nodes) return;
    const n = nodes;
    nodes = null;
    try {
      const t = n.ctx.currentTime;
      n.gain.gain.cancelScheduledValues(t);
      n.gain.gain.setTargetAtTime(0, t, 0.05);
      for (const o of [n.hum, n.buzz, n.lfo]) o.stop(t + 0.3);
      n.hum.onended = () => n.gain.disconnect();
    } catch {
      // bağlam kapanmış olabilir
    }
  };

  return {
    set(on, urgent) {
      if (!on || !effectsBus()) {
        stop();
        return;
      }
      const n = ensure();
      if (!n) return;
      const t = n.ctx.currentTime;
      n.gain.gain.setTargetAtTime(0.05, t, 0.3);
      n.lfo.frequency.setTargetAtTime(urgent ? 4 : 0.6, t, 0.2);
      n.buzz.frequency.setTargetAtTime(urgent ? 330 : 220, t, 0.2);
    },
    stop,
  };
}
