/** Açgözlülük Limiti — istemci ile sunucu arasındaki sözleşme. Kurallar: docs/KURALLAR.md §12. */

/** Seçim süresi (ms). */
export const ACGOZLULUK_CHOOSE_MS = 20_000;
/** Seçimler açıldıktan sonra sonucun ekranda kaldığı süre (ms); hazne animasyonu için. */
export const ACGOZLULUK_REVEAL_MS = 5_000;
export const ACGOZLULUK_DURATION_MS = ACGOZLULUK_CHOOSE_MS + ACGOZLULUK_REVEAL_MS;

/** Oyuncu sayısına göre sabit ortak limit tablosu (KURALLAR §12, madde 3). */
export const ACGOZLULUK_LIMITS: Readonly<Record<number, number>> = {
  3: 6,
  4: 11,
  5: 17,
  6: 24,
  7: 33,
  8: 43,
};

/** Ağdan gelen sayıya konan teknik üst sınır (gerçek üst sınır oyuncu sayısıdır). */
export const ACGOZLULUK_WIRE_MAX = 64;

/** Tablo dışı oyuncu sayısı için en yakın tablo satırı kullanılır. */
export function acgozlulukLimit(playerCount: number): number {
  const n = Math.min(8, Math.max(3, Math.trunc(playerCount)));
  return ACGOZLULUK_LIMITS[n] ?? 6;
}

export type AcgozlulukAction = { kind: "choose"; value: number };

/** Süre dolunca herkese açılan sonuç. */
export interface AcgozlulukReveal {
  /** Her katılımcının seçimi (seçmeyen 0). */
  choices: Record<string, number>;
  total: number;
  over: boolean;
}

/** Herkese açık görünüm (oda başına bir kez). Seçimler ve toplam süre dolana kadar burada yoktur. */
export interface AcgozlulukPublicView {
  startedAt: number;
  /** Seçim süresinin bitişi; seçimler bu anda açılır. */
  endsAt: number;
  /** Sonuç ekranının bitişi (oyunun bitişi). */
  revealEndsAt: number;
  limit: number;
  /** Seçilebilecek en büyük sayı (= oyuncu sayısı). */
  maxChoice: number;
  /** Süre dolmadan null. */
  reveal: AcgozlulukReveal | null;
}

/** Kişiye özel görünüm: yalnız kendi seçimin. */
export interface AcgozlulukView {
  /** Henüz seçmediysen ya da izleyiciysen null (seçilmemiş 0 sayılır). */
  myChoice: number | null;
}
