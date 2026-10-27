import { fit, nick, rec, str, type Summarize } from "../summary.js";

/** Karalama Defteri: bilgisiz oyuncu yakalandı mı. */
export const summarizeKaralamaDefteri: Summarize = (_result, players, publicView) => {
  const reveal = rec(rec(publicView).reveal);
  const outsider = str(reveal.outsider);
  if (outsider === undefined) return null;
  const who = nick(players, outsider);
  return fit(reveal.caught === true ? `${who} bilgisizdi ve yakalandı` : `${who} bilgisizdi, kimse anlamadı`);
};
