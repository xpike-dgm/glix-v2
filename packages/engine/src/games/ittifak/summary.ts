import { leadLine, numRec, rec, type Summarize } from "../summary.js";

/** İttifak: en çok oy alan. */
export const summarizeIttifak: Summarize = (result, players, publicView) => {
  const votes = numRec(rec(rec(publicView).reveal).scores);
  const scores = Object.keys(votes).length > 0 ? votes : result.miniScores;
  return leadLine(scores, players, (v) => `${v} oyla`, "en çok seçilen oldu", "oyları paylaştı");
};
