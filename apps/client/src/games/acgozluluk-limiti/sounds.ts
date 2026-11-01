import { play, type Tone } from "../../fx/sound.js";

/**
 * Açgözlülük Limiti kasa ses seti (AL-U14): mevcut ses sisteminde kodla üretilir, dosya gerektirmez. Ses alanı isterse
 * gerçek kayıtlarla değiştirir (docs/oneriler/GORSEL-IHTIYACLARI.md "Açgözlülük Limiti"; olay adları `acgozluluk.*`).
 */

/** `acgozluluk.jeton`: sayı düğmesi. 0'da yumuşak "tık"; sayı büyüdükçe daha çok jeton ve daha tiz. */
export function coinSound(value: number, max: number): void {
  if (value <= 0) {
    play([{ freq: 520, to: 380, dur: 0.05, type: "triangle", gain: 0.05 }]);
    return;
  }
  const count = Math.min(6, Math.max(1, Math.round((value / Math.max(1, max)) * 6)));
  const base = 1800 + (value / Math.max(1, max)) * 1400;
  const tones: Tone[] = [];
  for (let i = 0; i < count; i++) {
    tones.push({
      freq: base + ((i * 233) % 500),
      to: base * 0.82,
      dur: 0.06,
      at: i * 0.035,
      type: "square",
      gain: 0.025,
    });
    tones.push({ freq: base * 2.1, dur: 0.05, at: i * 0.035 + 0.005, type: "sine", gain: 0.015 });
  }
  play(tones);
}

/** `acgozluluk.muhur`: kilitte ağır kasa mührü "klonk". */
export const sealSound = (): void =>
  play([
    { freq: 140, to: 70, dur: 0.22, type: "triangle", gain: 0.16 },
    { freq: 420, to: 260, dur: 0.06, type: "square", gain: 0.04 },
    { freq: 90, to: 60, dur: 0.3, at: 0.04, type: "sine", gain: 0.1 },
  ]);

/** `acgozluluk.disli`: son 5 sn kasa kapısı dişlisi; `secs` azaldıkça daha tiz ve çift tık. */
export function gearSound(secs: number): void {
  const f = 900 + (5 - Math.max(1, Math.min(5, secs))) * 120;
  const tones: Tone[] = [{ freq: f, to: f * 0.7, dur: 0.03, type: "square", gain: 0.035 }];
  if (secs <= 2) tones.push({ freq: f * 1.1, to: f * 0.75, dur: 0.03, at: 0.12, type: "square", gain: 0.03 });
  play(tones);
}

/** `acgozluluk.anahtar`: Gözcü bakışı, anahtar deliği "çıt". */
export const keyholeSound = (): void =>
  play([
    { freq: 3200, to: 1800, dur: 0.025, type: "square", gain: 0.04 },
    { freq: 1200, to: 700, dur: 0.05, at: 0.05, type: "triangle", gain: 0.05 },
  ]);

/** `acgozluluk.kapak`: hazne kapağı açılır. */
export const lidSound = (): void =>
  play([
    { freq: 220, to: 330, dur: 0.18, type: "triangle", gain: 0.05 },
    { freq: 660, to: 990, dur: 0.12, at: 0.05, type: "sine", gain: 0.02 },
  ]);

const NOTES = [523, 587, 659, 698, 784, 880, 988, 1047];
/** `acgozluluk.serit`: şerit düşerken metalik "tın"; sıra ilerledikçe yükselen notalar. */
export function stripSound(i: number): void {
  const f = NOTES[Math.min(NOTES.length - 1, Math.max(0, i))] ?? 523;
  play([
    { freq: f, dur: 0.28, type: "triangle", gain: 0.06 },
    { freq: f * 2.76, dur: 0.12, type: "sine", gain: 0.015 },
  ]);
}

/** `acgozluluk.kalp`: limite 3 kala kalp atışı (çift vuruş). */
export const heartSound = (): void =>
  play([
    { freq: 70, to: 50, dur: 0.12, type: "sine", gain: 0.18 },
    { freq: 64, to: 46, dur: 0.12, at: 0.16, type: "sine", gain: 0.13 },
  ]);

/** `acgozluluk.catlama`: taşma, cam çatlaması + derin gümbürtü (`strong`: PATLADI). */
export function crackSound(strong: boolean): void {
  const tones: Tone[] = [
    { freq: 4200, to: 1500, dur: 0.08, type: "sawtooth", gain: 0.03 },
    { freq: 2600, to: 900, dur: 0.1, at: 0.04, type: "square", gain: 0.025 },
    { freq: 80, to: 40, dur: strong ? 0.7 : 0.45, at: 0.05, type: "sine", gain: strong ? 0.2 : 0.14 },
  ];
  if (strong) tones.push({ freq: 55, to: 30, dur: 0.6, at: 0.2, type: "triangle", gain: 0.1 });
  play(tones);
}

/** `acgozluluk.altin`: sığdı. `rain`: AĞZINA KADAR altın yağmuru (uzun arpej). */
export function goldSound(rain: boolean): void {
  const steps = rain ? [784, 988, 1175, 1568, 1976, 2349] : [784, 1175, 1568];
  play(
    steps.map(
      (f, i): Tone => ({
        freq: f,
        dur: i === steps.length - 1 ? 0.4 : 0.12,
        at: i * 0.07,
        type: "triangle",
        gain: 0.06,
      }),
    ),
  );
}

/** `acgozluluk.hih`: "Bol bol yer var", sönük hayal kırıklığı. */
export const sighSound = (): void =>
  play([
    { freq: 392, to: 330, dur: 0.22, type: "triangle", gain: 0.05 },
    { freq: 330, to: 262, dur: 0.3, at: 0.14, type: "sine", gain: 0.04 },
  ]);
