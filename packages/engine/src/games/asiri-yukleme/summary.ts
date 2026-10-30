import { fit, list, names, num, rec, type Summarize } from "../summary.js";

/** Aşırı Yükleme: barı kim(ler) patlattı. */
export const summarizeAsiriYukleme: Summarize = (_result, players, publicView) => {
  const reveal = rec(rec(publicView).reveal);
  if (Object.keys(reveal).length === 0) return null;
  const exploders = list(reveal.exploders).filter((id): id is string => typeof id === "string" && id !== "");
  if (exploders.length > 0) return fit(`${names(players, exploders)} barı patlattı`);
  return (num(reveal.total) ?? 0) >= 100 ? "Bar patlamadan 100'e ulaştı" : "Bar dolmadan süre bitti";
};
