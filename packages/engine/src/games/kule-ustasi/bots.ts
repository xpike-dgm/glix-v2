import type { GameBot } from "../../testing/simulate.js";
import { KULE_BOT_SPAN_MS, type KuleAction } from "./types.js";

/**
 * Bot rastgele bir anda bırakır: sunucu `at`'ı doğrulayamazsa kendi saatini kullanır, yani bot
 * zamanlamayı bilmeden dokunan oyuncu gibi davranır (bazen oturur, çoğu zaman keser ya da ıskalar).
 */
export const kuleUstasiBot: GameBot = {
  durationMs: KULE_BOT_SPAN_MS,
  burstJitterMs: [0, 40, 400, 1500],
  generate: (rng, _playerId, publicView): KuleAction => {
    const turnStart =
      typeof publicView === "object" && publicView !== null && "turnStart" in publicView
        ? Number((publicView as { turnStart: unknown }).turnStart)
        : 0;
    return { kind: "drop", at: Number.isFinite(turnStart) ? turnStart + rng.int(300) : 0 };
  },
};
