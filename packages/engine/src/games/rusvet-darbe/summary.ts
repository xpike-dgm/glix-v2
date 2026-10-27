import { fit, nick, num, rec, str, type Summarize } from "../summary.js";

/** Rüşvet ve Darbe: başkan kim oldu. */
export const summarizeRusvetDarbe: Summarize = (_result, players, publicView) => {
  const pv = rec(publicView);
  const president = str(pv.president);
  if (president === undefined) return null;
  const votes = num(rec(rec(pv.reveal).counts)[president]);
  const who = nick(players, president);
  return fit(votes === undefined ? `${who} başkan oldu` : `${who} ${votes} oyla başkan oldu`);
};
