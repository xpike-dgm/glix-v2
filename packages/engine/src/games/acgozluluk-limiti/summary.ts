import { fit, num, rec, type Summarize } from "../summary.js";

/** Açgözlülük Limiti: toplam limiti aştı mı. */
export const summarizeAcgozlulukLimiti: Summarize = (_result, _players, publicView) => {
  const pv = rec(publicView);
  const reveal = rec(pv.reveal);
  const total = num(reveal.total);
  const limit = num(pv.limit);
  if (total === undefined || limit === undefined) return null;
  return fit(
    reveal.over === true
      ? `Toplam ${total}, limit ${limit} aşıldı; kimse puan alamadı`
      : `Toplam ${total}/${limit}: herkes seçtiği kadar aldı`,
  );
};
