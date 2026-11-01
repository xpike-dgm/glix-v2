import { play, type Tone } from "../../fx/sound.js";

/**
 * Sözlük Blöfü ses seti (SB-U15): kâğıt, mürekkep, tahta masa. Yazarken tuş sesi YOKTUR (yazılan uzunluğu yandakine
 * duyurur). Sesler mevcut ses sisteminde üretilir; dosya gerektirmez.
 */

/** Hışırtı: kısa, aşağı kayan üçgen dalgalar. */
function rustle(count: number, base: number, gain: number, gap = 0.018): Tone[] {
  const tones: Tone[] = [];
  for (let i = 0; i < count; i++) {
    const f = base + ((i * 337) % 900);
    tones.push({ freq: f, to: f * 0.45, dur: 0.03, at: i * gap, type: "triangle", gain });
  }
  return tones;
}

/** Gönder: tüy kalem çizgisi + sayfa kapanma. */
export const quillSound = (): void =>
  play([
    { freq: 2600, to: 1400, dur: 0.18, type: "triangle", gain: 0.025 },
    { freq: 3200, to: 1800, dur: 0.12, at: 0.08, type: "triangle", gain: 0.018 },
    { freq: 180, to: 70, dur: 0.12, at: 0.24, type: "sine", gain: 0.14 },
    ...rustle(3, 1500, 0.02).map((t) => ({ ...t, at: (t.at ?? 0) + 0.22 })),
  ]);

/** Seçme başlarken deste karıştırma. */
export const shuffleSound = (): void => play(rustle(12, 1400, 0.022, 0.035));

/** Kart seçme: hafif kâğıt dokunuşu. */
export const paperTapSound = (): void =>
  play([
    { freq: 1900, to: 900, dur: 0.035, type: "triangle", gain: 0.03 },
    { freq: 220, to: 120, dur: 0.04, type: "sine", gain: 0.05 },
  ]);

/** Açılışta kart çevirme. */
export const flipSound = (): void => play(rustle(5, 1800, 0.024));

/** "Gerçek anlam…" kısa davul. */
export const drumSound = (): void => {
  const tones: Tone[] = [];
  let at = 0;
  for (let i = 0; i < 12; i++) {
    tones.push({ freq: 140 + (i % 2) * 16, to: 70, dur: 0.07, at, type: "sine", gain: 0.06 + i * 0.005 });
    at += Math.max(0.05, 0.13 - i * 0.007);
  }
  play(tones);
};

/** Mühür vuruşu + mürekkep. */
export const stampSound = (): void =>
  play([
    { freq: 110, to: 42, dur: 0.24, type: "sine", gain: 0.2 },
    { freq: 640, to: 160, dur: 0.05, type: "square", gain: 0.03 },
    { freq: 900, to: 300, dur: 0.35, at: 0.08, type: "sine", gain: 0.018 },
  ]);

/** Kandırıldığın kart açılınca kısa "boing". */
export const boingSound = (): void =>
  play([
    { freq: 220, to: 520, dur: 0.12, type: "sine", gain: 0.08 },
    { freq: 520, to: 260, dur: 0.18, at: 0.12, type: "sine", gain: 0.06 },
  ]);

/** Blöf Ustası: kısa fanfar. */
export const fanfareSound = (): void =>
  play([
    { freq: 523, dur: 0.12, type: "triangle", gain: 0.07 },
    { freq: 659, dur: 0.12, at: 0.12, type: "triangle", gain: 0.07 },
    { freq: 784, dur: 0.28, at: 0.24, type: "triangle", gain: 0.08 },
    { freq: 1046, dur: 0.32, at: 0.24, type: "sine", gain: 0.03 },
  ]);
