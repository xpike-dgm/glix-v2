/**
 * "Verimi indir" ve "Hesabımı sil" için saf yardımcılar (H10). Kurallar sunucudakiyle aynıdır
 * (apps/server/src/kvkk.ts); sunucu her durumda yeniden denetler.
 */

/** Silmeyi onaylamak için yazılan kullanıcı adı hesabınkiyle uyuşuyor mu (büyük/küçük harf, baştaki/sondaki boşluk önemsiz). */
export function usernameMatches(typed: string, username: string): boolean {
  return typed.trim().toLowerCase() === username.toLowerCase();
}

export interface DeleteForm {
  typed: string;
  username: string;
  /** Hesapta şifre var mı (yoksa yalnız Google hesabıdır). */
  hasPassword: boolean;
  password: string;
}

/** Kırmızı onay düğmesi açık mı: ad uyuşuyor ve (şifreli hesapta) şifre yazılmış. */
export function canDeleteAccount(f: DeleteForm): boolean {
  if (!usernameMatches(f.typed, f.username)) return false;
  return !f.hasPassword || f.password.length > 0;
}

/** Gönderimden önceki ilk hata (düğme zaten kapalıdır; Enter ile gönderilirse gösterilir). Hata yoksa null. */
export function deleteFormError(f: DeleteForm): string | null {
  if (!usernameMatches(f.typed, f.username)) return "Kullanıcı adını doğru yaz.";
  if (f.hasPassword && f.password.length === 0) return "Şifreni yaz.";
  return null;
}

/** Sunucuya giden gövde: şifre yalnız şifreli hesapta eklenir. */
export function deleteBody(f: DeleteForm): { confirm: string; password?: string } {
  const confirm = f.typed.trim();
  return f.hasPassword ? { confirm, password: f.password } : { confirm };
}

/** Dosya nasıl kaydedilir: `anchor` indirme bağlantısı; `tab` yeni sekmede açıp oradan kaydettirir. */
export type SaveMethod = "anchor" | "tab";

export interface DeviceInfo {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
  /** Ana ekrandan (bağımsız pencerede) açık. */
  standalone: boolean;
}

/** iPhone/iPad (iPadOS 13+ kendini Macintosh diye tanıtır; dokunmatik olması ayırır). */
export function isIosDevice(d: Pick<DeviceInfo, "userAgent" | "platform" | "maxTouchPoints">): boolean {
  return /iPhone|iPad|iPod/.test(d.userAgent) || (d.platform === "MacIntel" && d.maxTouchPoints > 1);
}

/**
 * iOS'ta ana ekrana eklenmiş uygulama indirme bağlantısını (`download`) tutmaz; dosya yeni sekmede açılır ve
 * paylaşım menüsünden kaydedilir. Safari'de ve diğer cihazlarda normal indirme çalışır.
 */
export function saveMethod(d: DeviceInfo): SaveMethod {
  return isIosDevice(d) && d.standalone ? "tab" : "anchor";
}

const FILE_PATTERN = /^glix-verilerim-\d{4}-\d{2}-\d{2}\.json$/;

/** İndirme dosyasının varsayılan adı ("glix-verilerim-2026-10-27.json", Türkiye saati). */
export function exportFileName(ms: number): string {
  return `glix-verilerim-${new Date(ms + 3 * 3600 * 1000).toISOString().slice(0, 10)}.json`;
}

/** `Content-Disposition` başlığından dosya adı; beklenen biçimde değilse varsayılan ad (başlığa güvenilmez). */
export function fileNameFromDisposition(header: string | null, fallback: string): string {
  const found = header ? /filename="([^"]+)"/.exec(header)?.[1] : undefined;
  return found && FILE_PATTERN.test(found) ? found : fallback;
}

/** İndirme sonrası kullanıcıya gösterilen kısa haber. */
export function exportDoneText(method: SaveMethod): string {
  return method === "tab"
    ? "Verilerin yeni sekmede açıldı. Paylaş düğmesiyle kaydedebilirsin."
    : "Verilerin indirildi.";
}
