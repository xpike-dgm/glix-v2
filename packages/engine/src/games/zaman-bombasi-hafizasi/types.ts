/** Zaman Bombası Hafızası — istemci ile sunucu arasındaki sözleşme. Kurallar: docs/KURALLAR.md §24, docs/A4-OYUNLAR.md. */

export const ZAMAN_BOMBASI_COLORS = ["kirmizi", "mavi", "yesil", "sari"] as const;
export type ZamanBombasiColor = (typeof ZAMAN_BOMBASI_COLORS)[number];

/** Başlangıç (ve her elenmeden sonraki) dizi uzunluğu. */
export const ZAMAN_BOMBASI_START_LENGTH = 2;
/** Dizi oynatılırken eleman başına süre. */
export const ZAMAN_BOMBASI_STEP_MS = 600;
/** Aktif oyuncunun giriş süresi: dizi uzunluğu × bu değer. */
export const ZAMAN_BOMBASI_INPUT_PER_ELEMENT_MS = 3_000;
/** İlk sıranın başlamasından önceki hazırlık payı. */
export const ZAMAN_BOMBASI_INTRO_MS = 1_500;
/** Doğru cevaptan sonra sonraki sıranın başlamasına kadar kısa nefes payı. */
export const ZAMAN_BOMBASI_PAUSE_OK_MS = 900;
/** Elenmeden sonra (çatlama ve pasife düşme gösterilsin diye) sonraki sıranın başlamasına kadar pay. */
export const ZAMAN_BOMBASI_PAUSE_FAIL_MS = 2_200;
/** Bu simülasyon/bot süre sınırı (oyun yalnız elenmelerle biter, sabit süresi yok). */
export const ZAMAN_BOMBASI_BOT_SPAN_MS = 150_000;

export type ZamanBombasiAction = { kind: "press"; color: ZamanBombasiColor };

export type ZamanBombasiPhase = "pause" | "playback" | "input" | "over";

export interface ZamanBombasiLast {
  /** Hangi sıranın sonucu (1'den başlar). */
  turn: number;
  player: string;
  kind: "ok" | "fail" | "timeout";
  /** Sonucun kesinleştiği an (sunucu saati, ms). */
  at: number;
  /** Yanlış basılan renk (yalnız `fail`). */
  color?: ZamanBombasiColor;
  /** Basılması gereken renk (yalnız `fail`); dizinin tamamı verilmez. */
  expected?: ZamanBombasiColor;
}

/**
 * Herkese açık görünüm. Sıra bilgisi mutlak zamanlarla verilir (istemci kendi saatinden evre türetir).
 * Hafıza oyunu: `sequence` yalnız hazırlık ve oynatma evrelerinde dolu, giriş evresinde `null` (tekrar gösterilmez).
 */
export interface ZamanBombasiPublicView {
  /** Sabit oyuncu sırası (maç başında bir kez karıştırılır). */
  order: string[];
  /** Elenenler, elenme sırasıyla. */
  eliminated: string[];
  /** Oyun içi puanlar (= genel skora aktarılan). */
  scores: Record<string, number>;
  /** Sırası olan oyuncu; oyun bitince null. */
  active: string | null;
  /** Bu sıradaki dizi uzunluğu. */
  length: number;
  phase: ZamanBombasiPhase;
  /** Sıra sayacı (1'den). */
  turn: number;
  /** Oynatmanın başladığı an; şimdiden ilerideyse hazırlık evresidir. */
  turnStart: number;
  /** Giriş evresinin başladığı an (= turnStart + uzunluk × stepMs). */
  inputStart: number;
  /** Giriş süresinin bittiği an (= inputStart + uzunluk × 3 sn). */
  deadline: number;
  stepMs: number;
  /** Oynatma evresinde şu an yanan elemanın sırası; başka evrede -1. */
  playbackIndex: number;
  /** Yalnız hazırlık ve oynatma evresinde; giriş evresinde null. */
  sequence: ZamanBombasiColor[] | null;
  /** Aktif oyuncunun bu sıradaki doğru basışları (yankı). Tam dizi hiçbir zaman burada olmaz. */
  pressed: ZamanBombasiColor[];
  /** Oyunun bitmesi için gereken elenme sayısı. */
  need: number;
  /** Son sıranın sonucu. */
  last: ZamanBombasiLast | null;
}

/** Kişiye özel görünüm (gizli bilgi yok; yalnız kendi durumun). */
export interface ZamanBombasiView {
  /** Elendin mi. İzleyicide false. */
  isOut: boolean;
  /** Sıra bende (hazırlık, oynatma veya giriş evresinde). İzleyicide false. */
  myTurn: boolean;
  /** Sıramın gelmesine kaç sıra var (0 = şimdi); elenmişte ve izleyicide null. */
  turnsAway: number | null;
}
