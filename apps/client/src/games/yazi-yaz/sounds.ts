import { play, type Tone } from "../../fx/sound.js";

/**
 * Yazı Yaz ses seti (YY-U6). Yazarken tuş sesi YOKTUR: tuş sesi yazılan harf sayısını yandakilere duyurur.
 */

/** Tamam: daktilo satır sonu zili ("ding"). */
export const dingSound = (): void =>
  play([
    { freq: 2093, dur: 0.45, type: "sine", gain: 0.07 },
    { freq: 4186, dur: 0.25, type: "sine", gain: 0.02 },
    { freq: 420, to: 180, dur: 0.06, type: "square", gain: 0.02 },
  ]);

/** Rol kartı çevirme: kısa kâğıt hışırtısı. */
export const flipSound = (): void => {
  const tones: Tone[] = [];
  for (let i = 0; i < 5; i++) {
    const f = 1800 + i * 260;
    tones.push({ freq: f, to: f * 0.45, dur: 0.03, at: i * 0.018, type: "triangle", gain: 0.022 });
  }
  play(tones);
};

/** Tartışmanın son saniyeleri: saat tiki. */
export const clockTickSound = (): void =>
  play([{ freq: 1250, to: 1100, dur: 0.035, type: "square", gain: 0.035 }]);

/** "Yazanlar…" davulu: hızlanan kısa vuruşlar (yaklaşık 1,4 sn). */
export const drumRollSound = (): void => {
  const tones: Tone[] = [];
  let at = 0;
  for (let i = 0; i < 16; i++) {
    tones.push({ freq: 150 + (i % 2) * 18, to: 70, dur: 0.07, at, type: "sine", gain: 0.06 + i * 0.005 });
    at += Math.max(0.045, 0.13 - i * 0.006);
  }
  tones.push({ freq: 110, to: 50, dur: 0.3, at: at + 0.02, type: "sine", gain: 0.16 });
  play(tones);
};

/** Açılışta harf harf daktilo tuşu. */
export const typeKeySound = (): void => {
  const f = 1500 + Math.round(Math.random() * 500);
  play([
    { freq: f, to: f * 0.4, dur: 0.025, type: "square", gain: 0.03 },
    { freq: 180, to: 90, dur: 0.03, type: "sine", gain: 0.05 },
  ]);
};

/** "İZ BIRAKMADI" / "n kişi buldu" damgası: tok vuruş. */
export const stampSound = (): void =>
  play([
    { freq: 120, to: 45, dur: 0.22, type: "sine", gain: 0.18 },
    { freq: 600, to: 180, dur: 0.05, type: "square", gain: 0.03 },
  ]);
