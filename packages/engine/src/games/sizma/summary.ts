import { fit, nick, rec, str, type Summarize } from "../summary.js";

/** Sızma: sızan yakalandı mı. */
export const summarizeSizma: Summarize = (_result, players, publicView) => {
  const reveal = rec(rec(publicView).reveal);
  const infiltrator = str(reveal.infiltrator);
  if (infiltrator === undefined) return null;
  const who = nick(players, infiltrator);
  return fit(reveal.caught === true ? `${who} sızmaydı ve yakalandı` : `${who} sızmaydı, kimse anlamadı`);
};
