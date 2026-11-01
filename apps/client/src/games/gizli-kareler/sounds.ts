import { play } from "../../fx/sound.js";

/*
 * GK-U16: Gizli Kareler ses seti. Kod içinde üretilen geçici sesler (dosyalar gelene kadar; docs/oneriler/
 * GORSEL-IHTIYACLARI.md "Gizli Kareler" ses notu). Kural: kare seçme sesi HER KARE İÇİN AYNI tondur; kareye göre
 * değişen ses yan koltuğa seçimi duyururdu.
 */

/** Kare seçimi: tek tip, kısa, yumuşak tık (her kare aynı). */
export const pickTone = (): void => play([{ freq: 660, to: 520, dur: 0.05, type: "triangle", gain: 0.06 }]);

/** Tamam: kilit "klak". */
export const lockClack = (): void =>
  play([
    { freq: 320, to: 180, dur: 0.06, type: "square", gain: 0.05 },
    { freq: 1400, dur: 0.025, at: 0.05, type: "square", gain: 0.03 },
  ]);

/** GK-U6: kare dönüşü tıkırtısı (çok kısık). */
export const flipClick = (): void => play([{ freq: 1700, to: 1200, dur: 0.02, type: "square", gain: 0.012 }]);

/** Tek kalan: yükselen altın nota. */
export const goldNote = (): void =>
  play([
    { freq: 659, dur: 0.12, type: "triangle", gain: 0.08 },
    { freq: 988, dur: 0.22, at: 0.1, type: "sine", gain: 0.08 },
  ]);

/** Çakışma: "bzzt" + cam kırılması. */
export const clashGlass = (): void =>
  play([
    { freq: 110, to: 70, dur: 0.22, type: "sawtooth", gain: 0.07 },
    { freq: 2900, to: 1800, dur: 0.05, at: 0.16, type: "square", gain: 0.025 },
    { freq: 3400, to: 2100, dur: 0.04, at: 0.22, type: "square", gain: 0.02 },
    { freq: 2500, to: 1500, dur: 0.06, at: 0.28, type: "square", gain: 0.018 },
  ]);

/** GK-M2: hayalet uğultusu (hayaletler açılırken). */
export const ghostHum = (): void =>
  play([
    { freq: 196, to: 233, dur: 0.6, type: "sine", gain: 0.04 },
    { freq: 294, to: 262, dur: 0.6, at: 0.05, type: "triangle", gain: 0.015 },
  ]);

/** GK-U7: ışık huzmesi süpürmesi. */
export const beamSweep = (): void =>
  play([
    { freq: 300, to: 1200, dur: 1.2, type: "sine", gain: 0.03 },
    { freq: 450, to: 1800, dur: 1.2, type: "triangle", gain: 0.012 },
  ]);

/** GK-U7: ödül sandığı açılışı. */
export const chestOpen = (): void =>
  play([
    { freq: 523, dur: 0.12, type: "triangle", gain: 0.09 },
    { freq: 659, dur: 0.12, at: 0.1, type: "triangle", gain: 0.09 },
    { freq: 784, dur: 0.12, at: 0.2, type: "triangle", gain: 0.09 },
    { freq: 1047, dur: 0.4, at: 0.3, type: "sine", gain: 0.09 },
    { freq: 2637, dur: 0.05, at: 0.45, type: "square", gain: 0.02 },
    { freq: 3136, dur: 0.05, at: 0.55, type: "square", gain: 0.02 },
  ]);

/** GK-U7: sandık kırıldı (çakışma ya da hayalet). */
export const chestBreak = (): void =>
  play([
    { freq: 160, to: 80, dur: 0.3, type: "sawtooth", gain: 0.06 },
    { freq: 2200, to: 1300, dur: 0.06, at: 0.08, type: "square", gain: 0.025 },
  ]);

/** GK-U7: sandık kapandı (kimse bulamadı). */
export const chestClose = (): void =>
  play([
    { freq: 220, to: 160, dur: 0.18, type: "triangle", gain: 0.06 },
    { freq: 110, dur: 0.12, at: 0.16, type: "square", gain: 0.03 },
  ]);

/** GK-U10: son 5 sn tik. */
export const lastTick = (): void => play([{ freq: 980, dur: 0.05, type: "square", gain: 0.035 }]);

/** GK-U5: "2. AŞAMA" bandı. */
export const bandWhoosh = (): void =>
  play([
    { freq: 180, to: 720, dur: 0.5, type: "sine", gain: 0.04 },
    { freq: 1320, dur: 0.15, at: 0.45, type: "triangle", gain: 0.04 },
  ]);
