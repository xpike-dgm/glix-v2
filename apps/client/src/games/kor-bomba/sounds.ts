import { effectsBus, play } from "../../fx/sound.js";

/**
 * Kör Bomba ses seti (BM-U13), kodla üretilir. Kural: hiçbir ses süreye bağlı değildir (masada her telefon duyulur;
 * taşıyıcıya ipucu olmasın). Ek süre kıvılcımı sessizdir; süreyi görenlerin telefonu son saniyelerde ses çıkarmaz.
 */

/** Pas: kısa, kuru "tak" (masadaki diğerleri duyar). */
export const tak = (): void =>
  play([
    { freq: 1500, to: 320, dur: 0.045, type: "square", gain: 0.05 },
    { freq: 240, to: 150, dur: 0.07, at: 0.015, type: "triangle", gain: 0.08 },
  ]);

/** Pas atma: "vuuş" (atanın telefonu). */
export const whoosh = (): void =>
  play([
    { freq: 260, to: 1400, dur: 0.18, type: "sawtooth", gain: 0.035 },
    { freq: 520, to: 2200, dur: 0.16, at: 0.02, type: "sine", gain: 0.04 },
  ]);

/** Bombayı alma: tok "tak" ve kıvılcım çıtırtısı (alanın telefonu). */
export const catchSound = (): void =>
  play([
    { freq: 180, to: 90, dur: 0.12, type: "triangle", gain: 0.14 },
    { freq: 1500, to: 400, dur: 0.05, type: "square", gain: 0.06 },
    { freq: 3200, dur: 0.02, at: 0.07, type: "square", gain: 0.03 },
    { freq: 2600, dur: 0.02, at: 0.12, type: "square", gain: 0.025 },
    { freq: 3600, dur: 0.018, at: 0.17, type: "square", gain: 0.02 },
  ]);

/** BM-M1 kilidi bitti: kısa "çıt" (yalnız taşıyıcı). */
export const unlockClick = (): void =>
  play([{ freq: 2400, to: 1800, dur: 0.03, type: "square", gain: 0.05 }]);

/** Bahis basışı: yalnız kendi telefonunda çok kısık "çıt". */
export const betClick = (): void => play([{ freq: 2000, dur: 0.02, type: "sine", gain: 0.015 }]);

/** Kazanan bahis: zil. */
export const bell = (): void =>
  play([
    { freq: 1318, dur: 0.6, type: "sine", gain: 0.07 },
    { freq: 1975, dur: 0.5, at: 0.04, type: "sine", gain: 0.04 },
    { freq: 2637, dur: 0.35, at: 0.08, type: "sine", gain: 0.025 },
  ]);

/** Patlama: derin bas gümbürtü ve cam/metal döküntü kuyruğu (≤ 2 sn). */
export const boom = (): void =>
  play([
    { freq: 170, to: 30, dur: 0.9, type: "sawtooth", gain: 0.16 },
    { freq: 80, to: 24, dur: 1.1, type: "square", gain: 0.1 },
    { freq: 900, to: 120, dur: 0.18, type: "sawtooth", gain: 0.07 },
    { freq: 4200, dur: 0.04, at: 0.35, type: "square", gain: 0.025 },
    { freq: 3100, dur: 0.05, at: 0.5, type: "triangle", gain: 0.03 },
    { freq: 5200, dur: 0.03, at: 0.66, type: "square", gain: 0.02 },
    { freq: 2700, dur: 0.06, at: 0.84, type: "triangle", gain: 0.02 },
    { freq: 4600, dur: 0.03, at: 1.1, type: "square", gain: 0.012 },
  ]);

export interface FuseHiss {
  start(): void;
  stop(): void;
}

/**
 * Taşıyıcının fitil cızırtısı: süzülmüş gürültü döngüsü, **sabit** düzey ve tempoda (zamanla hızlanmaz, değişmez).
 * Sessizdeyse ya da ses bağlamı açılmadıysa çalmaz.
 */
export function createFuseHiss(): FuseHiss {
  let nodes: { src: AudioBufferSourceNode; gain: GainNode; ctx: AudioContext } | null = null;
  return {
    start() {
      if (nodes) return;
      const bus = effectsBus();
      if (!bus) return;
      try {
        const { ctx } = bus;
        const len = Math.floor(ctx.sampleRate * 1.2);
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = buf.getChannelData(0);
        // Gürültü + sabit aralıklı çıtırtı (döngü boyunca aynı desen).
        for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * 0.35;
        for (let k = 0; k < 6; k++) {
          const at = Math.floor((k / 6) * len);
          for (let j = 0; j < 90 && at + j < len; j++) data[at + j] = (Math.random() * 2 - 1) * (1 - j / 90);
        }
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        const band = ctx.createBiquadFilter();
        band.type = "bandpass";
        band.frequency.value = 3200;
        band.Q.value = 0.8;
        const gain = ctx.createGain();
        gain.gain.value = 0;
        gain.gain.setTargetAtTime(0.05, ctx.currentTime, 0.15);
        src.connect(band).connect(gain).connect(bus.out);
        src.start();
        nodes = { src, gain, ctx };
      } catch {
        nodes = null;
      }
    },
    stop() {
      if (!nodes) return;
      const n = nodes;
      nodes = null;
      try {
        n.gain.gain.setTargetAtTime(0, n.ctx.currentTime, 0.05);
        n.src.stop(n.ctx.currentTime + 0.3);
      } catch {
        // zaten durmuş
      }
    },
  };
}
