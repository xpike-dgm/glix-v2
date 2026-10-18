import { play } from "../../fx/sound.js";

/** Kaçış: kısa, yukarı doğru bir "vuş". */
export const dash = (): void =>
  play([
    { freq: 280, to: 1100, dur: 0.18, type: "triangle", gain: 0.08 },
    { freq: 140, to: 520, dur: 0.2, at: 0.02, type: "sine", gain: 0.05 },
  ]);

/** Gerilim yükselince kısık bir kalp atışı. */
export const thump = (): void =>
  play([
    { freq: 90, to: 55, dur: 0.12, type: "sine", gain: 0.1 },
    { freq: 80, to: 50, dur: 0.14, at: 0.16, type: "sine", gain: 0.08 },
  ]);

/** Gerçek bitiş alarmı: sert siren. */
export const siren = (): void =>
  play([
    { freq: 520, to: 900, dur: 0.24, type: "sawtooth", gain: 0.07 },
    { freq: 900, to: 520, dur: 0.24, at: 0.24, type: "sawtooth", gain: 0.07 },
    { freq: 520, to: 900, dur: 0.24, at: 0.48, type: "sawtooth", gain: 0.06 },
  ]);

/** Son kaçan ödülü: parlak altın çınlama. */
export const gold = (): void =>
  play([
    { freq: 784, dur: 0.1, type: "triangle", gain: 0.09 },
    { freq: 988, dur: 0.1, at: 0.09, type: "triangle", gain: 0.09 },
    { freq: 1319, dur: 0.34, at: 0.18, type: "sine", gain: 0.08 },
  ]);
