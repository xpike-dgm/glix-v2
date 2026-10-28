import { REACTION_MIN_GAP_MS, type ReactionId } from "@glix/engine";
import { sendReaction } from "../net/client.js";

/** İstemci tarafı hız sınırı: sunucunun 700 ms kuralıyla aynı; gereksiz mesaj yollanmaz. */
export function createReactionSender(
  send: (emoji: ReactionId) => unknown = sendReaction,
  clock: () => number = Date.now,
): (emoji: ReactionId) => void {
  let last = Number.NEGATIVE_INFINITY;
  return (emoji) => {
    const now = clock();
    if (now - last < REACTION_MIN_GAP_MS) return;
    last = now;
    send(emoji);
  };
}
