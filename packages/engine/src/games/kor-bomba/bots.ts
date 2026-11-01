import type { ActionGenerator, GameBot } from "../../testing/simulate.js";
import { KOR_BOMBA_FUSE_CAP_MS, KOR_BOMBA_OUTRO_MS } from "./types.js";

/** Bir oyunda botun yapacağı en çok pas. */
const MAX_BOT_PASSES = 8;

const isRec = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Çoğunlukla bağlı birine pas verir (kilitteyse, geri pasta ya da taşıyıcı değilse reddedilir); bazen kendine verir
 * (reddedilir). Taşıyıcı olmayanlar bazen tek "PATLAR!" bahsini dener (ikincisi reddedilir).
 */
const generate: ActionGenerator = (rng, playerId, publicView, _privateView, connected) => {
  const pub = isRec(publicView) ? publicView : {};
  const passes = typeof pub.passes === "number" ? pub.passes : 0;
  const targets = connected.filter((id) => id !== playerId);
  const roll = rng.next();
  if (typeof pub.holder === "string" && pub.holder !== playerId && roll > 0.6) {
    return { kind: "bet", turn: passes };
  }
  if (passes >= MAX_BOT_PASSES || targets.length === 0 || roll < 0.1) return { kind: "pass", to: playerId };
  return { kind: "pass", to: targets[rng.int(targets.length)] };
};

export const korBombaBot: GameBot = {
  // BM-M2: fitil oyunun başından 45 sn'yi geçemez.
  durationMs: KOR_BOMBA_FUSE_CAP_MS + KOR_BOMBA_OUTRO_MS,
  burstJitterMs: [40, 400, 1500],
  generate,
};
