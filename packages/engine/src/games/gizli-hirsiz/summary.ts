import { fit, nick, rec, type Summarize, strList } from "../summary.js";

/** Gizli Hırsız: tek hırsız, çok hırsız ya da hırsızsız. */
export const summarizeGizliHirsiz: Summarize = (_result, players, publicView) => {
  const reveal = rec(rec(publicView).reveal);
  const thieves = strList(reveal.thieves);
  const first = thieves[0];
  if (reveal.outcome === "solo" && first !== undefined) {
    return fit(`${nick(players, first)} tek hırsız olarak sıyrıldı`);
  }
  if (reveal.outcome === "multi") return `${thieves.length} hırsız birbirini yakalattı`;
  if (reveal.outcome === "none") return "Kimse çalmaya cesaret edemedi";
  return null;
};
