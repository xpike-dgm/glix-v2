import { play } from "../../fx/sound.js";

/** Pas: kısa, kuru "tak". */
export const tak = (): void =>
  play([
    { freq: 1500, to: 320, dur: 0.045, type: "square", gain: 0.06 },
    { freq: 240, to: 150, dur: 0.07, at: 0.015, type: "triangle", gain: 0.09 },
  ]);

/** Eklenen süre: küçük, yukarı doğru bir kıvılcım. */
export const spark = (): void =>
  play([
    { freq: 1320, dur: 0.06, type: "sine", gain: 0.05 },
    { freq: 1980, dur: 0.1, at: 0.05, type: "sine", gain: 0.04 },
  ]);

/** Patlama: alçalan gürleme ve çatırtı. */
export const boom = (): void =>
  play([
    { freq: 170, to: 34, dur: 0.7, type: "sawtooth", gain: 0.16 },
    { freq: 95, to: 28, dur: 0.8, type: "square", gain: 0.1 },
    { freq: 900, to: 120, dur: 0.18, type: "sawtooth", gain: 0.07 },
  ]);
