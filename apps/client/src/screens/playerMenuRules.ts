import type { FriendsData } from "../net/friendsRules.js";

/**
 * Oyuncu menüsünde hedefle arkadaşlık durumu:
 * `none` hedef hesaplı değil (ya da sen hesapsızsın / kendin / engelli), `friend` arkadaş, `sent` istek gitti,
 * `incoming` o sana istek göndermiş, `can-add` eklenebilir.
 */
export type FriendState = "none" | "friend" | "sent" | "incoming" | "can-add";

export function friendState(
  me: string | null,
  target: string | null,
  data: FriendsData | null,
  justSent: string | null,
): FriendState {
  if (!me || !target || me === target || data === null) return "none";
  const same = (a: string): boolean => a.toLowerCase() === target.toLowerCase();
  if (data.blocked.some(same)) return "none";
  if (data.friends.some((f) => same(f.username))) return "friend";
  if (data.outgoing.some((f) => same(f.username)) || (justSent !== null && same(justSent))) return "sent";
  if (data.incoming.some((f) => same(f.username))) return "incoming";
  return "can-add";
}
