/** Kör Kronometre — istemci ile sunucu arasındaki sözleşme. Kurallar: docs/KURALLAR.md §9 (O6), docs/A6-OYUNLAR.md. */

/** Hedef süre aralığı (tam saniye, uçlar dahil); her oyunda setup'ta tohumlu RNG ile seçilir (O6). */
export const KOR_KRONOMETRE_TARGET_MIN_S = 7;
export const KOR_KRONOMETRE_TARGET_MAX_S = 13;
/** Basış süresi = hedef + bu pay (ms). */
export const KOR_KRONOMETRE_EXTRA_MS = 8_000;
/** Basışlar açıldıktan sonra sonucun ekranda kaldığı süre (ms). */
export const KOR_KRONOMETRE_REVEAL_MS = 6_000;
/** Herkes bastıysa sonucun açılmasına kalan süre (ms). */
export const KOR_KRONOMETRE_LOCK_GRACE_MS = 1_000;
/** Basış süresi (ms): hedef + 8 sn. */
export const korKronometreDurationMs = (targetMs: number): number => targetMs + KOR_KRONOMETRE_EXTRA_MS;
/** En uzun olası toplam süre (hedef 13 sn): basış süresi + sonuç gösterimi. Bot/simülasyon penceresi. */
export const KOR_KRONOMETRE_TOTAL_MS =
  KOR_KRONOMETRE_TARGET_MAX_S * 1_000 + KOR_KRONOMETRE_EXTRA_MS + KOR_KRONOMETRE_REVEAL_MS;

export type KorKronometreAction = { kind: "press" };

/** Süre dolunca açılan bir oyuncunun satırı. */
export interface KorKronometreEntry {
  playerId: string;
  /** Basış anı (oyun başından, ms); basmayan için null. */
  ms: number | null;
  pressed: boolean;
  /** |ms − hedef|; basmayan için null. */
  distance: number | null;
  /** Eşit mesafede aynı derece; sonraki derece atlanır (1, 1, 3 …). Basmayan sıralamaya girmez: null. */
  rank: number | null;
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
  /** Herkese açık hedef an (ms); tam saniye, 7–13 sn. Gerçek sayaç yine gizlidir. */
  targetMs: number;
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
