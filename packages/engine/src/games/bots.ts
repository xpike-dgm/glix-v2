import type { GameBot } from "../testing/simulate.js";
import { acgozlulukLimitiBot } from "./acgozluluk-limiti/bots.js";
import { asiriYuklemeBot } from "./asiri-yukleme/bots.js";
import { butonaBasBot } from "./butona-bas/bots.js";
import { cagrisimAgiBot } from "./cagrisim-agi/bots.js";
import { caprazAtesBot } from "./capraz-ates/bots.js";
import { cizgiyiGecmeBot } from "./cizgiyi-gecme/bots.js";
import { gizliAlisverisBot } from "./gizli-alisveris/bots.js";
import { gizliHirsizBot } from "./gizli-hirsiz/bots.js";
import { gizliKarelerBot } from "./gizli-kareler/bots.js";
import { karalamaDefteriBot } from "./karalama-defteri/bots.js";
import { korBombaBot } from "./kor-bomba/bots.js";
import { korKronometreBot } from "./kor-kronometre/bots.js";
import { ortalamaninYarisiBot } from "./ortalamanin-yarisi/bots.js";
import { sonKisiBot } from "./son-kisi/bots.js";
import { zamanBombasiHafizasiBot } from "./zaman-bombasi-hafizasi/bots.js";

/** Test botları: her oyun için bir kayıt zorunludur (games/invariants.test.ts denetler). */
export const BOTS: Record<string, GameBot> = {
  "acgozluluk-limiti": acgozlulukLimitiBot,
  "butona-bas": butonaBasBot,
  "asiri-yukleme": asiriYuklemeBot,
  "kor-bomba": korBombaBot,
  "kor-kronometre": korKronometreBot,
  "cagrisim-agi": cagrisimAgiBot,
  "zaman-bombasi-hafizasi": zamanBombasiHafizasiBot,
  "capraz-ates": caprazAtesBot,
  "karalama-defteri": karalamaDefteriBot,
  "gizli-hirsiz": gizliHirsizBot,
  "gizli-alisveris": gizliAlisverisBot,
  "gizli-kareler": gizliKarelerBot,
  "son-kisi": sonKisiBot,
  "cizgiyi-gecme": cizgiyiGecmeBot,
  "ortalamanin-yarisi": ortalamaninYarisiBot,
};
