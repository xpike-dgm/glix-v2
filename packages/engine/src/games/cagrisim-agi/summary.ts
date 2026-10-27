import { fit, list, rec, type Summarize, str, strList } from "../summary.js";

/** Çağrışım Ağı: en kalabalık küme. */
export const summarizeCagrisimAgi: Summarize = (_result, _players, publicView) => {
  const reveal = rec(rec(publicView).reveal);
  if (!Array.isArray(reveal.groups)) return null;
  const top = rec(list(reveal.groups)[0]);
  const text = str(top.text);
  const size = strList(top.members).length;
  if (text === undefined || size < 2) return "Kimse aynı cevabı vermedi";
  const shown = Array.from(text).slice(0, 18).join("");
  return fit(`“${shown}” cevabında ${size} kişi buluştu`);
};
