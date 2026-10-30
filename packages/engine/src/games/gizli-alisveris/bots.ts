import type { ActionGenerator, GameBot } from "../../testing/simulate.js";
import { ALISVERIS_DURATION_MS, ALISVERIS_POOL_SIZE, ALISVERIS_SHOP_MS } from "./types.js";

/** Raftaki ürün numaraları (ortak görünümden); okunamazsa havuzun tamamı. */
function shelfIds(publicView: unknown): number[] {
  const products = (publicView as { products?: unknown } | null)?.products;
  if (!Array.isArray(products)) return Array.from({ length: ALISVERIS_POOL_SIZE }, (_, i) => i);
  return products
    .map((p) => (p as { id?: unknown } | null)?.id)
    .filter((x): x is number => typeof x === "number");
}

/** Rastgele ürün ekler, bazen çıkarır, bazen raf dışı ya da aralık dışı numara yollar (reddedilmeli). */
const generate: ActionGenerator = (rng, _playerId, publicView, privateView) => {
  const basket = (privateView as { basket?: unknown } | null)?.basket;
  const mine = Array.isArray(basket) ? basket.filter((x): x is number => typeof x === "number") : [];
  const shelf = shelfIds(publicView);
  const roll = rng.int(10);
  if (rng.int(14) === 0) return { kind: "lock" };
  if (roll === 0) return { kind: "add", product: ALISVERIS_POOL_SIZE + rng.int(3) };
  if (roll === 1) return { kind: "add", product: rng.int(ALISVERIS_POOL_SIZE) };
  if (roll <= 3 && mine.length > 0) return { kind: "remove", product: mine[rng.int(mine.length)] };
  if (roll === 4) return { kind: "remove", product: rng.int(ALISVERIS_POOL_SIZE) };
  return { kind: "add", product: shelf[rng.int(Math.max(1, shelf.length))] ?? 0 };
};

export const gizliAlisverisBot: GameBot = {
  durationMs: ALISVERIS_DURATION_MS,
  burstJitterMs: [60, 300, Math.round(ALISVERIS_SHOP_MS / 10)],
  generate,
};
