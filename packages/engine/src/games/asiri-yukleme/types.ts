/** Aşırı Yükleme — istemci ile sunucu arasındaki sözleşme. Kurallar: docs/KURALLAR.md §20, docs/A6-OYUNLAR.md. */

/** Ortak barın kapasitesi; her tıklama 1 doldurur. */
export const ASIRI_YUKLEME_CAPACITY = 100;
/** Bar 100'e ulaşınca başlayan gizli pencere (ms); tur pencere sonuna kadar sürer, içinde basan herkes patlar. */
export const ASIRI_YUKLEME_DANGER_MS = 3_000;
/** Teknik üst sınır (ms): kimse tıklamazsa oda takılmasın; bar dolmadan biterse sıralama aynı kurala göre verilir. */
export const ASIRI_YUKLEME_CAP_MS = 90_000;
/** Tur bittikten sonra sonucun ekranda kaldığı süre (ms). */
export const ASIRI_YUKLEME_OUTRO_MS = 5_000;
export const ASIRI_YUKLEME_TOTAL_MS = ASIRI_YUKLEME_CAP_MS + ASIRI_YUKLEME_OUTRO_MS;
/**
 * Tek mesajda gönderilebilecek en çok tıklama. İstemci hızlı tıklamaları kısa aralıkla toplu gönderir
 * (sunucunun soket başına mesaj sınırını aşmamak için). Toplu mesajda 100'e kadar olan kısım "önce", aşan kısım
 * "sonra" sayılır.
 */
export const ASIRI_YUKLEME_MAX_BATCH = 10;

/** `count` yoksa 1 tıklama. */
export type AsiriYuklemeAction = { kind: "tap"; count: number };

/** Tur bitince herkese açılan sonuç. */
export interface AsiriYuklemeReveal {
  /** Bar toplamı: bütün tıklamalar (100'ü aşanlar dahil; patlama varsa 100'ün üstündedir). */
  total: number;
  /** Her katılımcının bar 100'e ulaşana kadar yaptığı tıklamalar (sıralamada sayılan). */
  before: Record<string, number>;
  /** Her katılımcının bar 100'ü geçtikten sonra yaptığı tıklamalar (> 0 ise patladı). */
  after: Record<string, number>;
  /** Patlayanlar (100'den sonra en az bir kez basanlar), katılım sırasıyla; patlama yoksa boş. */
  exploders: string[];
  /** Genel skora eklenen puanlar. */
  points: Record<string, number>;
}

/**
 * Herkese açık görünüm. Bar toplamı, tıklama sayıları ve gizli pencerenin bitişi tur bitene kadar
 * burada yoktur; yalnız bar 100'e ulaşınca `danger` true olur.
 */
export interface AsiriYuklemePublicView {
  startedAt: number;
  danger: boolean;
  /** Tur bitmeden null. */
  reveal: AsiriYuklemeReveal | null;
}

/** Kişiye özel görünüm: gizli bilgi yoktur; kendi tıklama sayın bile tur sonuna kadar gizlidir. */
export interface AsiriYuklemeView {
  /** İzleyici false. */
  participant: boolean;
}
