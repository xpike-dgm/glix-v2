import type { RoomSnapshot } from "@glix/engine";

/** Bu süreden uzun gizli kalan sekmede "açık görünen" soket ölü sayılabilir (iOS); canlılığı yoklanır. */
export const LONG_HIDDEN_MS = 5000;
/** Yoklamaya (ping) bu sürede yanıt gelmezse soket atılıp hemen yeniden bağlanılır. */
export const PROBE_TIMEOUT_MS = 1500;

export type ReturnAction = "reconnect" | "probe" | "ping" | "none";

export interface ReturnInput {
  /** WebSocket.readyState; soket yoksa null. */
  readyState: number | null;
  hiddenMs: number;
  /** bfcache'ten geri yükleme: sayfa donmuştu, soket güvenilmez. */
  restored: boolean;
}

const CONNECTING = 0;
const OPEN = 1;

/** Sekme öne gelince soketle ne yapılacağı. */
export function decideOnReturn({ readyState, hiddenMs, restored }: ReturnInput): ReturnAction {
  if (readyState === null || readyState > OPEN) return "reconnect";
  if (readyState === CONNECTING) return "none";
  return restored || hiddenMs >= LONG_HIDDEN_MS ? "probe" : "ping";
}

/** Maç sürerken yeniden bağlanınca gösterilen kısa bildirim; maç yoksa null (sessiz). */
export function reconnectNotice(snap: RoomSnapshot | null): string | null {
  const m = snap?.match;
  if (!snap || !m || snap.phase === "lobby" || snap.phase === "final") return null;
  return m.total > 0 ? `Tekrar bağlandın · Oyun ${m.round + 1}/${m.total}` : "Tekrar bağlandın";
}
