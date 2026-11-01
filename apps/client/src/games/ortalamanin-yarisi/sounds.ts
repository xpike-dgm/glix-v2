import { play } from "../../fx/sound.js";

/**
 * Ortalamaya En Yakın ses seti (OY-U15, `ortalama.*`): mevcut ses sisteminde kodla üretilir, dosya gerektirmez (Ses
 * alanı isterse gerçek kayıtlarla değiştirir: docs/oneriler/GORSEL-IHTIYACLARI.md "Ortalamanın Yarısı"). Olay ve evre
 * sesleri `cues.ts` ile geçişte BİR KEZ çalar; sürükleme tiki yalnız parmak 5'in katını geçince.
 */

/** Sürükleme tiki: sayı yükseldikçe tizleşir (her 5'te bir). */
export const dragTick = (value: number): void =>
  play([{ freq: 420 + Math.max(0, Math.min(100, value)) * 9, dur: 0.035, type: "triangle", gain: 0.04 }]);

/** Kilit: "klik-mühür". */
export const seal = (): void =>
  play([
    { freq: 1400, to: 900, dur: 0.04, type: "square", gain: 0.05 },
    { freq: 180, to: 90, dur: 0.14, at: 0.04, type: "sine", gain: 0.12 },
  ]);

/** Tur kartı: kısa "vınn". */
export const whoosh = (): void =>
  play([
    { freq: 220, to: 880, dur: 0.32, type: "sawtooth", gain: 0.025 },
    { freq: 440, to: 1320, dur: 0.28, at: 0.04, type: "sine", gain: 0.04 },
  ]);

/** Açılışta kapsül "pop"u; oyuncu sırasına göre hafif farklı perde (8 varyasyon). */
export const pop = (i: number): void =>
  play([{ freq: 520 + (i % 8) * 60, to: 260, dur: 0.07, type: "sine", gain: 0.09 }]);

/** Rastgele atanan sayı düşerken zar "tıkır"ı. */
export const dice = (): void =>
  play([
    { freq: 1900, dur: 0.025, type: "square", gain: 0.03 },
    { freq: 1500, dur: 0.025, at: 0.05, type: "square", gain: 0.03 },
    { freq: 1700, dur: 0.03, at: 0.1, type: "square", gain: 0.03 },
  ]);

/** Terazi: ahşap gıcırtı ve sonunda denge "tak"ı. */
export const balance = (): void =>
  play([
    { freq: 140, to: 190, dur: 0.35, type: "sawtooth", gain: 0.02 },
    { freq: 190, to: 150, dur: 0.35, at: 0.35, type: "sawtooth", gain: 0.02 },
    { freq: 300, to: 120, dur: 0.09, at: 0.8, type: "triangle", gain: 0.12 },
  ]);

/** Hedef ışını: lazer "fiuuu". */
export const laser = (): void =>
  play([
    { freq: 1800, to: 500, dur: 0.6, type: "sine", gain: 0.05 },
    { freq: 3600, to: 1000, dur: 0.5, type: "sine", gain: 0.015 },
  ]);

/** İp sönüşü: yumuşak "fıs". */
export const fizz = (): void => play([{ freq: 2400, to: 1200, dur: 0.09, type: "sawtooth", gain: 0.012 }]);

/** En yakın sensen: zil. */
export const bell = (): void =>
  play([
    { freq: 1318, dur: 0.9, type: "sine", gain: 0.09 },
    { freq: 2637, dur: 0.6, type: "sine", gain: 0.03 },
  ]);

/** Eşitlik: iki notalı akor. */
export const tieChord = (): void =>
  play([
    { freq: 659, dur: 0.5, type: "triangle", gain: 0.07 },
    { freq: 831, dur: 0.5, type: "triangle", gain: 0.06 },
  ]);

/** Yanan sayı: "cız". */
export const sizzle = (): void =>
  play([
    { freq: 3200, to: 900, dur: 0.35, type: "sawtooth", gain: 0.03 },
    { freq: 140, to: 60, dur: 0.25, type: "square", gain: 0.03 },
  ]);
