import { fit, nick, num, rec, type Summarize, str } from "../summary.js";

/** Aşırı Yükleme: barı kim patlattı. */
export const summarizeAsiriYukleme: Summarize = (_result, players, publicView) => {
  const reveal = rec(rec(publicView).reveal);
  if (Object.keys(reveal).length === 0) return null;
  const exploder = str(reveal.exploder);
  if (exploder !== undefined) return fit(`${nick(players, exploder)} barı patlattı`);
  return (num(reveal.total) ?? 0) >= 100 ? "Bar patlamadan 100'e ulaştı" : "Bar dolmadan süre bitti";
};
