/** İttifak — istemci ile sunucu arasındaki sözleşme. Kurallar: docs/KURALLAR.md §16, docs/A6-OYUNLAR.md. */

/**
 * Sözlü pazarlık süresi oyuncu sayısına göre (IT-M4): 3–4 oyuncuda 45 sn, 5–6 oyuncuda 60 sn, 7–8 oyuncuda 75 sn.
 * Uygulamada tek eylem söz işareti ve "Oylamaya geç"tir.
 */
export function ittifakTalkMs(players: number): number {
  if (players <= 4) return 45_000;
  return players <= 6 ? 60_000 : 75_000;
}
/** Pazarlık bitince 1 sn'lik "PAZARLIK BİTTİ · OYLAR GİZLİ" geçişi (IT-U8); oylama süresi ardından işler. */
export const ITTIFAK_BAND_MS = 1_000;
export const ITTIFAK_VOTE_MS = 15_000;
/** Oyların tek tek okunduğu en az gösterim süresi (IT-U5): 3 sn + oyuncu başına 0,9 sn. */
export function ittifakRevealMs(players: number): number {
  return 3_000 + 900 * players;
}
/** Oyuncu sayısına göre toplam oyun süresi (erken bitiş olmazsa). */
export function ittifakDurationMs(players: number): number {
  return ittifakTalkMs(players) + ITTIFAK_BAND_MS + ITTIFAK_VOTE_MS + ittifakRevealMs(players);
}
/** En uzun oyun (8 oyuncu): 75 + 1 + 15 + 10,2 = 101,2 sn. */
export const ITTIFAK_MAX_DURATION_MS = ittifakDurationMs(8);

/** Kendin dışında bir katılımcıya oy ver (kopan da olabilir, IT-M2); oylama bitene kadar değiştirilebilir. */
export type IttifakAction =
  | { kind: "vote"; target: string }
  /**
   * Pazarlıkta "söz" işareti ("sana oy vereceğim"): koy ya da kaldır. Puanı yoktur, oyu bağlamaz;
   * `ittifakMaxPromises` kişiye kadar, kendin hariç. Sonuç açılana kadar yalnız sözü verene görünür.
   */
  | { kind: "promise"; target: string; on: boolean }
  /** Konuşma aşamasında "Oylamaya geçelim". */
  | { kind: "skip" }
  /** Oylamada "Tamam": oyun kesinleşir. */
  | { kind: "lock" };

/** Bir oyuncunun verebileceği en çok söz işareti (IT-M5): 3–4 oyuncuda 1, 5–8 oyuncuda 2. */
export function ittifakMaxPromises(players: number): number {
  return players <= 4 ? 1 : 2;
}

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
  /** Oyuncu başına alınan oy sayısı (oyun içi puan). */
  scores: Record<string, number>;
  /** Genel skora giden ödül (IT-M1): en çok oy +2, ikinci +1, diğerleri 0; herkes eşitse herkes +1. */
  awards: Record<string, number>;
  /** Oy vermediği için oyu sunucuca (zarla) atananlar (IT-M3), katılım sırasıyla. */
  random: string[];
  /** Söz işaretleri: söz veren -> sözleri (tutuldu/bozuldu). Yalnız sonuç açılırken vardır. */
  promises: Record<string, IttifakPromise[]>;
}

/** Herkese açık görünüm: oylama sonuçları açılana kadar hiçbir oy ya da sayı içermez. */
export interface IttifakPublicView {
  players: string[];
  phase: IttifakPhase;
  startedAt: number;
  /** Pazarlığın bitişi; ardından `ITTIFAK_BAND_MS` geçiş, sonra oylama. */
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

/**
 * Söz verenin sonuç etiketi (IT-U6): "eri" sözünün eri (verdiği bütün sözleri tuttu), "cifte" çifte oyun (iki söz
 * verdi, birini tuttu), "hain" söz verdiği kimseye oy vermedi, "zar" söz verdiği kimseye oy gitmedi ama oyu zarla
 * atandı (oy vermedi; IT-M3 ile "hain" sayılmaz). Söz vermeyende etiket yok.
 */
export type IttifakLabel = "eri" | "cifte" | "hain" | "zar";
