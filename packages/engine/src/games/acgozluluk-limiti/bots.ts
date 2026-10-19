import type { ActionGenerator, GameBot } from "../../testing/simulate.js";
import { ACGOZLULUK_CHOOSE_MS, ACGOZLULUK_DURATION_MS } from "./types.js";

const maxOf = (pub: unknown): number => {
  const m = (pub as { maxChoice?: unknown } | null)?.maxChoice;
  return typeof m === "number" && Number.isFinite(m) ? m : 3;
};
const limitOf = (pub: unknown): number => {
  const m = (pub as { limit?: unknown } | null)?.limit;
  return typeof m === "number" && Number.isFinite(m) ? m : 6;
};

/** Çoğunlukla adil paya yakın, bazen açgözlü (üst sınır), bazen 0, nadiren aralık dışı sayı seçer. */
const generate: ActionGenerator = (rng, _playerId, publicView) => {
  const max = maxOf(publicView);
  const share = limitOf(publicView) / Math.max(1, max);
  if (rng.int(12) === 0) return { kind: "lock" };
  const roll = rng.int(10);
  let value: number;
  if (roll === 0) value = 0;
  else if (roll === 1) value = max;
  else if (roll === 2)
    value = max + 1; // aralık dışı: reddedilmeli
  else value = Math.round(share) + rng.int(3) - 1;
  return { kind: "choose", value: Math.max(0, value) };
};

export const acgozlulukLimitiBot: GameBot = {
  // Oyun, seçim süresi + sonuç süresi kadar sürer.
  durationMs: ACGOZLULUK_DURATION_MS,
  burstJitterMs: [60, 300, Math.round(ACGOZLULUK_CHOOSE_MS / 10)],
  generate,
};
