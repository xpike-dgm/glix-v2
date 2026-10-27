import type { ScreenId } from "../screens/route.js";

/** Işık süpürmesinin süresi (ms); CSS animasyonuyla aynı. */
export const CURTAIN_MS = 450;

const FLOW: ReadonlySet<ScreenId> = new Set(["briefing", "countdown", "playing", "results"]);

/**
 * Geçiş perdesi yalnız maç akışının içinde (anlatım → geri sayım → oyun → sonuç) süpürür. Lobi/final/ana
 * ekran geçişleri, ilk açılış ve aynı ekranın yenilenmesi süpürmez.
 */
export function shouldSweep(prev: ScreenId | undefined, cur: ScreenId): boolean {
  return prev !== undefined && prev !== cur && FLOW.has(prev) && FLOW.has(cur);
}
