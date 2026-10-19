/** Karalama Defteri — istemci ile sunucu arasındaki sözleşme. Kurallar: docs/KURALLAR.md §15, docs/A4-OYUNLAR.md. */

export const KARALAMA_DRAW_MS = 75_000;
export const KARALAMA_VOTE_MS = 20_000;
export const KARALAMA_DURATION_MS = KARALAMA_DRAW_MS + KARALAMA_VOTE_MS;

/** Çizim ızgarası: 0..GRID tam sayı, kare. */
export const KARALAMA_GRID = 1000;
/** Bir darbedeki nokta sayısı (x,y çifti). */
export const KARALAMA_MIN_POINTS = 2;
export const KARALAMA_MAX_POINTS = 120;
/** Oyuncu başına aynı anda duran en çok darbe. */
export const KARALAMA_MAX_STROKES = 400;
/** Oyuncu başına duran darbelerdeki toplam nokta üst sınırı (oylamadaki açık görünümü sınırlı tutar). */
export const KARALAMA_MAX_TOTAL_POINTS = 6_000;
/** Oyuncu başına kabul edilen toplam çizim eylemi (darbe + geri al + temizle); kayıt boyutunu sınırlar. */
export const KARALAMA_MAX_DRAW_ACTIONS = 1_000;

/** Palet kimlikleri; sıra `KaralamaStroke` içindeki renk dizinidir. */
export const KARALAMA_COLORS = ["beyaz", "pembe", "sari", "yesil", "mavi", "turuncu"] as const;
export type KaralamaColor = (typeof KARALAMA_COLORS)[number];
export type KaralamaPen = KaralamaColor | "eraser";
export type KaralamaSize = 1 | 2 | 3;
/** Sıkıştırılmış darbede silgi dizini. */
export const KARALAMA_ERASER_INDEX = KARALAMA_COLORS.length;

export type KaralamaAction =
  | { kind: "stroke"; color: KaralamaPen; size: KaralamaSize; points: number[] }
  | { kind: "undo" }
  | { kind: "clear" }
  | { kind: "vote"; target: string }
  /** Çizimde "Bitti", oylamada "Tamam": o aşamadaki seçim kesinleşir (en az bir darbe / bir oy gerekir). */
  | { kind: "lock" };

/** Son kilitten sonra aşamanın bitmesine kalan süre (ms). */
export const KARALAMA_LOCK_GRACE_MS = 1_000;

/**
 * Sıkıştırılmış darbe: `[renkDizini (0..5, silgi 6), kalınlık (1..3), x0, y0, x1, y1, …]`.
 */
export type KaralamaStroke = number[];

export type KaralamaPhase = "draw" | "vote" | "done";

export interface KaralamaReveal {
  outsider: string;
  mainWord: string;
  nearWord: string;
  /** Oy veren -> hedef. */
  votes: Record<string, string>;
  /** Alınan oy sayısı (hiç oy almayan 0). */
  tally: Record<string, number>;
  /** Bilgisiz oyuncu tek başına en çok oyu aldı mı. */
  caught: boolean;
}

/** Herkese açık görünüm (oda başına bir kez hesaplanır). */
export interface KaralamaPublicView {
  phase: KaralamaPhase;
  drawEndsAt: number;
  voteEndsAt: number;
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
  /** Kendi kelimen; izleyicide null. */
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
