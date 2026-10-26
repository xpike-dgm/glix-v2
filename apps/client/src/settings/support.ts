/** Cihaz yetenek denetimleri ve küçük biçimleyiciler (Ayarlar ekranı). */

export function hasVibrate(
  nav: Pick<Navigator, "vibrate"> | undefined = typeof navigator === "undefined" ? undefined : navigator,
): boolean {
  return typeof nav?.vibrate === "function";
}

export function hasAudioSession(
  nav: object | undefined = typeof navigator === "undefined" ? undefined : navigator,
): boolean {
  return nav !== undefined && "audioSession" in nav;
}

/** Bayt → "≈ 18 MB"; 1 MB altı "< 1 MB". */
export function formatMegabytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (!Number.isFinite(mb) || mb < 1) return "< 1 MB";
  return `≈ ${Math.round(mb)} MB`;
}
