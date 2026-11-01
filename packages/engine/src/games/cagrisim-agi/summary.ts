import { fit, list, rec, type Summarize, str, strList } from "../summary.js";

/** Çağrışım Ağı: üç kelimenin en kalabalık ağı (eşitlikte ilk kelime). */
export const summarizeCagrisimAgi: Summarize = (_result, _players, publicView) => {
  const results = rec(publicView).results;
  if (!Array.isArray(results) || results.length === 0) return null;
  let best: { text: string; size: number } | null = null;
  for (const r of list(results)) {
    const reveal = rec(rec(r).reveal);
    if (!Array.isArray(reveal.groups)) return null;
    const top = rec(list(reveal.groups)[0]);
    const text = str(top.text);
    const size = strList(top.members).length;
    if (text !== undefined && size >= 2 && (!best || size > best.size)) best = { text, size };
  }
  if (!best) return "Kimse aynı cevabı vermedi";
  const shown = Array.from(best.text).slice(0, 18).join("");
  return fit(`“${shown}” cevabında ${best.size} kişi buluştu`);
};
