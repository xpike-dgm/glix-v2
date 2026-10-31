import { hapticPress } from "../../fx/haptics.js";
import { play } from "../../fx/sound.js";

/**
 * Kara Borsa ses ve titreşim seti (KB-U8; WebAudio ile kodda üretilir, ses dosyası yok). Titreşim yolu
 * `hapticPress`: sunucu olayıyla çağrılınca da güvenli.
 */

/** Teklif mühürlendi: mum mühür "tık"ı (yumuşak bas + kuru tık). */
export function seal(): void {
  play([
    { freq: 210, to: 120, dur: 0.12, type: "sine", gain: 0.12 },
    { freq: 1500, to: 900, dur: 0.03, at: 0.01, type: "triangle", gain: 0.05 },
  ]);
  hapticPress([10, 30, 16]);
}

/** Son saniyeler: saat tiki (`urgent` son 2 sn, daha tiz). */
export function clockTick(urgent: boolean): void {
  play([{ freq: urgent ? 1320 : 980, dur: 0.035, type: "square", gain: urgent ? 0.045 : 0.03 }]);
}

/** Son 5 sn'de hâlâ teklif vermeyene kısa titreşim. */
export function nudge(): void {
  hapticPress([18, 40, 18]);
}

/** Tokmak: tok tahta vuruşu ("SATILDI!"). */
export function gavel(): void {
  play([
    { freq: 140, to: 60, dur: 0.18, type: "sine", gain: 0.22 },
    { freq: 520, to: 180, dur: 0.06, type: "square", gain: 0.06 },
    { freq: 1900, to: 700, dur: 0.03, type: "triangle", gain: 0.04 },
  ]);
  hapticPress(32);
}

/** Teklif satırı açıldı: kısa davul vuruşu; `last` (kazanan satır) daha dolgun. */
export function drum(last: boolean): void {
  play(
    last
      ? [
          { freq: 120, to: 50, dur: 0.3, type: "sine", gain: 0.2 },
          { freq: 240, to: 90, dur: 0.12, type: "triangle", gain: 0.08 },
          { freq: 180, to: 70, dur: 0.12, at: 0.1, type: "sine", gain: 0.12 },
        ]
      : [{ freq: 200, to: 110, dur: 0.09, type: "sine", gain: 0.09 }],
  );
}

/** Kutu kapağı gıcırtısı. */
export function creak(): void {
  play([
    { freq: 330, to: 470, dur: 0.28, type: "sawtooth", gain: 0.018 },
    { freq: 480, to: 380, dur: 0.22, at: 0.2, type: "sawtooth", gain: 0.014 },
    { freq: 660, to: 990, dur: 0.18, at: 0.3, type: "sine", gain: 0.03 },
  ]);
}

/** Kelepir (kâr 20 ve üstü): kasa "ka-ching". */
export function kaching(): void {
  play([
    { freq: 1568, dur: 0.08, type: "square", gain: 0.035 },
    { freq: 2093, dur: 0.3, at: 0.07, type: "triangle", gain: 0.08 },
    { freq: 3136, dur: 0.22, at: 0.09, type: "sine", gain: 0.035 },
  ]);
  hapticPress([14, 40, 14]);
}

/** Küçük kâr ya da başa baş: kısa parlak nota. */
export function coin(): void {
  play([
    { freq: 988, dur: 0.08, type: "triangle", gain: 0.07 },
    { freq: 1319, dur: 0.14, at: 0.07, type: "triangle", gain: 0.06 },
  ]);
}

/** Kazık (zarar): alçalan "ıh". */
export function groan(): void {
  play([
    { freq: 330, to: 196, dur: 0.32, type: "triangle", gain: 0.08 },
    { freq: 165, to: 98, dur: 0.32, type: "sine", gain: 0.06 },
  ]);
  hapticPress(24);
}

/** Lanetli kutu: gök gürültüsü ve uzun titreşim. */
export function thunder(): void {
  play([
    { freq: 70, to: 32, dur: 1.1, type: "sawtooth", gain: 0.08 },
    { freq: 110, to: 40, dur: 0.5, type: "square", gain: 0.05 },
    { freq: 55, to: 30, dur: 1.3, at: 0.25, type: "sine", gain: 0.16 },
    { freq: 2400, to: 300, dur: 0.12, type: "square", gain: 0.02 },
  ]);
  hapticPress([60, 40, 160, 40, 260]);
}

/** Büyük Kutu bandı: kısa boru fanfarı. */
export function fanfare(): void {
  play([
    { freq: 392, dur: 0.14, type: "sawtooth", gain: 0.04 },
    { freq: 523, dur: 0.14, at: 0.14, type: "sawtooth", gain: 0.04 },
    { freq: 659, dur: 0.14, at: 0.28, type: "sawtooth", gain: 0.04 },
    { freq: 784, dur: 0.42, at: 0.42, type: "sawtooth", gain: 0.05 },
    { freq: 1568, dur: 0.38, at: 0.44, type: "sine", gain: 0.02 },
  ]);
  hapticPress([16, 50, 16, 50, 30]);
}
