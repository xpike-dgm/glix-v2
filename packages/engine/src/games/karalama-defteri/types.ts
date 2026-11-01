/** Karalama Defteri — istemci ile sunucu arasındaki sözleşme. Kurallar: docs/KURALLAR.md §15, docs/A4-OYUNLAR.md. */

import {
  DRAW_COLORS,
  DRAW_ERASER_INDEX,
  DRAW_GRID,
  DRAW_MAX_POINTS,
  DRAW_MIN_POINTS,
  type DrawColor,
  type DrawPen,
  type DrawSize,
  type DrawStroke,
} from "../drawing.js";

export const KARALAMA_DRAW_MS = 75_000;
/**
 * Oylama süresi oyuncu sayısına göre (KD-M7; sahip notu: öneridekinden belirgin uzun, erken bitiş ön tercih):
 * 3–4 oyuncu 30 sn, 5–6 oyuncu 40 sn, 7–8 oyuncu 50 sn.
 */
export const KARALAMA_VOTE_MS_SMALL = 30_000;
export const KARALAMA_VOTE_MS_MID = 40_000;
export const KARALAMA_VOTE_MS_LARGE = 50_000;
/** Oyuncu sayısına göre oylama süresi (KD-M7). */
export function karalamaVoteMs(players: number): number {
  return players >= 7 ? KARALAMA_VOTE_MS_LARGE : players >= 5 ? KARALAMA_VOTE_MS_MID : KARALAMA_VOTE_MS_SMALL;
}
/** En kısa oylama (3–4 oyuncu); geriye dönük ad. */
export const KARALAMA_VOTE_MS = KARALAMA_VOTE_MS_SMALL;
/**
 * Bağlı herkes oyunu verdi (KD-M7, sahip notu "herkes oy verince geçmek ön tercih"): oylama en geç bu kadar sonra
 * biter; arada oy değiştirilebilir. Herkes "Tamam" derse 1 sn (`KARALAMA_LOCK_GRACE_MS`).
 */
export const KARALAMA_ALL_VOTED_MS = 3_000;
/** Açılış (KD-U5): oylar uçar, maske düşer, damga vurulur; sonra son şans başlar. */
export const KARALAMA_UNMASK_MS = 5_000;
/** Bilgisizin son şansı (KD-M1): ana kelimeyi tahmin etme süresi. */
export const KARALAMA_GUESS_MS = 12_000;
/** Son şanstan sonra kartın dönmesi ve puan şeridi (KD-U5, KD-U7). */
export const KARALAMA_FINAL_MS = 3_000;
/** Tahminin en çok uzunluğu (karakter). */
export const KARALAMA_GUESS_MAX = 24;
/** Yazım hatası toleransı (Yazı Yaz YY-M7 ile aynı): bu kadar ve daha uzun kelimede tek harf farkı doğru sayılır. */
export const KARALAMA_TYPO_MIN_LETTERS = 6;
/** Aynı odada çift tekrarı (KD-M5): son 50 oyunun çifti gelmez. */
export const KARALAMA_PAIR_MEMORY = 50;
/** Aynı odada kelime tekrarı (KD-M5): son 10 oyunun kelimelerinden birini içeren çift gelmez (oyun başına 2 kelime). */
export const KARALAMA_WORD_MEMORY = 20;
/** En uzun oyun: 75 + 50 + 5 + 12 + 3 = 145 sn. */
export const KARALAMA_DURATION_MS =
  KARALAMA_DRAW_MS + KARALAMA_VOTE_MS_LARGE + KARALAMA_UNMASK_MS + KARALAMA_GUESS_MS + KARALAMA_FINAL_MS;

/** Çiftin yakınlığı (KD-M6): etiketsiz çift "yakın" sayılır; "uzak" çift çekilmez. */
export const KARALAMA_CLOSENESS = ["çok yakın", "yakın", "uzak"] as const;
export type KaralamaCloseness = (typeof KARALAMA_CLOSENESS)[number];
/** Çift yönü (KD-M4): "rastgele" (varsayılan) ya da "sabit" (Kelime 1 hep çoğunluğun). */
export const KARALAMA_DIRECTIONS = ["rastgele", "sabit"] as const;
export type KaralamaDirection = (typeof KARALAMA_DIRECTIONS)[number];

/** Çizim tuvali ortak modülden gelir (games/drawing.ts); Karalama'nın adları geriye dönük uyumlu kalır. */
export const KARALAMA_GRID = DRAW_GRID;
export const KARALAMA_MIN_POINTS = DRAW_MIN_POINTS;
export const KARALAMA_MAX_POINTS = DRAW_MAX_POINTS;
/** Oyuncu başına aynı anda duran en çok darbe. */
export const KARALAMA_MAX_STROKES = 400;
/** Oyuncu başına duran darbelerdeki toplam nokta üst sınırı (oylamadaki açık görünümü sınırlı tutar). */
export const KARALAMA_MAX_TOTAL_POINTS = 6_000;
/** Oyuncu başına kabul edilen toplam çizim eylemi (darbe + geri al + temizle); kayıt boyutunu sınırlar. */
export const KARALAMA_MAX_DRAW_ACTIONS = 1_000;

/** Karalama Defteri yalnız ilk paletin 6 rengini kullanır. */
export const KARALAMA_COLORS: readonly DrawColor[] = DRAW_COLORS.slice(0, 6);
export type KaralamaColor = DrawColor;
export type KaralamaPen = DrawPen;
export type KaralamaSize = DrawSize;
export const KARALAMA_ERASER_INDEX = DRAW_ERASER_INDEX;

export type KaralamaAction =
  | { kind: "stroke"; color: KaralamaPen; size: KaralamaSize; points: number[] }
  | { kind: "undo" }
  | { kind: "clear" }
  | { kind: "vote"; target: string }
  /** Çizimde "Bitti", oylamada "Tamam": o aşamadaki seçim kesinleşir (en az bir darbe / bir oy gerekir). */
  | { kind: "lock" }
  /** Son şans (KD-M1): yalnız bilgisiz, tek tahmin, kesin. */
  | { kind: "guess"; text: string };

/** Son kilitten sonra aşamanın bitmesine kalan süre (ms). */
export const KARALAMA_LOCK_GRACE_MS = 1_000;

/**
 * Sıkıştırılmış darbe: `[renkDizini (0..5; silgi `KARALAMA_ERASER_INDEX`), kalınlık (1..3), x0, y0, x1, y1, …]`.
 * Karalama Defteri ortak paletin ilk 6 rengini ve 3 kalınlığını kullanır (`DRAW_PALETTE_CLASSIC`).
 */
export type KaralamaStroke = DrawStroke;

/**
 * Aşamalar: çizim, oylama, açılış (oylar uçar, bilgisiz açılır), son şans (bilgisiz ana kelimeyi tahmin eder) ve
 * bitti (ana kelime, tahmin ve puanlar açılır).
 */
export type KaralamaPhase = "draw" | "vote" | "unmask" | "guess" | "done";

/** Son şanstan sonra açılanlar (yalnız "done"). */
export interface KaralamaFinal {
  mainWord: string;
  /** Bilgisizin gönderdiği tahmin (yazdığı biçimde); tahmin yoksa null. */
  guess: string | null;
  /** Tahmin ana kelimeyle eşleşti mi. */
  guessed: boolean;
  /** Bu oyunun puanları (genel skora doğrudan gider). */
  scores: Record<string, number>;
}

/** Oylama bittikten sonra herkese açılanlar (ana kelime son şans bitene kadar gizli kalır). */
export interface KaralamaReveal {
  outsider: string;
  /** Bilgisizin kelimesi ("Onun"). */
  nearWord: string;
  /** Oy veren -> hedef. */
  votes: Record<string, string>;
  /** Alınan oy sayısı (hiç oy almayan 0). */
  tally: Record<string, number>;
  /** Bilgisiz oyuncu tek başına en çok oyu aldı mı. */
  caught: boolean;
  /** Bilgisize oy veren (+1 alan) oyuncular, katılım sırasıyla. */
  rightVoters: string[];
  /** Açılışın başladığı an (oylama bitişi). */
  openedAt: number;
  /** Son şansın penceresi; bilgisiz bağlı değilse ikisi eşit (son şans yok). */
  guessOpensAt: number;
  guessEndsAt: number;
  /** Oyunun bittiği an. */
  finishAt: number;
  /** Bilgisiz tahminini gönderdi mi (ne yazdığı "done"a kadar gizli). */
  guessSent: boolean;
  /** Yalnız "done": ana kelime, tahmin ve puanlar. */
  final: KaralamaFinal | null;
}

/** Herkese açık görünüm (oda başına bir kez hesaplanır). */
export interface KaralamaPublicView {
  phase: KaralamaPhase;
  drawEndsAt: number;
  voteEndsAt: number;
  /** Bu oyunun oylama süresi (KD-M7; oyuncu sayısına göre). */
  voteMs: number;
  /** Katılımcılar, katılım sırasıyla. */
  players: string[];
  /** Çizimler yalnız oylamada ve sonuçta açılır; çizim süresince null. */
  drawings: Record<string, KaralamaStroke[]> | null;
  /** Oy kullanmış oyuncular (kime verdikleri gizli). */
  voted: string[];
  /** Çizimini "Bitti" ile kesinleştirenler (çizim aşaması). */
  drawDoneIds: string[];
  /** Oyunu "Tamam" ile kesinleştirenler (oylama aşaması). */
  lockedIds: string[];
  /** Yalnız oyun bittikten sonra. */
  reveal: KaralamaReveal | null;
}

/** Kişiye özel görünüm. */
export interface KaralamaView {
  /** Kendi kelimen; izleyicide null. Açılış ve son şans sürerken ana kelime hiçbir ekranda olmaz (null). */
  word: string | null;
  /** Kelime "yakın sinyal" kelimesi mi (yalnız bilgisiz oyuncuda true). */
  near: boolean;
  /** Çizim süresince kendi darbelerin: sıra numarası (metin) -> darbe. Geri al/temizle `null` yamasıyla yansır. */
  strokes: Record<string, KaralamaStroke>;
  /** Kalan nokta kotası. */
  pointsLeft: number;
  /** Verdiğin oy; yoksa null. */
  myVote: string | null;
  /** Çizimini bitirdin mi. */
  drawDone: boolean;
  /** Oyunu kesinleştirdin mi. */
  locked: boolean;
}
