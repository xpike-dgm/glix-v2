import { decimal, fit, list, names, num, rec, type Summarize, str } from "../summary.js";

/** Kör Kronometre: hedefe en yakın basış. */
export const summarizeKorKronometre: Summarize = (_result, players, publicView) => {
  const reveal = rec(rec(publicView).reveal);
  if (!Array.isArray(reveal.entries)) return null;
  const entries = list(reveal.entries).map(rec);
  const best = entries.filter((e) => e.rank === 1 && e.pressed === true);
  const first = best[0];
  if (first === undefined) return "Kimse basmadı";
  const distance = num(first.distance);
  const ids = best.map((e) => str(e.playerId)).filter((id): id is string => id !== undefined);
  if (distance === undefined) return null;
  return fit(`${names(players, ids)} hedefi ${decimal(distance / 1000, 2)} sn farkla tutturdu`);
};
