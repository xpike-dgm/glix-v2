import { SIZMA_FINAL_MS, SIZMA_REVEAL_MS, SIZMA_UNMASK_MS } from "@glix/engine";

/**
 * Sızma açılışının zaman çizelgesi (tek yer). `OPENING` açılış başından (`reveal.openedAt`) ms; yakalanma
 * açılışı `SIZMA_UNMASK_MS` (7 sn), kurtulma açılışı `SIZMA_REVEAL_MS` (9 sn) içine sığar. `FINAL` son şanstan
 * sonraki son açılışın başından (`reveal.finalAt`) ms; `SIZMA_FINAL_MS` (5 sn) içine sığar.
 */
export const OPENING = {
  /** İlk oy avatarının kalktığı an. */
  flyFrom: 500,
  /** Bütün oyların uçuşu bu süreye yayılır (oy sayısından bağımsız). */
  flySpan: 2_400,
  /** Tek uçuşun süresi. */
  flyMs: 650,
  /** Sayım bitti; hüküm başlığı ("Yakalandı!" / "Oylar eşit"). */
  verdictAt: 3_700,
  /** Maske sallanır (yakalandı) ya da göz kırpar (kurtuldu). */
  maskAt: 4_100,
  /** Maske düşer ve kırılır; yüz açılır. */
  breakAt: 4_800,
  /** "KURTULDU!" damgası. */
  stampAt: 4_600,
  /** "Sızma kendini fark etti / etmedi" rozeti. */
  badgeAt: 5_600,
  /** Kurtulduysa: kelimeler ve puanlar. */
  wordsAt: 6_300,
  scoreAt: 7_000,
  caughtEnd: SIZMA_UNMASK_MS,
  escapedEnd: SIZMA_REVEAL_MS,
} as const;

export const FINAL = {
  /** İki kelime açılır. */
  wordsAt: 0,
  /** Tahmin sonucu ("KELİMEYİ ÇALDI!" / "Tutmadı!"). */
  verdictAt: 500,
  /** Puan satırı. */
  scoreAt: 1_500,
  endMs: SIZMA_FINAL_MS,
} as const;

/** `index`'inci uçuşun kalkış anı (açılış başından ms). */
export function flightAt(index: number, count: number): number {
  if (count <= 1) return OPENING.flyFrom;
  return OPENING.flyFrom + Math.round((index * (OPENING.flySpan - OPENING.flyMs)) / (count - 1));
}

/** Konuşma süresinin son 5 sn'si ve oylamanın son 5 sn'si: kırmızı nabız ve tik. */
export const URGENT_MS = 5_000;
