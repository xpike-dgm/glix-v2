/** Yönetici paneli biçimleyicileri (Türkçe). Saf işlevler; testleri format.test.ts. */
import { isReportStatus, REPORT_STATUS_LABELS } from "./moderationRules.js";

const MONTHS = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

export const fmtInt = (n: number): string => Math.round(n).toLocaleString("tr-TR");

/** Ondalıklı sayı, Türkçe virgülle. */
export function fmtNum(n: number, digits = 1): string {
  return n.toFixed(digits).replace(".", ",");
}

/** 0..1 -> "%12". */
export const fmtPct = (ratio: number): string => `%${Math.round(ratio * 100)}`;

/** Saniye -> "2 g 3 sa", "1 sa 5 dk", "3 dk 4 sn", "7 sn". */
export function fmtDuration(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d} g ${h} sa`;
  if (h > 0) return `${h} sa ${m} dk`;
  if (m > 0) return `${m} dk ${s % 60} sn`;
  return `${s} sn`;
}

/** Bayt/sn -> "812 B/sn", "12,3 KB/sn", "1,2 MB/sn". */
export function fmtRate(bytesPerSec: number): string {
  if (bytesPerSec < 1024) return `${Math.round(bytesPerSec)} B/sn`;
  if (bytesPerSec < 1048576) return `${fmtNum(bytesPerSec / 1024)} KB/sn`;
  return `${fmtNum(bytesPerSec / 1048576)} MB/sn`;
}

/** `YYYY-MM-DD` -> "27 Eki". Bozuk girişte olduğu gibi döner. */
export function shortDay(day: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return day;
  return `${Number(m[2])} ${MONTHS[Number(m[1]) - 1] ?? ""}`;
}

const two = (n: number): string => String(n).padStart(2, "0");

/** Yerel saatle "27.10.2026 21:57". */
export function fmtDateTime(ms: number): string {
  const d = new Date(ms);
  return `${two(d.getDate())}.${two(d.getMonth() + 1)}.${d.getFullYear()} ${two(d.getHours())}:${two(d.getMinutes())}`;
}

/** "az önce", "3 dk önce", "5 sa önce", "2 g önce". */
export function fmtAgo(ms: number, now: number): string {
  const sec = Math.max(0, Math.floor((now - ms) / 1000));
  if (sec < 60) return "az önce";
  if (sec < 3600) return `${Math.floor(sec / 60)} dk önce`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} sa önce`;
  return `${Math.floor(sec / 86400)} g önce`;
}

export type Level = "ok" | "warn" | "bad";

/** Eşiklere göre durum rengi: `warn` ve üstü uyarı, `bad` ve üstü kötü. */
export function level(value: number, warn: number, bad: number): Level {
  return value >= bad ? "bad" : value >= warn ? "warn" : "ok";
}

const PHASES: Record<string, string> = {
  lobby: "Lobi",
  briefing: "Anlatım",
  countdown: "Geri sayım",
  playing: "Oyunda",
  results: "Sonuç",
  final: "Final",
};
export const phaseLabel = (phase: string): string => PHASES[phase] ?? phase;

export const PLATFORM_LABEL: Record<string, string> = { ios: "iOS", android: "Android", diger: "Diğer" };

// ---- A2: hesaplar ve işlem kaydı ---------------------------------------------------------------------------

/** İşlem kaydındaki işlem adı -> okunur Türkçe etiket. Bilinmeyen kod olduğu gibi gösterilir. */
const AUDIT_LABELS: Record<string, string> = {
  otp_request: "Giriş kodu istendi",
  otp_ok: "Panele giriş yapıldı",
  otp_fail: "Hatalı giriş kodu",
  otp_locked: "Giriş kodu kilitlendi",
  otp_expired: "Giriş kodunun süresi doldu",
  otp_none: "Kodsuz giriş denemesi",
  logout: "Panelden çıkış",
  account_view: "Hesap ayrıntısı görüntülendi",
  account_search_email: "E-postayla hesap arandı",
  account_rename: "Kullanıcı adı değiştirildi",
  account_suspend: "Hesap askıya alındı",
  account_unsuspend: "Askı kaldırıldı",
  account_delete: "Hesap silindi",
  account_logout_all: "Tüm oturumlar kapatıldı",
  game_switch: "Oyun anahtarı değiştirildi",
  announcement_set: "Duyuru yayınlandı",
  announcement_clear: "Duyuru kaldırıldı",
  push_broadcast: "Herkese bildirim başlatıldı",
  push_broadcast_done: "Herkese bildirim bitti",
  maintenance_on: "Bakım kipi açıldı",
  maintenance_off: "Bakım kipi kapandı",
  db_backup: "Veritabanı yedeği indirildi",
  db_backup_denied: "Yedek reddedildi",
  db_backup_failed: "Yedek alınamadı",
  report_status: "Bildirim durumu değişti",
  room_view: "Oda oyuncuları görüntülendi",
  room_close: "Oda kapatıldı",
  room_kick: "Oyuncu odadan atıldı",
  banned_word_add: "Yasaklı kelime eklendi",
  banned_word_remove: "Yasaklı kelime silindi",
};
export const auditLabel = (action: string): string => AUDIT_LABELS[action] ?? action;

const DURATION_LABELS: Record<string, string> = { "1d": "1 gün", "7d": "7 gün", forever: "süresiz" };
const MAIL_STATE: Record<string, string> = {
  sent: "gönderildi",
  throttled: "sık istendi",
  mail_failed: "e-posta gitmedi",
};

const SWITCH_TEXT: Record<string, string> = {
  open: "açıldı",
  closed: "kapatıldı",
  pool_in: "rastgele havuza eklendi",
  pool_out: "rastgele havuzdan çıkarıldı",
};

/** "kule-ustasi:closed,pool_out" -> "kule-ustasi kapatıldı, rastgele havuzdan çıkarıldı". */
function gameSwitchDetail(detail: string): string {
  const [id, changes] = detail.split(":");
  const text = (changes ?? "")
    .split(",")
    .map((c) => SWITCH_TEXT[c] ?? c)
    .join(", ");
  return `${id ?? ""} ${text}`.trim();
}

/** "3/1/1" (gitti/gitmedi/silindi) -> "3 gitti, 1 gitmedi, 1 abonelik silindi". */
function broadcastDoneDetail(detail: string): string {
  const m = /^(\d+)\/(\d+)\/(\d+)$/.exec(detail);
  return m ? `${m[1]} gitti, ${m[2]} gitmedi, ${m[3]} abonelik silindi` : detail;
}

/** `kimlik:durum` -> "Bildirim #12: İncelendi". */
function reportStatusDetail(detail: string): string {
  const [id, status] = detail.split(":");
  const label = isReportStatus(status) ? REPORT_STATUS_LABELS[status] : (status ?? "");
  return `Bildirim #${id ?? "?"}: ${label}`;
}

/** İşlem kaydı ayrıntısı: kodları okunur metne çevirir; boşsa boş döner. */
export function auditDetail(action: string, detail: string): string {
  if (detail === "") return "";
  if (action === "account_suspend") return `Süre: ${DURATION_LABELS[detail] ?? detail}`;
  if (action === "account_logout_all") return `${detail} oturum`;
  if (action === "otp_request") return MAIL_STATE[detail] ?? detail;
  if (action === "game_switch") return gameSwitchDetail(detail);
  if (action === "announcement_set")
    return detail === "uyari" ? "Uyarı" : detail === "bilgi" ? "Bilgi" : detail;
  if (action === "push_broadcast") return `${detail} abonelik`;
  if (action === "push_broadcast_done") return broadcastDoneDetail(detail);
  if (action === "report_status") return reportStatusDetail(detail);
  if (action === "room_view" || action === "room_close" || action === "room_kick") return `Oda ${detail}`;
  if (action === "db_backup") return `${detail} dosya`;
  if (action === "db_backup_denied") return detail === "fresh_required" ? "giriş kodu eski" : detail;
  return detail;
}

/** Hesabın giriş yöntemleri: "Şifre", "Google", "Şifre + Google". */
export function methodsLabel(a: { password: boolean; google: boolean }): string {
  if (a.password && a.google) return "Şifre + Google";
  return a.google ? "Google" : "Şifre";
}

/** Askı bitişi: "27.10.2026 21:57'e kadar" ya da "süresiz". */
export const fmtUntil = (until: number | null): string =>
  until === null ? "süresiz" : `${fmtDateTime(until)} tarihine kadar`;

/** Kullanıcı adı alanı için istemci tarafı ön denetim (sunucu yine denetler). */
export const USERNAME_OK = /^[A-Za-z0-9_]{3,20}$/;

/** Silme onayı: yazılan metin kullanıcı adıyla (büyük/küçük harf ve boşluk önemsiz) eşleşiyor mu. */
export const confirmMatches = (typed: string, username: string): boolean =>
  typed.trim().toLowerCase() === username.toLowerCase() && username.length > 0;

/** Başarısızlık oranı 0..1; hiç gönderim yoksa null. */
export const failRatio = (c: { ok: number; failed: number }): number | null =>
  c.ok + c.failed === 0 ? null : c.failed / (c.ok + c.failed);

const RELEASE_STATE: Record<string, string> = {
  running: "Çalışıyor",
  clean: "Temiz kapandı",
  unclean: "Kapanış kaydı yok",
};
export const releaseStateLabel = (state: string): string => RELEASE_STATE[state] ?? state;

/** Revizyonun kısa hali (ilk 7 karakter). */
export const shortRevision = (rev: string): string => rev.slice(0, 7);
