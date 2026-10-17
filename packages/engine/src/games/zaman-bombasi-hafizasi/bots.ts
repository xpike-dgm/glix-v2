import type { GameBot } from "../../testing/simulate.js";
import { ZAMAN_BOMBASI_BOT_SPAN_MS, ZAMAN_BOMBASI_COLORS, type ZamanBombasiAction } from "./types.js";

/**
 * Dizi giriş evresinde görünmediği için bot ezberleyemez: rastgele renk basar.
 * Çoğu sıra zaman aşımıyla veya yanlış basışla biter, ara sıra kısa bir dizi tesadüfen tutar.
 */
export const zamanBombasiHafizasiBot: GameBot = {
  durationMs: ZAMAN_BOMBASI_BOT_SPAN_MS,
  burstJitterMs: [0, 40, 400, 1500],
  generate: (rng): ZamanBombasiAction => ({
    kind: "press",
    color: ZAMAN_BOMBASI_COLORS[rng.int(ZAMAN_BOMBASI_COLORS.length)] ?? "kirmizi",
  }),
};
