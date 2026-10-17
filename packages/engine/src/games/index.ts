import type { AnyGame } from "../game.js";
import type { GameInfo } from "../protocol.js";
import { butonaBas } from "./butona-bas/index.js";
import { korBomba } from "./kor-bomba/index.js";

export const GAMES: Record<string, AnyGame> = {
  [butonaBas.id]: butonaBas,
  [korBomba.id]: korBomba,
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
