import { play } from "../../fx/sound.js";

/**
 * Rus Ruleti ses seti (RR-U16), kodla üretilir; Ses alanı gerçek kayıt verene kadar kullanılır. Olay adları
 * `rus-ruleti.<an>`: horoz, tambur, kalp, klik, bam, sak, tik, sonsoz, bitti.
 */

/** Boş atış: kuru "klik". */
export const click = (): void =>
  play([
    { freq: 1500, to: 600, dur: 0.04, type: "square", gain: 0.05 },
    { freq: 420, to: 260, dur: 0.07, at: 0.05, type: "triangle", gain: 0.06 },
  ]);

/** Patlama: derin gümbürtü, keskin çatlak ve cam çatlağı kuyruğu. */
export const bang = (): void =>
  play([
    { freq: 1800, to: 120, dur: 0.12, type: "sawtooth", gain: 0.11 },
    { freq: 180, to: 32, dur: 0.6, type: "sine", gain: 0.17 },
    { freq: 90, to: 36, dur: 0.42, at: 0.02, type: "square", gain: 0.05 },
    { freq: 4200, dur: 0.03, at: 0.16, type: "square", gain: 0.022 },
    { freq: 3100, dur: 0.04, at: 0.24, type: "triangle", gain: 0.025 },
    { freq: 5200, dur: 0.025, at: 0.33, type: "square", gain: 0.016 },
  ]);

/** Silah sana geçti: horoz çekme. */
export const cock = (): void =>
  play([
    { freq: 700, to: 980, dur: 0.05, type: "triangle", gain: 0.07 },
    { freq: 540, to: 780, dur: 0.06, at: 0.09, type: "triangle", gain: 0.07 },
  ]);

/** Nişan kilidi: ince bir kırmızı "tink". */
export const lock = (): void => play([{ freq: 1240, to: 880, dur: 0.07, type: "sine", gain: 0.08 }]);

/** El değiştirme: kısa metal "şak" (silah başkasına kayınca). */
export const swap = (): void =>
  play([
    { freq: 1100, to: 640, dur: 0.04, type: "square", gain: 0.035 },
    { freq: 320, to: 220, dur: 0.06, at: 0.02, type: "triangle", gain: 0.05 },
  ]);

/** RR-U5: tambur dönüşü (1,2 sn, yavaşlayan tıkırtı). */
export const spin = (): void =>
  play(
    [0, 0.08, 0.17, 0.27, 0.39, 0.53, 0.7, 0.9, 1.12].map((at, i) => ({
      freq: 2200 - i * 120,
      to: 1400 - i * 80,
      dur: 0.03,
      at,
      type: "square" as const,
      gain: 0.03,
    })),
  );

/** Kalp atışı (lub-dub); risk %56 ve üstünde biraz daha sert. */
export const heart = (hot: boolean): void =>
  play([
    { freq: 62, to: 44, dur: 0.12, type: "sine", gain: hot ? 0.2 : 0.14 },
    { freq: 58, to: 40, dur: 0.14, at: hot ? 0.18 : 0.24, type: "sine", gain: hot ? 0.16 : 0.11 },
  ]);

/** RR-U9: son 5 sn tiki. */
export const tick = (): void => play([{ freq: 1900, dur: 0.025, type: "square", gain: 0.03 }]);

/** RR-M3: son söz için kısa alçak nota. */
export const lastWordNote = (): void =>
  play([
    { freq: 196, dur: 0.5, type: "triangle", gain: 0.08 },
    { freq: 147, dur: 0.6, at: 0.12, type: "sine", gain: 0.07 },
  ]);

/** RR-U8: hayatta kalanlar için tok "bitti" vuruşu. */
export const finale = (): void =>
  play([
    { freq: 110, to: 70, dur: 0.5, type: "sine", gain: 0.16 },
    { freq: 440, dur: 0.35, at: 0.04, type: "triangle", gain: 0.05 },
    { freq: 660, dur: 0.4, at: 0.1, type: "sine", gain: 0.04 },
  ]);
