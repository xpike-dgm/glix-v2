/** Kendim — istemci ile sunucu arasındaki sözleşme. Kurallar: docs/KURALLAR.md, docs/A6-OYUNLAR.md. */

export const KENDIM_WRITE_MS = 30_000;
export const KENDIM_MATCH_MS = 30_000;
/** Sonuç açıldıktan sonra gösterildiği süre (oyun bu sürenin sonunda biter). */
export const KENDIM_REVEAL_MS = 9_000;
export const KENDIM_DURATION_MS = KENDIM_WRITE_MS + KENDIM_MATCH_MS + KENDIM_REVEAL_MS;
/** Herkes hazırsa aşamanın bitişine kalan süre (ms). */
export const KENDIM_LOCK_GRACE_MS = 1_000;

export type KendimAction =
  /** Yazma: kendini anlatan tek kelime (Tamam'a kadar değiştirilebilir). */
  | { kind: "write"; text: string }
  /** Eşleştirme: kartı bir oyuncuyla eşle; `target` null ise kartın eşi kaldırılır. */
  | { kind: "match"; card: number; target: string | null }
  /** Yazmada ve eşleştirmede "Tamam". */
  | { kind: "lock" };

export type KendimStage = "write" | "match" | "reveal";

export interface KendimCard {
  /** Karışık sırada kart numarası (sahibi hakkında bilgi taşımaz). */
  id: number;
  text: string;
}

export interface KendimRevealCard extends KendimCard {
  owner: string;
  /** Kartı doğru eşleştirenler. */
  finders: string[];
  /** Kartı yalnız bir kişi doğru bulduysa sahibi +1 bonus aldı. */
  bonus: boolean;
}

export interface KendimRevealPair {
  card: number;
  target: string;
  ok: boolean;
}

export interface KendimReveal {
  cards: KendimRevealCard[];
  /** Oyuncu -> eşleştirmeleri ve doğruluğu. */
  pairs: Record<string, KendimRevealPair[]>;
  /** Mini oyun puanı (doğru +1, yanlış −1, bonus +1). */
  scores: Record<string, number>;
  /** Genel skora +1 alanlar (en yüksek ve 0'dan büyük puanlılar). */
  winners: string[];
}

/** Herkese açık görünüm: kartların sahipleri ve eşleştirmeler sonuç açılana kadar hiçbir yerde yoktur. */
export interface KendimPublicView {
  players: string[];
  stage: KendimStage;
  startedAt: number;
  writeEndsAt: number;
  matchEndsAt: number;
  finishAt: number;
  /** Bulunulan aşamada "Tamam" diyenler. */
  ready: string[];
  /** Kelimesini yazıp kart sahibi olanlar (eşleştirme aşamasından itibaren); kartlarla ilişkisi yok. */
  owners: string[];
  reveal: KendimReveal | null;
}

/** Kişiye özel görünüm. İzleyicide boştur. */
export interface KendimView {
  myText: string | null;
  locked: boolean;
  /** Eşleştirme aşamasında önündeki kartlar (kendi kartın hariç). */
  cards: KendimCard[];
  /** Kart numarası -> eşlediğin oyuncu. */
  myPairs: Record<string, string>;
}
