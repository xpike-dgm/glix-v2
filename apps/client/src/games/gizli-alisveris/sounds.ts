import { play } from "../../fx/sound.js";

/** Sepete ekleme: kuru kasa tıkı ve küçük yazar kasa çıngırağı. */
export const kasa = (): void =>
  play([
    { freq: 900, to: 600, dur: 0.04, type: "triangle", gain: 0.08 },
    { freq: 2350, dur: 0.09, at: 0.05, type: "sine", gain: 0.035 },
    { freq: 3130, dur: 0.12, at: 0.08, type: "sine", gain: 0.025 },
  ]);

/** Sepetten çıkarma: alçalan geri tıkı. */
export const geri = (): void =>
  play([
    { freq: 620, to: 380, dur: 0.06, type: "triangle", gain: 0.07 },
    { freq: 300, dur: 0.04, at: 0.05, type: "triangle", gain: 0.04 },
  ]);

/** Bütçe yetmedi: boğuk "bip". */
export const bip = (): void => play([{ freq: 180, to: 150, dur: 0.18, type: "square", gain: 0.05 }]);

/** Son 10 saniye tiki: yumuşak, kısa. */
export const sonTik = (): void => play([{ freq: 1240, dur: 0.035, type: "sine", gain: 0.035 }]);

/** Vitrin fısıldıyor: yükselen hafif ışıltı. */
export const fisilti = (): void =>
  play([
    { freq: 520, to: 880, dur: 0.3, type: "sine", gain: 0.04 },
    { freq: 1320, dur: 0.2, at: 0.18, type: "sine", gain: 0.025 },
  ]);

/** Metal kepenk: gürültülü, yükselen tırtıklı tarama. */
export const kepenk = (): void =>
  play([
    { freq: 70, to: 140, dur: 0.6, type: "sawtooth", gain: 0.06 },
    { freq: 113, to: 190, dur: 0.55, at: 0.02, type: "square", gain: 0.025 },
    { freq: 220, dur: 0.05, at: 0.6, type: "square", gain: 0.05 },
  ]);

/** Değer bölünmesi: kısa cam kırılması. */
export const kirilma = (): void =>
  play([
    { freq: 2600, to: 1400, dur: 0.07, type: "square", gain: 0.03 },
    { freq: 3400, to: 2100, dur: 0.05, at: 0.03, type: "sawtooth", gain: 0.02 },
    { freq: 1900, dur: 0.08, at: 0.07, type: "triangle", gain: 0.025 },
  ]);

/** Tek başına: altın çınlama. */
export const altin = (): void =>
  play([
    { freq: 1568, dur: 0.18, type: "sine", gain: 0.05 },
    { freq: 2093, dur: 0.24, at: 0.06, type: "sine", gain: 0.04 },
  ]);

/** Kazanma: kasa çekmecesi açılması + zil. */
export const cekmece = (): void =>
  play([
    { freq: 160, to: 90, dur: 0.16, type: "square", gain: 0.06 },
    { freq: 2350, dur: 0.18, at: 0.14, type: "sine", gain: 0.05 },
    { freq: 3130, dur: 0.3, at: 0.2, type: "sine", gain: 0.04 },
    { freq: 784, dur: 0.3, at: 0.2, type: "triangle", gain: 0.06 },
    { freq: 1047, dur: 0.4, at: 0.32, type: "triangle", gain: 0.07 },
  ]);
