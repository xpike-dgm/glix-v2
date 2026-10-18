import { play } from "../../fx/sound.js";

/** Sessiz parmak izi: çok kısık, kuru bir tık (yalnız basanın kulağına). */
export const prick = (): void =>
  play([
    { freq: 640, to: 360, dur: 0.07, type: "sine", gain: 0.045 },
    { freq: 180, dur: 0.05, at: 0.02, type: "triangle", gain: 0.035 },
  ]);

/** Kasa açıldı: temiz, yükselen iki nota. */
export const vaultOpen = (): void =>
  play([
    { freq: 523, dur: 0.12, type: "triangle", gain: 0.09 },
    { freq: 784, dur: 0.12, at: 0.1, type: "triangle", gain: 0.09 },
    { freq: 1047, dur: 0.32, at: 0.2, type: "sine", gain: 0.08 },
  ]);

/** Alarm: sert, iki kez yükselen siren. */
export const alarm = (): void =>
  play([
    { freq: 440, to: 820, dur: 0.22, type: "sawtooth", gain: 0.07 },
    { freq: 440, to: 820, dur: 0.22, at: 0.26, type: "sawtooth", gain: 0.07 },
    { freq: 90, to: 60, dur: 0.4, at: 0.05, type: "square", gain: 0.04 },
  ]);

/** Boş kasa: alçak, tek ve sakin. */
export const hollow = (): void => play([{ freq: 196, to: 150, dur: 0.4, type: "sine", gain: 0.06 }]);
