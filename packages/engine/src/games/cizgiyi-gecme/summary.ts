import { fit, names, num, rec, type Summarize } from "../summary.js";

/** Çizgiyi Geçme: tek kalanların en yükseği. */
export const summarizeCizgiyiGecme: Summarize = (_result, players, publicView) => {
  const reveal = rec(rec(publicView).reveal);
  const status = rec(reveal.status);
  if (Object.keys(status).length === 0) return null;
  const first = Object.keys(status).filter((id) => status[id] === "first");
  const top = first[0];
  if (top === undefined) return "Tek kalan olmadı; kimse puan almadı";
  const choice = num(rec(reveal.choices)[top]);
  return fit(`${names(players, first)} ${choice === undefined ? "" : `${choice} ile `}çizgiyi en yüksekten geçti`);
};
