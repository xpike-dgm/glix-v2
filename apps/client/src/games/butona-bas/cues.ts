import type { Accessor } from "solid-js";
import { onPhaseKey } from "../../fx/cue.js";
import type { RoundClock } from "./view.js";

/** Tur başı gongu geç açılan ekranda yalnız bu kadar yeniyse çalar. */
export const GONG_FRESH_MS = 1_500;

/**
 * Butona Bas evre geçişleri: tur başı (gong), ara (vuuş) ve oyun sonu (fanfar) tur başına bir kez. Saat her karede
 * yeniden hesaplanır; anahtar memo'dan geçtiği için ses yalnız evre ya da tur değişince çalar. Ara ve son ekran
 * geç açılırsa sessizdir.
 */
export function butonaBasCues(
  clock: Accessor<RoundClock | null>,
  now: Accessor<number>,
  on: { play: (c: RoundClock) => void; gap: (c: RoundClock) => void; over: (c: RoundClock) => void },
): void {
  onPhaseKey(
    () => {
      const c = clock();
      return `${c?.phase ?? "play"}:${c?.round ?? 0}`;
    },
    (_key, opening) => {
      const c = clock();
      if (!c) return;
      if (c.phase === "play") {
        if (!opening || now() - c.phaseStartsAt < GONG_FRESH_MS) on.play(c);
      } else if (opening) return;
      else if (c.phase === "gap") on.gap(c);
      else on.over(c);
    },
  );
}
