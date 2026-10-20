/** Sızma — istemci ile sunucu arasındaki sözleşme. Kurallar: docs/KURALLAR.md §3, docs/A6-OYUNLAR.md. */

/** İpucu aşaması süresizdir; bu yalnız odanın takılı kalmaması için teknik üst sınırdır (5 dk). */
export const SIZMA_CLUE_CAP_MS = 300_000;
export const SIZMA_VOTE_MS = 30_000;
/** Oylar açıldıktan sonra sonucun gösterildiği süre (oyun bu sürenin sonunda biter). */
export const SIZMA_REVEAL_MS = 8_000;
/** Herkes hazırsa aşamanın bitişine kalan süre (ms). */
export const SIZMA_LOCK_GRACE_MS = 1_000;
/** En uzun oyun süresi (ipucu aşaması tavana dayanırsa). */
export const SIZMA_MAX_DURATION_MS = SIZMA_CLUE_CAP_MS + SIZMA_VOTE_MS + SIZMA_REVEAL_MS;

export type SizmaAction =
  /** İpucu aşamasında "Oylamaya geç". */
  | { kind: "skip" }
  /** Kendin dahil bir katılımcıya oy ver; oylama bitene kadar değiştirilebilir (son oy geçerli). */
  | { kind: "vote"; target: string }
  /** Oylamada "Tamam": oyun kesinleşir. */
  | { kind: "lock" };

export type SizmaPhase = "clue" | "vote" | "reveal";

export interface SizmaReveal {
  /** Sızma oyuncusu. */
  infiltrator: string;
  /** Çoğunluğun gördüğü ve sızmanın gördüğü kelime (büyük harf). */
  commonWord: string;
  infiltratorWord: string;
  /** Verilen oylar: kim kime (oy vermeyen yok). */
  votes: Record<string, string>;
  /** Oyuncu başına alınan oy sayısı. */
  tally: Record<string, number>;
  /** Sızma tek başına en çok oyu aldı mı. */
  caught: boolean;
  /** Genel skora eklenen puanlar. */
  scores: Record<string, number>;
}

/** Herkese açık görünüm: kelimeler, sızma ve oylar sonuç açılana kadar hiçbir yerde yoktur. */
export interface SizmaPublicView {
  players: string[];
  phase: SizmaPhase;
  /** Söyleme sırası (iki ipucu turunda da aynı). */
  order: string[];
  startedAt: number;
  /** İpucu aşamasının teknik tavanı ya da (herkes geçtiyse) kapanış anı; oylamanın başlangıcı. */
  clueEndsAt: number;
  voteEndsAt: number;
  finishAt: number;
  /** Bulunulan aşamada hazır olanlar: ipucunda "Oylamaya geç" diyenler, oylamada "Tamam" diyenler. */
  ready: string[];
  reveal: SizmaReveal | null;
}

/** Kişiye özel görünüm. Kimse sızma olduğunu bilmez: herkes yalnız "kelimen" görür. */
export interface SizmaView {
  /** Senin kelimen (büyük harf); izleyicide null. */
  word: string | null;
  myVote: string | null;
  /** Bulunulan aşamada hazır dedin mi. */
  locked: boolean;
}
