/** Butona Bas — istemci ile sunucu arasındaki sözleşme. Kurallar: docs/KURALLAR.md §6 (O8 ve BB değişiklikleri dahil). */

/** Tur sayısı; her turda pencere daralır. */
export const BUTONA_BAS_ROUNDS = 3;
/** Turlara göre eşleşme penceresi uzunluğu (ms): 1. tur 300, 2. tur 200, 3. tur 120. */
export const BUTONA_BAS_WINDOWS_MS: readonly number[] = [300, 200, 120];
/** Bir turun süresi (ms); 3 tur = 45 sn oyun. */
export const BUTONA_BAS_ROUND_MS = 15_000;
/** Turlar arasındaki ara (ms): basışlar sayılmaz, tur özeti gösterilir. */
export const BUTONA_BAS_GAP_MS = 3_000;
/** Oyunun tamamı (ms): 3 tur + 2 ara. */
export const BUTONA_BAS_DURATION_MS =
  BUTONA_BAS_ROUNDS * BUTONA_BAS_ROUND_MS + (BUTONA_BAS_ROUNDS - 1) * BUTONA_BAS_GAP_MS;
/** İlk turun pencere uzunluğu (ms); eski sabit. */
export const BUTONA_BAS_WINDOW_MS = BUTONA_BAS_WINDOWS_MS[0] ?? 300;
/** BB-M1: sayılan basıştan sonra buton bu kadar "dolar" (ms); bu sürede gelen basış sessizce yok sayılır. */
export const BUTONA_BAS_COOLDOWN_MS = 1_000;
/**
 * BB-M4: istemcinin bildirdiği dokunma anı sunucunun aldığı andan en çok bu kadar eskiyse kabul edilir (ms).
 * Pencereler kapanıştan bu kadar sonra puanlanır; böylece sonucu görüp geriye tarihli basışla pencereye girilemez.
 */
export const BUTONA_BAS_AT_MAX_AGE_MS = 250;
/** BB-M2: kalabalık bonusu bu kadar ve daha çok bağlı katılımcıda geçerlidir. */
export const BUTONA_BAS_CROWD_MIN = 4;
/** BB-M2: kalabalık penceresinde basanların her birinin aldığı puan. */
export const BUTONA_BAS_CROWD_POINTS = 2;

/** Tur `round` (0 tabanlı) için pencere uzunluğu (ms). */
export function butonaBasWindowMs(round: number): number {
  const i = Math.min(BUTONA_BAS_ROUNDS - 1, Math.max(0, Math.floor(round)));
  return BUTONA_BAS_WINDOWS_MS[i] ?? BUTONA_BAS_WINDOW_MS;
}

/** Tur `round` (0 tabanlı) başlangıcı: oyun başından ms. */
export function butonaBasRoundOffset(round: number): number {
  return round * (BUTONA_BAS_ROUND_MS + BUTONA_BAS_GAP_MS);
}

/** BB-M2 eşiği: `connected` bağlı katılımcıda kalabalık sayılmak için gereken en az basan (yoksa null). */
export function butonaBasCrowdNeed(connected: number): number | null {
  return connected >= BUTONA_BAS_CROWD_MIN ? Math.floor(connected / 2) + 1 : null;
}

/** `at`: dokunma anı (sunucu saati, ms); verilmezse sunucunun aldığı an sayılır. */
export type ButonaBasAction = { kind: "press"; at?: number };

/** `crowd`: yarıdan fazlası bastı (BB-M2) · `full`: bağlı herkes bastı ("TAM EKİP!"). */
export type ButonaBasCrowd = "crowd" | "full";

export interface ButonaBasWindowResult {
  /** Tur numarası (0 tabanlı). */
  round: number;
  /** Tur içindeki pencere sırası (0'dan; yalnız basış olan pencereler sayılır). */
  index: number;
  pressers: string[];
  outcome: "match" | "solo";
  /** Basanların her birinin aldığı puan: +1, kalabalıkta +2, tek basışta −1. */
  points: number;
  /** Kalabalık bonusu (yalnız 4+ bağlı katılımcıda); yoksa null. */
  crowd: ButonaBasCrowd | null;
  /** Pencerenin puanlandığı an (sunucu saati, ms): kapanış + 250 ms, en geç tur sonu. */
  settledAt: number;
}

/** `play`: tur sürüyor · `gap`: turlar arası ara · `over`: oyun bitti. */
export type ButonaBasPhase = "play" | "gap" | "over";

/** BB-U7 son açılış verisi: herkesin gördüğü pencerelerden hesaplanır (gizli bilgi yok). */
export interface ButonaBasFinal {
  /** Aynı pencerede birlikte basan ikililer: ortak pencere sayısı (çoktan aza; eşitse oyuncu sırası). */
  pairs: { a: string; b: string; count: number }[];
  /** Oyuncu başına tek kaldığı (−1) pencere sayısı. */
  solos: Record<string, number>;
}

/** Herkese açık görünüm (oda başına bir kez hesaplanır). */
export interface ButonaBasPublicView {
  startedAt: number;
  endsAt: number;
  /** Tur numarası (1 tabanlı); aradayken yaklaşan tur. */
  round: number;
  rounds: number;
  phase: ButonaBasPhase;
  /** Gösterilen turun pencere uzunluğu (ms); aradayken yaklaşan turunki. */
  windowMs: number;
  /** Tur oynanırken turun bitişi; aradayken yaklaşan turun başlangıcı; bitince oyunun bitişi. */
  phaseEndsAt: number;
  /** Canlı mini oyun puanları (turlar boyunca toplam). */
  scores: Record<string, number>;
  /** Tur tur kazanılan puan (oyuncu -> [tur 1, tur 2, tur 3]). */
  roundScores: Record<string, number[]>;
  /** Son puanlanan, en az bir basış olan pencereler; en yenisi sonda, en fazla 8. */
  recent: ButonaBasWindowResult[];
  /** Oyun bitince son açılış verisi; önce null. */
  final: ButonaBasFinal | null;
}

/** Kişiye özel görünüm. */
export interface ButonaBasView {
  /** İzleyicide null. */
  myScore: number | null;
  /** Bu oyuncunun açık (henüz kapanmamış) bir pencerede basışı var mı. */
  pressedThisWindow: boolean;
  /** BB-M1: buton bu andan önce yeniden sayılmaz (sunucu saati, ms); dolu ise null. */
  readyAt: number | null;
}

/** BB-U7: en uyumlu ikili (en çok ortak pencere; en az 1) ve yalnız kurt (en çok tek basış; en az 1). */
export function butonaBasHighlights(
  final: ButonaBasFinal,
  players: readonly string[],
): { pair: { a: string; b: string; count: number } | null; lone: { id: string; count: number } | null } {
  const pair = final.pairs.find((p) => p.count > 0) ?? null;
  let lone: { id: string; count: number } | null = null;
  for (const id of players) {
    const c = final.solos[id] ?? 0;
    if (c > 0 && (lone === null || c > lone.count)) lone = { id, count: c };
  }
  return { pair, lone };
}
