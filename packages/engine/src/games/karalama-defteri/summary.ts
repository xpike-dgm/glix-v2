import { fit, nick, rec, type Summarize, str } from "../summary.js";

/** Karalama Defteri: bilgisiz oyuncu yakalandı mı, son şansta ana kelimeyi bildi mi (KD-M1). */
export const summarizeKaralamaDefteri: Summarize = (_result, players, publicView) => {
  const reveal = rec(rec(publicView).reveal);
  const outsider = str(reveal.outsider);
  if (outsider === undefined) return null;
  const who = nick(players, outsider);
  const guessed = rec(reveal.final).guessed === true;
  if (reveal.caught === true)
    return fit(guessed ? `${who} yakalandı ama kelimeyi bildi` : `${who} bilgisizdi ve yakalandı`);
  return fit(guessed ? `${who} kurtuldu, kelimeyi de bildi` : `${who} bilgisizdi, kimse anlamadı`);
};
