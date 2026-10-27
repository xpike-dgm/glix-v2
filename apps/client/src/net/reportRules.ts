/** "Bildir" sayfasının saf kuralları (docs/PROTOKOL.md "Oyuncu bildirimi"). */
import {
  type PlayerInfo,
  REPORT_NOTE_MAX,
  REPORT_REASON_LABELS,
  REPORT_REASONS,
  type ReportReason,
} from "@glix/engine";

/** Sebep düğmeleri, gösterim sırasıyla. */
export const REPORT_CHIPS: readonly { id: ReportReason; label: string }[] = REPORT_REASONS.map((id) => ({
  id,
  label: REPORT_REASON_LABELS[id],
}));

/** Bildirilebilecek kişiler: odadaki herkes, kendin hariç (izleyiciler dahil). */
export function reportTargets(players: readonly PlayerInfo[], selfId: string): PlayerInfo[] {
  return players.filter((p) => p.id !== selfId);
}

/** Notu 200 karakterde (kod noktası) keser. */
export function clipNote(text: string): string {
  const chars = Array.from(text);
  return chars.length <= REPORT_NOTE_MAX ? text : chars.slice(0, REPORT_NOTE_MAX).join("");
}

/** Notta kalan karakter (negatif olmaz). */
export function noteLeft(text: string): number {
  return Math.max(0, REPORT_NOTE_MAX - Array.from(text).length);
}

/** Gönder düğmesi: sebep seçili ve istek sürmüyor. */
export function canSendReport(reason: ReportReason | null, sending: boolean): boolean {
  return reason !== null && !sending;
}

export const REPORT_THANKS = "Bildirimin alındı. Teşekkürler.";
export const REPORT_FAILED = "Bildirim gönderilemedi. Biraz sonra tekrar dene.";

/** Bildirim sırasında gelebilen hata kodları (sunucu iletisi Türkçe ve oyuncuya gösterilir). */
const REPORT_ERRORS: ReadonlySet<string> = new Set([
  "report_limit",
  "report_duplicate",
  "not_in_room",
  "server_busy",
  "rate_limited",
  "invalid_message",
]);

export function isReportError(code: string): boolean {
  return REPORT_ERRORS.has(code);
}

/** Hata mesajı: sunucunun Türkçe iletisi varsa o, yoksa genel ileti. */
export function reportErrorText(code: string, serverMessage: string): string {
  if (code === "invalid_message") return REPORT_FAILED;
  return serverMessage.trim() === "" ? REPORT_FAILED : serverMessage;
}
