import type { Accessor } from "solid-js";
import { onPhaseKey } from "../../fx/cue.js";
import type { KroClock } from "./view.js";

/** "BAŞLA!" geç açılan ekranda yalnız bu kadar yeniyse çalar. */
export const GO_FRESH_MS = 800;

/**
 * Kör Kronometre evre geçişleri (KR-M2 / KR-U3): "Hazır ol" ve "BAŞLA!" el başına bir kez. Saat (`clock`) her
 * karede yeniden hesaplanır; anahtar memo'dan geçtiği için gong yalnız evre ya da el değişince çalar.
 */
export function korKronometreCues(
  clock: Accessor<KroClock | null>,
  now: Accessor<number>,
  on: { ready: (c: KroClock) => void; go: (c: KroClock) => void },
): void {
  onPhaseKey(
    () => {
      const c = clock();
      return `${c?.phase ?? "ready"}:${c?.hand ?? 0}`;
    },
    (_key, opening) => {
      const c = clock();
      if (!c) return;
      if (c.phase === "ready") on.ready(c);
      else if (c.phase === "count" && (!opening || now() - c.phaseStartsAt < GO_FRESH_MS)) on.go(c);
    },
  );
}
