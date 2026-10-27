/**
 * "Bildir" (oyuncu şikâyeti) sözleşmesi: sebepler, durumlar, not sınırı ve yönetici paneli tipleri.
 * Ayrıntılar: docs/PROTOKOL.md "Oyuncu bildirimi", docs/ADMIN.md "Moderasyon".
 */

export const REPORT_REASONS = ["name", "abuse", "cheat", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

/** Oyuncuya gösterilen sebep etiketleri (düğme metni). */
export const REPORT_REASON_LABELS: Readonly<Record<ReportReason, string>> = {
  name: "Uygunsuz ad",
  abuse: "Hakaret-küfür",
  cheat: "Hile",
  other: "Diğer",
};

export function isReportReason(value: unknown): value is ReportReason {
  return typeof value === "string" && (REPORT_REASONS as readonly string[]).includes(value);
}

export const REPORT_NOTE_MAX = 200;
/** Bir bildirenin saatte gönderebileceği en çok bildirim. */
export const REPORT_PER_HOUR = 5;
/** Bildirimler bu süreden sonra silinir (180 gün). */
export const REPORT_RETENTION_MS = 180 * 24 * 3600 * 1000;

/** Kısa not: denetim karakterleri boşluğa iner, kırpılır. Çok uzunsa ya da metin değilse null; boşsa "". */
export function sanitizeReportNote(value: unknown): string | null {
  if (typeof value !== "string" || value.length > REPORT_NOTE_MAX * 4) return null;
  const clean = value
    .replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\p{Co}\p{Cs}]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  return Array.from(clean).length > REPORT_NOTE_MAX ? null : clean;
}

// ---- Yönetici paneli ------------------------------------------------------------------------------------------

export const REPORT_STATUSES = ["new", "reviewed", "actioned", "rejected"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const REPORT_STATUS_LABELS: Readonly<Record<ReportStatus, string>> = {
  new: "Yeni",
  reviewed: "İncelendi",
  actioned: "İşlem yapıldı",
  rejected: "Reddedildi",
};

export function isReportStatus(value: unknown): value is ReportStatus {
  return typeof value === "string" && (REPORT_STATUSES as readonly string[]).includes(value);
}

/** Yönetici notu en çok bu kadar karakter. */
export const REPORT_ADMIN_NOTE_MAX = 300;

/** Bildirimle saklanan kanıt: hedefin son oyunda herkese açık gösterilmiş metinleri. */
export interface ReportEvidence {
  gameId: string;
  texts: string[];
}

export interface AdminReportRow {
  id: number;
  createdAt: number;
  status: ReportStatus;
  reason: ReportReason;
  /** Hedefin bildirim anındaki görünen adı. */
  targetName: string;
  /** Hedef hesaplıysa hesap kimliği (silinmişse null); misafirse null. */
  targetAccountId: number | null;
  roomCode: string;
  gameId: string | null;
}

export interface AdminReportDetail extends AdminReportRow {
  /** Bildiren hesaplıysa kimliği; misafirse null. */
  reporterAccountId: number | null;
  note: string;
  evidence: ReportEvidence | null;
  adminNote: string;
  reviewedAt: number | null;
  /** Hedefin odadaki oyuncu kimliği ("Odadan at" için; yalnız oda açıkken anlamlı). */
  targetPlayerId: string;
  /** Hedef şu an o odada mı; oda kapandıysa ya da çıktıysa false. */
  inRoom: boolean;
  /** Hedef, yönetici listesindeki bir hesap mı (hesap işlemleri kapalı). */
  targetProtected: boolean;
}

/** `GET /api/admin/reports`: yeniden eskiye sayfa. */
export interface AdminReportPage {
  reports: AdminReportRow[];
  nextBefore: number | null;
  /** Duruma göre toplamlar (filtreden bağımsız). */
  counts: Record<ReportStatus, number>;
}

export interface AdminBannedWord {
  word: string;
  addedAt: number;
}

/** `GET /api/admin/banned-words`. */
export interface AdminBannedWords {
  words: AdminBannedWord[];
  max: number;
}

/** `GET /api/admin/banned-words/accounts`: listeye takılan mevcut hesaplar (salt okunur yardımcı). */
export interface AdminBannedAccounts {
  accounts: { id: number; username: string }[];
  /** Sonuç sınırı aşıldı mı. */
  truncated: boolean;
}

/** `GET /api/admin/rooms/players`: tek odanın oyuncuları (görünen adlar yalnız bu uçta). */
export interface AdminRoomPlayer {
  id: string;
  nickname: string;
  connected: boolean;
  spectator: boolean;
  host: boolean;
  /** Hesaplı oyuncu mu (kimlik verilmez). */
  account: boolean;
}

export interface AdminRoomPlayers {
  code: string;
  phase: string;
  players: AdminRoomPlayer[];
}
