import type { AnyGame } from "../game.js";
import type { GameInfo } from "../protocol.js";
import { acgozlulukLimiti } from "./acgozluluk-limiti/index.js";
import { butonaBas } from "./butona-bas/index.js";
import { cagrisimAgi } from "./cagrisim-agi/index.js";
import { caprazAtes } from "./capraz-ates/index.js";
import { gizliHirsiz } from "./gizli-hirsiz/index.js";
import { karalamaDefteri } from "./karalama-defteri/index.js";
import { korBomba } from "./kor-bomba/index.js";
import { zamanBombasiHafizasi } from "./zaman-bombasi-hafizasi/index.js";

export const GAMES: Record<string, AnyGame> = {
  [butonaBas.id]: butonaBas,
  [acgozlulukLimiti.id]: acgozlulukLimiti,
  [caprazAtes.id]: caprazAtes,
  [cagrisimAgi.id]: cagrisimAgi,
  [karalamaDefteri.id]: karalamaDefteri,
  [korBomba.id]: korBomba,
  [zamanBombasiHafizasi.id]: zamanBombasiHafizasi,
  [gizliHirsiz.id]: gizliHirsiz,
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
