import type { ActionGenerator, GameBot } from "../../testing/simulate.js";
import { KARELER_DURATION_MS, KARELER_STAGE_MS } from "./types.js";

const sizeOf = (pub: unknown): number => {
  const s = (pub as { size?: unknown } | null)?.size;
  return typeof s === "number" && Number.isInteger(s) && s > 0 ? s : 3;
};

/** Çoğunlukla geçerli bir hücre, bazen ızgara dışı sayı (reddedilmeli); sık sık fikir değiştirir. */
const generate: ActionGenerator = (rng, _playerId, publicView) => {
  const cells = sizeOf(publicView) ** 2;
  if (rng.int(12) === 0) return { kind: "pick", cell: cells + rng.int(4) };
  return { kind: "pick", cell: rng.int(cells) };
};

export const gizliKarelerBot: GameBot = {
  durationMs: KARELER_DURATION_MS,
  burstJitterMs: [60, 300, Math.round(KARELER_STAGE_MS / 10)],
  generate,
};
