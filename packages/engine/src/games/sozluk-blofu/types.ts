/** Sözlük Blöfü — istemci ile sunucu arasındaki sözleşme. Kurallar: docs/KURALLAR.md §4, docs/A6-OYUNLAR.md. */

export const SOZLUK_WRITE_MS = 50_000;
export const SOZLUK_PICK_MS = 30_000;
/** Kartların sahipleri açıldıktan sonra sonucun gösterildiği süre (oyun bu sürenin sonunda biter). */
export const SOZLUK_REVEAL_MS = 12_000;
/** Herkes hazırsa aşamanın bitişine kalan süre (ms). */
export const SOZLUK_LOCK_GRACE_MS = 1_000;
export const SOZLUK_DURATION_MS = SOZLUK_WRITE_MS + SOZLUK_PICK_MS + SOZLUK_REVEAL_MS;
/** Sahte tanım sınırı (Unicode karakter, temizlemeden sonra). */
export const SOZLUK_MAX_LENGTH = 100;
/** Ham metin için ağ koruması (temizlemeden önce); kural sınırı değildir. */
export const SOZLUK_MAX_RAW_LENGTH = 400;

export type SozlukAction =
  /** Sahte tanımını gönder; gönderilen tanım kesindir (değiştirilemez), göndermek "Tamam"dır. */
  | { kind: "bluff"; text: string }
  /** Karıştırılmış kartlardan birini seç (kendi kartın hariç); kilitlenene kadar değiştirilebilir. */
  | { kind: "pick"; card: string }
  /** Seçimde "Tamam": seçim kesinleşir. */
  | { kind: "lock" };

export type SozlukPhase = "write" | "pick" | "reveal";

/** Karıştırılmış kart: gerçek tanım ve sahte tanımlar aynı biçimde, sahipsiz. */
export interface SozlukCard {
  id: string;
  text: string;
}

export interface SozlukReveal {
  /** Gerçek tanımın kartı. */
  realCard: string;
  /** Sahte kartların sahibi: kart -> oyuncu (gerçek kart yok). */
  authors: Record<string, string>;
  /** Seçimler: oyuncu -> kart (seçmeyen yok). */
  picks: Record<string, string>;
  /** Genel skora eklenen puanlar (mini puanlarla aynı). */
  scores: Record<string, number>;
}

/** Herkese açık görünüm: gerçek kart ve kart sahipleri sonuç açılana kadar hiçbir yerde yoktur. */
export interface SozlukPublicView {
  players: string[];
  phase: SozlukPhase;
  /** Garip kelime (büyük harf). */
  word: string;
  startedAt: number;
  writeEndsAt: number;
  pickEndsAt: number;
  finishAt: number;
  /** Bulunulan aşamada hazır olanlar: yazmada tanımını gönderenler, seçmede "Tamam" diyenler. */
  ready: string[];
  /** Seçme aşamasından itibaren: karıştırılmış kartlar. */
  cards: SozlukCard[] | null;
  reveal: SozlukReveal | null;
}

/** Kişiye özel görünüm. */
export interface SozlukView {
  /** Gönderdiğin (temizlenmiş) sahte tanım; henüz göndermediysen null. */
  myBluff: string | null;
  /** Seçme aşamasında senin kartının numarası (seçemezsin); yazmadıysan null. */
  myCard: string | null;
  myPick: string | null;
  /** Bulunulan aşamada hazır dedin mi. */
  locked: boolean;
}
