import { play } from "../../fx/sound.js";

/** Boş atış: kuru "klik". */
export const click = (): void =>
  play([
    { freq: 1500, to: 600, dur: 0.04, type: "square", gain: 0.05 },
    { freq: 420, to: 260, dur: 0.07, at: 0.05, type: "triangle", gain: 0.06 },
  ]);

/** Patlama: alçak gümbürtü ve keskin çatlak. */
export const bang = (): void =>
  play([
    { freq: 1800, to: 120, dur: 0.12, type: "sawtooth", gain: 0.11 },
    { freq: 180, to: 38, dur: 0.5, type: "sine", gain: 0.16 },
    { freq: 90, to: 40, dur: 0.38, at: 0.02, type: "square", gain: 0.05 },
  ]);

/** Silah el değiştirir: kısa metal "şak". */
export const cock = (): void =>
  play([
    { freq: 700, to: 980, dur: 0.05, type: "triangle", gain: 0.07 },
    { freq: 540, to: 780, dur: 0.06, at: 0.09, type: "triangle", gain: 0.07 },
  ]);

/** Nişan kilidi: ince bir kırmızı "tink". */
export const lock = (): void => play([{ freq: 1240, to: 880, dur: 0.07, type: "sine", gain: 0.08 }]);
