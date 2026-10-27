import { fit, leaders, nick, rec, type Summarize, str } from "../summary.js";

/** Sözlük Blöfü: en çok kişiyi kandıran sahte tanım; yoksa gerçek tanımı bulanlar. */
export const summarizeSozlukBlofu: Summarize = (_result, players, publicView) => {
  const reveal = rec(rec(publicView).reveal);
  const realCard = str(reveal.realCard);
  if (realCard === undefined) return null;
  const authors = rec(reveal.authors);
  const picks = Object.values(rec(reveal.picks)).filter((c): c is string => typeof c === "string");
  const fooled: Record<string, number> = {};
  for (const card of picks) {
    const author = str(authors[card]);
    if (author !== undefined) fooled[author] = (fooled[author] ?? 0) + 1;
  }
  const lead = leaders(fooled);
  const first = lead?.ids[0];
  if (lead && first !== undefined) {
    const who = lead.ids.length === 1 ? nick(players, first) : `${lead.ids.length} kişi`;
    return fit(`${who} ${lead.value} kişiyi kandırdı`);
  }
  const found = picks.filter((c) => c === realCard).length;
  return found > 0 ? `${found} kişi gerçek tanımı buldu` : "Kimse kimseyi kandıramadı";
};
