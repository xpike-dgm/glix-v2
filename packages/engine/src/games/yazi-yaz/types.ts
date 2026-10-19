/** Yazı Yaz — istemci ile sunucu arasındaki sözleşme. Kurallar: docs/KURALLAR.md, docs/A6-OYUNLAR.md. */

export const YAZI_YAZ_WRITE_MS = 30_000;
export const YAZI_YAZ_TALK_MS = 60_000;
export const YAZI_YAZ_GUESS_MS = 30_000;
/** Tahminler açıldıktan sonra sonucun gösterildiği süre (oyun bu sürenin sonunda biter). */
export const YAZI_YAZ_REVEAL_MS = 8_000;
export const YAZI_YAZ_DURATION_MS =
  YAZI_YAZ_WRITE_MS + YAZI_YAZ_TALK_MS + YAZI_YAZ_GUESS_MS + YAZI_YAZ_REVEAL_MS;
/** Herkes hazırsa aşamanın bitişine kalan süre (ms). */
export const YAZI_YAZ_LOCK_GRACE_MS = 1_000;
export const YAZI_YAZ_WRITER_COUNT = 2;
/** Masumun yazabileceği tek giriş. */
export const YAZI_YAZ_INNOCENT_WORD = "MASUM";

export type YaziYazAction =
  /** Yazma aşaması: girişi yaz (Tamam'a kadar değiştirilebilir). Yazan kendi kelimesini, masum `MASUM` yazar. */
  | { kind: "write"; text: string }
  /** Tahmin aşaması: bir oyuncu seç (kendin dışında). */
  | { kind: "guessPlayer"; target: string }
  /** Tahmin aşaması: kelimeyi yaz (boş bırakılabilir). */
  | { kind: "guessWord"; text: string }
  /** Yazmada ve tahminde "Tamam": girdi kesinleşir. */
  | { kind: "lock" }
  /** Tartışmada "Tahmine geçelim". */
  | { kind: "skip" };

export type YaziYazStage = "write" | "talk" | "guess" | "reveal";
export type YaziYazRole = "writer" | "innocent";

export interface YaziYazGuessResult {
  target: string | null;
  word: string;
  personOk: boolean;
  wordOk: boolean;
}

export interface YaziYazReveal {
  /** İki yazan (katılım sırasıyla). */
  writers: string[];
  /** Yazanların kelimeleri; yazmamışsa boş metin. */
  words: Record<string, string>;
  /** Her katılımcının tahmini ve sonucu. */
  guesses: Record<string, YaziYazGuessResult>;
  /** Tahminlerden gelen puan (= genel skora eklenen). */
  scores: Record<string, number>;
}

/** Herkese açık görünüm: roller ve kelimeler sonuç açılana kadar hiçbir yerde yoktur. */
export interface YaziYazPublicView {
  players: string[];
  stage: YaziYazStage;
  startedAt: number;
  writeEndsAt: number;
  talkEndsAt: number;
  guessEndsAt: number;
  finishAt: number;
  /** Bulunulan aşamada hazır olanlar (yazmada ve tahminde "Tamam", tartışmada "Tahmine geçelim"). */
  ready: string[];
  reveal: YaziYazReveal | null;
}

/** Kişiye özel görünüm. İzleyicide rol ve metinler boştur. */
export interface YaziYazView {
  /** Yalnız sahibine görünür; izleyicide null. */
  role: YaziYazRole | null;
  /** Yazma aşamasında girdiğin metin (temizlenmiş, büyük harf). */
  myText: string | null;
  /** Bulunulan aşamada hazır dedin mi. */
  locked: boolean;
  /** Tahminin (değiştirilebilir). */
  myGuess: { target: string | null; word: string };
}
