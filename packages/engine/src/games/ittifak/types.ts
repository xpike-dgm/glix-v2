/** İttifak — istemci ile sunucu arasındaki sözleşme. Kurallar: docs/KURALLAR.md §16, docs/A6-OYUNLAR.md. */

/** Sözlü pazarlık: uygulamada eylem yoktur. */
export const ITTIFAK_TALK_MS = 60_000;
export const ITTIFAK_VOTE_MS = 15_000;
/** Oylar açıldıktan sonra oy akışının gösterildiği süre (oyun bu sürenin sonunda biter). */
export const ITTIFAK_REVEAL_MS = 8_000;
export const ITTIFAK_DURATION_MS = ITTIFAK_TALK_MS + ITTIFAK_VOTE_MS + ITTIFAK_REVEAL_MS;

/** Kendin dışındaki bağlı bir katılımcıya oy ver; oylama bitene kadar değiştirilebilir (son oy geçerli). */
export type IttifakAction =
  | { kind: "vote"; target: string }
  /**
   * Pazarlıkta "söz" işareti ("sana oy vereceğim"): koy ya da kaldır. Puanı yoktur, oyu bağlamaz;
   * en çok 2 kişiye, kendin hariç. Sonuç açılana kadar yalnız sözü verene görünür.
   */
  | { kind: "promise"; target: string; on: boolean }
  /** Konuşma aşamasında "Oylamaya geçelim". */
  | { kind: "skip" }
  /** Oylamada "Tamam": oyun kesinleşir. */
  | { kind: "lock" };

/** Bir oyuncunun verebileceği en çok söz işareti. */
export const ITTIFAK_MAX_PROMISES = 2;

/** Herkes hazırsa aşamanın bitişine kalan süre (ms). */
export const ITTIFAK_LOCK_GRACE_MS = 1_000;

/** Sonuçta açılan bir söz: gerçek oyla karşılaştırılır. */
export interface IttifakPromise {
  to: string;
  /** Söz veren gerçekten ona oy verdi mi (✓) ya da vermedi mi (✗). */
  kept: boolean;
}

export type IttifakPhase = "talk" | "vote" | "reveal";

export interface IttifakReveal {
  /** Her katılımcının (kendisi dışındaki) oyu: kim kime. Oy vermeyenin oyu rastgele atanmıştır. */
  votes: Record<string, string>;
  /** Oyuncu başına alınan oy sayısı (= genel skora eklenen puan). */
  scores: Record<string, number>;
  /** Söz işaretleri: söz veren -> sözleri (tutuldu/bozuldu). Yalnız sonuç açılırken vardır. */
  promises: Record<string, IttifakPromise[]>;
}

/** Herkese açık görünüm: oylama sonuçları açılana kadar hiçbir oy ya da sayı içermez. */
export interface IttifakPublicView {
  players: string[];
  phase: IttifakPhase;
  startedAt: number;
  talkEndsAt: number;
  voteEndsAt: number;
  finishAt: number;
  /** Bulunulan aşamada hazır olanlar: konuşmada "Oylamaya geçelim" diyenler, oylamada "Tamam" diyenler. */
  ready: string[];
  reveal: IttifakReveal | null;
}

/** Kişiye özel görünüm: yalnız kendi oyun. İzleyicide null. */
export interface IttifakView {
  myVote: string | null;
  /** Koyduğun söz işaretleri (yalnız sana görünür; alıcı da görmez). */
  myPromises: string[];
  /** Bulunulan aşamada hazır dedin mi (konuşmada atlama, oylamada kilit). */
  locked: boolean;
}
