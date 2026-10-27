/**
 * İçerik ve bakım sekmelerinin saf kuralları (U16 A3): form ön denetimleri ve gösterim metinleri. Sunucu aynı sınırları
 * yeniden denetler (packages/engine/src/siteNotice.ts); buradaki sayılar onunla aynıdır, testi bunu doğrular.
 */

export const ANNOUNCEMENT_MAX = 140;
export const BROADCAST_TITLE_MAX = 40;
export const BROADCAST_BODY_MAX = 120;
/** Duyuru bitişi en çok bu kadar ileride olabilir. */
export const ANNOUNCEMENT_MAX_AHEAD_MS = 30 * 24 * 3600 * 1000;

/** Kırpılmış, boşlukları tek boşluğa inmiş karakter (kod noktası) sayısı. */
export const charCount = (text: string): number => Array.from(text.replace(/\s+/gu, " ").trim()).length;

// biome-ignore lint/suspicious/noControlCharactersInRegex: denetim karakterleri bilerek aranır
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/;
const FORMAT = /[\p{Cf}\p{Zl}\p{Zp}\p{Co}\p{Cs}]/u;

/** Metin alanı sorunu (Türkçe); sorun yoksa null. `label` cümle başında kullanılır ("Başlık", "Metin"). */
export function textProblem(text: string, max: number, label: string): string | null {
  if (CONTROL.test(text)) return `${label} satır sonu ya da denetim karakteri içeremez.`;
  if (FORMAT.test(text)) return `${label} görünmez biçim karakteri içeremez.`;
  if (/[<>]/.test(text)) return `${label} "<" ve ">" içeremez.`;
  const n = charCount(text);
  if (n === 0) return `${label} boş olamaz.`;
  if (n > max) return `${label} en çok ${max} karakter olabilir (${n}).`;
  return null;
}

/** Bildirimde açılacak yol: boş (ana sayfa) ya da "/" ile başlayan site içi yol. */
export function sitePathProblem(path: string): string | null {
  if (path === "") return null;
  return /^\/(?!\/)[A-Za-z0-9\-._~/?=&%#]{0,99}$/.test(path)
    ? null
    : 'Bağlantı "/" ile başlamalı ve sitenin kendi yolu olmalı (en çok 100 karakter).';
}

export type EndsAt = { ok: true; endsAt: number | null } | { ok: false; message: string };

/** `datetime-local` değeri (yerel saat, "2026-10-28T21:30") -> bitiş anı. Boşsa süresiz. */
export function endsAtFromInput(value: string, now: number): EndsAt {
  if (value === "") return { ok: true, endsAt: null };
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return { ok: false, message: "Bitiş zamanı geçersiz." };
  const [, y, mo, d, h, mi] = m.map(Number) as [number, number, number, number, number, number];
  const at = new Date(y, mo - 1, d, h, mi, 0, 0);
  const ms = at.getTime();
  if (!Number.isFinite(ms) || at.getMonth() !== mo - 1 || at.getDate() !== d)
    return { ok: false, message: "Bitiş zamanı geçersiz." };
  if (ms <= now) return { ok: false, message: "Bitiş zamanı ileri bir an olmalı." };
  if (ms > now + ANNOUNCEMENT_MAX_AHEAD_MS)
    return { ok: false, message: "Bitiş en çok 30 gün sonrası olabilir." };
  return { ok: true, endsAt: ms };
}

const two = (n: number): string => String(n).padStart(2, "0");

/** Bitiş anı -> `datetime-local` değeri (yerel saat). */
export function inputFromEndsAt(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}T${two(d.getHours())}:${two(d.getMinutes())}`;
}

/** Kalan süre: "3 dk", "2 sa 5 dk", "1 g 4 sa". */
export function fmtRemaining(ms: number): string {
  const min = Math.max(1, Math.ceil(ms / 60_000));
  if (min < 60) return `${min} dk`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} sa ${min % 60} dk`;
  return `${Math.floor(h / 24)} g ${h % 24} sa`;
}

/** Oyun satırı: motorun "rastgele havuz" varsayılanından farkı için kısa not. */
export function poolNote(g: { randomPool: boolean; engineRandomPool: boolean }): string {
  if (g.randomPool === g.engineRandomPool)
    return g.engineRandomPool ? "varsayılan: havuzda" : "varsayılan: dışında";
  return g.randomPool ? "havuza eklendi (varsayılan: dışında)" : "havuzdan çıkarıldı (varsayılan: havuzda)";
}

/** Yedek indirme hakkı özeti: "Bugün 1/3" ya da dolduysa ne zaman açılacağı. */
export function backupQuotaText(
  b: { usedToday: number; limit: number; nextAt: number | null },
  now: number,
): string {
  if (b.usedToday >= b.limit && b.nextAt !== null)
    return `Günlük sınır doldu (${b.usedToday}/${b.limit}). ${fmtRemaining(b.nextAt - now)} sonra yeniden alınabilir.`;
  return `Son 24 saatte ${b.usedToday}/${b.limit} yedek alındı.`;
}

/** Bakım kipini kapatmadan önce uyarı gerekir mi: açıksa hayır (kapatmak güvenli). Açarken maç sayısına göre metin. */
export function maintenanceOnWarning(activeMatches: number): string {
  return activeMatches === 0
    ? "Şu an süren maç yok. Bakım kipi açılınca yeni oda kurulamaz ve yeni maç başlamaz."
    : `${activeMatches} maç sürüyor; bunlar normal biter. Yeni oda kurulamaz ve yeni maç başlamaz.`;
}
