import { play } from "../../fx/sound.js";

/*
 * IT-U14: müzakere salonu ses seti. Kod içinde üretilen geçici sesler (dosyalar gelene kadar; docs/oneriler/
 * GORSEL-IHTIYACLARI.md "İttifak" ses notu). Sessiz kipte ya da ses henüz açılmadıysa çalmaz.
 */

/** IT-U2: mühür basma "tak"ı. */
export const sealPress = (): void =>
  play([
    { freq: 210, to: 95, dur: 0.08, type: "sine", gain: 0.15 },
    { freq: 1400, to: 700, dur: 0.02, type: "square", gain: 0.02 },
  ]);

/** IT-U2: mühür kırma "çıt"ı. */
export const sealBreak = (): void =>
  play([
    { freq: 3800, to: 2200, dur: 0.03, type: "square", gain: 0.03 },
    { freq: 2600, to: 1200, dur: 0.05, at: 0.03, type: "triangle", gain: 0.03 },
  ]);

/** IT-U8: son saniyelerin tiki. */
export const lastTick = (): void => play([{ freq: 1180, dur: 0.05, type: "square", gain: 0.04 }]);

/** IT-U8: pazarlık bitti gongu. */
export const gong = (): void =>
  play([
    { freq: 98, to: 92, dur: 1.1, type: "sine", gain: 0.16 },
    { freq: 196, to: 188, dur: 0.8, type: "sine", gain: 0.05 },
    { freq: 293, dur: 0.5, type: "triangle", gain: 0.025 },
  ]);

/** IT-U5: oy kartı çevirme "hışırtısı" (2–3 varyasyon). */
export const cardRustle = (variant = 0): void => {
  const base = [3200, 2900, 3500][variant % 3] ?? 3200;
  play([
    { freq: base, to: base * 0.75, dur: 0.05, type: "sawtooth", gain: 0.012 },
    { freq: base * 0.8, to: base * 0.6, dur: 0.06, at: 0.04, type: "sawtooth", gain: 0.01 },
  ]);
};

/** IT-U5: hedef sayacı "tık"ı. */
export const counterTick = (): void => play([{ freq: 1500, dur: 0.035, type: "triangle", gain: 0.05 }]);

/** IT-U5: SÖZ TUTULDU çanı. */
export const keptBell = (): void =>
  play([
    { freq: 1047, dur: 0.55, type: "sine", gain: 0.07 },
    { freq: 2093, dur: 0.35, type: "sine", gain: 0.02 },
  ]);

/** IT-U5: İHANET — cam çatlaması + kısa org akoru. */
export const betrayal = (): void =>
  play([
    { freq: 4200, to: 1800, dur: 0.05, type: "square", gain: 0.03 },
    { freq: 3600, to: 1500, dur: 0.06, at: 0.05, type: "square", gain: 0.025 },
    { freq: 147, dur: 0.45, at: 0.12, type: "sawtooth", gain: 0.035 },
    { freq: 175, dur: 0.45, at: 0.12, type: "sawtooth", gain: 0.03 },
    { freq: 220, dur: 0.45, at: 0.12, type: "sawtooth", gain: 0.025 },
  ]);

/** IT-U6: İTTİFAK kristal çınlaması. */
export const allianceChime = (): void =>
  play([
    { freq: 1568, dur: 0.5, type: "sine", gain: 0.05 },
    { freq: 2349, dur: 0.45, at: 0.08, type: "sine", gain: 0.04 },
    { freq: 3136, dur: 0.4, at: 0.16, type: "sine", gain: 0.03 },
  ]);

/** IT-U14: kendi adın okununca "ding". */
export const ding = (): void => play([{ freq: 1318, dur: 0.22, type: "triangle", gain: 0.07 }]);
