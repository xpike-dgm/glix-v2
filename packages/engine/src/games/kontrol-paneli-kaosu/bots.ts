import type { GameBot } from "../../testing/simulate.js";
import { KONTROL_DURATION_MS, type KontrolAction, WIRE_COLORS } from "./types.js";

/** Rastgele bir kablo keser; ara sıra ikinci kesim dener (reddedilir) ve çok seyrek geçersiz renk gönderir. */
export const kontrolPaneliKaosuBot: GameBot = {
  durationMs: KONTROL_DURATION_MS,
  burstJitterMs: [100, 2_000, 9_000],
  generate: (rng): KontrolAction | { kind: "cut"; color: string } => {
    if (rng.int(100) < 3) return { kind: "cut", color: "purple" };
    return { kind: "cut", color: WIRE_COLORS[rng.int(WIRE_COLORS.length)] as KontrolAction["color"] };
  },
};
