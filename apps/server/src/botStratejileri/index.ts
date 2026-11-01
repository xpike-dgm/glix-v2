/**
 * Oda botlarının OYNAMA stratejileri (bots.ts kullanır). Motorun `BOTS`'u testler için rastgele "fuzz" üreticileridir
 * (bilerek bozuk metin ve geçersiz hamle dener); oda botu sahibin oyunu denemesi için düzgün oynamalıdır. Burada her
 * oyun için insan gibi davranan bir strateji vardır; olmayan oyunda bot `BOTS`'a döner.
 *
 * Strateji yalnız herkese açık görünüme ve botun KENDİ görünümüne bakar. Görünüm beklenen biçimde değilse (oyun
 * değişti) strateji hata verir ya da hiçbir şey yapmaz; bots.ts hatayı yakalar (yazı oyununda pas, ötekilerde `BOTS`).
 */
import type { Rng } from "@glix/engine";
import { isCleanBotText } from "./metin.js";
import { STRATEGIES } from "./oyunlar.js";

export interface PlayCtx {
  rng: Rng;
  /** Botun oyuncu kimliği. */
  me: string;
  pub: unknown;
  priv: unknown;
  /** Bağlı katılımcılar. */
  connected: readonly string[];
  /** Oyun saati (görünümdeki zamanlarla aynı saat). */
  now: number;
  /** Botun bu oyundaki küçük belleği (oyun değişince sıfırlanır). */
  mem: Record<string, unknown>;
}

/** Bir adım: gönderilecek eylem (yoksa bekler) ve isteğe bağlı bir sonraki uyanma (ms). */
export interface PlayStep {
  action?: unknown;
  next?: number;
}

export type PlayStrategy = (c: PlayCtx) => PlayStep | null;

/** Oyun kimliği -> oynama stratejisi. */
export const PLAY_STRATEGIES: Readonly<Record<string, PlayStrategy>> = STRATEGIES;

/**
 * Metin yazılan oyunlar: strateji bozulursa bot `BOTS`'a dönmez (onun bilerek bozuk metinleri ekrana çıkmasın), pas geçer.
 */
export const TEXT_GAMES: ReadonlySet<string> = new Set([
  "sozluk-blofu",
  "cagrisim-agi",
  "yazi-yaz",
  "kendim",
  "laf-sokma",
  "bozuk-telefon",
  "sizma",
  "karalama-defteri",
]);

/**
 * Son kapı: eylemde oyuncuya gösterilecek bir `text` varsa temiz olmalı (görünmez karakter yok, kısa, denetimden
 * geçer). Temiz değilse eylem gönderilmez.
 */
export function isPresentable(payload: unknown): boolean {
  if (payload === null || typeof payload !== "object") return true;
  const text = (payload as { text?: unknown }).text;
  return text === undefined || (typeof text === "string" && isCleanBotText(text));
}
