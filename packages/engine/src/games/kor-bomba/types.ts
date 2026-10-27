/** Kör Bomba — istemci ile sunucu arasındaki sözleşme. Kurallar: docs/KURALLAR.md §10, docs/A4-OYUNLAR.md. */

/** Patlama ilk verilişten en az / en çok bu kadar sonra (ms çözünürlükte rastgele). */
export const KOR_BOMBA_MIN_FUSE_MS = 15_000;
export const KOR_BOMBA_MAX_FUSE_MS = 20_000;
/** Her başarılı pas patlamaya bu aralıkta rastgele süre ekler. */
export const KOR_BOMBA_MIN_BONUS_MS = 1_000;
export const KOR_BOMBA_MAX_BONUS_MS = 4_000;

/**
 * Patlamadan sonra ekranın patlamayı gösterebilmesi için sonuç ekranına geçmeden önceki kısa bekleme (ms).
 * Kurallar patlama anında biter: pas, bu süre içinde de reddedilir; puanlar patlama anındaki taşıyıcıya göredir.
 */
export const KOR_BOMBA_OUTRO_MS = 2_000;

/**
 * Eylemler:
 * - `pass`: bomba taşıyıcıdan başka bir bağlı katılımcıya geçer.
 * - `predict` (O9): taşıyıcı olmayan katılımcı, bu elde (`turn` = o ana kadarki pas sayısı) bombanın patlayıp
 *   patlamayacağını tahmin eder. Tahmin gizlidir, el başına bir kez verilir ve değişmez.
 */
export type KorBombaAction =
  | { kind: "pass"; to: string }
  | { kind: "predict"; turn: number; explodes: boolean };

/** Patlamada +1 alan tahminci için üst sınır (oyun başına). */
export const KOR_BOMBA_PREDICT_BONUS = 1;

/** Son başarılı pas (herkes görür; eklenen süre görünmez). */
export interface KorBombaPass {
  /** 1'den başlayan pas sırası. */
  seq: number;
  from: string;
  to: string;
}

/** Herkese açık görünüm (oda başına bir kez). Patlama zamanı patlamadan önce burada asla yoktur. */
export interface KorBombaPublicView {
  startedAt: number;
  /** Bombayı şu an taşıyan katılımcı. */
  holder: string;
  /** Şimdiye kadarki pas sayısı. */
  passes: number;
  lastPass: KorBombaPass | null;
  /** Patlama gerçekleşti mi (süre bitince ilk tick'te true olur). */
  exploded: boolean;
  /** Yalnız patladıktan sonra dolu. */
  explodedAt: number | null;
  /** O9: patlamada "patlar" diye doğru bilenler (+1 alanlar). Yalnız patladıktan sonra dolu; öncesinde boş. */
  correctPredictors: string[];
}

/** Kişinin kendi tahmini ya da çözülmüş sonucu (yalnız sahibine gider). */
export interface KorBombaPrediction {
  /** Tahminin verildiği el (pas sayısı). */
  turn: number;
  explodes: boolean;
}
export interface KorBombaPredictionResult {
  turn: number;
  correct: boolean;
}

/**
 * Kişiye özel görünüm.
 * - `holder`: taşıyıcı; hiçbir süre alanı yoktur.
 * - `watcher`: taşıyıcı olmayan katılımcı; gerçek patlama zamanını görür.
 * - `spectator`: izleyici; süre görmez.
 */
export type KorBombaView =
  | { role: "holder"; lastResult: KorBombaPredictionResult | null }
  | {
      role: "watcher";
      explodeAt: number;
      lastBonusMs: number | null;
      /** Bu elde verdiğim tahmin; yoksa null. Başkasınınki asla yoktur. */
      prediction: KorBombaPrediction | null;
      /** Son çözülen tahminimin sonucu. */
      lastResult: KorBombaPredictionResult | null;
    }
  | { role: "spectator" };
