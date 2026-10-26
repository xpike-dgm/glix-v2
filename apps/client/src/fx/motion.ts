import { motion } from "../settings/settings.js";

/**
 * Hareket azaltma için tek karar noktası: kullanıcı ayarı "Açık"/"Kapalı" ise o, "Cihaza göre"
 * ise sistemin `prefers-reduced-motion` tercihi. CSS tarafı aynı kararı kökteki `data-motion`
 * özelliğinden okur (bkz. settings.ts `applyRootSettings`).
 */
export function systemReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export function resolveReducedMotion(pref: "auto" | "reduce" | "full", system: boolean): boolean {
  if (pref === "reduce") return true;
  if (pref === "full") return false;
  return system;
}

export function reducedMotion(): boolean {
  return resolveReducedMotion(motion(), systemReducedMotion());
}
