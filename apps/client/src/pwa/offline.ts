import type { ConnStatus } from "../net/store.js";

export interface OfflineInput {
  online: boolean;
  conn: ConnStatus;
  failedAttempts: number;
}

/** Ana sayfada "internet yok" durumu: tarayıcı çevrimdışı ya da sunucuya en az bir kez ulaşılamadı. */
export function isOfflineHome({ online, conn, failedAttempts }: OfflineInput): boolean {
  if (!online) return true;
  return (conn === "closed" || conn === "connecting") && failedAttempts >= 1;
}
