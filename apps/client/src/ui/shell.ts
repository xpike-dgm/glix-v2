import { createContext, useContext } from "solid-js";
import type { ClockWindow } from "./clockState.js";

/** Kabuğun oyunlara sunduğu kanal: oyun bu aşamanın süre penceresini kabuktaki saate bildirir. */
export interface ShellApi {
  setClock: (win: ClockWindow | null) => void;
}

export const ShellContext = createContext<ShellApi>({ setClock: () => {} });

export function useShell(): ShellApi {
  return useContext(ShellContext);
}
