import { rec, type Summarize } from "../summary.js";

/** Yazı Yaz: yazanı doğru tahmin edenlerin sayısı. */
export const summarizeYaziYaz: Summarize = (_result, _players, publicView) => {
  const guesses = Object.values(rec(rec(rec(publicView).reveal).guesses)).map(rec);
  if (guesses.length === 0) return null;
  const ok = guesses.filter((g) => g.personOk === true).length;
  return `${guesses.length} kişiden ${ok} tanesi yazanı doğru tahmin etti`;
};
