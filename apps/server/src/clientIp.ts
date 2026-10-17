import { isIP } from "node:net";

/** `::ffff:1.2.3.4` biçimini `1.2.3.4` yapar; küçük harfe çevirir. */
export function normalizeIp(ip: string): string {
  const lower = ip.trim().toLowerCase();
  return lower.startsWith("::ffff:") && isIP(lower.slice(7)) === 4 ? lower.slice(7) : lower;
}

/** Loopback ya da özel adres mi (127/8, 10/8, 172.16/12, 192.168/16, ::1, fc00::/7). */
export function isPrivateOrLoopback(ip: string): boolean {
  const addr = normalizeIp(ip);
  const kind = isIP(addr);
  if (kind === 4) {
    const [a = 0, b = 0] = addr.split(".").map(Number);
    return a === 127 || a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  if (kind === 6) return addr === "::1" || /^f[cd][0-9a-f]{2}:/.test(addr);
  return false;
}

/**
 * İstemci IP'si. `trustProxy` açık ve TCP eşi loopback/özel adres ise (yani isteği bizim ters vekilimiz
 * iletmişse) `X-Forwarded-For` başlığının SON girdisi kullanılır: Caddy güvenilmeyen istemcinin başlığını
 * gerçek istemci IP'siyle değiştirir. Aksi halde başlık yok sayılır (sahte başlıkla limit aşılamaz).
 */
export function resolveClientIp(
  peer: string | undefined,
  forwardedFor: string | string[] | undefined,
  trustProxy: boolean,
): string {
  const direct = normalizeIp(peer ?? "") || "unknown";
  if (!trustProxy || !isPrivateOrLoopback(direct) || forwardedFor === undefined) return direct;
  const header = Array.isArray(forwardedFor) ? forwardedFor.join(",") : forwardedFor;
  const last = header.split(",").at(-1)?.trim() ?? "";
  return isIP(last) !== 0 ? normalizeIp(last) : direct;
}
