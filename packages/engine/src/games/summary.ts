import type { GameResult } from "../game.js";

/** Tur özetinin ihtiyaç duyduğu en küçük oyuncu bilgisi. */
export interface SummaryPlayer {
  id: string;
  nickname: string;
}

/**
 * Bir oyunun tur özeti: herkese açık sonuçtan (`result`) ve oyunun herkese açık görünümünden (`publicView`,
 * sonuç aşamasında açılmış bölümler) tek, kısa, olgusal bir Türkçe cümle üretir. Saf fonksiyondur: gizli bilgi
 * okumaz (yalnız zaten herkese gösterilen veriye bakar), aynı girdiye aynı cümleyi verir. Cümle kurulamıyorsa null.
 * `publicView` ağdan geldiği için `unknown` kabul edilir ve burada daraltılır.
 */
export type Summarize = (
  result: GameResult,
  players: readonly SummaryPlayer[],
  publicView?: unknown,
) => string | null;

/** Cümlenin en çok uzunluğu (karakter). */
export const SUMMARY_MAX_LENGTH = 60;
/** Cümlede takma adın en çok uzunluğu; uzunsa kırpılıp "…" eklenir. */
const NAME_MAX = 10;

/** Takma adı cümleye sığacak şekilde kısaltır; oyuncu bulunamazsa "Biri". */
export function nick(players: readonly SummaryPlayer[], id: string): string {
  const name = players.find((p) => p.id === id)?.nickname;
  if (name === undefined || name === "") return "Biri";
  const chars = Array.from(name);
  return chars.length > NAME_MAX ? `${chars.slice(0, NAME_MAX - 1).join("")}…` : name;
}

/** "Elif", "Elif ve Can", "Elif ve 2 kişi". */
export function names(players: readonly SummaryPlayer[], ids: readonly string[]): string {
  const [first, second] = ids;
  if (first === undefined) return "";
  if (second === undefined) return nick(players, first);
  if (ids.length === 2) return `${nick(players, first)} ve ${nick(players, second)}`;
  return `${nick(players, first)} ve ${ids.length - 1} kişi`;
}

/** Cümleyi üst sınıra kırpar (yedek önlem; cümleler zaten kısa kurulur). */
export function fit(sentence: string): string {
  const chars = Array.from(sentence);
  return chars.length <= SUMMARY_MAX_LENGTH
    ? sentence
    : `${chars.slice(0, SUMMARY_MAX_LENGTH - 1).join("")}…`;
}

export function rec(v: unknown): Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export function list(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

export function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

export function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

export function strList(v: unknown): string[] {
  return list(v).filter((x): x is string => typeof x === "string");
}

export function numRec(v: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, x] of Object.entries(rec(v))) {
    const n = num(x);
    if (n !== undefined) out[k] = n;
  }
  return out;
}

/** En yüksek değere sahip oyuncular (eşitlikte hepsi, giriş sırasıyla); en yüksek değer `min`'den küçükse null. */
export function leaders(scores: Record<string, number>, min = 1): { ids: string[]; value: number } | null {
  const entries = Object.entries(scores);
  if (entries.length === 0) return null;
  const value = Math.max(...entries.map(([, v]) => v));
  if (value < min) return null;
  return {
    ids: entries.filter(([, v]) => v === value).map(([id]) => id),
    value,
  };
}

/**
 * "Elif 5 puanla turun yıldızı" kalıbı: lider(ler) ve değeri. `how` değeri ek ile yazar ("5 puanla"),
 * `single` tek lider, `tie` eşitlik için cümlenin devamıdır.
 */
export function leadLine(
  scores: Record<string, number>,
  players: readonly SummaryPlayer[],
  how: (value: number) => string,
  single: string,
  tie: string,
  min = 1,
): string | null {
  const lead = leaders(scores, min);
  if (!lead) return null;
  return fit(`${names(players, lead.ids)} ${how(lead.value)} ${lead.ids.length === 1 ? single : tie}`);
}

/** Ondalığı virgülle yazar (en çok bir basamak): 23,5 · 24. */
export function decimal(n: number, digits = 1): string {
  return String(Number(n.toFixed(digits))).replace(".", ",");
}
