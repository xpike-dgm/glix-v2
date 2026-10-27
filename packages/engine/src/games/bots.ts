import type { GameBot } from "../testing/simulate.js";
import { acgozlulukLimitiBot } from "./acgozluluk-limiti/bots.js";
import { asiriYuklemeBot } from "./asiri-yukleme/bots.js";
import { bozukTelefonBot } from "./bozuk-telefon/bots.js";
import { butonaBasBot } from "./butona-bas/bots.js";
import { cagrisimAgiBot } from "./cagrisim-agi/bots.js";
import { caprazAtesBot } from "./capraz-ates/bots.js";
import { cizgiyiGecmeBot } from "./cizgiyi-gecme/bots.js";
import { gizliAlisverisBot } from "./gizli-alisveris/bots.js";
import { gizliHirsizBot } from "./gizli-hirsiz/bots.js";
import { gizliKarelerBot } from "./gizli-kareler/bots.js";
import { ittifakBot } from "./ittifak/bots.js";
import { karaBorsaBot } from "./kara-borsa/bots.js";
import { karalamaDefteriBot } from "./karalama-defteri/bots.js";
import { kendimBot } from "./kendim/bots.js";
import { kontrolPaneliKaosuBot } from "./kontrol-paneli-kaosu/bots.js";
import { korBombaBot } from "./kor-bomba/bots.js";
import { korKronometreBot } from "./kor-kronometre/bots.js";
import { kuleUstasiBot } from "./kule-ustasi/bots.js";
import { lafSokmaBot } from "./laf-sokma/bots.js";
import { ortalamaninYarisiBot } from "./ortalamanin-yarisi/bots.js";
import { rusRuletiBot } from "./rus-ruleti/bots.js";
import { rusvetDarbeBot } from "./rusvet-darbe/bots.js";
import { sizmaBot } from "./sizma/bots.js";
import { sonKisiBot } from "./son-kisi/bots.js";
import { sozlukBlofuBot } from "./sozluk-blofu/bots.js";
import { yaziYazBot } from "./yazi-yaz/bots.js";
import { zamanBombasiHafizasiBot } from "./zaman-bombasi-hafizasi/bots.js";
import { zehirliKadehBot } from "./zehirli-kadeh/bots.js";

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
  "rus-ruleti": rusRuletiBot,
  "zehirli-kadeh": zehirliKadehBot,
  ittifak: ittifakBot,
  kendim: kendimBot,
  "kontrol-paneli-kaosu": kontrolPaneliKaosuBot,
  "yazi-yaz": yaziYazBot,
  "rusvet-darbe": rusvetDarbeBot,
  sizma: sizmaBot,
  "sozluk-blofu": sozlukBlofuBot,
  "bozuk-telefon": bozukTelefonBot,
  "kara-borsa": karaBorsaBot,
  "laf-sokma": lafSokmaBot,
  "kule-ustasi": kuleUstasiBot,
};
