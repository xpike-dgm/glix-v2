/** Ortak Nokta (TASLAK) — istemci ile sunucu arasındaki sözleşme. Kurallar: docs/TASLAK-OYUNLAR.md §1. */

/** Tur sayısı ve bir turdaki kutu (şekil+renk) sayısı. */
export const ORTAK_ROUNDS = 4;
export const ORTAK_TILES = 6;
/** Renk paleti ve şekil kümesi boyutu (istemci aynı sırayı çizer; renk körü için her kutu şekil de taşır). */
export const ORTAK_COLORS = 6;
export const ORTAK_SHAPES = 8;

/** Seçim süresi, sonuç süresi (son turda daha uzun) ve herkes "Tamam" deyince kalan süre (ms). */
export const ORTAK_CHOOSE_MS = 12_000;
export const ORTAK_REVEAL_MS = 5_000;
export const ORTAK_LAST_REVEAL_MS = 7_000;
export const ORTAK_LOCK_GRACE_MS = 1_000;
/** Oyunun en uzun süresi (ms); erken bitişte kısalır. */
export const ORTAK_DURATION_MS =
  ORTAK_ROUNDS * ORTAK_CHOOSE_MS + (ORTAK_ROUNDS - 1) * ORTAK_REVEAL_MS + ORTAK_LAST_REVEAL_MS;

/** Bir kutu: renk (0..5) ve şekil (0..7) indeksi. Sözcük yok; yalnız renk ve şekil verisi. */
export interface OrtakTile {
  color: number;
  shape: number;
}

export type OrtakAction = { kind: "choose"; tile: number } | { kind: "lock" };

/** Aynı kutuyu seçenler. */
export interface OrtakGroup {
  tile: number;
  ids: string[];
}

/** Süre dolunca herkese açılan tur sonucu. */
export interface OrtakReveal {
  /** Seçim yapanların kutuları (yapmayan yok). */
  picks: Record<string, number>;
  /** Gruplar: büyükten küçüğe; eşit boyutta kutu sırasıyla. Tek başına seçenler de gruptur (boyut 1). */
  groups: OrtakGroup[];
  /** En kalabalık grubun kutusu; eşitlik varsa ya da kimse seçmediyse null. */
  topTile: number | null;
  /** Bu turun mini puanı. */
  points: Record<string, number>;
}

export interface OrtakPublicView {
  startedAt: number;
  /** Gösterilen tur (1 tabanlı) ve toplamı. */
  round: number;
  rounds: number;
  phase: "choose" | "reveal";
  phaseStartedAt: number;
  phaseEndsAt: number;
  /** Bu turun kutuları (herkes için aynı sırada; herkes kendi telefonunda karışık sırada görür). */
  board: OrtakTile[];
  /** Açılmış turların mini puan toplamı. */
  totals: Record<string, number>;
  /** Seçimini kilitleyenler (yalnız kimler). */
  lockedIds: string[];
  /** Yalnız sonuç aşamasında. */
  reveal: OrtakReveal | null;
  /** Yalnız son turun sonucunda: genel skora eklenecek puanlar. */
  final: Record<string, number> | null;
}

export interface OrtakView {
  /** Bu oyuncunun ekranında kutuların sırası (kutu indeksleri). */
  layout: number[];
  myTile: number | null;
  locked: boolean;
}
