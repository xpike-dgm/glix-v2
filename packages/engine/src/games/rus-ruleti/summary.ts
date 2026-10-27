import { fit, nick, rec, strList, type Summarize } from "../summary.js";

/** Rus Ruleti: kaç kişi elendi, kim kaldı. */
export const summarizeRusRuleti: Summarize = (_result, players, publicView) => {
  const result = rec(rec(publicView).result);
  if (!Array.isArray(result.survivors)) return null;
  const survivors = strList(result.survivors);
  const eliminated = strList(result.eliminated);
  const [only] = survivors;
  if (eliminated.length === 0) return "Kimse elenmedi";
  if (survivors.length === 1 && only !== undefined) return fit(`${nick(players, only)} son hayatta kalan oldu`);
  return `${eliminated.length} kişi elendi, ${survivors.length} kişi kurtuldu`;
};
