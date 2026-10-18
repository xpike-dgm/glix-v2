/** Kör Kronometre — istemci ile sunucu arasındaki sözleşme. Kurallar: docs/KURALLAR.md §9, docs/A6-OYUNLAR.md. */

/** Basış süresi (ms). Basmayan oyuncunun zamanı da bu değer sayılır. */
export const KOR_KRONOMETRE_DURATION_MS = 18_000;
/** Hedef an (ms), oyunun başlangıcından itibaren. */
export const KOR_KRONOMETRE_TARGET_MS = 10_000;
/** Basışlar açıldıktan sonra sonucun ekranda kaldığı süre (ms). */
export const KOR_KRONOMETRE_REVEAL_MS = 6_000;
export const KOR_KRONOMETRE_TOTAL_MS = KOR_KRONOMETRE_DURATION_MS + KOR_KRONOMETRE_REVEAL_MS;

export type KorKronometreAction = { kind: "press" };

/** Süre dolunca açılan bir oyuncunun satırı. */
export interface KorKronometreEntry {
  playerId: string;
  /** Basış anı (oyun başından, ms); basmayan için 18 000. */
  ms: number;
  pressed: boolean;
  /** |ms − hedef|. */
  distance: number;
  /** Eşit mesafede aynı derece; sonraki derece atlanır (1, 1, 3 …). */
  rank: number;
  /** Genel skora eklenen puan. */
  points: number;
}

/** Süre dolunca herkese açılan sonuç; yakından uzağa sıralıdır. */
export interface KorKronometreReveal {
  entries: KorKronometreEntry[];
}

/** Herkese açık görünüm. Süre dolmadan hiçbir basış (kim bastığı da) burada yoktur. */
export interface KorKronometrePublicView {
  startedAt: number;
  /** Basış süresinin bitişi; seçimler bu anda açılır. */
  endsAt: number;
  /** Sonuç ekranının bitişi (oyunun bitişi). */
  revealEndsAt: number;
  /** Süre dolmadan null. */
  reveal: KorKronometreReveal | null;
}

/** Kişiye özel görünüm: yalnız bastın mı; basış anı sona kadar sahibine de gizlidir. */
export interface KorKronometreView {
  pressed: boolean;
}
