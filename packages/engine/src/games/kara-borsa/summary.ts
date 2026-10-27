import { leadLine, list, rec, str, type Summarize } from "../summary.js";

/** Kara Borsa: en çok kutu alan. */
export const summarizeKaraBorsa: Summarize = (_result, players, publicView) => {
  const raw = rec(publicView).history;
  if (!Array.isArray(raw)) return null;
  const history = list(raw);
  const boxes: Record<string, number> = {};
  for (const round of history) {
    const winner = str(rec(round).winner);
    if (winner !== undefined) boxes[winner] = (boxes[winner] ?? 0) + 1;
  }
  return (
    leadLine(boxes, players, (v) => `${v} kutu alarak`, "turun yıldızı", "başa baş gitti") ??
    "Kimse kutu alamadı"
  );
};
