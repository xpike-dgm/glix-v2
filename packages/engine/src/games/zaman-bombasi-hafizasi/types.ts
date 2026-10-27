/** Zaman Bombası Hafızası — istemci ile sunucu arasındaki sözleşme. Kurallar: docs/KURALLAR.md §24, docs/A4-OYUNLAR.md. */

export const ZAMAN_BOMBASI_COLORS = ["kirmizi", "mavi", "yesil", "sari"] as const;
export type ZamanBombasiColor = (typeof ZAMAN_BOMBASI_COLORS)[number];

/** Başlangıç (ve her elenmeden sonraki) dizi uzunluğu. */
export const ZAMAN_BOMBASI_START_LENGTH = 2;
/** Dizi oynatılırken eleman başına süre. */
export const ZAMAN_BOMBASI_STEP_MS = 350;
/** Aktif oyuncunun giriş süresi: bu taban + dizi uzunluğu × eleman başı süre (O1). */
export const ZAMAN_BOMBASI_INPUT_BASE_MS = 1_500;
export const ZAMAN_BOMBASI_INPUT_PER_ELEMENT_MS = 1_000;
/** Toplam süre sınırı (oyun kurulduğu andan; oynatma dahil). Dolunca oyun biter (O1). */
export const ZAMAN_BOMBASI_TOTAL_MS = 90_000;
/** Ani ölüm: yeni bir sıranın dizisi kurulduğu an, oyun başından bu süre geçmişse (kesin büyük) dizi 2 renk uzar. */
export const ZAMAN_BOMBASI_SUDDEN_DEATH_AFTER_MS = 60_000;
/** Ani ölümde bir doğru sıradan sonra dizinin uzama miktarı (normalde 1). */
export const ZAMAN_BOMBASI_SUDDEN_DEATH_GROWTH = 2;
/** İlk sıranın başlamasından önceki hazırlık payı. */
export const ZAMAN_BOMBASI_INTRO_MS = 1_500;
/** Doğru cevaptan sonra sonraki sıranın başlamasına kadar kısa nefes payı. */
export const ZAMAN_BOMBASI_PAUSE_OK_MS = 900;
/** Elenmeden sonra (çatlama ve pasife düşme gösterilsin diye) sonraki sıranın başlamasına kadar pay. */
export const ZAMAN_BOMBASI_PAUSE_FAIL_MS = 2_200;
/** Simülasyon/bot süre sınırı (toplam süre sınırından biraz uzun). */
export const ZAMAN_BOMBASI_BOT_SPAN_MS = 95_000;

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
  /** Giriş süresinin bittiği an (= inputStart + 1,5 sn + uzunluk × 1 sn). */
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
  /** Oyunun başladığı an (toplam süre buradan işler). */
  startedAt: number;
  /** Toplam sürenin bittiği an (= startedAt + 90 sn). */
  endsAt: number;
  /** Ani ölümün başladığı an (= startedAt + 60 sn). */
  suddenDeathAt: number;
  /** Oyun süre dolduğu için mi bitti. */
  timeUp: boolean;
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
