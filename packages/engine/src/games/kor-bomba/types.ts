/** Kör Bomba — istemci ile sunucu arasındaki sözleşme. Kurallar: docs/KURALLAR.md §10, docs/A4-OYUNLAR.md. */

/** Patlama ilk verilişten en az / en çok bu kadar sonra (ms çözünürlükte rastgele). */
export const KOR_BOMBA_MIN_FUSE_MS = 15_000;
export const KOR_BOMBA_MAX_FUSE_MS = 20_000;
/** 1.–3. pasın fitile eklediği süre aralığı (BM-M2; ms çözünürlükte rastgele). */
export const KOR_BOMBA_MIN_BONUS_MS = 1_000;
export const KOR_BOMBA_MAX_BONUS_MS = 4_000;
/** 4.–6. pasın eklediği süre aralığı (BM-M2). 7. pas ve sonrası 0 ekler. */
export const KOR_BOMBA_LATE_MIN_BONUS_MS = 500;
export const KOR_BOMBA_LATE_MAX_BONUS_MS = 2_000;
/** BM-M2: fitil hiçbir durumda oyunun başından bu kadar sonrasını geçmez (güvenlik tavanı). */
export const KOR_BOMBA_FUSE_CAP_MS = 45_000;
/** BM-M1: bombayı alan bu kadar süre pas veremez ("Fitil tutuşuyor…"); oyunun ilk taşıyıcısı dahil. */
export const KOR_BOMBA_LOCK_MS = 1_500;
/** BM-M3: "PATLAR!" bahsi fitilde en az bu kadar varken verilmelidir; daha geç gelen bahis reddedilir, hak yanmaz. */
export const KOR_BOMBA_BET_CUTOFF_MS = 3_000;

/**
 * Patlamadan sonra ekranın patlamayı gösterebilmesi için sonuç ekranına geçmeden önceki kısa bekleme (ms).
 * Kurallar patlama anında biter: pas, bu süre içinde de reddedilir; puanlar patlama anındaki taşıyıcıya göredir.
 */
export const KOR_BOMBA_OUTRO_MS = 2_000;

/**
 * BM-M2: `seq`. pasın (1'den) ekleyebileceği süre aralığı; 7. pastan sonra null (0 eklenir).
 * Tavan (`KOR_BOMBA_FUSE_CAP_MS`) ayrıca uygulanır.
 */
export function korBombaBonusRange(seq: number): { min: number; max: number } | null {
  if (seq <= 3) return { min: KOR_BOMBA_MIN_BONUS_MS, max: KOR_BOMBA_MAX_BONUS_MS };
  if (seq <= 6) return { min: KOR_BOMBA_LATE_MIN_BONUS_MS, max: KOR_BOMBA_LATE_MAX_BONUS_MS };
  return null;
}

/**
 * Eylemler:
 * - `pass`: bomba taşıyıcıdan başka bir bağlı katılımcıya geçer (BM-M1: alındıktan 1,5 sn sonra; 3+ bağlıda
 *   az önce atana hemen geri verilemez).
 * - `bet` (BM-M3): taşıyıcı olmayan katılımcının oyun boyunca tek "PATLAR!" bahsi. `turn` = o ana kadarki pas sayısı;
 *   bahis o elin taşıyıcısına bağlanır. Gizlidir; fitilde 3 sn'den az kaldıysa kabul edilmez (hak yanmaz).
 */
export type KorBombaAction = { kind: "pass"; to: string } | { kind: "bet"; turn: number };

/** Patlamada +1 alan bahisçi için üst sınır (oyun başına). */
export const KOR_BOMBA_PREDICT_BONUS = 1;

/** Son başarılı pas (herkes görür; eklenen süre görünmez). */
export interface KorBombaPass {
  /** 1'den başlayan pas sırası. */
  seq: number;
  from: string;
  to: string;
}

/** BM-U6: bombanın bir eli (patlamadan sonra herkese açılır). */
export interface KorBombaHand {
  holder: string;
  /** Bombayı elinde tuttuğu süre (ms). */
  heldMs: number;
}

/** BM-U6: bombanın yolculuğu ve fitil hesabı. Yalnız patladıktan sonra `publicView`'da; öncesinde hiçbir yerde yok. */
export interface KorBombaJourney {
  /** Fitilin oyun başındaki süresi (ms). */
  fuseMs: number;
  /** Her pasın eklediği süre (ms), pas sırasıyla (tavanla kırpılmış, 0 olabilir). */
  bonusesMs: number[];
  /** Patlamaya kadarki toplam süre (ms) = fuseMs + bonusların toplamı. */
  totalMs: number;
  /** Eller, sırasıyla; son el patlayan eldir. */
  hands: KorBombaHand[];
}

/** Herkese açık görünüm (oda başına bir kez). Patlama zamanı patlamadan önce burada asla yoktur. */
export interface KorBombaPublicView {
  startedAt: number;
  /** Bombayı şu an taşıyan katılımcı. */
  holder: string;
  /** Şimdiye kadarki pas sayısı. */
  passes: number;
  lastPass: KorBombaPass | null;
  /**
   * BM-U3: bombayı sırayla taşıyanlar (ilk taşıyıcı, ardından her pasın alıcısı). Herkes pasları zaten canlı görür;
   * süre bilgisi taşımaz.
   */
  trail: string[];
  /** BM-M1: şu anki taşıyıcının pas verebileceği en erken an (eli aldığı an + 1,5 sn). Süreyle ilgisi yoktur. */
  lockedUntil: number;
  /** Patlama gerçekleşti mi (fitil bitince true olur). */
  exploded: boolean;
  /** Yalnız patladıktan sonra dolu. */
  explodedAt: number | null;
  /** BM-M3: patlamada "PATLAR!" bahsi tutanlar (+1 alanlar). Yalnız patladıktan sonra dolu; öncesinde boş. */
  correctPredictors: string[];
  /** BM-U6: yalnız patladıktan sonra dolu. */
  journey: KorBombaJourney | null;
}

/** Kişinin kendi bahsi (yalnız sahibine gider). `turn` bahsin bağlandığı el (pas sayısı). */
export interface KorBombaBet {
  turn: number;
  /** Bahsin bağlandığı elin taşıyıcısı. */
  holder: string;
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
  | { role: "holder"; betUsed: boolean; lastResult: KorBombaPredictionResult | null }
  | {
      role: "watcher";
      explodeAt: number;
      lastBonusMs: number | null;
      /** Bu elde duran bahsim; yoksa null. Başkasınınki asla yoktur. */
      bet: KorBombaBet | null;
      /** Tek "PATLAR!" hakkımı kullandım mı. */
      betUsed: boolean;
      /** Bahsimin sonucu (pasla yandıysa false, patlamada tuttuysa true). */
      lastResult: KorBombaPredictionResult | null;
    }
  | { role: "spectator" };
