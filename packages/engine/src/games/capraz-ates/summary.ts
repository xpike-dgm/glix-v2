import { fit, list, nick, rec, strList, type Summarize } from "../summary.js";

/** Çapraz Ateş: karşılıklı hedefleşen çiftler. */
export const summarizeCaprazAtes: Summarize = (_result, players, publicView) => {
  const reveal = rec(rec(publicView).reveal);
  if (!Array.isArray(reveal.mutual)) return null;
  const pairs = list(reveal.mutual).map(strList);
  const [a, b] = pairs[0] ?? [];
  if (a === undefined || b === undefined) return "Karşılıklı hedefleşme olmadı";
  if (pairs.length === 1) return fit(`${nick(players, a)} ile ${nick(players, b)} birbirini hedef aldı`);
  return `${pairs.length} çift birbirini hedef aldı`;
};
