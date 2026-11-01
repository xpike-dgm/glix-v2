import { hapticPress } from "../../fx/haptics.js";
import { play } from "../../fx/sound.js";

/**
 * Karalama Defteri ses seti (KD-U13): "kâğıt, kurşun kalem, ahşap çerçeve". WebAudio ile kodda üretilir (ses dosyası
 * yok; gerçek kayıtlar GORSEL-IHTIYACLARI.md'de "ses" notunda). Ayarlarda ses kapalıysa `play` çalmaz. Kalem
 * cızırtısı yalnız çizenin telefonunda çalar.
 */

let lastScratch = 0;
/** Çizerken çok hafif kalem cızırtısı (en çok 12 kez/sn; kısık). */
export function pencil(): void {
  const t = performance.now();
  if (t - lastScratch < 85) return;
  lastScratch = t;
  const f = 2400 + Math.random() * 1600;
  play([{ freq: f, to: f * 0.7, dur: 0.05, type: "sawtooth", gain: 0.006 }]);
}

/** Silgi sürtme. */
export function eraser(): void {
  const t = performance.now();
  if (t - lastScratch < 110) return;
  lastScratch = t;
  play([{ freq: 300 + Math.random() * 120, to: 180, dur: 0.08, type: "triangle", gain: 0.012 }]);
}

/** Geri al: kısa "fıs". */
export function undoFis(): void {
  play([{ freq: 5200, to: 2600, dur: 0.07, type: "sawtooth", gain: 0.012 }]);
}

/** Temizle: kâğıt buruşturma (birkaç kısa hışırtı). */
export function crumple(): void {
  play(
    [0, 0.05, 0.11, 0.16, 0.22].map((at, i) => ({
      freq: 1800 + i * 420,
      to: 700,
      dur: 0.05,
      at,
      type: "sawtooth" as const,
      gain: 0.02,
    })),
  );
}

/** Bitti: defter kapanma ve sergiye asılma "tık". */
export function bookClose(): void {
  play([
    { freq: 170, to: 90, dur: 0.12, type: "triangle", gain: 0.12 },
    { freq: 2200, to: 1500, dur: 0.03, at: 0.32, type: "square", gain: 0.03 },
  ]);
  hapticPress([16, 40, 10]);
}

/** Oy verince raptiye "çıt" ve kısa titreşim. */
export function pin(): void {
  play([{ freq: 2600, to: 1900, dur: 0.035, type: "square", gain: 0.035 }]);
  hapticPress(14);
}

/** Tamam: çerçeve vuruşu (tok ahşap). */
export function frameKnock(): void {
  play([
    { freq: 240, to: 150, dur: 0.09, type: "triangle", gain: 0.12 },
    { freq: 480, to: 320, dur: 0.05, type: "sine", gain: 0.04 },
  ]);
  hapticPress([12, 30, 20]);
}

/** Açılış: her oy için "vınn". */
export function whoosh(): void {
  play([{ freq: 380, to: 1300, dur: 0.22, type: "sine", gain: 0.04 }]);
}

/** "Kelimeyi bilmeyen…": kısa davul. */
export function drum(): void {
  play(
    [0, 0.09, 0.18, 0.27, 0.36, 0.45].map((at, i) => ({
      freq: 120 - i * 4,
      to: 70,
      dur: 0.08,
      at,
      type: "sine" as const,
      gain: 0.09 + i * 0.01,
    })),
  );
}

/** Maske kırılma "çat". */
export function maskCrack(): void {
  play([
    { freq: 3200, to: 900, dur: 0.05, type: "square", gain: 0.05 },
    { freq: 1800, to: 400, dur: 0.12, at: 0.03, type: "sawtooth", gain: 0.04 },
    { freq: 140, to: 60, dur: 0.22, at: 0.02, type: "sine", gain: 0.12 },
  ]);
  hapticPress([30, 30, 50]);
}

/** Damga vuruşu. */
export function stamp(): void {
  play([
    { freq: 90, to: 50, dur: 0.18, type: "sine", gain: 0.18 },
    { freq: 600, to: 200, dur: 0.06, type: "square", gain: 0.03 },
  ]);
  hapticPress(40);
}

/** Son şans: saat tiki. */
export function clockTick(): void {
  play([{ freq: 980, dur: 0.05, type: "square", gain: 0.03 }]);
}

/** Doğru tahmin: zil. */
export function bell(): void {
  play([
    { freq: 1568, dur: 0.6, type: "sine", gain: 0.08 },
    { freq: 2093, dur: 0.5, at: 0.08, type: "sine", gain: 0.05 },
  ]);
  hapticPress([20, 40, 20, 40, 60]);
}

/** Yanlış tahmin: kısa "bzzt". */
export function bzzt(): void {
  play([{ freq: 140, to: 110, dur: 0.28, type: "sawtooth", gain: 0.06 }]);
  hapticPress(60);
}
