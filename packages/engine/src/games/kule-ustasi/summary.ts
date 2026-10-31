import { leadLine, numRec, rec, type Summarize } from "../summary.js";

/** Kule Ustası: en yüksek usta puanlı oyuncu (kat +1, kusursuz +2, ayakta kalan +3). */
export const summarizeKuleUstasi: Summarize = (result, players, publicView) => {
  const pvScores = numRec(rec(publicView).usta);
  const scores = Object.keys(pvScores).length > 0 ? pvScores : result.miniScores;
  return leadLine(scores, players, (v) => `${v} usta puanıyla`, "kulenin ustası", "kuleyi paylaştı");
};
