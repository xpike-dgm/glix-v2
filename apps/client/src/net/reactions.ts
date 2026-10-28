import type { ReactionId } from "@glix/engine";

/** Lobi emoji tepkileri: oda durumunda tutulmayan geçici olaylar; dinleyiciler yalnız anlık haber alır. */
type Listener = (playerId: string, emoji: ReactionId) => void;

const listeners = new Set<Listener>();

export function onReaction(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function emitReaction(playerId: string, emoji: ReactionId): void {
  for (const fn of [...listeners]) fn(playerId, emoji);
}

/** Bir emojinin ekranda kaldığı süre (ms): uçuş animasyonu ve hareket azaltmadaki sabit rozet. */
export const REACTION_FLIGHT_MS = 1500;
