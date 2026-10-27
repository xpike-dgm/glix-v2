/**
 * Yalnız geliştirme önizlemesi: arkadaşlar ekranı, arkadaş sayfası, lobide davet sayfası ve gelen davet kartı.
 * `?mock=arkadas` (`&v=bos|engelli|yukleniyor|hata`), `arkadas-ana` (ana sayfada rozet), `arkadas-davet-lobi`,
 * `arkadas-kart` (ana sayfada davet kartı), `arkadas-kart-oda` (odadayken davet kartı).
 * Ekran açılmadan önce veri sabitlenir (ağdan okumasın).
 */
import { freezeFriends, receiveInvite } from "../net/friends.js";
import { type FriendsData, parseFriends } from "../net/friendsRules.js";
import { serverNow, setState } from "../net/store.js";
import { startMock } from "./mock.js";

function sample(v: string | null): FriendsData {
  const day = 24 * 3600 * 1000;
  const now = Date.now();
  const friend = (username: string, status: string, joinable: boolean): Record<string, unknown> => ({
    username,
    since: now - 9 * day,
    status,
    joinable,
    withYou: false,
  });
  const raw = {
    ok: true,
    friends:
      v === "bos"
        ? []
        : [
            friend("mert_34", "lobby", true),
            friend("elif_k", "online", false),
            friend("zeynep", "playing", true),
            friend("cok_uzun_kullanici_1", "lobby", true),
            friend("kaan_07", "offline", false),
          ],
    incoming:
      v === "bos"
        ? []
        : [
            { username: "defne_s", at: now - 3600_000 },
            { username: "burak", at: now - day },
          ],
    outgoing: v === "bos" ? [] : [{ username: "ayse_t", at: now - 2 * day }],
    blocked: v === "engelli" ? [{ username: "rahatsiz_01" }] : [],
  };
  const parsed = parseFriends(raw);
  if (!parsed) throw new Error("örnek arkadaş listesi geçersiz");
  return parsed;
}

export function startArkadasMock(kind: string, params: URLSearchParams): void {
  const v = params.get("v");
  if (v === "yukleniyor") freezeFriends(null, "loading");
  else if (v === "hata") freezeFriends(null, "error");
  else freezeFriends(sample(v), "ready");
  const account = { username: "cihad_01", email: "cihad@example.com" };

  if (kind === "arkadas-davet-lobi" || kind === "arkadas-kart-oda") {
    // Lobi, giriş yapmış hesapla; `n=1` ile odada yalnız sen varsın (boş oda görünümü).
    startMock("lobby", params);
    setState("account", account);
  } else {
    setState({ account, nav: kind === "arkadas" ? "friends" : "home", session: null });
  }
  if (kind === "arkadas-kart" || kind === "arkadas-kart-oda")
    receiveInvite({ from: "elif_k", roomCode: "MN4PQ", expiresAt: serverNow() + 9 * 60_000 });
  if (kind === "arkadas-kart-coklu") {
    receiveInvite({ from: "mert_34", roomCode: "ZX9KL", expiresAt: serverNow() + 4 * 60_000 });
    receiveInvite({ from: "elif_k", roomCode: "MN4PQ", expiresAt: serverNow() + 9 * 60_000 });
  }
}
