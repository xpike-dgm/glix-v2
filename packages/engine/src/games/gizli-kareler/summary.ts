import { leadLine, numRec, rec, type Summarize } from "../summary.js";

/** Gizli Kareler: açılan sonuçlardan en çok puan toplayan. */
export const summarizeGizliKareler: Summarize = (result, players, publicView) => {
  const points = numRec(rec(publicView).points);
  const scores = Object.keys(points).length > 0 ? points : result.miniScores;
  return (
    leadLine(scores, players, (v) => `${v} puanla`, "karelerde önde", "karelerde başa baş") ??
    "Kimse tek başına kare tutamadı"
  );
};
