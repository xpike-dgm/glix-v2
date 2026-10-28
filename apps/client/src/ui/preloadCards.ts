import { CARD_BACK_SRC, cardFrame } from "./cards.js";

const started = new Set<string>();
const keep: HTMLImageElement[] = [];

/** Kartlı maçta dört çerçeve ve kart sırtı önden indirilir (küçük); seçim ekranı açılınca boş çerçeve görünmez. */
export function preloadCards(): void {
  if (typeof Image === "undefined") return;
  const list = [
    cardFrame("siradan"),
    cardFrame("nadir"),
    cardFrame("efsanevi"),
    cardFrame("kotu"),
    CARD_BACK_SRC,
  ];
  for (const src of list) {
    if (started.has(src)) continue;
    started.add(src);
    const img = new Image();
    img.decoding = "async";
    img.src = src;
    keep.push(img);
  }
}
