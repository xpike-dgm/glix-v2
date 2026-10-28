import { type Cosmetics, cosmeticItem } from "@glix/engine";
import { playCelebration } from "./celebration.js";
import { playConfetti } from "./confetti.js";

/**
 * Finalin kutlaması: kazananlardan (sıra: kürsü sırası) ilk kuşandığı zafer kutlaması herkesin ekranında oynar;
 * hiçbir kazananın kutlaması yoksa klasik konfeti. Kimlik ağdan gelir: katalogda ve doğru türde değilse atlanır.
 */
export function winnerCelebration(
  winners: readonly { player: { cosmetics?: Cosmetics | undefined } }[],
): string | undefined {
  for (const w of winners) {
    const id = w.player.cosmetics?.celebration;
    if (id !== undefined && cosmeticItem(id)?.type === "zafer") return id;
  }
  return undefined;
}

export function playFinalFx(host: HTMLElement, celebration: string | undefined): Promise<() => void> {
  // Yalnız geliştirme önizlemesi: `&zaferdongu=1` kutlamayı döngüye alır (ekran denetimi karakterler gelince çekilir).
  const loop = import.meta.env.DEV && new URLSearchParams(location.search).get("zaferdongu") === "1";
  return celebration ? playCelebration(host, celebration, { loop }) : playConfetti(host);
}
