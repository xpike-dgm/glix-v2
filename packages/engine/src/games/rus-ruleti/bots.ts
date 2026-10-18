import type { ActionGenerator, GameBot } from "../../testing/simulate.js";
import { RUS_RULETI_DECISION_MS, RUS_RULETI_OPEN_MS, type RusRuletiPublicView } from "./types.js";

const isRec = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Çoğunlukla bağlı bir hayatta oyuncuyu hedefler; bazen kendini, bazen elenmiş ya da bağlantısı kopuk birini
 * (bunlar reddedilir). Silah sahibi değilse eylem reddedilir.
 */
const generate: ActionGenerator = (rng, playerId, publicView, _privateView, connected) => {
  const pub = isRec(publicView) ? (publicView as unknown as Partial<RusRuletiPublicView>) : {};
  const alive = Array.isArray(pub.alive) ? pub.alive.filter((x): x is string => typeof x === "string") : [];
  const roll = rng.next();
  if (roll < 0.15) return { kind: "shoot", target: playerId };
  if (roll < 0.2) return { kind: "shoot", target: "kimse" };
  const pool = alive.filter((id) => id !== playerId && connected.includes(id));
  if (pool.length === 0) return { kind: "shoot", target: playerId };
  return { kind: "shoot", target: pool[rng.int(pool.length)] };
};

/**
 * Üst sınır: en kötü durumda her atış tam süreyle (20,5 sn) çözülür. 8 oyuncu 4 patlama ister;
 * riskin %76'da kalması bile birkaç atışta patlama getirir, bu pay bunu fazlasıyla karşılar.
 */
export const rusRuletiBot: GameBot = {
  durationMs: 40 * (RUS_RULETI_DECISION_MS + RUS_RULETI_OPEN_MS),
  burstJitterMs: [40, 400, 2_000],
  generate,
};
