/** Rus Ruleti — istemci ile sunucu arasındaki sözleşme. Kurallar: docs/KURALLAR.md §7, docs/A6-OYUNLAR.md. */

/** Patlama riski (yüzde): başlangıç, güvenli atış başına artış ve tavan. */
export const RUS_RULETI_START_RISK = 16;
export const RUS_RULETI_RISK_STEP = 10;
export const RUS_RULETI_MAX_RISK = 76;
/** Karar süresi (ms); açılış penceresi bittiğinde başlar. */
export const RUS_RULETI_DECISION_MS = 18_000;
/** Her atıştan sonra sonuç animasyonu için bekleme (ms); bu sürede eylem kabul edilmez. */
export const RUS_RULETI_OPEN_MS = 2_500;

/** "Kâhin" rozeti için gereken en az doğru "Evet, patlar" tahmini (O9); ayrıca "Evet"lerin en az yarısı doğru olmalı. */
export const RUS_RULETI_KAHIN_MIN_CORRECT = 1;

/**
 * Eylemler:
 * - `shoot`: silah sahibi hedefe ateş eder.
 * - `predict` (O9): elenen izleyici, sıradaki atışın (`turn` = o ana kadarki atış sayısı) patlayıp patlamayacağını
 *   tahmin eder. Tahmin gizlidir, atış başına bir kez verilir ve değişmez; puan vermez.
 */
export type RusRuletiAction =
  | { kind: "shoot"; target: string }
  | { kind: "predict"; turn: number; explodes: boolean };

/** Son atış: herkes görür (patlama atış anında belirlenir, önceden gizli değer yoktur). */
export interface RusRuletiShot {
  /** 1'den başlayan atış sırası. */
  seq: number;
  shooter: string;
  target: string;
  /** Süre dolduğu için sunucu ateş etti. */
  auto: boolean;
  exploded: boolean;
  /** Atış anındaki risk (yüzde). */
  risk: number;
  /** Atışın sunucu zamanı (ms). */
  at: number;
}

export interface RusRuletiResult {
  /** Hayatta kalanlar (+1). */
  survivors: string[];
  /** Elenenler, elenme sırasıyla (0). */
  eliminated: string[];
  /** O9: "Kâhin" rozeti alanlar (patlamayı bilenler). Yalnız mini oyun bitince herkese açılır; puan vermez. */
  kahinler: string[];
}

/** Elenen oyuncunun son çözülen tahmininin sonucu (yalnız sahibine gider). */
export interface RusRuletiPredictionResult {
  turn: number;
  correct: boolean;
}

/** Herkese açık görünüm. */
export interface RusRuletiPublicView {
  startedAt: number;
  /** Bütün katılımcılar (başlangıç sırası). */
  players: string[];
  alive: string[];
  eliminated: string[];
  /** Silahı tutan; oyun bitince son atıştan sonraki sahip. */
  holder: string;
  /** Sıradaki atışın patlama riski (yüzde). */
  risk: number;
  shots: number;
  last: RusRuletiShot | null;
  /** Karar penceresi bu ana kadar kapalıdır (sonuç animasyonu). */
  openAt: number;
  /** Karar süresinin bitişi; bitince sunucu otomatik ateş eder. Oyun bitince null. */
  deadline: number | null;
  over: boolean;
  result: RusRuletiResult | null;
}

/** Kişiye özel görünüm: oyuncunun durumu. */
export type RusRuletiView =
  | { role: "alive" }
  | { role: "spectator" }
  | {
      role: "out";
      /** Şu an tahmin edilen atış sırası (eylemdeki `turn`). */
      turn: number;
      /** Bu atış için verdiğim tahmin (patlar mı); yoksa null. Başkasınınki asla yoktur. */
      prediction: boolean | null;
      lastResult: RusRuletiPredictionResult | null;
    };
