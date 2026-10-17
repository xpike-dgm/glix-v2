/** Çapraz Ateş — istemci ile sunucu arasındaki sözleşme. Kurallar: docs/KURALLAR.md §23, docs/A4-OYUNLAR.md. */

/** Hedef seçme süresi. Süre dolunca hedefler açılır. */
export const CAPRAZ_ATES_FIRE_MS = 25_000;
/** Hedefler açıldıktan sonra izlerin gösterildiği süre (oyun bu sürenin sonunda biter; yeni eylem kabul edilmez). */
export const CAPRAZ_ATES_REVEAL_MS = 7_000;
export const CAPRAZ_ATES_DURATION_MS = CAPRAZ_ATES_FIRE_MS + CAPRAZ_ATES_REVEAL_MS;

/** Kendin dışındaki bağlı bir katılımcıyı hedefle; süre bitene kadar değiştirilebilir (son seçim geçerli). */
export type CaprazAtesAction = { kind: "target"; target: string };

export interface CaprazAtesReveal {
  /** Her katılımcının hedefi; hedef seçmeyen null. */
  targets: Record<string, string | null>;
  /** Oyuncu başına puan (−1, 0, +1). */
  scores: Record<string, number>;
  /** Karşılıklı hedefleşen çiftler (her çift bir kez). */
  mutual: [string, string][];
}

/** Herkese açık görünüm. Süre bitene kadar hiçbir hedef ya da sayı içermez. */
export interface CaprazAtesPublicView {
  startedAt: number;
  /** Hedef seçme süresinin bitişi; hedefler bu anda açılır. */
  endsAt: number;
  /** Oyunun bitişi (izlerin gösterimi dahil). */
  finishAt: number;
  reveal: CaprazAtesReveal | null;
}

/** Kişiye özel görünüm: yalnız kendi hedefin. İzleyicide null. */
export interface CaprazAtesView {
  myTarget: string | null;
}
