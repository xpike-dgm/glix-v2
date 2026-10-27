import { leadLine, list, names, numRec, rec, type Summarize, str } from "../summary.js";

/** Laf Sokma Düellosu: Laf Ustası olanlar, yoksa en çok puan. */
export const summarizeLafSokma: Summarize = (result, players, publicView) => {
  const pv = rec(publicView);
  const duels = [...list(pv.history), pv.reveal];
  const masters: string[] = [];
  for (const duel of duels) {
    for (const card of list(rec(duel).cards).map(rec)) {
      const author = str(card.author);
      if (card.master === true && author !== undefined && !masters.includes(author)) masters.push(author);
    }
  }
  if (masters.length > 0) return `${names(players, masters)} Laf Ustası oldu`;
  const pvScores = numRec(pv.scores);
  const scores = Object.keys(pvScores).length > 0 ? pvScores : result.miniScores;
  return leadLine(scores, players, (v) => `${v} puanla`, "lafı gediğine koydu", "düelloyu paylaştı");
};
