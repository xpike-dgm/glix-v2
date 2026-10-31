/** Sızma — istemci ile sunucu arasındaki sözleşme. Kurallar: docs/KURALLAR.md §3, docs/oneriler/sizma.md. */

/** İpucu aşamasının teknik üst sınırı (5 dk): odanın takılı kalmaması için. */
export const SIZMA_CLUE_CAP_MS = 300_000;
/** Bir konuşma hakkının üst sınırı: dolarsa sıra kendiliğinden geçer (ceza yok). */
export const SIZMA_TURN_MS = 15_000;
/** İpucu turu sayısı (söyleme sırası iki turda da aynıdır). */
export const SIZMA_ROUNDS = 2;
/** İki tur bitince oylamaya kadar geri sayım. */
export const SIZMA_COUNTDOWN_MS = 3_000;
export const SIZMA_VOTE_MS = 30_000;
/** En çok oyda eşitlik olursa yalnız eşit adaylar arasında ikinci oylama. */
export const SIZMA_RUNOFF_MS = 15_000;
/** "Sızma sen miydin?" aşamasının süresi (herkes cevaplarsa erken biter). */
export const SIZMA_NOTICE_MS = 10_000;
/** Kendini fark eden sızmanın ek puanı. */
export const SIZMA_NOTICE_POINTS = 1;
/** Yakalanan sızma ortak kelimeyi bilirse ek puan. */
export const SIZMA_STEAL_POINTS = 1;
/** Yakalanma açılışı (oylar uçar, maske düşer); ardından son şans başlar. */
export const SIZMA_UNMASK_MS = 7_000;
/** Son şans: yakalanan sızmanın ortak kelimeyi yazma süresi. */
export const SIZMA_GUESS_MS = 15_000;
/** Son şanstan sonra kelimelerin ve puanların açıldığı son açılış. */
export const SIZMA_FINAL_MS = 5_000;
/** Kurtulma açılışı (oylar uçar, "KURTULDU!", kelimeler ve puanlar). */
export const SIZMA_REVEAL_MS = 9_000;
/** Herkes hazırsa aşamanın bitişine kalan süre (ms). */
export const SIZMA_LOCK_GRACE_MS = 1_000;
/** Son şans tahmininin en uzun hâli (karakter). */
export const SIZMA_GUESS_MAX = 24;
/** En uzun oyun süresi (her aşama tavana dayanırsa). */
export const SIZMA_MAX_DURATION_MS =
  SIZMA_CLUE_CAP_MS +
  SIZMA_VOTE_MS +
  SIZMA_RUNOFF_MS +
  SIZMA_NOTICE_MS +
  Math.max(SIZMA_REVEAL_MS, SIZMA_UNMASK_MS + SIZMA_GUESS_MS + SIZMA_FINAL_MS);

export type SizmaAction =
  /** Konuşan "Söyledim": sıra bir sonrakine geçer. `turn` hangi konuşma olduğu (eski basış ikinci sırayı atlatmasın). */
  | { kind: "said"; turn: number }
  /** İpucu aşamasında "Oylamaya geç" (bağlı herkes basarsa kalan sıralar atlanır). */
  | { kind: "skip" }
  /** Kendin dahil bir katılımcıya oy ver; oylama bitene kadar değiştirilebilir (son oy geçerli). */
  | { kind: "vote"; target: string }
  /** Oylamada "Oyumu ver": oy kesinleşir. */
  | { kind: "lock" }
  /** "Sızma sen miydin?" Evet (true) / Hayır (false); herkes cevaplar, cevap tek seferliktir. */
  | { kind: "notice"; yes: boolean }
  /** Son şans: yakalanan sızma ortak kelimeyi yazar (tek hak). */
  | { kind: "guess"; text: string };

export type SizmaPhase = "clue" | "vote" | "runoff" | "notice" | "guess" | "reveal";

/** Son şanstan sonra (ya da sızma kurtulduysa açılışta) açılan kısım. */
export interface SizmaFinal {
  /** Çoğunluğun gördüğü ve sızmanın gördüğü kelime (büyük harf). */
  commonWord: string;
  infiltratorWord: string;
  /** Yakalanan sızmanın tahmini (yazdığı gibi, büyük harf); tahmin yoksa null. */
  guess: string | null;
  /** Tahmin ortak kelimeyle eşleşti mi ("KELİMEYİ ÇALDI!"). */
  stole: boolean;
  /** Genel skora eklenen puanlar. */
  scores: Record<string, number>;
  /** Doğru oy verenler (yakalandıysa sızmaya oy veren sızma olmayanlar; Evet deseler de). */
  rightVoters: string[];
}

export interface SizmaReveal {
  /** Sızma oyuncusu. */
  infiltrator: string;
  /** Sayılan oylar (ikinci oylama olduysa onun oyları): kim kime (oy vermeyen yok). */
  votes: Record<string, string>;
  /** Oyuncu başına alınan oy sayısı (sayılan oylamada). */
  tally: Record<string, number>;
  /** Sızma tek başına en çok oyu aldı mı. */
  caught: boolean;
  /** İlk oylamada eşitlik çıktıysa ikinci oylamanın adayları; yoksa null. */
  runoff: string[] | null;
  /** Sızma "Sızma sen miydin?" sorusuna Evet dedi mi (cevap vermediyse false). Diğerlerinin cevapları hiç açılmaz. */
  selfNoticed: boolean;
  /** Açılışın başladığı an ("Sızma sen miydin?" bitişi). */
  openedAt: number;
  /** Yakalandıysa son şansın açıldığı ve bittiği an; kurtulduysa null. */
  guessOpensAt: number | null;
  guessEndsAt: number | null;
  /** Kelimelerin ve puanların açıldığı an (kurtulduysa `openedAt`). */
  finalAt: number;
  /** Oyunun (açılış animasyonunun) bittiği an. */
  finishAt: number;
  /** Kelimeler ve puanlar: son şans bitene kadar null (ortak kelime bu sırada kimsenin ekranında yoktur). */
  final: SizmaFinal | null;
}

/** Herkese açık görünüm: kelimeler, sızma ve oylar sonuç açılana kadar hiçbir yerde yoktur. */
export interface SizmaPublicView {
  players: string[];
  phase: SizmaPhase;
  /** Söyleme sırası (iki ipucu turunda da aynı). */
  order: string[];
  startedAt: number;
  /** Bulunulan aşamanın başlangıcı ve bitişi (ipucunda oylamanın başlayacağı an: tavan ya da geri sayım sonu). */
  phaseStartedAt: number;
  phaseEndsAt: number;
  /** Kaçıncı konuşma (0 tabanlı, iki tur boyunca); `order.length * 2` ise sıralar bitti. */
  turn: number;
  turnStartedAt: number;
  turnEndsAt: number;
  /** İkinci oylamanın adayları (ilk oylama eşitlikle bittiyse; ondan önce null). */
  runoff: string[] | null;
  /** Bulunulan aşamada hazır olanlar: ipucunda "Oylamaya geç", oylamada kilitleyenler, "Sızma sen miydin?"de cevap verenler (cevabın ne olduğu değil). */
  ready: string[];
  reveal: SizmaReveal | null;
}

/** Kişiye özel görünüm. Kimse sızma olduğunu bilmez: herkes yalnız "kelimen" görür. */
export interface SizmaView {
  /** Senin kelimen (büyük harf); izleyicide ve son şans sırasında (sızma dışındakilerde) null. */
  word: string | null;
  /** Bulunulan oylamadaki oyun (ikinci oylamada yeniden boş başlar). */
  myVote: string | null;
  /** "Sızma sen miydin?" cevabın (yalnız sana görünür); vermediysen null. */
  myNotice: boolean | null;
  /** Bulunulan aşamada hazır dedin mi. */
  locked: boolean;
}
