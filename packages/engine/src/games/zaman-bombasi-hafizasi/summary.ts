import { leadLine, numRec, rec, type Summarize } from "../summary.js";

/** Zaman Bombası Hafızası: dizileri en çok doğru tamamlayan. */
export const summarizeZamanBombasiHafizasi: Summarize = (result, players, publicView) => {
  const pvScores = numRec(rec(publicView).scores);
  const scores = Object.keys(pvScores).length > 0 ? pvScores : result.miniScores;
  return leadLine(scores, players, (v) => `${v} puanla`, "hafızada önde", "hafızada başa baş");
};
