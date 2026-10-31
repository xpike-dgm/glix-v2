import { play } from "../../fx/sound.js";

/** Takas: iki kadehin tıngırtısı ve kısa ışık süpürmesi. */
export const swapSound = (): void =>
  play([
    { freq: 520, to: 1400, dur: 0.16, type: "sine", gain: 0.07 },
    { freq: 1760, dur: 0.1, at: 0.14, type: "triangle", gain: 0.08 },
    { freq: 2350, dur: 0.14, at: 0.2, type: "sine", gain: 0.05 },
  ]);

/** Temiz kadeh: parlak altın çınlama. */
export const cleanSound = (): void =>
  play([
    { freq: 784, dur: 0.1, type: "triangle", gain: 0.09 },
    { freq: 1175, dur: 0.12, at: 0.09, type: "triangle", gain: 0.09 },
    { freq: 1568, dur: 0.34, at: 0.18, type: "sine", gain: 0.07 },
  ]);

/** Zehirli kadeh: alçak, boğuk iniş. */
export const poisonSound = (): void =>
  play([
    { freq: 200, to: 70, dur: 0.4, type: "sawtooth", gain: 0.06 },
    { freq: 110, to: 55, dur: 0.45, type: "sine", gain: 0.08 },
  ]);

/** Kontrol: kısa, nötr "kapak kalktı" sesi. Sonuç ne olursa olsun AYNI ses: yanındakiler sesten bir şey anlamasın. */
export const peekSound = (): void =>
  play([
    { freq: 660, to: 990, dur: 0.12, type: "sine", gain: 0.05 },
    { freq: 1320, dur: 0.08, at: 0.1, type: "triangle", gain: 0.04 },
  ]);

/** Şerefe: iki kadehin tokuşması (parlak, kısa çınlama ve titreşen kuyruk). */
export const cheersSound = (): void =>
  play([
    { freq: 2093, dur: 0.06, type: "triangle", gain: 0.09 },
    { freq: 2637, dur: 0.5, at: 0.02, type: "sine", gain: 0.06 },
    { freq: 3136, dur: 0.35, at: 0.05, type: "sine", gain: 0.035 },
  ]);

/** Son saniyeler: kalp atışı ("tum-tum"). */
export const heartbeatSound = (): void =>
  play([
    { freq: 70, to: 48, dur: 0.12, type: "sine", gain: 0.16 },
    { freq: 64, to: 44, dur: 0.14, at: 0.2, type: "sine", gain: 0.12 },
  ]);
