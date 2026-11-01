import { fit, list, names, num, numRec, rec, type Summarize } from "../summary.js";

/** Çizgiyi Geçme: iki turun toplamında önde olan(lar) ve son turun en yüksek tek kalanı. */
export const summarizeCizgiyiGecme: Summarize = (_result, players, publicView) => {
  const pv = rec(publicView);
  if (pv.final === null || pv.final === undefined) return null;
  const totals = numRec(pv.totals);
  const top = Math.max(0, ...Object.values(totals));
  const reveals = [...list(pv.history).map(rec), rec(pv.reveal)];
  const crashes = reveals.reduce(
    (n, r) => n + Object.values(rec(r.status)).filter((s) => s === "crashed").length,
    0,
  );
  if (top <= 0) return fit(crashes > 0 ? "Herkes çarpıştı; kimse puan alamadı" : "Kimse sayı seçmedi");
  const ids = Object.keys(totals).filter((id) => totals[id] === top);
  const last = rec(pv.reveal);
  const status = rec(last.status);
  const winner = Object.keys(status).find((id) => status[id] === "first");
  const v = winner === undefined ? undefined : num(rec(last.choices)[winner]);
  const tail = winner !== undefined && v !== undefined ? ` · son tur ${names(players, [winner])} ${v}` : "";
  return fit(`${names(players, ids)} iki turda ${top} puanla önde${tail}`);
};
