import { hapticPress } from "../../fx/haptics.js";
import { play } from "../../fx/sound.js";

/**
 * Kule Ustası ses ve titreşim seti (KU-U9; WebAudio ile kodda üretilir, ses dosyası yok). Titreşim yalnız kendi
 * bırakışında ve kendi sıranda (çağıran `own` ile seçer); izleyici ve TV titreşmez.
 */

/** Vinç cızırtısı: blok yön değiştirirken hafif metal sürtünmesi. */
export function craneCreak(): void {
  play([
    { freq: 340, to: 290, dur: 0.12, type: "sawtooth", gain: 0.012 },
    { freq: 1250, to: 1100, dur: 0.06, at: 0.02, type: "triangle", gain: 0.008 },
  ]);
}

/** Bırakma "klik"i: kanca açılır. */
export function releaseClick(own: boolean): void {
  play([
    { freq: 2300, to: 1600, dur: 0.03, type: "square", gain: 0.03 },
    { freq: 900, to: 600, dur: 0.05, at: 0.03, type: "triangle", gain: 0.05 },
  ]);
  if (own) hapticPress(14);
}

/** Oturma "tak"ı: ağır blok kuleye oturur. */
export function landThud(): void {
  play([
    { freq: 150, to: 70, dur: 0.14, type: "sine", gain: 0.16 },
    { freq: 520, to: 220, dur: 0.05, type: "square", gain: 0.03 },
  ]);
}

/** Kesilme "çat"ı: taşan parça kopar. */
export function cutCrack(): void {
  play([
    { freq: 1900, to: 300, dur: 0.07, type: "sawtooth", gain: 0.05 },
    { freq: 3200, to: 1400, dur: 0.03, at: 0.01, type: "square", gain: 0.02 },
  ]);
}

/** Kusursuz "ding"i: seride her kusursuz bir nota (yarım ton) yükselir; titreşim çift. */
export function perfectDing(streak: number, own: boolean): void {
  const step = Math.min(12, Math.max(0, streak - 1));
  const f = 1046.5 * 2 ** (step / 12);
  play([
    { freq: f, dur: 0.32, type: "sine", gain: 0.09 },
    { freq: f * 2, dur: 0.22, at: 0.01, type: "triangle", gain: 0.03 },
    { freq: f * 1.5, dur: 0.3, at: 0.09, type: "sine", gain: 0.04 },
  ]);
  if (own) hapticPress([16, 40, 16]);
}

/** Son 2 saniye tiki. */
export function urgentTick(): void {
  play([{ freq: 1500, dur: 0.035, type: "square", gain: 0.03 }]);
}

/** Yıkılma gürültüsü: katlar devrilir; ıskalayanda uzun titreşim. */
export function collapseRumble(own: boolean): void {
  play([
    { freq: 110, to: 34, dur: 0.9, type: "sawtooth", gain: 0.12 },
    { freq: 70, to: 30, dur: 1.1, at: 0.05, type: "sine", gain: 0.18 },
    { freq: 620, to: 120, dur: 0.18, at: 0.12, type: "square", gain: 0.035 },
    { freq: 480, to: 90, dur: 0.2, at: 0.32, type: "square", gain: 0.03 },
    { freq: 380, to: 80, dur: 0.22, at: 0.52, type: "square", gain: 0.025 },
  ]);
  if (own) hapticPress(260);
}

/** "Yeni kule": vinç makarası yeni tabanı indirir. */
export function newTowerWinch(): void {
  play([
    { freq: 220, to: 330, dur: 0.36, type: "triangle", gain: 0.035 },
    { freq: 880, to: 990, dur: 0.3, at: 0.06, type: "sine", gain: 0.012 },
  ]);
}

/** "Sıra sende!" uyarısı: kısa yükselen iki nota; sıra kendindeyse güçlü titreşim. */
export function yourTurn(own: boolean): void {
  if (!own) return;
  play([
    { freq: 660, dur: 0.09, type: "triangle", gain: 0.07 },
    { freq: 990, dur: 0.14, at: 0.1, type: "triangle", gain: 0.07 },
  ]);
  hapticPress([30, 50, 60]);
}
