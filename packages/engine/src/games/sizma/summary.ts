import { fit, nick, rec, type Summarize, str } from "../summary.js";

/** Sızma: sızan yakalandı mı (yakalandıysa kelimeyi çaldı mı). */
export const summarizeSizma: Summarize = (_result, players, publicView) => {
  const reveal = rec(rec(publicView).reveal);
  const infiltrator = str(reveal.infiltrator);
  if (infiltrator === undefined) return null;
  const who = nick(players, infiltrator);
  if (reveal.caught !== true) return fit(`${who} sızmaydı, kimse anlamadı`);
  return fit(
    rec(reveal.final).stole === true ? `${who} yakalandı ama kelimeyi çaldı` : `${who} sızmaydı ve yakalandı`,
  );
};
