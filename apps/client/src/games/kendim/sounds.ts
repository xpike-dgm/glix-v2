import { play, type Tone } from "../../fx/sound.js";

/**
 * Kendim ses seti (KN-U6): aynada hafif çınlama, Tamam'da cam "tın", sürüklemede ip gerilmesi, eşlemede "tık",
 * kart dönerken "vuuş", doğru tahminde "ding", tek bulan bonusunda kısa fanfar, "Seni kim tanıdı?" anında davul.
 */

/** Aynaya yazarken: çok hafif, rastgele perdeli cam çınlaması (harf sayısını ele vermeyecek kadar kısık). */
export const mirrorChime = (): void => {
  const f = 2400 + Math.round(Math.random() * 900);
  play([{ freq: f, to: f * 1.02, dur: 0.12, type: "sine", gain: 0.012 }]);
};

/** Tamam: cam "tın". */
export const glassTing = (): void =>
  play([
    { freq: 2637, dur: 0.6, type: "sine", gain: 0.06 },
    { freq: 3951, dur: 0.4, type: "sine", gain: 0.025 },
    { freq: 5274, dur: 0.22, at: 0.01, type: "sine", gain: 0.012 },
  ]);

/** Sürükleme başladı: ip gerilir (yükselen ince vınlama). */
export const ropeStretch = (): void =>
  play([
    { freq: 180, to: 420, dur: 0.22, type: "sawtooth", gain: 0.018 },
    { freq: 360, to: 840, dur: 0.18, type: "triangle", gain: 0.02 },
  ]);

/** Eşleme: kısa "tık". */
export const pairClick = (): void =>
  play([
    { freq: 1800, to: 900, dur: 0.03, type: "square", gain: 0.035 },
    { freq: 240, to: 120, dur: 0.05, type: "sine", gain: 0.05 },
  ]);

/** Kart dönüşü: "vuuş". */
export const cardWhoosh = (): void => {
  const tones: Tone[] = [];
  for (let i = 0; i < 6; i++) {
    const f = 900 - i * 110;
    tones.push({ freq: f, to: f * 0.5, dur: 0.06, at: i * 0.025, type: "triangle", gain: 0.02 });
  }
  play(tones);
};

/** Doğru tahmin: "ding". */
export const rightDing = (): void =>
  play([
    { freq: 1568, dur: 0.35, type: "sine", gain: 0.07 },
    { freq: 2349, dur: 0.25, at: 0.04, type: "sine", gain: 0.035 },
  ]);

/** Tek bulan bonusu: kısa fanfar. */
export const bonusFanfare = (): void =>
  play([
    { freq: 784, dur: 0.12, type: "triangle", gain: 0.06 },
    { freq: 988, dur: 0.12, at: 0.11, type: "triangle", gain: 0.06 },
    { freq: 1175, dur: 0.12, at: 0.22, type: "triangle", gain: 0.06 },
    { freq: 1568, dur: 0.4, at: 0.33, type: "triangle", gain: 0.07 },
  ]);

/** "Seni kim tanıdı?": hızlanan davul (yaklaşık 1 sn). */
export const drumRoll = (): void => {
  const tones: Tone[] = [];
  let at = 0;
  for (let i = 0; i < 12; i++) {
    tones.push({ freq: 150 + (i % 2) * 18, to: 70, dur: 0.07, at, type: "sine", gain: 0.06 + i * 0.006 });
    at += Math.max(0.045, 0.12 - i * 0.007);
  }
  tones.push({ freq: 110, to: 50, dur: 0.3, at: at + 0.02, type: "sine", gain: 0.16 });
  play(tones);
};
