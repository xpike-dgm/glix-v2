import type { GameBot } from "../testing/simulate.js";
import { butonaBasBot } from "./butona-bas/bots.js";
import { cagrisimAgiBot } from "./cagrisim-agi/bots.js";
import { caprazAtesBot } from "./capraz-ates/bots.js";
import { karalamaDefteriBot } from "./karalama-defteri/bots.js";
import { korBombaBot } from "./kor-bomba/bots.js";
import { zamanBombasiHafizasiBot } from "./zaman-bombasi-hafizasi/bots.js";

/** Test botları: her oyun için bir kayıt zorunludur (games/invariants.test.ts denetler). */
export const BOTS: Record<string, GameBot> = {
  "butona-bas": butonaBasBot,
  "kor-bomba": korBombaBot,
  "cagrisim-agi": cagrisimAgiBot,
  "zaman-bombasi-hafizasi": zamanBombasiHafizasiBot,
  "capraz-ates": caprazAtesBot,
  "karalama-defteri": karalamaDefteriBot,
};
