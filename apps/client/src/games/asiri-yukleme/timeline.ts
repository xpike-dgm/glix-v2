import { ASIRI_YUKLEME_OUTRO_MS } from "@glix/engine";

/**
 * Sonuç açılışının zaman çizelgesi (tek yer). Bugün sonuç tur bittikten sonra `ASIRI_YUKLEME_OUTRO_MS` (5 sn)
 * ekranda kalır; açılış bu sürenin içine sığar. Sonuç süresi uzarsa yalnız `budgetMs` (ve istenirse adım
 * süreleri) değişir.
 */
export const REVEAL_TIMELINE = {
  /** Açılışın tamamının bitmesi gereken süre (ms): sonuç süresi eksi okuma payı. */
  budgetMs: ASIRI_YUKLEME_OUTRO_MS - 500,
  /** Patlama sahnesi (flaş, parçalar, şok dalgası); yalnız patlama varsa. */
  boomMs: 1_000,
  /** Patlama yoksa toplam sayacından önceki kısa bekleme. */
  leadMs: 250,
  /** Toplam sayacının 0'dan gerçek toplama yükselişi. */
  countMs: 800,
  /** Sayaç bittikten sonra ilk satıra kadar ara. */
  afterCountMs: 200,
  /** Satırlar arası en uzun ara; satır çoksa kısalır. */
  rowGapMs: 320,
  /** Patlayan satırın arası normal satırın bu katıdır (daha ağır açılır). */
  exploderGapFactor: 1.5,
  /** Kendi puanının üstteki puan yazısına uçuşu. */
  flyMs: 550,
} as const;

export type RevealTimeline = { readonly [K in keyof typeof REVEAL_TIMELINE]: number };

export interface RevealSchedule {
  /** Toplam sayacının başladığı an (açılış başından ms). */
  countAt: number;
  countMs: number;
  /** Her satırın açıldığı an (satır sırasıyla). */
  rowAt: number[];
  /** Kendi puanının uçmaya başladığı an. */
  flyAt: number;
  /** Açılışın bittiği an. */
  doneAt: number;
}

/**
 * Satırların (sıralı; patlayanlar en sonda) açılış anları. Satır arası, bütçeye sığacak kadar kısaltılır;
 * sonuç her zaman `budgetMs` içinde biter.
 */
export function revealSchedule(
  exploded: readonly boolean[],
  boom: boolean,
  t: RevealTimeline = REVEAL_TIMELINE,
): RevealSchedule {
  const countAt = boom ? t.boomMs : t.leadMs;
  const rowsStart = countAt + t.countMs + t.afterCountMs;
  const units = exploded.reduce((sum, e) => sum + (e ? t.exploderGapFactor : 1), 0);
  const room = Math.max(0, t.budgetMs - t.flyMs - rowsStart);
  const gap = units > 0 ? Math.min(t.rowGapMs, room / units) : 0;
  const rowAt: number[] = [];
  let at = rowsStart;
  for (const e of exploded) {
    rowAt.push(Math.round(at));
    at += gap * (e ? t.exploderGapFactor : 1);
  }
  const flyAt = Math.round(at);
  return { countAt, countMs: t.countMs, rowAt, flyAt, doneAt: flyAt + t.flyMs };
}
