import { play } from "../../fx/sound.js";

/** Tıklama: kısa elektrik çıtırtısı. */
export const zap = (): void =>
  play([
    { freq: 1900, to: 700, dur: 0.035, type: "square", gain: 0.035 },
    { freq: 420, to: 260, dur: 0.05, at: 0.01, type: "triangle", gain: 0.05 },
  ]);

/** Seri ritmi: küçük, parlak iki nota (yalnız kendi hızın). */
export const beat = (): void =>
  play([
    { freq: 1320, dur: 0.06, type: "triangle", gain: 0.045 },
    { freq: 1760, dur: 0.08, at: 0.05, type: "sine", gain: 0.04 },
  ]);

/** Tehlike başladı: iki alçak uyarı notası. */
export const alarm = (): void =>
  play([
    { freq: 330, dur: 0.16, type: "square", gain: 0.06 },
    { freq: 330, dur: 0.16, at: 0.22, type: "square", gain: 0.06 },
  ]);

/** Patlama: derin, uzun gürleme; altta boğuk alt bas, üstte kısa çatırtı. */
export const blast = (): void =>
  play([
    { freq: 72, to: 24, dur: 1.5, type: "sine", gain: 0.24 },
    { freq: 150, to: 32, dur: 1.0, type: "sawtooth", gain: 0.14 },
    { freq: 96, to: 28, dur: 1.2, type: "square", gain: 0.08 },
    { freq: 1300, to: 120, dur: 0.22, type: "sawtooth", gain: 0.07 },
    { freq: 46, to: 22, dur: 1.1, at: 0.18, type: "sine", gain: 0.16 },
  ]);
