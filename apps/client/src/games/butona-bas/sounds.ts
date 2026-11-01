import { play, type Tone } from "../../fx/sound.js";

/**
 * Butona Bas arcade ses seti (BB-U13, BB-U6, BB-U3): mevcut ses sisteminde kodla üretilir, dosya gerektirmez (Ses
 * alanı isterse gerçek kayıtlarla değiştirir: docs/oneriler/GORSEL-IHTIYACLARI.md "Butona Bas"). Yalnız kendi
 * basışına ve kendi sonucuna çalar; başkalarının pencereleri yalnız görseldir.
 */

let klakTurn = 0;

/** Basış: kalın, mekanik "KLAK" ve yay titremesi (üç küçük varyasyon sırayla). */
export const klakSound = (): void => {
  const v = klakTurn++ % 3;
  play([
    { freq: 150 + v * 12, to: 70, dur: 0.07, type: "square", gain: 0.11 },
    { freq: 1400 - v * 90, to: 600, dur: 0.025, type: "triangle", gain: 0.06 },
    { freq: 420 + v * 20, to: 380, dur: 0.12, at: 0.02, type: "sawtooth", gain: 0.012 },
  ]);
};

/** Eşleşme: yükselen notalar; eşleşen kişi arttıkça akor kalabalıklaşır (2 kişi iki nota, 4+ üç nota). */
export const chordSound = (people: number): void => {
  const notes = people >= 4 ? [523, 659, 784] : [523, 784];
  play(
    notes.map(
      (f, i): Tone => ({ freq: f, to: f * 1.02, dur: 0.22, at: i * 0.06, type: "triangle", gain: 0.07 }),
    ),
  );
};

/** KALABALIK: akorun üstüne kısa "tezahürat" vuruşu. */
export const cheerSound = (): void => {
  chordSound(4);
  const hits: Tone[] = [];
  for (let i = 0; i < 6; i++) {
    hits.push({
      freq: 900 + ((i * 371) % 700),
      to: 400,
      dur: 0.05,
      at: 0.12 + i * 0.03,
      type: "square",
      gain: 0.02,
    });
  }
  play([{ freq: 90, to: 60, dur: 0.18, at: 0.12, type: "sine", gain: 0.14 }, ...hits]);
};

/** Tek basış: kısa "bzzzt" buzzer. */
export const buzzSound = (): void =>
  play([
    { freq: 110, dur: 0.24, type: "sawtooth", gain: 0.06 },
    { freq: 116, dur: 0.24, type: "square", gain: 0.03 },
  ]);

/** Dolum bitti: çok kısa "çıt". */
export const refillSound = (): void =>
  play([{ freq: 2600, to: 2100, dur: 0.025, type: "triangle", gain: 0.035 }]);

/** Tur başı: "gong". */
export const gongSound = (): void =>
  play([
    { freq: 196, to: 190, dur: 1.4, type: "sine", gain: 0.12 },
    { freq: 392, to: 380, dur: 0.9, type: "triangle", gain: 0.04 },
    { freq: 587, dur: 0.6, type: "sine", gain: 0.02 },
  ]);

/** Ara: "vuuş" (pencere daralıyor). */
export const whooshSound = (): void =>
  play([
    { freq: 900, to: 180, dur: 0.45, type: "sawtooth", gain: 0.025 },
    { freq: 1800, to: 360, dur: 0.4, type: "sine", gain: 0.02 },
  ]);

/** Son 3 sn tıkı (`double`: son saniyede iki tık). */
export const lastTick = (double: boolean): void =>
  play([
    { freq: 1500, dur: 0.04, type: "square", gain: 0.04 },
    ...(double ? [{ freq: 1700, dur: 0.04, at: 0.18, type: "square" as const, gain: 0.045 }] : []),
  ]);

/** Oyun sonu: kısa fanfar. */
export const endFanfare = (): void =>
  play(
    [523, 659, 784, 1047].map(
      (f, i): Tone => ({ freq: f, dur: i === 3 ? 0.5 : 0.14, at: i * 0.12, type: "triangle", gain: 0.08 }),
    ),
  );
