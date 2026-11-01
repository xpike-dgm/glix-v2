import { play, type Tone } from "../../fx/sound.js";

/**
 * Kör Kronometre kronometre ses seti (KR-U12): mevcut ses sisteminde kodla üretilir, dosya gerektirmez (Ses alanı
 * isterse gerçek kayıtlarla değiştirir: docs/oneriler/GORSEL-IHTIYACLARI.md "Kör Kronometre"). Sayarken hiçbir ses
 * yoktur (müzik, ortam, tik): her ritimli ses bir metronomdur. Sesler yalnız "BAŞLA!", kendi basışın ve açılışta çalar.
 */

/** "BAŞLA!": derin tek gong. */
export const gongSound = (): void =>
  play([
    { freq: 110, to: 106, dur: 1.5, type: "sine", gain: 0.16 },
    { freq: 220, to: 214, dur: 1.1, type: "triangle", gain: 0.05 },
    { freq: 331, dur: 0.7, type: "sine", gain: 0.025 },
    { freq: 60, to: 50, dur: 0.25, type: "sine", gain: 0.1 },
  ]);

let clickTurn = 0;
/** Basış: mekanik kronometre "klik" (iki parçalı, tok; iki varyasyon sırayla). */
export const clickSound = (): void => {
  const v = clickTurn++ % 2;
  play([
    { freq: 2200 - v * 160, to: 900, dur: 0.018, type: "square", gain: 0.06 },
    { freq: 180 + v * 14, to: 90, dur: 0.06, type: "triangle", gain: 0.12 },
    { freq: 1700 + v * 120, to: 800, dur: 0.02, at: 0.07, type: "square", gain: 0.04 },
    { freq: 140, to: 80, dur: 0.05, at: 0.07, type: "triangle", gain: 0.08 },
  ]);
};

/** Açılış (KR-U5): ibre "vızz". */
export const whizSound = (): void =>
  play([
    { freq: 300, to: 1400, dur: 0.4, type: "sawtooth", gain: 0.018 },
    { freq: 600, to: 2600, dur: 0.35, type: "sine", gain: 0.02 },
  ]);

/** Avatar çizgiye düşer: küçük "tik" (oyuncu başına hafif farklı perde). */
export const dropTick = (i: number): void =>
  play([{ freq: 900 + ((i * 137) % 600), to: 700, dur: 0.035, type: "triangle", gain: 0.05 }]);

/** İbre hedeften geçer: "ding". */
export const dingSound = (): void =>
  play([
    { freq: 1568, dur: 0.5, type: "sine", gain: 0.07 },
    { freq: 3136, dur: 0.25, type: "sine", gain: 0.015 },
  ]);

/** +2 (el ya da oyun birincisi): kısa zafer notası. */
export const winSound = (): void =>
  play(
    [659, 784, 1047].map(
      (f, i): Tone => ({ freq: f, dur: i === 2 ? 0.32 : 0.11, at: i * 0.09, type: "triangle", gain: 0.08 }),
    ),
  );

/** TAM İSABET: cam çanı. */
export const glassBell = (): void =>
  play([
    { freq: 2637, dur: 0.9, type: "sine", gain: 0.05 },
    { freq: 3951, dur: 0.6, at: 0.01, type: "sine", gain: 0.03 },
    { freq: 5274, dur: 0.35, at: 0.02, type: "sine", gain: 0.015 },
  ]);

/** Kendi sonucun: puan varsa yükselen, yoksa alçalan kısa ses. */
export const upSound = (): void =>
  play([
    { freq: 523, to: 784, dur: 0.18, type: "triangle", gain: 0.07 },
    { freq: 784, to: 1047, dur: 0.16, at: 0.12, type: "triangle", gain: 0.05 },
  ]);
export const downSound = (): void =>
  play([
    { freq: 392, to: 262, dur: 0.28, type: "triangle", gain: 0.06 },
    { freq: 196, to: 131, dur: 0.3, at: 0.05, type: "sine", gain: 0.04 },
  ]);
