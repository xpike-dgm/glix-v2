import { PROTOCOL_VERSION } from "@glix/engine";
import type { ScreenId } from "../screens/route.js";

/** Bu istemci derlemesinin konuştuğu protokol sürümü (motor sabitinden gelir; elle yazılmaz). */
export const CLIENT_PROTOCOL_VERSION: number = PROTOCOL_VERSION;

/**
 * - none: yapılacak bir şey yok.
 * - apply-now-silently: bekleyen sürümü şimdi, sormadan uygula.
 * - wait-for-safe-moment: bekleyen sürüm var ama şimdi maç sürüyor; güvenli ana kadar bekle.
 * - block-required: sunucuyla protokol uyuşmuyor; güncellemeden oyuna girilemez.
 */
export type UpdateDecision = "none" | "apply-now-silently" | "wait-for-safe-moment" | "block-required";

/** Sayfayı yenilemenin oyuncuya zarar vermediği ekranlar: maç dışı ya da maç bitişi. */
const SAFE_SCREENS: ReadonlySet<ScreenId> = new Set(["home", "settings", "notfound", "lobby", "final"]);

export const isSafeScreen = (screen: ScreenId): boolean => SAFE_SCREENS.has(screen);

export interface UpdateInput {
  /** Yeni sürümün hizmet çalışanı indi ve etkinleşmeyi bekliyor. */
  waiting: boolean;
  screen: ScreenId;
  /** Sunucunun `welcome` ile bildirdiği protokol; henüz bilinmiyorsa null. */
  serverProtocol: number | null;
  clientProtocol?: number;
}

export function isProtocolMismatch(serverProtocol: number | null, clientProtocol: number): boolean {
  return serverProtocol !== null && serverProtocol !== clientProtocol;
}

export function decideUpdate(input: UpdateInput): UpdateDecision {
  if (isProtocolMismatch(input.serverProtocol, input.clientProtocol ?? CLIENT_PROTOCOL_VERSION))
    return "block-required";
  if (!input.waiting) return "none";
  return isSafeScreen(input.screen) ? "apply-now-silently" : "wait-for-safe-moment";
}

/** Sekme öne gelince yapılan sürüm denetimi en çok bu sıklıkta (ms). */
export const CHECK_MIN_GAP_MS = 5 * 60 * 1000;

/** Denetim zamanı geldi mi? `force` (sunucu yeniden başladı, elle denetim) aralığı yok sayar. */
export function shouldCheckNow(now: number, lastCheck: number | null, force = false): boolean {
  if (force || lastCheck === null) return true;
  return now - lastCheck >= CHECK_MIN_GAP_MS;
}
