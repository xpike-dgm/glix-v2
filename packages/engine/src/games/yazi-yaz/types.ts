/** Yazı Yaz — istemci ile sunucu arasındaki sözleşme. Kurallar: docs/KURALLAR.md, docs/A6-OYUNLAR.md. */

export const YAZI_YAZ_WRITE_MS = 30_000;
export const YAZI_YAZ_TALK_MS = 60_000;
export const YAZI_YAZ_GUESS_MS = 30_000;
/**
 * Tahminler açıldıktan sonra sonucun en az gösterildiği süre ("Yazanlar…" açılışı; oyun bu sürenin sonunda biter,
 * ekran "Devam et" ile geçer). İstemcinin zaman çizelgesi (YY_REVEAL_PLAN) bu süreye sığar.
 */
export const YAZI_YAZ_REVEAL_MS = 8_000;
export const YAZI_YAZ_DURATION_MS =
  YAZI_YAZ_WRITE_MS + YAZI_YAZ_TALK_MS + YAZI_YAZ_GUESS_MS + YAZI_YAZ_REVEAL_MS;
/** Herkes hazırsa aşamanın bitişine kalan süre (ms). */
export const YAZI_YAZ_LOCK_GRACE_MS = 1_000;
export const YAZI_YAZ_WRITER_COUNT = 2;
/** Masumun yazabileceği tek giriş. Yazan bunu yazamaz (YY-M5). */
export const YAZI_YAZ_INNOCENT_WORD = "MASUM";
/**
 * Konu havuzunun "konusuz tur" kaydı: bu konu çıkarsa oyun konusuz oynanır (bugünkü davranış). Havuzun başlangıçtaki
 * tek yerleşik kaydıdır; sahip konuları panelden ekleyince bu kaydı kapatabilir.
 */
export const YAZI_YAZ_FREE_TOPIC = "SERBEST";
/** Aynı odada son bu kadar Yazı Yaz oyununda çıkan konu tekrar gelmez (havuz yetiyorsa). */
export const YAZI_YAZ_TOPIC_MEMORY = 10;
/** Yazım hatası toleransı (YY-M7): bu kadar ve daha uzun kelimede tek harf farkı doğru sayılır. */
export const YAZI_YAZ_TYPO_MIN_LETTERS = 6;

/** Puan kalemleri (oyun içi "dedektif puanı"). */
export const YAZI_YAZ_PERSON_POINT = 1;
export const YAZI_YAZ_WORD_POINT = 1;
/** Hiçbir masumun seçmediği, kelime yazmış yazana: "İz bırakmadın" (YY-M3). */
export const YAZI_YAZ_HIDDEN_POINT = 1;

export type YaziYazAction =
  /** Yazma aşaması: girişi yaz (Tamam'a kadar değiştirilebilir). Yazan kendi kelimesini, masum `MASUM` yazar. */
  | { kind: "write"; text: string }
  /** Tahmin aşaması: bir oyuncu seç (kendin dışında). */
  | { kind: "guessPlayer"; target: string }
  /** Tahmin aşaması: kelimeyi yaz (boş bırakılabilir). */
  | { kind: "guessWord"; text: string }
  /** Yazmada ve tahminde "Tamam": girdi kesinleşir. Hiç yazmamış masumda giriş MASUM olur. */
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
  /** Hiçbir masumun seçmediği, kelime yazmış yazanlar ("İz bırakmadın" +1). */
  hidden: string[];
  /** Oyun içi dedektif puanı: kişi +1, kelime +1, iz bırakmama +1 (= miniScores). */
  scores: Record<string, number>;
  /** Genel skora giden sıralama ödülü: en yüksek +2, sonraki farklı toplam +1, diğerleri 0 (= awards). */
  awards: Record<string, number>;
}

/** Herkese açık görünüm: roller ve kelimeler sonuç açılana kadar hiçbir yerde yoktur. */
export interface YaziYazPublicView {
  players: string[];
  stage: YaziYazStage;
  /** Herkese açık konu (YY-M1); konusuz turda null. */
  topic: string | null;
  /**
   * Harf sayısı ipucu (YY-M2): tartışmadan itibaren iki kelimenin harf sayısı, küçükten büyüğe; kelime yazmamış
   * yazan için null (sonda). Kimin olduğu yoktur. Yazma aşamasında null.
   */
  letters: (number | null)[] | null;
  startedAt: number;
  writeEndsAt: number;
  talkEndsAt: number;
  guessEndsAt: number;
  finishAt: number;
  /**
   * Bulunulan aşamada hazır olanlar (tartışmada "Tahmine geç", tahminde "Tamam"). Yazma aşamasında boştur
   * (YY-M6: kimin Tamam dediği gizli, yalnız sayı görünür).
   */
  ready: string[];
  /** Bulunulan aşamada hazır olan sayısı (yazmada da). */
  readyCount: number;
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

/** Kelimedeki harf ve rakam sayısı (boşluk ve işaretler sayılmaz): "BUZ DOLABI" = 9. */
export function yaziYazLetterCount(word: string): number {
  return Array.from(word.normalize("NFC")).filter((ch) => /[\p{L}\p{N}]/u.test(ch)).length;
}

/**
 * Sıralama ödülü (YY-M4): en yüksek dedektif puanı +2, sonraki farklı toplam +1, diğerleri 0. Birincide eşitlikte
 * hepsi +2; toplamı 0 olan ödül almaz; herkesin toplamı aynı ve 0'dan büyükse herkes +1; herkes 0 ise kimse.
 */
export function yaziYazAwards(points: Readonly<Record<string, number>>): Record<string, number> {
  const ids = Object.keys(points);
  const awards: Record<string, number> = Object.fromEntries(ids.map((id) => [id, 0]));
  const value = (id: string): number => points[id] ?? 0;
  const positive = [...new Set(ids.map(value).filter((v) => v > 0))].sort((x, y) => y - x);
  const top = positive[0];
  if (top === undefined) return awards;
  if (ids.every((id) => value(id) === top)) {
    for (const id of ids) awards[id] = 1;
    return awards;
  }
  const second = positive[1];
  for (const id of ids) {
    if (value(id) === top) awards[id] = 2;
    else if (second !== undefined && value(id) === second) awards[id] = 1;
  }
  return awards;
}
