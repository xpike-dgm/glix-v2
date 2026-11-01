import { fit, list, names, numRec, rec, type Summarize } from "../summary.js";

/** Açgözlülük Limiti: üç turun toplamında önde olan(lar) ve kasanın kaç kez taştığı. */
export const summarizeAcgozlulukLimiti: Summarize = (_result, players, publicView) => {
  const pv = rec(publicView);
  if (pv.final === null || pv.final === undefined) return null;
  const totals = numRec(pv.totals);
  const reveals = [...list(pv.history).map((h) => rec(rec(h).reveal)), rec(pv.reveal)];
  const overs = reveals.filter((r) => r.over === true).length;
  const top = Math.max(0, ...Object.values(totals));
  const spill = overs === 0 ? "kasa hiç taşmadı" : `kasa ${overs} kez taştı`;
  if (top <= 0) return fit(overs > 0 ? `Kimse puan alamadı; ${spill}` : "Kimse jeton koymadı");
  const ids = Object.keys(totals).filter((id) => totals[id] === top);
  return fit(`${names(players, ids)} ${top} jetonla önde · ${spill}`);
};
