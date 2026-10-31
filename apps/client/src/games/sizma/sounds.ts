import { hapticPress } from "../../fx/haptics.js";
import { play } from "../../fx/sound.js";

/**
 * Sızma ses ve titreşim seti (WebAudio ile kodda üretilir; ses dosyası yok). Titreşim yolu `hapticPress`:
 * dokunuş dışında (sunucu olayı) çağrılınca iOS anahtar yolu denenmez.
 */

/** Sıra sana geldi: parlak "ding" ve güçlü titreşim. */
export function yourTurn(): void {
  play([
    { freq: 1320, dur: 0.18, type: "sine", gain: 0.09 },
    { freq: 1760, dur: 0.32, at: 0.12, type: "sine", gain: 0.07 },
  ]);
  hapticPress([60, 60, 60, 60, 120]);
}

/** "Söyledim": hafif tık. */
export function saidTick(): void {
  play([{ freq: 1500, to: 900, dur: 0.04, type: "triangle", gain: 0.06 }]);
  hapticPress(10);
}

/** Son 5 sn: kuru saat tiki. */
export function clockTick(): void {
  play([{ freq: 980, dur: 0.05, type: "square", gain: 0.035 }]);
}

/** Eşitlik: derin gong. */
export function gong(): void {
  play([
    { freq: 110, to: 104, dur: 1.6, type: "sine", gain: 0.16 },
    { freq: 221, to: 210, dur: 1.2, type: "sine", gain: 0.06 },
    { freq: 332, dur: 0.9, type: "triangle", gain: 0.03 },
  ]);
  hapticPress([40, 80, 40]);
}

/** Oy avatarı hedefe kondu: tok ses. */
export function tok(): void {
  play([{ freq: 260, to: 140, dur: 0.07, type: "triangle", gain: 0.08 }]);
}

/** Maske kırıldı: "çat". */
export function crack(): void {
  play([
    { freq: 3200, to: 900, dur: 0.05, type: "square", gain: 0.05 },
    { freq: 1800, to: 400, dur: 0.12, at: 0.03, type: "sawtooth", gain: 0.05 },
    { freq: 140, to: 60, dur: 0.22, at: 0.02, type: "sine", gain: 0.12 },
  ]);
  hapticPress([30, 30, 50]);
}

/** Sızma kurtuldu: kısa, alaycı kıkırtı. */
export function giggle(): void {
  play(
    [0, 0.13, 0.26, 0.39].map((at, i) => ({
      freq: 620 - i * 40,
      to: 480 - i * 40,
      dur: 0.09,
      at,
      type: "triangle",
      gain: 0.06,
    })),
  );
  hapticPress([14, 40, 14, 40, 14]);
}

/** "KELİMEYİ ÇALDI!": kısa alkış (tıkırtı yağmuru). */
export function applause(): void {
  play(
    Array.from({ length: 14 }, (_, i) => ({
      freq: 2400 + ((i * 337) % 900),
      to: 700,
      dur: 0.03,
      at: i * 0.055 + ((i * 7) % 3) * 0.01,
      type: "square" as const,
      gain: 0.025,
    })),
  );
  hapticPress([20, 40, 20, 40, 60]);
}

/** Tahmin tutmadı: inen iki nota. */
export function miss(): void {
  play([
    { freq: 520, to: 420, dur: 0.18, type: "triangle", gain: 0.07 },
    { freq: 400, to: 300, dur: 0.3, at: 0.18, type: "triangle", gain: 0.07 },
  ]);
}
