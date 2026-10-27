import { leadLine, numRec, rec, type Summarize } from "../summary.js";

/** Kendim: en çok doğru eşleştirme puanı. */
export const summarizeKendim: Summarize = (result, players, publicView) => {
  const mini = numRec(rec(rec(publicView).reveal).scores);
  const scores = Object.keys(mini).length > 0 ? mini : result.miniScores;
  return leadLine(scores, players, (v) => `${v} puanla`, "herkesi en iyi tanıdı", "tanıma yarışını paylaştı");
};
