import { hapticsUnavailable } from "./haptics.js";
import { reducedMotion } from "./motion.js";

/** Titreşimsiz cihazda sarsıntı/parlama bu kadar güçlenir (CSS'te `--shake-gain` ile aynı). */
export const UNAVAILABLE_GAIN = 1.4;

/**
 * Sarsıntı çarpanı: azaltılmış harekette 0 (hiç sarsılmaz), titreşimsiz cihazda biraz fazla, yoksa 1.
 * Saf; kararı çağıran verir.
 */
export function shakeGain(reduced: boolean, hapticsUnavailable: boolean): number {
  if (reduced) return 0;
  return hapticsUnavailable ? UNAVAILABLE_GAIN : 1;
}

/** Parlama en çok 1'e kadar güçlenir; azaltılmış harekette yarıya iner. */
export function flashPeak(base: number, reduced: boolean, hapticsUnavailable: boolean): number {
  if (reduced) return base * 0.5;
  return Math.min(1, hapticsUnavailable ? base * UNAVAILABLE_GAIN : base);
}

/** Şu anki cihaz ve ayarlara göre sarsıntı çarpanı. */
export const currentShakeGain = (): number => shakeGain(reducedMotion(), hapticsUnavailable());
/** Şu anki cihaz ve ayarlara göre parlama tepe değeri. */
export const currentFlashPeak = (base: number): number =>
  flashPeak(base, reducedMotion(), hapticsUnavailable());
