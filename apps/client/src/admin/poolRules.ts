/**
 * İçerik havuzları sekmesinin saf kuralları (U16 A4): form ön denetimi, toplu yapıştırma ayrıştırma, rozet ve uyarı
 * metinleri. Sunucu her şeyi yeniden doğrular (packages/engine/src/content.ts, apps/server/src/contentStore.ts);
 * buradaki denetim yalnız gereksiz istek göndermemek içindir.
 */
import type {
  AdminPoolEntry,
  AdminPoolField,
  AdminPoolFilter,
  AdminPoolLineStatus,
  AdminPoolSummary,
} from "@glix/engine";
import { FAMILIAR_CLOSE_RATIO, FAMILIAR_MIN_SHOWN, FAMILIAR_RATIO, playSuggestion } from "@glix/engine";

/** Toplu yapıştırmada tek istekteki en çok satır (sunucudaki sınırla aynı). */
export const BULK_MAX_LINES = 200;
export const POOL_FILTERS: readonly { id: AdminPoolFilter; label: string }[] = [
  { id: "all", label: "Tümü" },
  { id: "builtin", label: "Hazır" },
  { id: "custom", label: "Eklenen" },
  { id: "disabled", label: "Kapalı" },
];

export const LINE_STATUS_LABELS: Readonly<Record<AdminPoolLineStatus, string>> = {
  ok: "Eklenecek",
  invalid: "Geçersiz",
  duplicate: "Zaten var",
  banned: "Yasaklı kelime",
  full: "Havuz dolu",
};

const charCount = (text: string): number => Array.from(text.replace(/\s+/gu, " ").trim()).length;

/** Tek alan için ön denetim; sorun yoksa null. */
export function fieldProblem(field: AdminPoolField, value: string): string | null {
  const n = charCount(value);
  // İsteğe bağlı seçim alanı (en az 0 karakter, ör. Çağrışım Ağı zorluğu): boş bırakılabilir.
  if (n === 0 && field.options && field.min === 0) return null;
  if (n === 0) return field.options ? `${field.label} seçilmeli.` : `${field.label} boş olamaz.`;
  if (field.options && !field.options.includes(value.trim()))
    return `${field.label} şunlardan biri olmalı: ${field.options.join(", ")}.`;
  if (/[<>]/.test(value)) return `${field.label} "<" ve ">" içeremez.`;
  if (n < field.min) return `${field.label} en az ${field.min} karakter olmalı.`;
  if (n > field.max) return `${field.label} en çok ${field.max} karakter olabilir (${n}).`;
  return null;
}

/** Formdaki ilk sorun; yoksa null. */
export function valuesProblem(
  fields: readonly AdminPoolField[],
  values: Readonly<Record<string, string>>,
): string | null {
  for (const f of fields) {
    const p = fieldProblem(f, values[f.key] ?? "");
    if (p) return p;
  }
  return null;
}

/** Boş form değerleri. */
export function emptyValues(fields: readonly AdminPoolField[]): Record<string, string> {
  return Object.fromEntries(fields.map((f) => [f.key, ""]));
}

/** Yapıştırılan metni satırlara böler; fazlası kesilir. Boş satırlar numarayı korumak için bırakılır, uçtaki boşlar atılır. */
export function splitPaste(text: string): { lines: string[]; cut: boolean } {
  const all = text.split(/\r?\n/);
  while (all.length > 0 && (all.at(-1) ?? "").trim() === "") all.pop();
  const cut = all.length > BULK_MAX_LINES;
  return { lines: cut ? all.slice(0, BULK_MAX_LINES) : all, cut };
}

/** Toplu yapıştırma yönergesi (havuzun alanlarına göre). */
export function bulkHint(fields: readonly AdminPoolField[]): string {
  if (fields.length === 1)
    return `Her satıra bir ${fields[0]?.label.toLocaleLowerCase("tr-TR") ?? "girdi"} yaz.`;
  const names = fields.map((f) => f.label.toLocaleLowerCase("tr-TR")).join("; ");
  return `Her satıra bir girdi yaz, alanları noktalı virgülle ayır: ${names}.`;
}

/**
 * Bilinirlik hücresi (SB-M7): "%45 · 12 oyun". En az 10 oyunda çıkmadıysa yalnız oyun sayısı; %40'ı aşan "ağırlık
 * yarıda", %60'ı aşan "kapatma önerisi" diye işaretlenir (eşikler motordaki `isFamiliar` ile aynı).
 */
export function knownCell(known: { shown: number; knew: number } | undefined): {
  text: string;
  badge: Badge | null;
} {
  if (!known || known.shown === 0) return { text: "henüz oynanmadı", badge: null };
  const ratio = known.knew / known.shown;
  const text = `%${Math.round(ratio * 100)} · ${known.shown} oyun`;
  if (known.shown < FAMILIAR_MIN_SHOWN) return { text, badge: null };
  if (ratio > FAMILIAR_CLOSE_RATIO) return { text, badge: { label: "Kapatma önerisi", tone: "off" } };
  if (ratio > FAMILIAR_RATIO) return { text, badge: { label: "Ağırlık yarıda", tone: "added" } };
  return { text, badge: null };
}

/**
 * Kelime karnesi hücresi (CG-M6): "12 oyun · ağ %45 · tek %30". En az 8 oyundan sonra öneri rozeti: "Kolay önerisi",
 * "Zor önerisi" ya da "Kapatma önerisi" (eşikler motordaki `playSuggestion` ile aynı; kendiliğinden uygulanmaz).
 */
export function playCell(card: { games: number; top: number; single: number } | undefined): {
  text: string;
  badge: Badge | null;
} {
  if (!card || card.games === 0) return { text: "henüz oynanmadı", badge: null };
  const pct = (v: number): string => `%${Math.round(v * 100)}`;
  const text = `${card.games} oyun · ağ ${pct(card.top)} · tek ${pct(card.single)}`;
  const s = playSuggestion(card);
  if (s === "kapat") return { text, badge: { label: "Kapatma önerisi", tone: "off" } };
  if (s === "kolay") return { text, badge: { label: "Kolay önerisi", tone: "added" } };
  if (s === "zor") return { text, badge: { label: "Zor önerisi", tone: "added" } };
  return { text, badge: null };
}

export interface Badge {
  label: string;
  tone: "ready" | "added" | "off";
}

/** Girdinin rozetleri: Hazır / Eklenen, kapalıysa ayrıca Kapalı; bilinirlikli havuzda varsa bilinirlik rozeti. */
export function badgesOf(
  e: Pick<AdminPoolEntry, "source" | "disabled" | "known" | "play">,
  feedback = false,
  playStats = false,
): Badge[] {
  const out: Badge[] = [
    e.source === "builtin" ? { label: "Hazır", tone: "ready" } : { label: "Eklenen", tone: "added" },
  ];
  if (e.disabled) out.push({ label: "Kapalı", tone: "off" });
  const known = feedback ? knownCell(e.known).badge : null;
  if (known) out.push(known);
  const play = playStats ? playCell(e.play).badge : null;
  if (play) out.push(play);
  return out;
}

export const pageCount = (total: number, pageSize: number): number =>
  Math.max(1, Math.ceil(total / Math.max(1, pageSize)));

/** Havuzun yeni maçlardaki durumu: uyarı gerekiyorsa metin ve düzey; değişiklik yoksa null. */
export function poolStatus(p: AdminPoolSummary): { text: string; level: "ok" | "bad" } | null {
  if (p.belowMin)
    return {
      level: "bad",
      text: `Etkin girdi sayısı (${p.active}) asgarinin (${p.min}) altında: yeni maçlar değişiklik yapılmamış gibi hazır havuzu kullanıyor. Girdi ekle ya da kapattıklarından aç.`,
    };
  if (p.applied)
    return {
      level: "ok",
      text: "Değişiklikler bundan sonra başlayan maçlara uygulanır; süren maçlar etkilenmez.",
    };
  return null;
}

/** Asgari/ihtiyaç göstergesi: "Etkin 320 / en az 10". */
export const minText = (p: AdminPoolSummary): string => `Etkin ${p.active} · en az ${p.min} gerekli`;

/** Girdinin liste başlığı: tüm alanlar " · " ile. */
export const entryText = (
  fields: Readonly<Record<string, string>>,
  order: readonly AdminPoolField[],
): string =>
  order
    .map((f) => fields[f.key] ?? "")
    .filter((t) => t !== "")
    .join(" · ");
