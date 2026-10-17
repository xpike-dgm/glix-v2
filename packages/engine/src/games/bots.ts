import type { GameBot } from "../testing/simulate.js";
import { butonaBasBot } from "./butona-bas/bots.js";
import { karalamaDefteriBot } from "./karalama-defteri/bots.js";

/** Test botları: her oyun için bir kayıt zorunludur (games/invariants.test.ts denetler). */
export const BOTS: Record<string, GameBot> = {
  "butona-bas": butonaBasBot,
  "karalama-defteri": karalamaDefteriBot,
};
