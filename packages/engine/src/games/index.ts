import type { AnyGame } from "../game.js";
import type { GameInfo } from "../protocol.js";
import { acgozlulukLimiti } from "./acgozluluk-limiti/index.js";
import { asiriYukleme } from "./asiri-yukleme/index.js";
import { butonaBas } from "./butona-bas/index.js";
import { cagrisimAgi } from "./cagrisim-agi/index.js";
import { caprazAtes } from "./capraz-ates/index.js";
import { cizgiyiGecme } from "./cizgiyi-gecme/index.js";
import { gizliAlisveris } from "./gizli-alisveris/index.js";
import { gizliHirsiz } from "./gizli-hirsiz/index.js";
import { gizliKareler } from "./gizli-kareler/index.js";
import { karalamaDefteri } from "./karalama-defteri/index.js";
import { korBomba } from "./kor-bomba/index.js";
import { korKronometre } from "./kor-kronometre/index.js";
import { ortalamaninYarisi } from "./ortalamanin-yarisi/index.js";
import { rusRuleti } from "./rus-ruleti/index.js";
import { sonKisi } from "./son-kisi/index.js";
import { zamanBombasiHafizasi } from "./zaman-bombasi-hafizasi/index.js";
import { zehirliKadeh } from "./zehirli-kadeh/index.js";

export const GAMES: Record<string, AnyGame> = {
  [butonaBas.id]: butonaBas,
  [acgozlulukLimiti.id]: acgozlulukLimiti,
  [caprazAtes.id]: caprazAtes,
  [cagrisimAgi.id]: cagrisimAgi,
  [karalamaDefteri.id]: karalamaDefteri,
  [korBomba.id]: korBomba,
  [zamanBombasiHafizasi.id]: zamanBombasiHafizasi,
  [gizliHirsiz.id]: gizliHirsiz,
  [gizliAlisveris.id]: gizliAlisveris,
  [gizliKareler.id]: gizliKareler,
  [korKronometre.id]: korKronometre,
  [sonKisi.id]: sonKisi,
  [ortalamaninYarisi.id]: ortalamaninYarisi,
  [cizgiyiGecme.id]: cizgiyiGecme,
  [asiriYukleme.id]: asiriYukleme,
  [rusRuleti.id]: rusRuleti,
  [zehirliKadeh.id]: zehirliKadeh,
};

export function getCatalog(): GameInfo[] {
  return Object.values(GAMES).map((g) => ({
    id: g.id,
    name: g.name,
    minPlayers: g.minPlayers,
    maxPlayers: g.maxPlayers,
    orientation: g.orientation,
  }));
}
