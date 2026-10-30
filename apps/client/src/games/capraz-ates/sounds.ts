import { hapticPress } from "../../fx/haptics.js";
import { play } from "../../fx/sound.js";

/**
 * Çapraz Ateş ses ve titreşim seti (WebAudio ile kodda üretilir; ses dosyası yok). Her ses kendi titreşimiyle
 * birlikte çalınır. Titreşim yolu `hapticPress`: dokunuş dışında (sunucu olayı) çağrılınca iOS anahtar yolu denenmez.
 */

/** Nişangâh kilit "klik"i: kuru, yüksek iki tık. */
export function sightClick(): void {
  play([
    { freq: 2600, to: 1800, dur: 0.025, type: "square", gain: 0.035 },
    { freq: 1400, to: 900, dur: 0.04, at: 0.035, type: "triangle", gain: 0.06 },
  ]);
  hapticPress(8);
}

/** Siper: alçak, dolgun kalkan uğultusu. */
export function shieldUp(): void {
  play([
    { freq: 180, to: 420, dur: 0.22, type: "triangle", gain: 0.08 },
    { freq: 840, to: 1260, dur: 0.18, at: 0.06, type: "sine", gain: 0.035 },
  ]);
  hapticPress([12, 30, 12]);
}

/** Silah kurma ("ATEŞE HAZIR"): metalik çek-bırak. */
export function cock(): void {
  play([
    { freq: 700, to: 300, dur: 0.05, type: "square", gain: 0.05 },
    { freq: 2200, to: 1500, dur: 0.03, at: 0.01, type: "square", gain: 0.025 },
    { freq: 520, to: 260, dur: 0.07, at: 0.13, type: "square", gain: 0.06 },
    { freq: 1900, to: 1200, dur: 0.035, at: 0.14, type: "square", gain: 0.03 },
  ]);
  hapticPress([10, 50, 22]);
}

/** Düello ıslığı: vahşi batı "fiyuu-fiyuu". */
export function whistle(): void {
  play([
    { freq: 1180, to: 1580, dur: 0.32, type: "sine", gain: 0.05 },
    { freq: 1580, to: 1060, dur: 0.5, at: 0.34, type: "sine", gain: 0.045 },
    { freq: 1180, to: 1580, dur: 0.3, at: 1.0, type: "sine", gain: 0.04 },
    { freq: 1580, to: 880, dur: 0.7, at: 1.32, type: "sine", gain: 0.035 },
  ]);
}

/** Toplu ateş: bütün namlular birden; derin patlama ve çatırtı. */
export function volley(): void {
  play([
    { freq: 120, to: 38, dur: 0.5, type: "sine", gain: 0.22 },
    { freq: 260, to: 60, dur: 0.22, type: "sawtooth", gain: 0.1 },
    { freq: 1800, to: 200, dur: 0.12, type: "square", gain: 0.06 },
    { freq: 90, to: 30, dur: 0.4, at: 0.05, type: "square", gain: 0.06 },
  ]);
  hapticPress(34);
}

/** Ağır çekim mermi vınlaması (`sec` saniye). */
export function whiz(sec: number): void {
  play([
    { freq: 940, to: 420, dur: sec, type: "sawtooth", gain: 0.012 },
    { freq: 1880, to: 760, dur: sec * 0.9, at: 0.05, type: "sine", gain: 0.02 },
  ]);
}

/** İsabet: boğuk vuruş. */
export function hit(): void {
  play([
    { freq: 170, to: 55, dur: 0.24, type: "square", gain: 0.1 },
    { freq: 90, to: 40, dur: 0.3, type: "sine", gain: 0.14 },
  ]);
  hapticPress(40);
}

/** Sekme (siper): ince "pyuuv". */
export function ricochet(): void {
  play([
    { freq: 3200, to: 900, dur: 0.32, type: "sine", gain: 0.05 },
    { freq: 1600, to: 2400, dur: 0.06, type: "square", gain: 0.03 },
  ]);
  hapticPress([8, 20, 8]);
}

/** Çarpışma kıvılcımı: parlak çıtırtılar. */
export function spark(): void {
  play([
    { freq: 2400, to: 1200, dur: 0.06, type: "square", gain: 0.04 },
    { freq: 3100, to: 1600, dur: 0.05, at: 0.06, type: "square", gain: 0.035 },
    { freq: 1900, to: 700, dur: 0.12, at: 0.1, type: "sawtooth", gain: 0.03 },
    { freq: 440, to: 140, dur: 0.18, type: "triangle", gain: 0.07 },
  ]);
  hapticPress([14, 30, 14]);
}

/** Cam kırılması (seni vurdular): yüksek, dağınık şıngırtılar. */
export function glass(): void {
  play([
    { freq: 3520, dur: 0.12, type: "triangle", gain: 0.05 },
    { freq: 2960, dur: 0.16, at: 0.03, type: "triangle", gain: 0.045 },
    { freq: 4180, dur: 0.1, at: 0.07, type: "triangle", gain: 0.04 },
    { freq: 2490, dur: 0.22, at: 0.11, type: "sine", gain: 0.04 },
    { freq: 4700, to: 2200, dur: 0.18, at: 0.15, type: "square", gain: 0.015 },
  ]);
  hapticPress([45, 30, 60]);
}

/** Sağ kaldın (+1): yükselen parlak iki nota. */
export function survive(): void {
  play([
    { freq: 784, dur: 0.12, type: "triangle", gain: 0.09 },
    { freq: 1175, dur: 0.22, at: 0.1, type: "triangle", gain: 0.09 },
    { freq: 1568, dur: 0.18, at: 0.22, type: "sine", gain: 0.04 },
  ]);
  hapticPress([14, 40, 14]);
}
