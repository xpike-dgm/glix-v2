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

/** Bomba taşıyıcıdan başka bir bağlı katılımcıya geçer. */
export type KorBombaAction = { kind: "pass"; to: string };

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
}

/**
 * Kişiye özel görünüm.
 * - `holder`: taşıyıcı; hiçbir süre alanı yoktur.
 * - `watcher`: taşıyıcı olmayan katılımcı; gerçek patlama zamanını görür.
 * - `spectator`: izleyici; süre görmez.
 */
export type KorBombaView =
  | { role: "holder" }
  | { role: "watcher"; explodeAt: number; lastBonusMs: number | null }
  | { role: "spectator" };
