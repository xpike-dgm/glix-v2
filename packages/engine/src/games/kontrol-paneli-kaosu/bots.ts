import type { GameBot } from "../../testing/simulate.js";
import { KONTROL_DURATION_MS, KONTROL_WAVES, type KontrolAction, WIRE_COLORS } from "./types.js";

/**
 * Rastgele bir dalga için rastgele bir kablo keser (yanlış dalga ve 4 kablolu dalgada mor reddedilir); ikinci kesim dener
 * (reddedilir) ve çok seyrek geçersiz renk gönderir.
 */
export const kontrolPaneliKaosuBot: GameBot = {
  durationMs: KONTROL_DURATION_MS,
  burstJitterMs: [100, 2_000, 9_000],
  generate: (rng): KontrolAction | { kind: "cut"; color: string; wave: number } => {
    const wave = rng.int(KONTROL_WAVES);
    if (rng.int(100) < 3) return { kind: "cut", color: "orange", wave };
    return { kind: "cut", color: WIRE_COLORS[rng.int(WIRE_COLORS.length)] as KontrolAction["color"], wave };
  },
};
