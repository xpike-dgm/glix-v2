import { type LobbyEmoji, REACTION_MIN_GAP_MS } from "@glix/engine";
import { sendReaction } from "../net/client.js";

/** İstemci tarafı hız sınırı: sunucunun 700 ms kuralıyla aynı; gereksiz mesaj yollanmaz. */
export function createReactionSender(
  send: (emoji: LobbyEmoji) => unknown = sendReaction,
  clock: () => number = Date.now,
): (emoji: LobbyEmoji) => void {
  let last = Number.NEGATIVE_INFINITY;
  return (emoji) => {
    const now = clock();
    if (now - last < REACTION_MIN_GAP_MS) return;
    last = now;
    send(emoji);
  };
}
