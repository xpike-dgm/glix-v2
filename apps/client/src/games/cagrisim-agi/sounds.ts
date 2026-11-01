import { play, type Tone } from "../../fx/sound.js";

/**
 * Çağrışım Ağı ses seti (CG-U5, CG-U13): elektrik ve neon. Yazarken tuş sesi YOKTUR. Sesler mevcut ses sisteminde
 * üretilir; dosya gerektirmez (Ses alanı istersek gerçek kayıtlarla değiştirir: docs/oneriler/GORSEL-IHTIYACLARI.md).
 */

/** Çıtırtı: çok kısa, rastgele görünümlü (sabit) kare dalga kıvılcımları. */
function crackle(count: number, gain: number, gap = 0.022, base = 2400): Tone[] {
  const tones: Tone[] = [];
  for (let i = 0; i < count; i++) {
    const f = base + ((i * 613) % 1700);
    tones.push({
      freq: f,
      to: f * 0.6,
      dur: 0.012,
      at: i * gap + ((i * 7) % 5) * 0.004,
      type: "square",
      gain,
    });
  }
  return tones;
}

/** Gönder: kısa "zap". */
export const zapSound = (): void =>
  play([
    { freq: 1800, to: 220, dur: 0.16, type: "sawtooth", gain: 0.05 },
    { freq: 3600, to: 900, dur: 0.08, type: "square", gain: 0.02 },
    ...crackle(3, 0.012, 0.03),
  ]);

/** Başka biri gönderdi: çok hafif çıtırtı (yalnız ses). */
export const sparkSound = (): void => play(crackle(2, 0.008, 0.025, 3000));

/** Son 5 sn: kürenin uğultusu (her saniye biraz daha yüksek). */
export const humSound = (secondsLeft: number): void => {
  const lift = Math.max(0, 5 - secondsLeft);
  play([
    { freq: 110 + lift * 12, dur: 0.5, type: "sawtooth", gain: 0.018 + lift * 0.006 },
    { freq: 220 + lift * 24, dur: 0.4, type: "sine", gain: 0.012 + lift * 0.004 },
  ]);
};

/** Açılışta kart çevirme tıkı. */
export const flipTick = (): void =>
  play([
    { freq: 2200, to: 1200, dur: 0.03, type: "triangle", gain: 0.03 },
    { freq: 400, to: 200, dur: 0.03, type: "sine", gain: 0.04 },
  ]);

/** Tek kalan sönme "fzz". */
export const fizzSound = (): void =>
  play([{ freq: 700, to: 90, dur: 0.28, type: "sawtooth", gain: 0.03 }, ...crackle(4, 0.008, 0.05, 1400)]);

/** Ağ bağlanma "vınnn": ağ büyüdükçe perde yükselir. */
export const linkSound = (size: number): void => {
  const base = 220 * 2 ** (Math.min(8, Math.max(2, size)) / 6);
  play([
    { freq: base, to: base * 2, dur: 0.42, type: "sawtooth", gain: 0.035 },
    { freq: base * 1.5, to: base * 3, dur: 0.38, at: 0.04, type: "sine", gain: 0.03 },
  ]);
};

/** En büyük ağ: çıtırtılı elektrik patlaması. */
export const burstSound = (): void =>
  play([
    { freq: 90, to: 40, dur: 0.4, type: "sine", gain: 0.16 },
    { freq: 1400, to: 300, dur: 0.3, type: "sawtooth", gain: 0.04 },
    ...crackle(10, 0.014, 0.03),
  ]);

/** Kelime geçişinde küre söner ve yeniden yanar. */
export const reigniteSound = (): void =>
  play([
    { freq: 300, to: 80, dur: 0.2, type: "sine", gain: 0.04 },
    { freq: 120, to: 640, dur: 0.32, at: 0.24, type: "sawtooth", gain: 0.03 },
  ]);
