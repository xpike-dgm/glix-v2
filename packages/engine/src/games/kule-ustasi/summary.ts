import { leadLine, numRec, rec, type Summarize } from "../summary.js";

/** Kule Ustası: en yüksek puanlı (kalan ve kusursuz) oyuncu. */
export const summarizeKuleUstasi: Summarize = (result, players, publicView) => {
  const pvScores = numRec(rec(publicView).scores);
  const scores = Object.keys(pvScores).length > 0 ? pvScores : result.miniScores;
  return leadLine(scores, players, (v) => `${v} puanla`, "kulenin ustası", "kuleyi paylaştı");
};
