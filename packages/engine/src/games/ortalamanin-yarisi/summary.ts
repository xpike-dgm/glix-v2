import { decimal, fit, nick, num, rec, type Summarize, strList } from "../summary.js";

/**
 * Ortalamaya En Yakın: hedef ve ona en yakın, puan alan seçim. Yanan (OY-M1) ve rastgele atanan (OY-M2) sayılar
 * puan almadığı için "en yakın" sayılmaz; kimse puan almadıysa bu söylenir.
 */
export const summarizeOrtalamaninYarisi: Summarize = (_result, players, publicView) => {
  const reveal = rec(rec(publicView).reveal);
  const target = num(reveal.target);
  const order = strList(reveal.order);
  if (target === undefined || order.length === 0) return null;
  const points = rec(reveal.points);
  const closest = order.find((id) => (num(points[id]) ?? 0) > 0);
  if (closest === undefined) return fit(`Hedef ${decimal(target)}; kimse puan alamadı`);
  const choice = num(rec(reveal.choices)[closest]);
  return fit(
    `Hedef ${decimal(target)}; en yakın ${nick(players, closest)}${choice === undefined ? "" : ` (${choice})`}`,
  );
};
