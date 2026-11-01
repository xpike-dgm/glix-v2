import { play, type Tone } from "../../fx/sound.js";

/**
 * Çizgiyi Geçme tırmanış ses seti (CZ-U14): mevcut ses sisteminde kodla üretilir, dosya gerektirmez. Ses alanı isterse
 * gerçek kayıtlarla değiştirir (docs/oneriler/GORSEL-IHTIYACLARI.md "Çizgiyi Geçme"; olay adları `cizgi.*`).
 */

/** `cizgi.ton`: sürüklerken yüksekliğe göre tizleşen hafif ton (0 alt … 1 üst). */
export function heightTone(ratio: number): void {
  const f = 260 + Math.min(1, Math.max(0, ratio)) * 900;
  play([{ freq: f, dur: 0.06, type: "sine", gain: 0.025 }]);
}

/** `cizgi.tik`: platform sınırını geçince kuru "tık". */
export const borderTick = (): void => play([{ freq: 1500, to: 900, dur: 0.025, type: "square", gain: 0.03 }]);

/** `cizgi.can`: Zirve'ye çıkınca çan. */
export const peakBell = (): void =>
  play([
    { freq: 1318, dur: 0.6, type: "triangle", gain: 0.06 },
    { freq: 2637, dur: 0.35, type: "sine", gain: 0.02 },
    { freq: 1975, dur: 0.45, at: 0.02, type: "sine", gain: 0.02 },
  ]);

/** `cizgi.bayrak`: kilitte bayrak dikilir, kumaş "fırt". */
export const flagSound = (): void =>
  play([
    { freq: 300, to: 900, dur: 0.09, type: "sawtooth", gain: 0.025 },
    { freq: 180, to: 120, dur: 0.12, at: 0.06, type: "triangle", gain: 0.08 },
  ]);

/** `cizgi.son5`: son 5 sn tiki; saniye azaldıkça hızlanır (çift tık). */
export function lastTick(secs: number): void {
  const tones: Tone[] = [{ freq: 980, dur: 0.04, type: "square", gain: 0.035 }];
  if (secs <= 2) tones.push({ freq: 1180, dur: 0.04, at: 0.25, type: "square", gain: 0.03 });
  play(tones);
}

/** `cizgi.radar`: sonar "biip". */
export const sonarSound = (): void =>
  play([
    { freq: 1250, to: 1180, dur: 0.35, type: "sine", gain: 0.07 },
    { freq: 1250, to: 1180, dur: 0.25, at: 0.42, type: "sine", gain: 0.025 },
  ]);

/** `cizgi.tirmanis`: pin tırmanırken yükselen "vııı" (`ratio`: hedef yükseklik). */
export function climbSound(ratio: number): void {
  const to = 380 + Math.min(1, Math.max(0, ratio)) * 1100;
  play([{ freq: 220, to, dur: 0.32, type: "sawtooth", gain: 0.018 }]);
}

/** `cizgi.oturma`: pin platformuna oturur, "tak". */
export const seatSound = (): void =>
  play([
    { freq: 520, to: 320, dur: 0.05, type: "triangle", gain: 0.07 },
    { freq: 140, dur: 0.06, type: "sine", gain: 0.05 },
  ]);

/** `cizgi.carpisma`: elektrik "bzzt" ve sönme. */
export const crashSound = (): void =>
  play([
    { freq: 110, to: 90, dur: 0.28, type: "sawtooth", gain: 0.06 },
    { freq: 2400, to: 600, dur: 0.12, type: "square", gain: 0.02 },
    { freq: 220, to: 60, dur: 0.35, at: 0.18, type: "sine", gain: 0.05 },
  ]);

/** `cizgi.roket`: birinci fırlarken "fşşuu". */
export const rocketSound = (): void =>
  play([
    { freq: 300, to: 1800, dur: 0.45, type: "sawtooth", gain: 0.03 },
    { freq: 784, dur: 0.12, at: 0.4, type: "triangle", gain: 0.05 },
    { freq: 1175, dur: 0.3, at: 0.5, type: "triangle", gain: 0.05 },
  ]);

/** `cizgi.jeton`: +1 jeton. */
export const coinSound = (): void =>
  play([
    { freq: 1568, dur: 0.07, type: "square", gain: 0.03 },
    { freq: 2093, dur: 0.2, at: 0.07, type: "triangle", gain: 0.05 },
  ]);
