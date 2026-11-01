import type { ActionGenerator, GameBot } from "../../testing/simulate.js";
import { ACGOZLULUK_CHOOSE_MS, ACGOZLULUK_DURATION_MS } from "./types.js";

const rec = (pub: unknown): Record<string, unknown> =>
  typeof pub === "object" && pub !== null ? (pub as Record<string, unknown>) : {};
const numOr = (v: unknown, d: number): number => (typeof v === "number" && Number.isFinite(v) ? v : d);

/** Çoğunlukla adil paya yakın, bazen açgözlü (üst sınır), bazen 0, nadiren aralık dışı sayı seçer; arada kilitler. */
const generate: ActionGenerator = (rng, _playerId, publicView) => {
  const pub = rec(publicView);
  const max = numOr(pub.maxChoice, 3);
  const band = rec(pub.band);
  const mid = (numOr(band.low, 6) + numOr(band.high, 6)) / 2;
  const share = mid / Math.max(1, max);
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
  // Oyun 3 tur sürer (seçim + açılışlar).
  durationMs: ACGOZLULUK_DURATION_MS,
  burstJitterMs: [60, 300, Math.round(ACGOZLULUK_CHOOSE_MS / 10)],
  generate,
};
