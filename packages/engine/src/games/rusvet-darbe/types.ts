/** Rüşvet ve Darbe — istemci ile sunucu arasındaki sözleşme. Kurallar: docs/KURALLAR.md §11, docs/A6-OYUNLAR.md. */

export const RUSVET_VOTE_MS = 20_000;
/** Herkes "Tamam" deyince oylamanın / dağıtımın bitişine kalan süre (ms). */
export const RUSVET_LOCK_GRACE_MS = 1_000;
/** Darbe düellosunda bir elin gizli işaret süresi. */
export const RUSVET_SIGN_MS = 8_000;
/** İşaretler açıldıktan sonra sonucun gösterildiği süre. */
export const RUSVET_SIGN_REVEAL_MS = 2_500;
/** Dağıtım süresi. */
export const RUSVET_GIVE_MS = 25_000;
/** Sonuç açılış süresi (oyun bu sürenin sonunda biter). */
export const RUSVET_REVEAL_MS = 8_000;
/** Bir kişiye verilebilecek en çok jeton. */
export const RUSVET_MAX_PER_PLAYER = 2;
/** Eşitlikte en çok kaç el oynanır; sonra rastgele başkan seçilir (güvenlik sınırı). */
export const RUSVET_MAX_HANDS = 6;
/** Oyunun olabilecek en uzun süresi (her el eşit kalırsa). */
export const RUSVET_MAX_DURATION_MS =
  RUSVET_VOTE_MS +
  RUSVET_MAX_HANDS * (RUSVET_SIGN_MS + RUSVET_SIGN_REVEAL_MS) +
  RUSVET_GIVE_MS +
  RUSVET_REVEAL_MS;

export type Sign = "tas" | "kagit" | "makas";
export const SIGNS: readonly Sign[] = ["tas", "kagit", "makas"];

export interface Allocation {
  /** Jeton verilen oyuncu. */
  to: string;
  /** 1 ile 2 arası jeton. */
  n: number;
}

/**
 * - vote: başkanlık için kendin dışında bağlı birine gizli oy; süre bitene kadar değiştirilebilir.
 * - sign: darbe düellosunda (yalnız eşit adaylar) elin gizli işareti; el bitene kadar değiştirilebilir.
 * - give: yalnız başkan; jetonların tamamını ya da bir kısmını dağıtır, süre bitene kadar değiştirilebilir.
 * - lock: oylamada "Tamam" (oy kesinleşir); başkan için dağıtımda "Bitti" (dağıtım kesinleşir).
 *   Düelloda işaret tek seferliktir: ilk işaret kesindir.
 */
export type RusvetAction =
  | { kind: "vote"; target: string }
  | { kind: "sign"; sign: Sign }
  | { kind: "give"; tokens: Allocation[] }
  | { kind: "lock" };

export type RusvetPhase = "vote" | "duel" | "give" | "reveal";

/** Tamamlanmış (işaretleri açılmış) bir düello eli. */
export interface DuelHand {
  candidates: string[];
  signs: Record<string, Sign>;
  /** Eli geçenler (el tekrarlandıysa adayların hepsi). */
  advance: string[];
  /** Elde sonuç çıkmadı (tek işaret ya da üç işaret) ve el tekrarlanacak. */
  replay: boolean;
}

export interface RusvetDuel {
  /** 1'den başlayan el numarası. */
  hand: number;
  candidates: string[];
  signStartedAt: number;
  signEndsAt: number;
  revealEndsAt: number;
  /** Elin işaretleri; `signEndsAt` geçmeden null. */
  signs: Record<string, Sign> | null;
  /** Önceki eller. */
  history: DuelHand[];
}

export interface RusvetReveal {
  /** Başkanlık oyları: kim kime (oy vermeyenin oyu rastgele atanmıştır). */
  votes: Record<string, string>;
  /** Başkanlık oyu sayısı. */
  counts: Record<string, number>;
  /** Başkanın dağıttığı jetonlar (oyuncu başına). */
  tokens: Record<string, number>;
  /** Genel skora eklenen puan: başkan +1, jetonlar. */
  scores: Record<string, number>;
  duelHands: DuelHand[];
}

/** Herkese açık görünüm: oylar, işaretler (el bitene kadar) ve dağıtım sonuna kadar görünmez. */
export interface RusvetPublicView {
  players: string[];
  phase: RusvetPhase;
  startedAt: number;
  /** Şu anki aşamanın başlangıcı ve bitişi (süre çubuğu için). */
  phaseStartedAt: number;
  phaseEndsAt: number;
  /** Seçim bitince açılır. */
  president: string | null;
  /** Başkanın dağıtacağı jeton sayısı (aldığı oy sayısı); seçim bitince açılır. */
  budget: number | null;
  /**
   * Hazır olanlar (yalnız kimler; seçimleri gizli): oylamada "Tamam" diyenler, düelloda işaretini verenler,
   * dağıtımda "Bitti" diyen başkan. Diğer aşamalarda boş.
   */
  ready: string[];
  duel: RusvetDuel | null;
  reveal: RusvetReveal | null;
}

/** Kişiye özel görünüm. İzleyicide hepsi boş. */
export interface RusvetView {
  myVote: string | null;
  /** Düelloda şu anki elin işaretin (yalnız aday için). */
  mySign: Sign | null;
  /** Yalnız başkan: o ana kadar verdiği jetonlar. */
  myTokens: Allocation[] | null;
  /** Bulunulan aşamada hazırsın: oy kilitli / işaretin verildi / dağıtım bitti. */
  locked: boolean;
}
