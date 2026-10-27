import { decimal, fit, nick, num, rec, type Summarize, strList } from "../summary.js";

/** Ortalamaya En Yakın: hedef ve ona en yakın seçim. */
export const summarizeOrtalamaninYarisi: Summarize = (_result, players, publicView) => {
  const reveal = rec(rec(publicView).reveal);
  const target = num(reveal.target);
  const closest = strList(reveal.order)[0];
  if (target === undefined || closest === undefined) return null;
  const choice = num(rec(reveal.choices)[closest]);
  return fit(
    `Hedef ${decimal(target)}; en yakın ${nick(players, closest)}${choice === undefined ? "" : ` (${choice})`}`,
  );
};
