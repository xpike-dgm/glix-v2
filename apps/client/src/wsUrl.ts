export interface WsLocation {
  protocol: string;
  host: string;
}

/** WebSocket adresini çözer: açık adres > geliştirme varsayılanı > aynı köken. */
export function resolveWsUrl(loc: WsLocation, override?: string, dev = false): string {
  if (override) return override;
  if (dev) return "ws://localhost:3900/ws";
  return `${loc.protocol === "https:" ? "wss:" : "ws:"}//${loc.host}/ws`;
}
