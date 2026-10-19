import type { GameBot } from "../../testing/simulate.js";
import { KENDIM_DURATION_MS, type KendimAction } from "./types.js";

const WORDS = ["Kedi", "ELMA", "deniz", "güneş", "Işık", "çay", "ev", "bulut", "neşeli"];

interface Pub {
  stage?: string;
  owners?: string[];
}
interface Priv {
  cards?: { id: number; text: string }[];
}

/** Aşamaya uygun eylemler: kelime yazar, kart eşler/bırakır, kilitler; ara sıra geçersiz hedef ya da kart dener. */
export const kendimBot: GameBot = {
  durationMs: KENDIM_DURATION_MS,
  burstJitterMs: [100, 1_500, 6_000],
  generate: (rng, playerId, publicView, privateView, connected): KendimAction => {
    const pub = publicView as Pub | null;
    const priv = privateView as Priv | null;
    const roll = rng.int(100);
    if (roll < 12) return { kind: "lock" };
    const word = WORDS[rng.int(WORDS.length)] as string;
    if ((pub?.stage ?? "write") === "write" || roll >= 96) {
      return { kind: "write", text: rng.int(6) === 0 ? "  ağaç   ev " : word };
    }
    const cards = priv?.cards ?? [];
    const pool = (pub?.owners ?? connected).filter((id) => id !== playerId);
    const card = cards[rng.int(Math.max(1, cards.length))]?.id ?? rng.int(8);
    if (roll < 22) return { kind: "match", card, target: null };
    if (roll < 26) return { kind: "match", card, target: playerId };
    if (roll < 29) return { kind: "match", card: 99, target: pool[0] ?? "ghost" };
    return { kind: "match", card, target: pool[rng.int(Math.max(1, pool.length))] ?? "ghost" };
  },
};
