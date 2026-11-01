import { fit, list, names, num, rec, type Summarize, str } from "../summary.js";

/** Son Kişi: üç alarmın toplamında kazanan(lar); kimse puan alamadıysa "Kimse kurtulamadı". */
export const summarizeSonKisi: Summarize = (_result, players, publicView) => {
  const pub = rec(publicView);
  if (!Array.isArray(pub.final)) return null;
  const standings = list(pub.final).map(rec);
  const top = standings.filter((s) => s.rank === 1 && (num(s.total) ?? 0) > 0);
  const total = num(top[0]?.total);
  if (top.length === 0 || total === undefined) return "Kimse kurtulamadı";
  const ids = top.map((s) => str(s.playerId)).filter((id): id is string => id !== undefined);
  return fit(`${names(players, ids)} ${total} puanla en cesur kaçan`);
};
