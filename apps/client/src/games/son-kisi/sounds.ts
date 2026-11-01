import { play } from "../../fx/sound.js";

/**
 * Son Kişi koridor ses seti (SK-U15): mevcut ses sisteminde kodla üretilir, dosya gerektirmez (Ses alanı isterse gerçek
 * kayıtlarla değiştirir: docs/oneriler/GORSEL-IHTIYACLARI.md "Son Kişi"). Olay sesleri ekranda `CueGate` ile her olay
 * geçişinde BİR KEZ çalar; yalnız kalp atışı içerideki oyuncuda bilinçli olarak ritimle tekrar eder.
 */

/** Kendi kaçışın: yukarı doğru "vuş" ve ardından kapı çarpması. */
export const dash = (): void =>
  play([
    { freq: 280, to: 1100, dur: 0.18, type: "triangle", gain: 0.08 },
    { freq: 140, to: 520, dur: 0.2, at: 0.02, type: "sine", gain: 0.05 },
    { freq: 120, to: 60, dur: 0.16, at: 0.32, type: "square", gain: 0.06 },
    { freq: 70, to: 40, dur: 0.22, at: 0.33, type: "sine", gain: 0.1 },
  ]);

/** Başkası kaçtı: koridorun uzağında boğuk bir kapı. */
export const farDoor = (): void =>
  play([
    { freq: 95, to: 55, dur: 0.18, type: "sine", gain: 0.05 },
    { freq: 220, to: 120, dur: 0.06, type: "square", gain: 0.012 },
  ]);

/** Kalp atışı (iki vuruşlu, kısık). */
export const thump = (): void =>
  play([
    { freq: 90, to: 55, dur: 0.12, type: "sine", gain: 0.1 },
    { freq: 80, to: 50, dur: 0.14, at: 0.16, type: "sine", gain: 0.08 },
  ]);

/** "SON İKİ" / "SON KİŞİ": alçak gong. */
export const gong = (): void =>
  play([
    { freq: 98, to: 94, dur: 1.2, type: "sine", gain: 0.12 },
    { freq: 196, to: 190, dur: 0.8, type: "triangle", gain: 0.04 },
  ]);

/** Alarm sireni (SK-U5). */
export const siren = (): void =>
  play([
    { freq: 520, to: 900, dur: 0.24, type: "sawtooth", gain: 0.07 },
    { freq: 900, to: 520, dur: 0.24, at: 0.24, type: "sawtooth", gain: 0.07 },
    { freq: 520, to: 900, dur: 0.24, at: 0.48, type: "sawtooth", gain: 0.06 },
  ]);

/** Kepenk iner: metalik çarpma. */
export const shutter = (): void =>
  play([
    { freq: 600, to: 140, dur: 0.35, at: 0.2, type: "sawtooth", gain: 0.03 },
    { freq: 80, to: 40, dur: 0.3, at: 0.55, type: "square", gain: 0.06 },
  ]);

/** Kıl payı: ince "çın". */
export const ting = (): void =>
  play([
    { freq: 2637, dur: 0.6, type: "sine", gain: 0.05 },
    { freq: 3951, dur: 0.35, at: 0.01, type: "sine", gain: 0.02 },
  ]);

/** Son kişi: altın fanfar. */
export const gold = (): void =>
  play([
    { freq: 784, dur: 0.1, type: "triangle", gain: 0.09 },
    { freq: 988, dur: 0.1, at: 0.09, type: "triangle", gain: 0.09 },
    { freq: 1319, dur: 0.34, at: 0.18, type: "sine", gain: 0.08 },
  ]);

/** Yeni tur "HAZIR": kısa iki nota. */
export const readyTone = (): void =>
  play([
    { freq: 523, dur: 0.08, type: "triangle", gain: 0.06 },
    { freq: 784, dur: 0.14, at: 0.1, type: "triangle", gain: 0.06 },
  ]);
