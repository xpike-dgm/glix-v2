import { fit, names, rec, type Summarize, strList } from "../summary.js";

/** Zehirli Kadeh: zehirli kadehte kalanlar. */
export const summarizeZehirliKadeh: Summarize = (_result, players, publicView) => {
  const result = rec(rec(publicView).result);
  if (!Array.isArray(result.poisoned)) return null;
  const poisoned = strList(result.poisoned);
  if (poisoned.length === 0) return "Kimse zehirli kadehte kalmadı";
  return fit(`${names(players, poisoned)} zehirli kadehte kaldı`);
};
