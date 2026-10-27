/**
 * Sıralı açılış (en çok kandıran/en büyük/en şaşırtıcı en sona) için saf zamanlama.
 * Süre sunucudan gelen aşama süresine uyar: dizi, aşamanın ayrılan payına sığacak şekilde vuruşlar sıkıştırılır;
 * aşama süresi hiçbir zaman değiştirilmez.
 */

/** İstenen vuruş aralığı (ms): her adım bu kadar arayla gelir. */
export const BEAT_MAX_MS = 1000;
/** Sıkıştırmanın alt sınırı: bundan kısa vuruşta adımlar okunmaz. */
export const BEAT_MIN_MS = 200;
/** İlk adımdan önceki kısa nefes (ms). */
export const LEAD_MS = 400;
/** Dizinin, açılış aşamasının en çok bu kadarını harcamasına izin verilir; kalanı okumaya ayrılır. */
export const SEQUENCE_SHARE = 0.6;

export interface SequenceTiming {
  leadMs: number;
  beatMs: number;
}

/** `steps` adımlı dizinin vuruşu: ayrılan paya sığacak kadar sıkıştırılır, en çok `BEAT_MAX_MS`. */
export function sequenceTiming(steps: number, budgetMs: number): SequenceTiming {
  const n = Math.max(1, Math.floor(steps));
  const allowed = Math.max(0, budgetMs) * SEQUENCE_SHARE;
  const lead = Math.min(LEAD_MS, allowed * 0.15);
  const fit = (allowed - lead) / n;
  return { leadMs: lead, beatMs: Math.max(BEAT_MIN_MS, Math.min(BEAT_MAX_MS, fit)) };
}

/** Başlangıçtan `elapsedMs` sonra görünmesi gereken adım sayısı (0..steps). */
export function stepsShown(elapsedMs: number, steps: number, t: SequenceTiming): number {
  if (steps <= 0) return 0;
  if (elapsedMs < t.leadMs) return 0;
  return Math.min(steps, Math.floor((elapsedMs - t.leadMs) / t.beatMs) + 1);
}

/** Bir sonraki adıma kalan süre (ms); dizi bittiyse null. */
export function nextStepDelay(elapsedMs: number, steps: number, t: SequenceTiming): number | null {
  const shown = stepsShown(elapsedMs, steps, t);
  if (shown >= steps) return null;
  return Math.max(0, t.leadMs + shown * t.beatMs - elapsedMs);
}

/** Dizinin toplam süresi (ms): son adımın görünme anı. */
export function sequenceSpan(steps: number, t: SequenceTiming): number {
  return t.leadMs + Math.max(0, steps - 1) * t.beatMs;
}
