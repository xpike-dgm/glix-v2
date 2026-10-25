/** Kara Borsa — istemci ile sunucu arasındaki sözleşme. Kurallar: docs/KURALLAR.md §28, docs/A8-OYUNLAR.md. */

export const BORSA_ROUNDS = 5;
export const BORSA_START_COINS = 100;
export const BORSA_BID_MS = 20_000;
export const BORSA_REVEAL_MS = 5_000;
/** Herkes teklif verince turun bitmesine kalan süre (ms). */
export const BORSA_EARLY_MS = 1_000;
export const BORSA_DURATION_MS = BORSA_ROUNDS * (BORSA_BID_MS + BORSA_REVEAL_MS);

/** Kutu değeri: 0..60 tam sayı ya da lanetli (−20, %15 olasılık). */
export const BORSA_MAX_VALUE = 60;
export const BORSA_CURSED_VALUE = -20;
export const BORSA_CURSED_CHANCE = 0.15;

export type BorsaAction = { kind: "bid"; amount: number };

/**
 * Oyuncuya özel ipucu: her zaman doğrudur. İstemci Türkçe cümleye çevirir.
 *   gt: değeri n'den büyük · lt: n'den küçük · between: lo ile hi arasında (dahil)
 *   even/odd: çift/tek · multiple/notMultiple: n'in katı / katı değil · cursed/notCursed: lanetli / değil
 */
export type BorsaHint =
  | { kind: "gt"; n: number }
  | { kind: "lt"; n: number }
  | { kind: "between"; lo: number; hi: number }
  | { kind: "even" }
  | { kind: "odd" }
  | { kind: "multiple"; n: number }
  | { kind: "notMultiple"; n: number }
  | { kind: "cursed" }
  | { kind: "notCursed" };

export type BorsaPhase = "bid" | "reveal" | "done";

/** Açılmış bir tur. */
export interface BorsaRoundResult {
  /** Kutunun gerçek değeri (−20: lanetli). */
  value: number;
  /** Kutuyu alan; kimse teklif vermediyse null. */
  winner: string | null;
  /** Ödenen fiyat (kazanan yoksa 0). */
  price: number;
  /** Herkesin teklifi (vermeyen ve geçen 0). */
  bids: Record<string, number>;
}

export interface BorsaPublicView {
  phase: BorsaPhase;
  /** Geçerli tur (0..rounds-1). */
  round: number;
  rounds: number;
  startedAt: number;
  /** Teklif süresinin başı/sonu; açılış aşamasında açılışın sonu. */
  stageStartedAt: number;
  stageEndsAt: number;
  /** Katılımcılar, katılım sırasıyla. */
  players: string[];
  /** Güncel jeton (kapanmış turlara göre). */
  coins: Record<string, number>;
  /** Kazanılan kutuların değer toplamı (kapanmış turlara göre). */
  boxes: Record<string, number>;
  /** Bu turda teklifini vermiş olanlar (teklifin kendisi gizli; jetonu bitenler de sayılır). */
  bidIds: string[];
  /** Kapanmış turlar (en yenisi sonda); açılış aşamasında bu turun sonucu da içindedir. */
  history: BorsaRoundResult[];
  /** Açılış aşamasındaki tur sonucu. */
  reveal: BorsaRoundResult | null;
}

export interface BorsaView {
  /** Bu turdaki ipucun; izleyicide null. */
  hint: BorsaHint | null;
  /** Bu turda verdiğin teklif; vermediysen null. */
  myBid: number | null;
}
