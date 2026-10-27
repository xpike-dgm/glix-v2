import { fit, names, rec, type Summarize, strList } from "../summary.js";

/** Son Kişi: en son kaçan ve kaçamayanlar. */
export const summarizeSonKisi: Summarize = (_result, players, publicView) => {
  const result = rec(rec(publicView).result);
  if (!Array.isArray(result.last)) return null;
  const last = strList(result.last);
  const missed = strList(result.missed);
  if (last.length === 0) return missed.length > 0 ? "Kimse kaçamadı" : null;
  const line = `${names(players, last)} en son kaçtı`;
  return fit(missed.length > 0 ? `${line}, ${missed.length} kişi kaçamadı` : line);
};
