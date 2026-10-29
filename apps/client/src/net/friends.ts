import type { FriendStatus } from "@glix/engine";
import { createSignal } from "solid-js";
import { NETWORK_ERROR, playerErrorText } from "./errorText.js";
import {
  addInvite,
  EMPTY_FRIENDS,
  type FriendInvite,
  type FriendsData,
  parseFriends,
  withStatus,
} from "./friendsRules.js";
import { toast } from "./store.js";

/** Arkadaş listesi, istekler ve gelen davetler. HTTP'den okunur; canlı değişimler WS ile gelir. */

export type FriendsLoad = "idle" | "loading" | "ready" | "error";

const [friendsData, setFriendsData] = createSignal<FriendsData | null>(null);
const [friendsLoad, setFriendsLoad] = createSignal<FriendsLoad>("idle");
const [invites, setInvites] = createSignal<readonly FriendInvite[]>([]);

export { friendsData, friendsLoad, invites };

/** Bekleyen gelen istek sayısı (ana sayfadaki rozet). */
export const incomingCount = (): number => friendsData()?.incoming.length ?? 0;

/** Yalnız geliştirme önizlemesi: veri sabitlenir, ağdan okuma yapılmaz. */
let frozen = false;
export function freezeFriends(data: FriendsData | null, load: FriendsLoad = "ready"): void {
  frozen = true;
  setFriendsData(data);
  setFriendsLoad(load);
}

/** Aynı anda tek okuma; eski bir yanıt yenisinin üstüne yazmaz. */
let seq = 0;

/** Listeyi sunucudan okur. Oturum yoksa (401) ya da hata olursa eldeki liste korunur. */
export async function loadFriends(): Promise<void> {
  if (frozen) return;
  const mine = ++seq;
  if (friendsData() === null) setFriendsLoad("loading");
  try {
    const res = await fetch("/api/friends", { credentials: "same-origin" });
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      // gövde okunamadı
    }
    if (mine !== seq) return;
    if (res.status === 401) {
      setFriendsData(null);
      setFriendsLoad("idle");
      return;
    }
    const parsed = res.ok ? parseFriends(body) : null;
    if (parsed) {
      setFriendsData(parsed);
      setFriendsLoad("ready");
    } else if (friendsData() === null) setFriendsLoad("error");
  } catch {
    if (mine === seq && friendsData() === null) setFriendsLoad("error");
  }
}

export interface FriendReply {
  ok: boolean;
  /** Başarısızsa Türkçe metin. */
  message: string;
  /** İstekte: "sent" (istek gitti) ya da "accepted" (karşı taraf zaten istemişti). */
  result?: string;
}

export type FriendAction = "request" | "accept" | "decline" | "cancel" | "remove" | "block" | "unblock";

/** Tek bir arkadaşlık işlemi; başarıda liste yenilenir. */
export async function friendAction(action: FriendAction, username: string): Promise<FriendReply> {
  try {
    const res = await fetch(`/api/friends/${action}`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      // gövde okunamadı
    }
    const rec = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : null;
    if (rec?.ok === true) {
      void loadFriends();
      return { ok: true, message: "", ...(typeof rec.result === "string" ? { result: rec.result } : {}) };
    }
    // Hata da listeyi eskitmiş olabilir (ör. istek artık yok).
    if (res.status === 404 || res.status === 409) void loadFriends();
    return { ok: false, message: playerErrorText(rec?.code, rec?.message) };
  } catch {
    return { ok: false, message: NETWORK_ERROR };
  }
}

// ---- Canlı güncellemeler (WS) -----------------------------------------------------------------------------

export function onFriendStatus(username: string, status: FriendStatus): void {
  const d = friendsData();
  if (d) setFriendsData(withStatus(d, username, status));
}

export function onFriendRequest(username: string): void {
  toast(`${username} sana arkadaşlık isteği gönderdi`);
  void loadFriends();
}

let changedTimer: ReturnType<typeof setTimeout> | undefined;
/** Liste değişti: art arda gelenler tek okumaya iner. */
export function onFriendsChanged(): void {
  clearTimeout(changedTimer);
  changedTimer = setTimeout(() => void loadFriends(), 300);
}

/** Çıkışta: arkadaş verisi ve davetler cihazdan silinir. */
export function resetFriends(): void {
  seq += 1;
  frozen = false;
  setFriendsData(null);
  setFriendsLoad("idle");
  setInvites([]);
}

// ---- Davetler ---------------------------------------------------------------------------------------------

export function receiveInvite(inv: FriendInvite): void {
  setInvites((list) => addInvite(list, inv));
}

export function dismissInvite(inv: FriendInvite): void {
  setInvites((list) => list.filter((i) => !(i.from === inv.from && i.roomCode === inv.roomCode)));
}

/** O odaya girildi: o odanın davetleri artık gereksiz. */
export function dropInvitesFor(roomCode: string): void {
  setInvites((list) => list.filter((i) => i.roomCode !== roomCode));
}

export { EMPTY_FRIENDS };
