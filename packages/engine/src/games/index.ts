import type { AnyGame } from "../game.js";
import type { GameInfo } from "../protocol.js";
import { acgozlulukLimiti } from "./acgozluluk-limiti/index.js";
import { butonaBas } from "./butona-bas/index.js";

export const GAMES: Record<string, AnyGame> = {
  [acgozlulukLimiti.id]: acgozlulukLimiti,
  [butonaBas.id]: butonaBas,
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
