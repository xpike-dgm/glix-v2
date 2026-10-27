import type { ActionGenerator, GameBot } from "../../testing/simulate.js";
import { KOR_BOMBA_MAX_BONUS_MS, KOR_BOMBA_MAX_FUSE_MS, KOR_BOMBA_OUTRO_MS } from "./types.js";

/** Bir oyunda botun yapacağı en çok pas; süre üst sınırını sabit tutar. */
const MAX_BOT_PASSES = 6;

const isRec = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Çoğunlukla bağlı birine pas verir (taşıyıcı değilse reddedilir); bazen kendine verir (reddedilir). */
const generate: ActionGenerator = (rng, playerId, publicView, _privateView, connected) => {
  const pub = isRec(publicView) ? publicView : {};
  const passes = typeof pub.passes === "number" ? pub.passes : 0;
  const targets = connected.filter((id) => id !== playerId);
  const roll = rng.next();
  // Taşıyıcı olmayanlar çoğunlukla tahmin dener (yinelenen tahmin reddedilir).
  if (typeof pub.holder === "string" && pub.holder !== playerId && roll > 0.45) {
    return { kind: "predict", turn: passes, explodes: rng.next() < 0.5 };
  }
  if (passes >= MAX_BOT_PASSES || targets.length === 0 || roll < 0.1) return { kind: "pass", to: playerId };
  return { kind: "pass", to: targets[rng.int(targets.length)] };
};

export const korBombaBot: GameBot = {
  durationMs: KOR_BOMBA_MAX_FUSE_MS + MAX_BOT_PASSES * KOR_BOMBA_MAX_BONUS_MS + KOR_BOMBA_OUTRO_MS,
  burstJitterMs: [40, 400, 1500],
  generate,
};
