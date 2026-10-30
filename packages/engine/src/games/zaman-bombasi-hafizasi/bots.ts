import type { GameBot } from "../../testing/simulate.js";
import { ZAMAN_BOMBASI_BOT_SPAN_MS, ZAMAN_BOMBASI_COLORS, type ZamanBombasiAction } from "./types.js";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

/**
 * Dizi giriş evresinde görünmediği için bot ezberleyemez: rastgele renk basar. Çoğu sıra zaman aşımıyla veya
 * yanlış basışla biter, ara sıra kısa bir dizi tesadüfen tutar. Seçim sırası kendisindeyse bazen renk/hedef seçer
 * (bazen hiç seçmez: sunucu süre dolunca rastgele seçer).
 */
export const zamanBombasiHafizasiBot: GameBot = {
  durationMs: ZAMAN_BOMBASI_BOT_SPAN_MS,
  burstJitterMs: [0, 40, 400, 1500],
  generate: (rng, playerId, publicView): ZamanBombasiAction => {
    const color = ZAMAN_BOMBASI_COLORS[rng.int(ZAMAN_BOMBASI_COLORS.length)] ?? "kirmizi";
    const pv = isRec(publicView) ? publicView : {};
    const pick = isRec(pv.pick) ? pv.pick : null;
    if (pick && pick.by === playerId && rng.int(3) > 0) {
      if (pick.colorDone !== true) return { kind: "color", color };
      const out = strings(pv.eliminated);
      const options = strings(pv.order).filter(
        (id) => id !== playerId && id !== pick.blocked && !out.includes(id),
      );
      const target = options[rng.int(Math.max(1, options.length))];
      if (target !== undefined) return { kind: "target", target };
    }
    return { kind: "press", color };
  },
};
