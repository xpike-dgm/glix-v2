import { fit, nick, num, rec, str, type Summarize } from "../summary.js";

/** Kör Bomba: bomba kimin elinde patladı. */
export const summarizeKorBomba: Summarize = (_result, players, publicView) => {
  const pv = rec(publicView);
  const holder = str(pv.holder);
  if (pv.exploded !== true || holder === undefined) return null;
  const passes = num(pv.passes) ?? 0;
  const who = nick(players, holder);
  return fit(passes > 0 ? `Bomba ${who} elinde, ${passes} pasın ardından patladı` : `Bomba ${who} elinde patladı`);
};
