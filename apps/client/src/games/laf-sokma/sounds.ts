import { play, type Tone } from "../../fx/sound.js";

let lastPen = 0;
/** Yazarken hafif kalem tıkırtısı: çok kısık, sık yazmada seyreltilir (en çok ~12/sn). */
export const penSound = (): void => {
  const now = performance.now();
  if (now - lastPen < 80) return;
  lastPen = now;
  const f = 2200 + Math.round(Math.random() * 900);
  play([{ freq: f, to: f * 0.6, dur: 0.025, type: "triangle", gain: 0.018 }]);
};

/** Sayım davulu: alçak, kuru vuruş. */
export const drumSound = (): void =>
  play([
    { freq: 150, to: 60, dur: 0.14, type: "sine", gain: 0.16 },
    { freq: 900, to: 300, dur: 0.03, type: "square", gain: 0.02 },
  ]);

/**
 * Kahkaha: art arda inen "ha" sesleri. `level` (1'den) oy sayısıyla büyür: daha çok "ha", daha yüksek ses.
 */
export const laughSound = (level: number): void => {
  const n = Math.min(6, 2 + level);
  const gain = Math.min(0.09, 0.03 + level * 0.012);
  const tones: Tone[] = [];
  for (let i = 0; i < n; i++) {
    const base = 520 - i * 18 + (i % 2) * 40;
    tones.push({ freq: base, to: base * 0.72, dur: 0.09, at: 0.05 + i * 0.11, type: "sawtooth", gain });
    tones.push({
      freq: base * 2,
      to: base * 1.4,
      dur: 0.07,
      at: 0.05 + i * 0.11,
      type: "sine",
      gain: gain / 2,
    });
  }
  play(tones);
};

/** Laf Ustası gongu: alçak, uzun tını ve titreşen üst sesler. */
export const gongSound = (): void =>
  play([
    { freq: 98, dur: 1.6, type: "sine", gain: 0.16 },
    { freq: 147, dur: 1.2, at: 0.01, type: "sine", gain: 0.07 },
    { freq: 262, to: 250, dur: 1.0, at: 0.02, type: "triangle", gain: 0.05 },
    { freq: 523, to: 505, dur: 0.7, at: 0.02, type: "sine", gain: 0.025 },
  ]);

/** "Berabere" zili: iki parlak çan vuruşu. */
export const bellSound = (): void =>
  play([
    { freq: 1319, dur: 0.5, type: "sine", gain: 0.07 },
    { freq: 2637, dur: 0.3, type: "sine", gain: 0.025 },
    { freq: 1319, dur: 0.6, at: 0.26, type: "sine", gain: 0.07 },
    { freq: 2637, dur: 0.35, at: 0.26, type: "sine", gain: 0.025 },
  ]);

/** Final alkışı: kısa, sık ve rastgele "şap" sesleri (yaklaşık 1,4 sn). */
export const applauseSound = (): void => {
  const tones: Tone[] = [];
  for (let i = 0; i < 26; i++) {
    const at = i * 0.05 + Math.random() * 0.04;
    const f = 1500 + Math.random() * 1800;
    tones.push({ freq: f, to: f * 0.5, dur: 0.035, at, type: "square", gain: 0.02 + Math.random() * 0.015 });
  }
  play(tones);
};
