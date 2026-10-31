/** Çapraz Ateş — istemci ile sunucu arasındaki sözleşme. Kurallar: docs/KURALLAR.md §23. */

/** Tur sayısı: tur 1 (kısa açılış) + tur 2 (final açılış). */
export const CAPRAZ_ATES_ROUNDS = 2;
/** Her turdaki seçim süresi. Süre dolunca o turun hedefleri açılır. */
export const CAPRAZ_ATES_FIRE_MS = 20_000;
/** Tur 1 bittikten sonraki kısa açılış (kim kimi vurdu, tur puanı); ardından tur 2 başlar. */
export const CAPRAZ_ATES_INTERVAL_MS = 5_000;
/** Final açılışı (tur 2'nin hedefleri açıldıktan sonra); oyun bu sürenin sonunda biter, yeni eylem kabul edilmez. */
export const CAPRAZ_ATES_REVEAL_MS = 8_000;
/** Erken bitiş olmazsa oyunun toplam süresi: 20 + 5 + 20 + 8 sn. */
export const CAPRAZ_ATES_DURATION_MS =
  CAPRAZ_ATES_FIRE_MS + CAPRAZ_ATES_INTERVAL_MS + CAPRAZ_ATES_FIRE_MS + CAPRAZ_ATES_REVEAL_MS;

/**
 * Kendin dışındaki bağlı bir katılımcıyı hedefle (`target`) ya da siper al (`cover`); süre bitene ya da kilide kadar
 * değiştirilebilir (son seçim geçerli). `lock` seçimi kesinleştirir ("Ateşe hazır").
 */
export type CaprazAtesAction = { kind: "target"; target: string } | { kind: "cover" } | { kind: "lock" };

/** Son kilitten sonra hedeflerin açılmasına kalan süre (ms). */
export const CAPRAZ_ATES_LOCK_GRACE_MS = 1_000;

/** Açılmış bir turun sonucu. */
export interface CaprazAtesRoundReveal {
  /** Her katılımcının hedefi; hedef seçmeyen ya da siperdeki null. */
  targets: Record<string, string | null>;
  /** Siper alanlar (katılım sırasıyla). */
  cover: string[];
  /** O turun puanı (−1, 0, +1). */
  scores: Record<string, number>;
  /** Karşılıklı hedefleşen çiftler (her çift bir kez). */
  mutual: [string, string][];
}

/**
 * Herkese açık görünüm. Bir turun hedefleri ve siperleri ancak o turun süresi bitince `rounds`a girer; o ana kadar
 * hiçbir hedef, siper ya da sayı içermez.
 */
export interface CaprazAtesPublicView {
  /** Oyunun (tur 1'in) başlangıcı. */
  startedAt: number;
  /** Şu anki ya da sıradaki seçim turu (1 ya da 2). Tur 1 açıldıktan sonra 2 olur. */
  round: 1 | 2;
  /** Bu turun seçim başlangıcı; tur 2'de tur 1'in kısa açılışından sonradır. */
  roundStartedAt: number;
  /** Bu turun seçim bitişi; hedefler bu anda açılır. */
  endsAt: number;
  /** Oyunun bitişi (final açılışı dahil). Tur 1'de beklenen bitiştir. */
  finishAt: number;
  /** Açılmış turlar (sırayla). Tur 1 açılınca 1, tur 2 açılınca 2 öğe. */
  rounds: CaprazAtesRoundReveal[];
  /** İki tur da açılınca oyuncu başına toplam puan (−2…+2); öncesinde null. */
  totals: Record<string, number> | null;
  /** Bu turda seçimini kilitleyenler (yalnız kimler; seçimin kendisi değil). */
  lockedIds: string[];
}

/** Kişiye özel görünüm: yalnız bu turdaki kendi seçimin. İzleyicide boş. */
export interface CaprazAtesView {
  myTarget: string | null;
  /** Bu turda siperdesin. */
  cover: boolean;
  /** Seçimini kilitledin mi. */
  locked: boolean;
}
