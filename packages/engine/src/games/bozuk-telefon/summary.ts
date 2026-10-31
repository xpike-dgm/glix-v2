import { leadLine, numRec, rec, type Summarize } from "../summary.js";

/** Bozuk Telefon: kahkaha puanında (oy + sağlam zincir) önde olan. */
export const summarizeBozukTelefon: Summarize = (result, players, publicView) => {
  const pvScores = numRec(rec(publicView).scores);
  const scores = Object.keys(pvScores).length > 0 ? pvScores : result.miniScores;
  return leadLine(
    scores,
    players,
    (v) => `${v} kahkahayla`,
    "en komik zincirlerin sahibi",
    "zincir oylarını paylaştı",
  );
};
