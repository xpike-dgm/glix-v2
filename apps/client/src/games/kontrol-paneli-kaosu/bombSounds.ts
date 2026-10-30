/**
 * Kontrol Paneli Kaosu ses ve titreşim seti: bomba saatinin tiki (son 10 sn'de hızlanır), kablo kopması, kıvılcım,
 * saat atlaması "bzzzt", dalga geçiş alarmı, imha zili ve bütün bomba imha edilince kısa zafer. Sesler ortak
 * WebAudio altyapısıyla (`fx/sound.ts`) kodda üretilir; dosya gerekmez. Titreşim `fx/haptics.ts` üzerinden
 * (hareket azaltma tercihine uyar).
 */
import { hapticError, hapticGo, hapticMatch, hapticReady, hapticTick } from "../../fx/haptics.js";
import { play } from "../../fx/sound.js";

/** Saat tiki: kuru, kısa. `urgent` son 10 sn: daha tiz ve keskin. */
export function bombTick(urgent: boolean): void {
  play(
    urgent
      ? [
          { freq: 1320, dur: 0.045, type: "square", gain: 0.05 },
          { freq: 2640, dur: 0.02, type: "sine", gain: 0.02 },
        ]
      : [{ freq: 980, to: 900, dur: 0.035, type: "square", gain: 0.035 }],
  );
}

/** Son 10 sn: her saniye hafif titreşim. */
export const bombPulseHaptic = (): void => hapticTick();

/** Kablo kopması: kısa metalik "çat" ve ardından kıvılcım cızırtısı. */
export function wireSnap(): void {
  play([
    { freq: 1900, to: 420, dur: 0.06, type: "square", gain: 0.07 },
    { freq: 140, to: 70, dur: 0.09, type: "triangle", gain: 0.08 },
  ]);
  sparkle(0.05);
  hapticReady();
}

/** Kıvılcım: art arda çok kısa, tiz çıtırtılar. */
export function sparkle(at = 0): void {
  const tones = [0, 0.03, 0.055, 0.09, 0.12].map((d, i) => ({
    freq: 3200 + ((i * 937) % 1800),
    to: 1400,
    dur: 0.025,
    at: at + d,
    type: "sawtooth" as const,
    gain: 0.022,
  }));
  play(tones);
}

/** Saat 5 sn atladı: alçak, titrek "bzzzt". */
export function bzzzt(): void {
  play([
    { freq: 92, dur: 0.38, type: "sawtooth", gain: 0.09 },
    { freq: 97, dur: 0.38, type: "square", gain: 0.05 },
    { freq: 184, to: 120, dur: 0.38, type: "sawtooth", gain: 0.03 },
  ]);
  hapticError();
}

/** Yeni dalga: iki tonlu kısa alarm. */
export function waveAlarm(): void {
  play([
    { freq: 880, dur: 0.14, at: 0, type: "square", gain: 0.05 },
    { freq: 660, dur: 0.14, at: 0.16, type: "square", gain: 0.05 },
    { freq: 880, dur: 0.14, at: 0.32, type: "square", gain: 0.05 },
    { freq: 660, dur: 0.18, at: 0.48, type: "square", gain: 0.05 },
  ]);
  hapticGo();
}

/** Dalgadaki bütün paneller doğru kesildi: imha zili. */
export function defusedBell(): void {
  play([
    { freq: 1318, dur: 0.5, type: "sine", gain: 0.09 },
    { freq: 2636, dur: 0.35, type: "sine", gain: 0.03 },
    { freq: 1975, dur: 0.45, at: 0.12, type: "sine", gain: 0.05 },
  ]);
  hapticMatch();
}

/** Üç dalganın hepsinde bomba tamamen imha edildi: kısa zafer. */
export function bombVictory(): void {
  play([
    { freq: 523, dur: 0.12, at: 0, type: "triangle", gain: 0.1 },
    { freq: 659, dur: 0.12, at: 0.11, type: "triangle", gain: 0.1 },
    { freq: 784, dur: 0.12, at: 0.22, type: "triangle", gain: 0.1 },
    { freq: 1047, dur: 0.42, at: 0.33, type: "triangle", gain: 0.12 },
    { freq: 1568, dur: 0.3, at: 0.45, type: "sine", gain: 0.04 },
  ]);
  hapticMatch();
}
