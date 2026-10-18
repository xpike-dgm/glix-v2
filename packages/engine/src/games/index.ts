import type { AnyGame } from "../game.js";
import type { GameInfo } from "../protocol.js";
import { acgozlulukLimiti } from "./acgozluluk-limiti/index.js";
import { asiriYukleme } from "./asiri-yukleme/index.js";
import { butonaBas } from "./butona-bas/index.js";
import { cagrisimAgi } from "./cagrisim-agi/index.js";
import { caprazAtes } from "./capraz-ates/index.js";
import { karalamaDefteri } from "./karalama-defteri/index.js";
import { korBomba } from "./kor-bomba/index.js";
import { korKronometre } from "./kor-kronometre/index.js";
import { zamanBombasiHafizasi } from "./zaman-bombasi-hafizasi/index.js";

export const GAMES: Record<string, AnyGame> = {
  [butonaBas.id]: butonaBas,
  [asiriYukleme.id]: asiriYukleme,
  [acgozlulukLimiti.id]: acgozlulukLimiti,
  [caprazAtes.id]: caprazAtes,
  [cagrisimAgi.id]: cagrisimAgi,
  [karalamaDefteri.id]: karalamaDefteri,
  [korBomba.id]: korBomba,
  [korKronometre.id]: korKronometre,
  [zamanBombasiHafizasi.id]: zamanBombasiHafizasi,
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
