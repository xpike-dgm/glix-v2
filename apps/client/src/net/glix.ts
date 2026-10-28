import { createSignal } from "solid-js";
import type { GlixEarnedInfo } from "./glixRules.js";

/**
 * Maç sonunda kazanılan Glix (sunucudan `glixEarned`). Final ekranında özet olarak gösterilir; odadan çıkılınca ya da
 * yeni maça geçilince temizlenir. Mesaj gelmezse (eski sunucu, hata) hiçbir şey gösterilmez.
 */
const [earned, setEarned] = createSignal<GlixEarnedInfo | null>(null);

export { earned as glixEarned };

export function receiveGlix(info: GlixEarnedInfo): void {
  setEarned(info);
}

export function clearGlix(): void {
  setEarned(null);
}
