/** Kendim — istemci ile sunucu arasındaki sözleşme. Kurallar: docs/KURALLAR.md, docs/oneriler/kendim.md. */

export const KENDIM_WRITE_MS = 30_000;
/** Eşleştirme süresi (KN-M4): 3–5 oyuncuda 30 sn, 6–8 oyuncuda 40 sn. */
export const KENDIM_MATCH_MS = 30_000;
export const KENDIM_MATCH_LARGE_MS = 40_000;
/** Bu sayıdan (dahil) itibaren uzun eşleştirme süresi kullanılır. */
export const KENDIM_MATCH_LARGE_FROM = 6;
/** Herkes hazırsa aşamanın bitişine kalan süre (ms). */
export const KENDIM_LOCK_GRACE_MS = 1_000;

/**
 * Kart kart açılış (KN-U4): her kart 3 sn, ardından 3 sn özet. Açılış süresi = kart sayısı × 3 sn + 3 sn; oyun bu
 * sürenin sonunda biter (ardından genel "Devam et" kuralı). İstemcinin kart içi anları bu sabitten türer.
 */
export const KENDIM_REVEAL_CARD_MS = 3_000;
export const KENDIM_REVEAL_TAIL_MS = 3_000;

/** Tanıma puanı (KN-M1): doğru eşleme +1, yanlış 0, kelimeni tam bir kişi bulduysa +1 bonus. */
export const KENDIM_RIGHT_POINT = 1;
export const KENDIM_BONUS_POINT = 1;

/** Aynı odada son bu kadar oyunda çıkan konu yeniden seçilmez (KN-M2; havuz kısaysa yalnız bir önceki). */
export const KENDIM_TOPIC_MEMORY = 5;

export function kendimMatchMs(playerCount: number): number {
  return playerCount >= KENDIM_MATCH_LARGE_FROM ? KENDIM_MATCH_LARGE_MS : KENDIM_MATCH_MS;
}

export function kendimRevealMs(cardCount: number): number {
  return Math.max(0, cardCount) * KENDIM_REVEAL_CARD_MS + KENDIM_REVEAL_TAIL_MS;
}

/** En uzun oyun (8 oyuncu, 8 kart): botlar ve önizlemeler için. */
export const KENDIM_DURATION_MS = KENDIM_WRITE_MS + KENDIM_MATCH_LARGE_MS + kendimRevealMs(8);

/** Konu kartı (KN-M2): herkes kendini bu konuyla tek kelimeyle anlatır; `hint` yazı kutusunun ipucudur. */
export interface KendimTopic {
  topic: string;
  hint: string;
}

/** Havuz boşsa ya da bozuksa kullanılan, bugünkü davranışı koruyan konu. */
export const KENDIM_DEFAULT_TOPIC: KendimTopic = { topic: "Kendini anlat", hint: "Ben…" };

/**
 * Genel skor ödülü (KN-M1): en yüksek tanıma puanı +2 (eşitse hepsi), sonraki farklı toplam +1, diğerleri 0. Puanı 0
 * olan ödül almaz; herkesin toplamı aynı ve 0'dan büyükse herkes +1, hepsi 0 ise kimse.
 */
export function kendimAwards(points: Readonly<Record<string, number>>): Record<string, number> {
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

export type KendimAction =
  /** Yazma: konuyla kendini anlatan tek kelime (boşluksuz; Tamam'a kadar değiştirilebilir). */
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
  /** Aynı kelimeyi başka biri de yazdı ("İkiz kelime!"). */
  twin: boolean;
}

export interface KendimRevealPair {
  card: number;
  target: string;
  ok: boolean;
}

export interface KendimReveal {
  cards: KendimRevealCard[];
  /** Açılış sırası (kart numaraları, karışık). İstemci kendi kartını en sona alır. */
  order: number[];
  /** Oyuncu -> eşleştirmeleri ve doğruluğu. */
  pairs: Record<string, KendimRevealPair[]>;
  /** Tanıma puanı (doğru +1, yanlış 0, tek bulan bonusu +1). */
  scores: Record<string, number>;
  /** Genel skora giden ödül (+2 / +1 / 0). */
  awards: Record<string, number>;
}

/** Herkese açık görünüm: kartların sahipleri ve eşleştirmeler sonuç açılana kadar hiçbir yerde yoktur. */
export interface KendimPublicView {
  players: string[];
  stage: KendimStage;
  /** Bu oyunun konusu ve yazı kutusu ipucu (KN-M2). */
  topic: string;
  hint: string;
  startedAt: number;
  writeEndsAt: number;
  matchEndsAt: number;
  /** Açılışın (ve oyunun) bitişi: açılış `matchEndsAt`'te başlar. */
  finishAt: number;
  /** Bulunulan aşamada "Tamam" diyenler. */
  ready: string[];
  /** Kelimesini yazıp kart sahibi olanlar (eşleştirme aşamasından itibaren); kartlarla ilişkisi yok. */
  owners: string[];
  /** Eşleştirmeden itibaren bütün kelime kartları, sahipsiz (KN-U7: izleyici ve TV). Yazmada boş. */
  cards: KendimCard[];
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
