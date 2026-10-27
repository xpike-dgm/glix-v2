import { rec, type Summarize } from "../summary.js";

/** Kontrol Paneli Kaosu: doğru kesilen panel sayısı. */
export const summarizeKontrolPaneliKaosu: Summarize = (_result, _players, publicView) => {
  const rows = Object.values(rec(rec(rec(publicView).reveal).rows)).map(rec);
  if (rows.length === 0) return null;
  const ok = rows.filter((r) => r.correct === true).length;
  return `${rows.length} panelin ${ok} tanesi doğru kesildi`;
};
