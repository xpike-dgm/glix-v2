/**
 * Moderasyon sekmesinin saf kuralları (U16 A4): durum ve sebep etiketleri, form ön denetimleri. Yönetici paketi
 * `@glix/engine`den yalnız tip alır (oyun kodu pakete girmesin); buradaki sabitler motordakiyle aynıdır, testi doğrular.
 */
import type { ReportReason, ReportStatus } from "@glix/engine";

export const REPORT_STATUSES: readonly ReportStatus[] = ["new", "reviewed", "actioned", "rejected"];
export const REPORT_STATUS_LABELS: Readonly<Record<ReportStatus, string>> = {
  new: "Yeni",
  reviewed: "İncelendi",
  actioned: "İşlem yapıldı",
  rejected: "Reddedildi",
};
export const REPORT_REASONS: readonly ReportReason[] = ["name", "abuse", "cheat", "other"];
export const REPORT_REASON_LABELS: Readonly<Record<ReportReason, string>> = {
  name: "Uygunsuz ad",
  abuse: "Hakaret-küfür",
  cheat: "Hile",
  other: "Diğer",
};
export const REPORT_ADMIN_NOTE_MAX = 300;
export const BANNED_WORDS_MAX = 500;
export const BANNED_WORD_LENGTH_MAX = 40;

export const isReportStatus = (v: unknown): v is ReportStatus =>
  typeof v === "string" && (REPORT_STATUSES as readonly string[]).includes(v);
export const isReportReason = (v: unknown): v is ReportReason =>
  typeof v === "string" && (REPORT_REASONS as readonly string[]).includes(v);

/** Yeni kelime için ön denetim (sunucu normalleşmiş uzunluğu ayrıca denetler); sorun yoksa null. */
export function bannedWordProblem(word: string, count: number): string | null {
  const text = word.trim();
  const n = Array.from(text).length;
  if (n === 0) return "Kelime boş olamaz.";
  if (n > BANNED_WORD_LENGTH_MAX) return `Kelime en çok ${BANNED_WORD_LENGTH_MAX} karakter olabilir (${n}).`;
  if (count >= BANNED_WORDS_MAX) return `Liste dolu (en çok ${BANNED_WORDS_MAX} kelime).`;
  return null;
}

/** Yönetici notu için ön denetim; sorun yoksa null. */
export function adminNoteProblem(note: string): string | null {
  const n = Array.from(note.trim()).length;
  return n > REPORT_ADMIN_NOTE_MAX ? `Not en çok ${REPORT_ADMIN_NOTE_MAX} karakter olabilir (${n}).` : null;
}

/** Kuyruk süzgeci: tümü ya da bir durum. */
export type QueueFilter = ReportStatus | "all";
export const QUEUE_FILTERS: readonly { id: QueueFilter; label: string }[] = [
  { id: "new", label: REPORT_STATUS_LABELS.new },
  { id: "reviewed", label: REPORT_STATUS_LABELS.reviewed },
  { id: "actioned", label: REPORT_STATUS_LABELS.actioned },
  { id: "rejected", label: REPORT_STATUS_LABELS.rejected },
  { id: "all", label: "Tümü" },
];

/** Hedefe yapılabilecek işlem açıklaması (panelde hedef türüne göre). */
export function targetKind(r: {
  targetAccountId: number | null;
  inRoom: boolean;
}): "account" | "guest-in-room" | "guest-gone" {
  if (r.targetAccountId !== null) return "account";
  return r.inRoom ? "guest-in-room" : "guest-gone";
}
