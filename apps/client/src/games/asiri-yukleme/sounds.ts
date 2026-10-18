import { play } from "../../fx/sound.js";

/** Tıklama: kısa elektrik çıtırtısı. */
export const zap = (): void =>
  play([
    { freq: 1900, to: 700, dur: 0.035, type: "square", gain: 0.035 },
    { freq: 420, to: 260, dur: 0.05, at: 0.01, type: "triangle", gain: 0.05 },
  ]);

/** Tehlike başladı: iki alçak uyarı notası. */
export const alarm = (): void =>
  play([
    { freq: 330, dur: 0.16, type: "square", gain: 0.06 },
    { freq: 330, dur: 0.16, at: 0.22, type: "square", gain: 0.06 },
  ]);

/** Patlama: alçalan gürleme. */
export const blast = (): void =>
  play([
    { freq: 190, to: 36, dur: 0.75, type: "sawtooth", gain: 0.16 },
    { freq: 100, to: 30, dur: 0.85, type: "square", gain: 0.1 },
    { freq: 1100, to: 140, dur: 0.2, type: "sawtooth", gain: 0.07 },
  ]);
