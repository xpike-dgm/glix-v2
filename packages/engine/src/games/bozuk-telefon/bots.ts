import type { ActionGenerator, GameBot } from "../../testing/simulate.js";
import { randomStroke } from "../drawing-bot.js";
import { BOZUK_MAX_DURATION_MS, type BozukStep } from "./types.js";

const WORDS = [
  "KEDİ",
  "BALON",
  "ŞEMSİYE",
  "UZAYLI",
  "PASTA",
  "ROBOT",
  "DENİZ",
  "BİSİKLET",
  "KAPLUMBAĞA",
  "TREN",
  "ÇİÇEK",
  "GÖKKUŞAĞI",
];

interface PublicLike {
  phase?: unknown;
  step?: unknown;
  reveal?: { stage?: unknown; steps?: BozukStep[] } | null;
}

/** Her (yazar, adım) çifti için ayırt edici bir kuyruk simgesi: farklı zincirlerdeki cümleler birbirinin alt dizgisi olmaz. */
const tag = (playerId: string, step: number): string => `${playerId.toUpperCase()}S${step}`;

/**
 * Yazmada cümle (arada sınır uzunluk), çizimde darbe / geri al / temizle, oylamada başka birinin adımına oy;
 * her aşamada ara sıra "Tamam".
 */
export const generate: ActionGenerator = (rng, playerId, publicView) => {
  const pub = (publicView ?? {}) as PublicLike;
  if (pub.phase === "reveal") {
    const reveal = pub.reveal;
    if (reveal?.stage === "vote" && Array.isArray(reveal.steps)) {
      const options = reveal.steps.map((s, i) => ({ s, i })).filter((x) => x.s.author !== playerId);
      // Ara sıra kendi adımına da dener (reddedilmeli).
      const pool = rng.int(10) === 0 ? reveal.steps.map((s, i) => ({ s, i })) : options;
      const pick = pool[rng.int(pool.length)];
      if (pick) return { kind: "vote", step: pick.i };
    }
    return { kind: "vote", step: rng.int(6) };
  }
  if (rng.int(25) === 0) return { kind: "lock" };
  const step = typeof pub.step === "number" ? pub.step : 0;
  if (pub.phase === "write") {
    const roll = rng.int(20);
    if (roll === 0)
      return { kind: "text", text: `${"A".repeat(40)} ${tag(playerId, step)} ${"B".repeat(10)}` };
    const words = `${WORDS[rng.int(WORDS.length)]} ${WORDS[rng.int(WORDS.length)]}`;
    return { kind: "text", text: `${words} ${tag(playerId, step)}`.toLocaleLowerCase("tr-TR") };
  }
  const roll = rng.int(30);
  if (roll === 0) return { kind: "clear" };
  if (roll <= 3) return { kind: "undo" };
  return randomStroke(rng);
};

export const bozukTelefonBot: GameBot = {
  durationMs: BOZUK_MAX_DURATION_MS,
  burstJitterMs: [100, 700, 2_000],
  generate,
};
