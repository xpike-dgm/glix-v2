import { fit, list, nick, rec, type Summarize, strList } from "../summary.js";

/** Çapraz Ateş: final turunda (yoksa son açılan turda) karşılıklı hedefleşen çiftler. */
export const summarizeCaprazAtes: Summarize = (_result, players, publicView) => {
  const rounds = list(rec(publicView).rounds);
  const last = rec(rounds[rounds.length - 1]);
  if (!Array.isArray(last.mutual)) return null;
  const pairs = list(last.mutual).map(strList);
  const [a, b] = pairs[0] ?? [];
  if (a === undefined || b === undefined) return "Karşılıklı hedefleşme olmadı";
  if (pairs.length === 1) return fit(`${nick(players, a)} ile ${nick(players, b)} birbirini hedef aldı`);
  return `${pairs.length} çift birbirini hedef aldı`;
};
