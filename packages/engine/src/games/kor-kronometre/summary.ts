import { decimal, fit, list, names, num, rec, type Summarize, str } from "../summary.js";

/** Kör Kronometre: üç elin toplamında kazanan(lar) ve oyunun en yakın basışı. */
export const summarizeKorKronometre: Summarize = (_result, players, publicView) => {
  const pub = rec(publicView);
  const final = rec(pub.final);
  if (!Array.isArray(final.standings)) return null;
  const standings = list(final.standings).map(rec);
  // En yakın basış (bütün eller).
  let best: number | undefined;
  for (const hand of list(pub.played).map(rec)) {
    for (const e of list(rec(hand.reveal).entries).map(rec)) {
      const d = num(e.distance);
      if (e.pressed === true && d !== undefined && (best === undefined || d < best)) best = d;
    }
  }
  const top = standings.filter((s) => s.rank === 1 && (num(s.total) ?? 0) > 0);
  const total = num(top[0]?.total);
  if (top.length === 0 || total === undefined) return "Kimse basmadı";
  const ids = top.map((s) => str(s.playerId)).filter((id): id is string => id !== undefined);
  const tail = best === undefined ? "" : ` · en yakın ${decimal(best / 1000, 2)} sn`;
  return fit(`${names(players, ids)} ${total} el puanıyla kazandı${tail}`);
};
