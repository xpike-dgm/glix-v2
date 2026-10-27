/** Yönetici paneli biçimleyicileri (Türkçe). Saf işlevler; testleri format.test.ts. */

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
