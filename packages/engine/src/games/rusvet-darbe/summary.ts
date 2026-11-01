import { fit, nick, num, rec, type Summarize, str } from "../summary.js";

/** Rüşvet ve Darbe: başkan kim oldu (darbe tuttuysa tahtı devrildi). */
export const summarizeRusvetDarbe: Summarize = (_result, players, publicView) => {
  const pv = rec(publicView);
  const president = str(pv.president);
  if (president === undefined) return null;
  const reveal = rec(pv.reveal);
  const votes = num(rec(reveal.counts)[president]);
  const who = nick(players, president);
  if (rec(reveal.coup).success === true) return fit(`${who} başkan oldu, tahtı devrildi`);
  return fit(votes === undefined ? `${who} başkan oldu` : `${who} ${votes} oyla başkan oldu`);
};
