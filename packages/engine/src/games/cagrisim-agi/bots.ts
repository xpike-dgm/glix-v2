import type { GameBot } from "../../testing/simulate.js";
import { CAGRISIM_TOTAL_MS, type CagrisimAgiAction } from "./types.js";

const POPULAR = ["mavi", "tatil", "güzel", "sıcak", "yaz", "soğuk", "deniz kenarı", "İzmir", "ışık", "çay"];
const RARE = [
  "ördek",
  "kuş sütü",
  "bilgisayar",
  "Anadolu",
  "şemsiye",
  "ZEYTİN",
  "gökyüzü",
  "tamam",
  "Çiçek 2",
];

/** Çoğu bot popüler cevaplardan seçer (gruplar oluşsun); bazıları büyük/küçük harf ve boşluk farkı yapar. */
export const cagrisimAgiBot: GameBot = {
  durationMs: CAGRISIM_TOTAL_MS,
  burstJitterMs: [200, 3_000, 9_000],
  generate: (rng, _playerId, publicView): CagrisimAgiAction => {
    const roll = rng.int(100);
    let text: string;
    if (roll < 4) text = "";
    else if (roll < 7) text = "   \t ";
    else if (roll < 9) text = "x".repeat(80);
    else if (roll < 14)
      text = "ab"; // çok kısa
    else if (roll < 70) text = POPULAR[rng.int(POPULAR.length)] as string;
    else text = RARE[rng.int(RARE.length)] as string;
    const style = rng.int(4);
    if (style === 1) text = text.toLocaleUpperCase("tr");
    else if (style === 2) text = `  ${text.replace(" ", "   ")} `;
    // Sızıntı denetimi, görünümdeki sabit metinlerle (anahtarlar, kelime) çakışan cevapları karıştırmasın.
    const shown = JSON.stringify(publicView ?? null);
    if (text.length >= 3 && shown.includes(text)) text = `${text} ✓`;
    return { kind: "answer", text };
  },
};
