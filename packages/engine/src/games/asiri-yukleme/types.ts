/** Aşırı Yükleme — istemci ile sunucu arasındaki sözleşme. Kurallar: docs/KURALLAR.md §20, docs/A6-OYUNLAR.md. */

/** Ortak barın kapasitesi; her tıklama 1 doldurur. */
export const ASIRI_YUKLEME_CAPACITY = 100;
/** Bar 100'e ulaşınca başlayan gizli pencere (ms). */
export const ASIRI_YUKLEME_DANGER_MS = 3_000;
/** Teknik üst sınır (ms): kimse tıklamazsa oda takılmasın; dolarsa patlama olmadan sıralama. */
export const ASIRI_YUKLEME_CAP_MS = 90_000;
/** Tur bittikten sonra sonucun ekranda kaldığı süre (ms). */
export const ASIRI_YUKLEME_OUTRO_MS = 5_000;
export const ASIRI_YUKLEME_TOTAL_MS = ASIRI_YUKLEME_CAP_MS + ASIRI_YUKLEME_OUTRO_MS;
/**
 * Tek mesajda gönderilebilecek en çok tıklama. İstemci hızlı tıklamaları kısa aralıkla toplu gönderir
 * (sunucunun soket başına mesaj sınırını aşmamak için); sunucu toplu mesajı sırayla tek tek işler.
 */
export const ASIRI_YUKLEME_MAX_BATCH = 10;

/** `count` yoksa 1 tıklama. */
export type AsiriYuklemeAction = { kind: "tap"; count: number };

/** Tur bitince herkese açılan sonuç. */
export interface AsiriYuklemeReveal {
  /** Bar toplamı (patlamada 101: kapasiteyi aşan tıklama dahil). */
  total: number;
  /** Patlayan oyuncu; patlama yoksa null. */
  exploder: string | null;
  /** Her katılımcının tıklama sayısı. */
  clicks: Record<string, number>;
  /** Genel skora eklenen puanlar (patlayan −1). */
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
