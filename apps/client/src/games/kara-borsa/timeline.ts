import { BORSA_REVEAL_MS } from "@glix/engine";

/**
 * Tur açılışının zaman çizelgesi (KB-U1; tek yer). Değerler açılışın başından (sunucunun `stageStartedAt`'i) ms'dir;
 * tamamı `BORSA_REVEAL_MS` (8 sn) içine sığar. Teklif satırları düşükten yükseğe tek tek açılır (kazanan en son),
 * ardından kutunun kapağı kalkar, değer sayarak yükselir ve kazanan satırına kâr/zarar damgası basılır.
 */
export const REVEAL_TIMELINE = {
  /** Tokmağın inişi (ekranın ortasında). */
  gavelMs: 380,
  /** "SATILDI!" damgası ve tokmak sesi. */
  stampAt: 380,
  /** Tokmak sahnesinin çekildiği an. */
  gavelOutAt: 1_150,
  /** İlk teklif satırı. */
  rowsAt: 1_200,
  /** Satır başına süre ("her satır yarım saniye"). */
  rowStep: 500,
  /** Son satırdan sonra kapağın kalkmasına kadar ara. */
  lidGap: 250,
  /** Kapak kalktıktan sonra değerin saymaya başladığı an. */
  countDelay: 250,
  /** Değerin 0'dan saymasının süresi. */
  countMs: 700,
  /** Kapaktan kâr/zarar damgasına. */
  verdictDelay: 1_150,
  /** Damgadan oyuncu şeridinin kâra dönmesine (ve son turda özete). */
  summaryDelay: 450,
  /** Açılışın sonu. */
  endMs: BORSA_REVEAL_MS,
} as const;

export interface RevealSchedule {
  /** i'inci satırın (düşükten yükseğe) belirdiği an. */
  rowAt: (i: number) => number;
  lidAt: number;
  countAt: number;
  verdictAt: number;
  summaryAt: number;
}

/** `rows` satırlı açılışın anları (8 oyuncuda bile 8 sn'ye sığar). */
export function revealSchedule(rows: number): RevealSchedule {
  const t = REVEAL_TIMELINE;
  const n = Math.max(1, rows);
  const lidAt = t.rowsAt + n * t.rowStep + t.lidGap;
  const verdictAt = lidAt + t.verdictDelay;
  return {
    rowAt: (i) => t.rowsAt + i * t.rowStep,
    lidAt,
    countAt: lidAt + t.countDelay,
    verdictAt,
    summaryAt: Math.min(t.endMs - 300, verdictAt + t.summaryDelay),
  };
}

/** Değer sayacı: `elapsed` anında ekranda yazan sayı (0'dan gerçek değere; lanetli eksiye doğru). */
export function countedValue(value: number, elapsed: number, countAt: number): number {
  const t = REVEAL_TIMELINE;
  const p = Math.min(1, Math.max(0, (elapsed - countAt) / t.countMs));
  const eased = 1 - (1 - p) ** 3;
  return Math.round(value * eased);
}

/** Teklif aşamasının son anları: zarf/seçici titrer, tik hızlanır. */
export const BID_TENSION = {
  /** Gerilimin başladığı kalan süre. */
  startMs: 5_000,
  /** Tiklerin hızlandığı kalan süre. */
  fastMs: 2_000,
} as const;
