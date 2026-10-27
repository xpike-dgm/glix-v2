import type { PlayerInfo } from "@glix/engine";
import { createContext, useContext } from "solid-js";
import type { ClockWindow } from "./clockState.js";

/** Kabuğun oyunlara sunduğu kanal: oyun bu aşamanın süre penceresini kabuktaki saate bildirir. */
export interface ShellApi {
  /** `owner` penceresini bildirir; `null` yalnız hâlâ sahibiyse temizler (aşama geçişinde sıra karışmasın). */
  setClock: (owner: symbol, win: ClockWindow | null) => void;
  /** Bu oyunun katılımcıları (hazır şeridi noktaları için). */
  crew: () => PlayerInfo[];
}

export const ShellContext = createContext<ShellApi>({ setClock: () => {}, crew: () => [] });

export function useShell(): ShellApi {
  return useContext(ShellContext);
}
