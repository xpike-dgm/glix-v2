import { play } from "../../fx/sound.js";

/*
 * RD-U14: saray ses seti. Kod içinde üretilen geçici sesler (dosyalar gelene kadar; docs/oneriler/
 * GORSEL-IHTIYACLARI.md "Rüşvet ve Darbe" ses notu). Sessiz kipte ya da ses henüz açılmadıysa çalmaz.
 */

/** RD-U1: mühür "tok"u: kısa, tok bir vuruş. */
export const seal = (): void =>
  play([
    { freq: 180, to: 90, dur: 0.09, type: "sine", gain: 0.14 },
    { freq: 1200, to: 600, dur: 0.02, type: "square", gain: 0.02 },
  ]);

/** Sandığa düşen oy: kâğıt hışırtısı (açılışta her oy). */
export const rustle = (): void =>
  play([
    { freq: 3200, to: 2400, dur: 0.05, type: "sawtooth", gain: 0.012 },
    { freq: 2600, to: 1900, dur: 0.06, at: 0.04, type: "sawtooth", gain: 0.01 },
  ]);

/** RD-U8: "TAŞ · KÂĞIT · MAKAS!" ritminin bir vuruşu (son vuruş daha güçlü). */
export const rhythm = (strong: boolean): void =>
  play([
    { freq: strong ? 140 : 110, to: 70, dur: strong ? 0.16 : 0.1, type: "sine", gain: strong ? 0.18 : 0.12 },
  ]);

/** Kart dönüşü. */
export const cardFlip = (): void =>
  play([
    { freq: 900, to: 1500, dur: 0.06, type: "triangle", gain: 0.05 },
    { freq: 1500, to: 700, dur: 0.05, at: 0.06, type: "triangle", gain: 0.035 },
  ]);

/** RD-U8: "ELENDİ" — alçak düşüş. */
export const knockedOut = (): void => play([{ freq: 260, to: 110, dur: 0.35, type: "sawtooth", gain: 0.05 }]);

/** RD-U3 / açılış: jeton şıngırtısı (2–3 varyasyon). */
export const coin = (variant = 0): void => {
  const base = [2637, 2794, 3136][variant % 3] ?? 2637;
  play([
    { freq: base, dur: 0.06, type: "square", gain: 0.022 },
    { freq: base * 1.26, dur: 0.08, at: 0.05, type: "triangle", gain: 0.03 },
  ]);
};

/** RD-U7: taç inişi fanfarı. */
export const crownFanfare = (): void =>
  play([
    { freq: 392, dur: 0.14, type: "triangle", gain: 0.09 },
    { freq: 523, dur: 0.14, at: 0.13, type: "triangle", gain: 0.09 },
    { freq: 659, dur: 0.14, at: 0.26, type: "triangle", gain: 0.09 },
    { freq: 784, dur: 0.45, at: 0.39, type: "triangle", gain: 0.1 },
    { freq: 1568, dur: 0.3, at: 0.42, type: "sine", gain: 0.03 },
  ]);

/** RD-U9: darbe davulu ve taht devrilmesi. */
export const coupDrum = (): void =>
  play([
    { freq: 90, to: 50, dur: 0.18, type: "sine", gain: 0.18 },
    { freq: 90, to: 50, dur: 0.18, at: 0.22, type: "sine", gain: 0.18 },
    { freq: 120, to: 40, dur: 0.5, at: 0.46, type: "sawtooth", gain: 0.07 },
    { freq: 300, to: 80, dur: 0.4, at: 0.5, type: "square", gain: 0.03 },
  ]);

/** RD-U9: "Darbe bastırıldı" borusu. */
export const suppressed = (): void =>
  play([
    { freq: 523, dur: 0.18, type: "sawtooth", gain: 0.04 },
    { freq: 659, dur: 0.18, at: 0.18, type: "sawtooth", gain: 0.04 },
    { freq: 784, dur: 0.4, at: 0.36, type: "sawtooth", gain: 0.045 },
  ]);

/** RD-U9: vaat damgası: TUTTU çan / BOZDU cam çatlaması. */
export const pledgeStamp = (kept: boolean): void =>
  kept
    ? play([
        { freq: 1047, dur: 0.6, type: "sine", gain: 0.07 },
        { freq: 2093, dur: 0.4, type: "sine", gain: 0.02 },
      ])
    : play([
        { freq: 4200, to: 1800, dur: 0.05, type: "square", gain: 0.03 },
        { freq: 3600, to: 1500, dur: 0.06, at: 0.05, type: "square", gain: 0.025 },
        { freq: 2800, to: 900, dur: 0.12, at: 0.11, type: "sawtooth", gain: 0.02 },
      ]);
