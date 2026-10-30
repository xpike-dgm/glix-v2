import { rec, type Summarize } from "../summary.js";

/** Kontrol Paneli Kaosu: üç dalgada doğru kesilen panel sayısı. */
export const summarizeKontrolPaneliKaosu: Summarize = (_result, _players, publicView) => {
  const results = rec(publicView).results;
  if (!Array.isArray(results) || results.length === 0) return null;
  const rows = results.flatMap((r) => Object.values(rec(rec(r).rows)).map(rec));
  if (rows.length === 0) return null;
  const ok = rows.filter((r) => r.correct === true).length;
  return `${results.length} dalgada ${rows.length} panelin ${ok} tanesi doğru kesildi`;
};
