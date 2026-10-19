import type { ActionGenerator, GameBot } from "../../testing/simulate.js";
import { ALISVERIS_DURATION_MS, ALISVERIS_SHOP_MS } from "./types.js";

/** Rastgele ürün ekler, bazen çıkarır, bazen aralık dışı numara yollar (reddedilmeli). */
const generate: ActionGenerator = (rng, _playerId, _publicView, privateView) => {
  const basket = (privateView as { basket?: unknown } | null)?.basket;
  const mine = Array.isArray(basket) ? basket.filter((x): x is number => typeof x === "number") : [];
  const roll = rng.int(10);
  if (rng.int(14) === 0) return { kind: "lock" };
  if (roll === 0) return { kind: "add", product: 12 + rng.int(3) };
  if (roll <= 3 && mine.length > 0) return { kind: "remove", product: mine[rng.int(mine.length)] };
  if (roll === 4) return { kind: "remove", product: rng.int(12) };
  return { kind: "add", product: rng.int(12) };
};

export const gizliAlisverisBot: GameBot = {
  durationMs: ALISVERIS_DURATION_MS,
  burstJitterMs: [60, 300, Math.round(ALISVERIS_SHOP_MS / 10)],
  generate,
};
