import { fit, list, names, num, rec, strList, type Summarize } from "../summary.js";
import { formatKredi } from "./types.js";

/** Gizli Alışveriş: en değerli sepet. */
export const summarizeGizliAlisveris: Summarize = (_result, players, publicView) => {
  const reveal = rec(rec(publicView).reveal);
  if (!Array.isArray(reveal.winners)) return null;
  const winners = strList(list(reveal.winners));
  const first = winners[0];
  if (first === undefined) return "Kimse değerli bir sepet kuramadı";
  const value = num(rec(reveal.values)[first]);
  if (value === undefined) return fit(`${names(players, winners)} en değerli sepeti kurdu`);
  return fit(`${names(players, winners)} ${formatKredi(value)} kredilik sepetle önde`);
};
