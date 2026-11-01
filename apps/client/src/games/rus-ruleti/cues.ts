import type { Accessor } from "solid-js";
import { onChange } from "../../fx/cue.js";

/** RR-U9: "SİLAH SENDE!" bandı (karar penceresinden önceki beklemenin son 0,8 sn'si). */
export const HOLD_BAND_MS = 800;

/** Silah sendeyken bant görünür mü: ilk atıştan önce oyun başında, sonra her karar penceresinden hemen önce. */
export function holdBandOn(
  p: { shots: number; handoff: unknown; startedAt: number; openAt: number },
  now: number,
): boolean {
  if (p.shots === 0 && !p.handoff) return now < p.startedAt + HOLD_BAND_MS;
  return now >= p.openAt - HOLD_BAND_MS && now < p.openAt;
}

/**
 * Bant açıldığı anda tek "çek-çek" (RR-U9). Bant saatten türetilir ve her karede yeniden hesaplanır; değer
 * memo'dan geçtiği için ses yalnız bant kapalıdan açığa geçince çalar, bant açık kaldıkça tekrarlamaz.
 */
export function cockCue(band: Accessor<boolean>, fn: () => void): void {
  onChange(band, (on) => {
    if (on) fn();
  });
}
