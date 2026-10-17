import type { GameBot } from "../testing/simulate.js";
import { acgozlulukLimitiBot } from "./acgozluluk-limiti/bots.js";
import { butonaBasBot } from "./butona-bas/bots.js";

/** Test botları: her oyun için bir kayıt zorunludur (games/invariants.test.ts denetler). */
export const BOTS: Record<string, GameBot> = {
  "acgozluluk-limiti": acgozlulukLimitiBot,
  "butona-bas": butonaBasBot,
};
