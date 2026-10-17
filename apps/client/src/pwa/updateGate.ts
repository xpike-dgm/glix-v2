import type { ScreenId } from "../screens/route.js";

/** Maç sürerken sayfayı yenilemek oyuncuyu oyundan atar; yalnız bu ekranlarda güncelleme önerilir. */
const SAFE_SCREENS: ReadonlySet<ScreenId> = new Set(["home", "join", "notfound", "lobby", "final"]);

/** "Yeni sürüm hazır" bildirimi görünsün mü? Bekleyen sürüm var ve ekran maç dışında olmalı. */
export function shouldOfferUpdate(waiting: boolean, screen: ScreenId): boolean {
  return waiting && SAFE_SCREENS.has(screen);
}
