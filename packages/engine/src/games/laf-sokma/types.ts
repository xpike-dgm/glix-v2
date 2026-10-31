/** Laf Sokma Düellosu — istemci ile sunucu arasındaki sözleşme. Kurallar: docs/KURALLAR.md §27, docs/A8-LAF-SOKMA.md. */

/** Soru yazma aşaması (her oyuncu iki soruya cevap yazar). */
export const LAF_WRITE_MS = 60_000;
/** Bir sorunun oylaması; cevap sahipleri oy vermez. */
export const LAF_VOTE_MS = 10_000;
/** Bir sorunun açılışı (cevap sahipleri, oylar, puanlar). */
export const LAF_REVEAL_MS = 7_000;
/** Hiç cevap gelmeyen sorunun kısa açılışı ("Cevap yok" kartları). */
export const LAF_EMPTY_REVEAL_MS = 2_500;
export const LAF_FINAL_WRITE_MS = 45_000;
/** Kuralda süre yazmaz; sahip onayına bırakılan varsayım. */
export const LAF_FINAL_VOTE_MS = 20_000;
export const LAF_FINAL_REVEAL_MS = 12_000;
/** Herkes hazırsa aşamanın bitişine kalan süre (ms). */
export const LAF_LOCK_GRACE_MS = 1_000;
/** Cevap sınırı (Unicode karakter, temizlemeden sonra). */
export const LAF_ANSWER_MAX = 80;
/** Ham metin için ağ koruması (temizlemeden önce); kural sınırı değildir. */
export const LAF_RAW_MAX = 400;
/** Final sorusunun kimliği. */
export const LAF_FINAL_ID = "final";

/** En uzun oyun süresi (hiç erken bitiş yok, her soruda tüm süreler dolar). */
export function lafMaxDurationMs(playerCount: number): number {
  return (
    LAF_WRITE_MS +
    playerCount * (LAF_VOTE_MS + LAF_REVEAL_MS) +
    LAF_FINAL_WRITE_MS +
    LAF_FINAL_VOTE_MS +
    LAF_FINAL_REVEAL_MS
  );
}

export type LafAction =
  /** Bir soruya cevap yaz (boş metin cevabı siler); kilitlenene kadar değiştirilebilir. */
  | { kind: "answer"; prompt: string; text: string }
  /** Yazmada "Tamam": cevapların kesinleşir. */
  | { kind: "lock" }
  /** Oylamada bir karta oy ver; tek seferlik (istemci seçimi yerelde tutar, yalnız onayda gönderir). */
  | { kind: "vote"; card: string };

export type LafPhase = "write" | "vote" | "reveal" | "finalWrite" | "finalVote" | "finalReveal";

/** Oylama kartı: cevap sahipsiz. `text` null ise "Cevap yok" kartıdır. */
export interface LafCard {
  id: string;
  text: string | null;
}

export interface LafCardResult {
  id: string;
  author: string;
  text: string | null;
  /** Bu karta oy verenler (katılım sırasıyla). */
  voters: string[];
  /** Bu karttan yazara giden puan (oylar + varsa Laf Ustası). */
  points: number;
  /** "Laf Ustası": tüm oyları (en az 2) aldı. */
  master: boolean;
}

export interface LafDuelReveal {
  /** Soru kimliği (`q1`, `q2`, … ya da `final`). */
  id: string;
  prompt: string;
  cards: LafCardResult[];
}

export interface LafDuel {
  id: string;
  prompt: string;
  cards: LafCard[];
}

/** Herkese açık görünüm: cevap-yazar eşleşmesi ilgili sorunun açılışına kadar hiçbir yerde yoktur. */
export interface LafPublicView {
  players: string[];
  /** Eski istemciler için sabit değer (ton kaldırıldı); yeni istemci okumaz. Sonraki sürümde silinecek. */
  tone?: "arkadas";
  phase: LafPhase;
  /** Gösterilen düello sırası (0'dan); yazma ve final aşamalarında null. */
  index: number | null;
  /** Düello sayısı (= oyuncu sayısı); final hariç. */
  total: number;
  startedAt: number;
  stageStartedAt: number;
  stageEndsAt: number;
  /** Yazmada kilitleyenler; oylamada oy verenler. */
  ready: string[];
  /** Oylamada oy verebilecek oyuncular. */
  voters: string[];
  /** Oylama ve açılışta gösterilen soru ve isimsiz kartlar. */
  duel: LafDuel | null;
  /** Açılış aşamasında: yazarlar, oylar ve puanlar. */
  reveal: LafDuelReveal | null;
  /** Önceki açılışlar (şimdiki hariç). */
  history: LafDuelReveal[];
  /** Açılmış sorulardan toplanan kahkaha puanları (oy +1, Laf Ustası +1); mini puan bunların sıralamasıdır. */
  scores: Record<string, number>;
}

export interface LafTask {
  id: string;
  prompt: string;
  /** Temizlenmiş cevabın; yoksa null. */
  answer: string | null;
}

/** Kişiye özel görünüm. */
export interface LafView {
  /** Yazma aşamasında sana verilen sorular (finalde tek soru). */
  tasks: LafTask[];
  /** Yazmada "Tamam" dedin mi. */
  locked: boolean;
  /** Oylamada senin kartın (cevap sahibiysen). */
  myCard: string | null;
  /** Oylamada verdiğin oy (kart kimliği). */
  myVote: string | null;
}
