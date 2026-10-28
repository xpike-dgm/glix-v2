import type { RoomSnapshot } from "@glix/engine";
import type { Nav } from "../net/store.js";

export type ScreenId =
  | "home"
  | "join"
  | "settings"
  | "profile"
  | "friends"
  | "leaderboard"
  | "login"
  | "register"
  | "aydinlatma"
  | "googleAd"
  | "unuttum"
  | "yeniSifre"
  | "notfound"
  | "lobby"
  | "briefing"
  | "countdown"
  | "playing"
  | "results"
  | "cards"
  | "final";

export interface RouteInput {
  snapshot: RoomSnapshot | null;
  nav: Nav;
  notFound: boolean;
}

/** Ekran yalnız store'dan türetilir: oturum yok → ana sayfa/katıl; varsa snapshot.phase. */
export function selectScreen({ snapshot, nav, notFound }: RouteInput): ScreenId {
  if (!snapshot) return notFound ? "notfound" : nav;
  switch (snapshot.phase) {
    case "lobby":
      return "lobby";
    case "final":
      return "final";
    case "briefing":
    case "countdown":
    case "playing":
    case "results":
    case "cards":
      return snapshot.match ? snapshot.phase : "lobby";
  }
}
