import { CARD_BACK_SRC, cardFrame } from "./cards.js";
import { warmImage } from "./imageWarm.js";

/** Kartlı maçta dört çerçeve ve kart sırtı önden indirilir (küçük); seçim ekranı açılınca boş çerçeve görünmez. */
export function preloadCards(): void {
  for (const src of [
    cardFrame("siradan"),
    cardFrame("nadir"),
    cardFrame("efsanevi"),
    cardFrame("kotu"),
    CARD_BACK_SRC,
  ])
    warmImage(src);
}
