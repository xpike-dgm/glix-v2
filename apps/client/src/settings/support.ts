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

export type PushToggleMode =
  /** Anahtar hiç gösterilmez (sunucu ya da tarayıcı desteklemiyor). */
  | "hidden"
  /** iPhone'da ana ekrana eklenmemiş: anahtar yerine ipucu. */
  | "hint"
  /** Tarayıcı izni kapatılmış: anahtar kapalı, yönerge görünür. */
  | "denied"
  | "toggle";

export interface PushSupportInput {
  /** Sunucu `welcome` ile VAPID anahtarı bildirdi. */
  serverEnabled: boolean;
  hasPushManager: boolean;
  hasServiceWorker: boolean;
  hasNotification: boolean;
  /** iPhone/iPad (herhangi bir tarayıcı). */
  ios: boolean;
  /** Ana ekrandan (bağımsız pencerede) açık. */
  standalone: boolean;
  /** `Notification.permission`; bilinmiyorsa "default". */
  permission: NotificationPermission;
}

/** Ayarlar'da "Bildirimler" satırı nasıl görünür. iOS'ta ana ekrana eklenmeden `PushManager` yoktur; bu yüzden önce o bakılır. */
export function pushToggleMode(i: PushSupportInput): PushToggleMode {
  if (!i.serverEnabled) return "hidden";
  if (i.ios && !i.standalone) return "hint";
  if (!i.hasPushManager || !i.hasServiceWorker || !i.hasNotification) return "hidden";
  return i.permission === "denied" ? "denied" : "toggle";
}
