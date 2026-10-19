import type { GameBot } from "../../testing/simulate.js";
import { YAZI_YAZ_DURATION_MS, YAZI_YAZ_INNOCENT_WORD, type YaziYazAction } from "./types.js";

const WORDS = ["Kedi", "ELMA", "deniz", "güneş", "Işık", "çay", "ev", "bulut"];

interface Pub {
  stage?: string;
}
interface Priv {
  role?: string | null;
  myText?: string | null;
}

/** Aşamaya uygun eylemler üretir; ara sıra yanlış aşama, masumun yanlış girişi ve kendine tahmin dener. */
export const yaziYazBot: GameBot = {
  durationMs: YAZI_YAZ_DURATION_MS,
  burstJitterMs: [100, 1_500, 6_000],
  generate: (rng, playerId, publicView, privateView, connected): YaziYazAction => {
    const stage = (publicView as Pub | null)?.stage ?? "write";
    const priv = privateView as Priv | null;
    const roll = rng.int(100);
    const others = connected.filter((id) => id !== playerId);
    const word = WORDS[rng.int(WORDS.length)] as string;
    if (roll < 8) return { kind: "skip" };
    if (roll < 20) return { kind: "lock" };
    if (stage === "guess" || stage === "reveal" || roll >= 94) {
      const pick = roll < 30 ? playerId : (others[rng.int(others.length)] ?? "ghost");
      if (roll % 2 === 0) return { kind: "guessPlayer", target: pick };
      return { kind: "guessWord", text: rng.int(5) === 0 ? "" : word };
    }
    if (priv?.role === "writer") return { kind: "write", text: rng.int(6) === 0 ? "  ağaç   ev " : word };
    // Masum: çoğunlukla MASUM; ara sıra küçük harf/boşluklu hâli ya da yanlış giriş.
    const style = rng.int(10);
    if (style === 0) return { kind: "write", text: word };
    if (style === 1) return { kind: "write", text: " masum " };
    return { kind: "write", text: YAZI_YAZ_INNOCENT_WORD };
  },
};
