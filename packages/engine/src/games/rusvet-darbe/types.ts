/** Rüşvet ve Darbe — istemci ile sunucu arasındaki sözleşme. Kurallar: docs/KURALLAR.md §11, docs/A6-OYUNLAR.md. */

/** Başkanlık seçimi süresi, 3–5 oyuncuda (RD-M7). */
export const RUSVET_VOTE_MS = 20_000;
/** Başkanlık seçimi süresi, kalabalık masada (6–8 oyuncu; RD-M7). */
export const RUSVET_VOTE_CROWD_MS = 30_000;
/** Bu sayıdan itibaren seçim kalabalık süresiyle oynanır. */
export const RUSVET_CROWD_FROM = 6;
/** Oyuncu sayısına göre seçim süresi (RD-M7). */
export const rusvetVoteMs = (players: number): number =>
  players >= RUSVET_CROWD_FROM ? RUSVET_VOTE_CROWD_MS : RUSVET_VOTE_MS;
/** Herkes "Tamam" deyince oylamanın / dağıtımın bitişine kalan süre (ms). */
export const RUSVET_LOCK_GRACE_MS = 1_000;
/** RD-M4: bu kadar ya da daha çok aday eşit kalırsa önce ikinci oylama yapılır. */
export const RUSVET_RUNOFF_FROM = 4;
/** RD-M4: ikinci oylama süresi. */
export const RUSVET_RUNOFF_MS = 12_000;
/** Darbe düellosunda bir elin gizli işaret süresi. */
export const RUSVET_SIGN_MS = 8_000;
/** İşaretler açıldıktan sonra sonucun gösterildiği süre. */
export const RUSVET_SIGN_REVEAL_MS = 2_500;
/** RD-U7: "Başkan seçildi" anı; dağıtım süresi bu anın bitiminden sayılır. */
export const RUSVET_CROWN_MS = 1_500;
/** Dağıtım süresi. */
export const RUSVET_GIVE_MS = 25_000;
/** Darbe oylaması süresi (jeton almayanlar). */
export const RUSVET_COUP_MS = 10_000;
/** Sonuç açılış süresi (RD-U9; oyun bu sürenin sonunda biter). */
export const RUSVET_REVEAL_MS = 11_000;
/** Bir kişiye verilebilecek en çok jeton. */
export const RUSVET_MAX_PER_PLAYER = 2;
/** RD-M2: darbe tutmazsa başkanın aldığı puan. */
export const RUSVET_PRESIDENT_SCORE = 2;
/** Eşitlikte en çok kaç el oynanır; sonra rastgele başkan seçilir (güvenlik sınırı). */
export const RUSVET_MAX_HANDS = 6;
/** Oyunun olabilecek en uzun süresi (kalabalık seçim, ikinci oylama ve her el eşit kalırsa). */
export const RUSVET_MAX_DURATION_MS =
  RUSVET_VOTE_CROWD_MS +
  RUSVET_RUNOFF_MS +
  RUSVET_MAX_HANDS * (RUSVET_SIGN_MS + RUSVET_SIGN_REVEAL_MS) +
  RUSVET_CROWN_MS +
  RUSVET_GIVE_MS +
  RUSVET_COUP_MS +
  RUSVET_REVEAL_MS;

export type Sign = "tas" | "kagit" | "makas";
export const SIGNS: readonly Sign[] = ["tas", "kagit", "makas"];

/**
 * RD-M3: seçim vaadi (herkese açık, puansız).
 * - voters: "Oy verene jeton" — bana kendi eliyle oy veren herkese en az 1 jeton.
 * - all: "Herkese jeton" — jetonu olabildiğince çok kişiye yayarım.
 */
export type Pledge = "voters" | "all";
export const PLEDGES: readonly Pledge[] = ["voters", "all"];

export interface Allocation {
  /** Jeton verilen oyuncu. */
  to: string;
  /** 1 ile 2 arası jeton. */
  n: number;
}

/**
 * - vote: başkanlık için kendin dışında bağlı birine gizli oy; süre bitene kadar değiştirilebilir. İkinci oylamada
 *   (RD-M4) yalnız eşit adaylardan birine.
 * - pledge: seçim süresince kendi vaadini asar / değiştirir / indirir (null).
 * - sign: darbe düellosunda (yalnız eşit adaylar) elin gizli işareti; tek seferlik.
 * - give: yalnız başkan; jetonların tamamını ya da bir kısmını dağıtır, süre bitene kadar değiştirilebilir.
 * - lock: oylamada "Tamam" (oy kesinleşir); başkan için dağıtımda "Bitti" (dağıtım kesinleşir).
 */
export type RusvetAction =
  | { kind: "vote"; target: string }
  | { kind: "pledge"; pledge: Pledge | null }
  | { kind: "sign"; sign: Sign }
  | { kind: "give"; tokens: Allocation[] }
  | { kind: "lock" }
  /** Darbe oylaması (yalnız jeton almayanlar): true = "Darbe", false = "Darbe yok". Tek seferliktir. */
  | { kind: "coup"; yes: boolean };

export type RusvetPhase = "vote" | "runoff" | "duel" | "give" | "coup" | "reveal";

/** Darbe oylamasının herkese açık sonucu: yalnız sayılar; kim ne dedi hiçbir zaman açılmaz. */
export interface RusvetCoupResult {
  /** Oy hakkı olanlar (jeton almayan, başkan olmayan oyuncular). */
  eligible: string[];
  /** "Darbe" diyenlerin sayısı. */
  yes: number;
  /** Darbe tutup başkanın puanı iptal edildi mi (yes, eligible.length / 2'den büyükse). */
  success: boolean;
}

/** Tamamlanmış (işaretleri açılmış) bir düello eli. */
export interface DuelHand {
  candidates: string[];
  signs: Record<string, Sign>;
  /** Eli geçenler (el tekrarlandıysa adayların hepsi). */
  advance: string[];
  /** Elde sonuç çıkmadı (tek işaret ya da üç işaret) ve el tekrarlanacak. */
  replay: boolean;
}

export interface RusvetDuel {
  /** 1'den başlayan el numarası. */
  hand: number;
  candidates: string[];
  signStartedAt: number;
  signEndsAt: number;
  revealEndsAt: number;
  /** Elin işaretleri; `signEndsAt` geçmeden null. */
  signs: Record<string, Sign> | null;
  /** Önceki eller. */
  history: DuelHand[];
  /** RD-U8: son elde de eşitlik kaldıysa kurayla seçilen başkan (işaretler açılınca); yoksa null. */
  lottery: string | null;
}

/** RD-M4: ikinci oylamanın herkese açık bilgisi (oylar sonda açılır). */
export interface RusvetRunoff {
  /** Eşit kalan adaylar (ilk tur sırasıyla). */
  candidates: string[];
}

/** RD-M3: seçilen başkanın vaadi ve gerçek dağılımla karşılaştırması (açılışta). */
export interface RusvetPledgeVerdict {
  pledge: Pledge;
  /** TUTTU ✓ / BOZDU ✗. */
  kept: boolean;
  /** Başkan "Bitti" demedi; dağıtım süre dolunca tamamlandı ("süre doldu" notu). */
  timedOut: boolean;
}

export interface RusvetReveal {
  /** Başkanlık oyları: kim kime (oy vermeyenin oyu rastgele atanmıştır). */
  votes: Record<string, string>;
  /** Başkanlık oyu sayısı (ilk tur). */
  counts: Record<string, number>;
  /** RD-M5: oy vermediği için oyu rastgele atananlar. */
  randomVoters: string[];
  /** RD-M4: ikinci oylama yapıldıysa oylar (yalnız oy verenler); yoksa null. */
  runoffVotes: Record<string, string> | null;
  /** Başkanın aldığı jetonlar (oyuncu başına; rastgele tamamlananlar dahil). */
  tokens: Record<string, number>;
  /** RD-M5: süre dolduğu için rastgele (ya da kopan başkanda seçmenlerine) giden jetonlar (oyuncu başına). */
  randomTokens: Record<string, number>;
  /** RD-M6: başkan dağıtımda koptuğu için kalan jetonlar önce seçmenlerine gitti. */
  offlineRefill: boolean;
  /** Genel skora eklenen puan: başkan +2 (darbe tutmazsa), jetonlar. */
  scores: Record<string, number>;
  duelHands: DuelHand[];
  /** Darbe oylamasının sonucu; oy hakkı olan yoksa (aşama atlandı) null. */
  coup: RusvetCoupResult | null;
  /** RD-M3: başkanın vaadi (vaat asmadıysa null). */
  pledge: RusvetPledgeVerdict | null;
}

/** Darbe aşamasının herkese açık bilgisi: dağılım açılmıştır, oylar değildir. */
export interface RusvetCoupPublic {
  /** Başkanın dağıttığı jetonlar (oyuncu başına), dağıtım açıldı. */
  tokens: Record<string, number>;
  /** Oy hakkı olanlar. */
  eligible: string[];
}

/** Herkese açık görünüm: oylar, işaretler (el bitene kadar) ve dağıtım sonuna kadar görünmez. */
export interface RusvetPublicView {
  players: string[];
  phase: RusvetPhase;
  startedAt: number;
  /** Şu anki aşamanın başlangıcı ve bitişi (süre çubuğu için; dağıtımda "Başkan seçildi" anından sonra). */
  phaseStartedAt: number;
  phaseEndsAt: number;
  /** Seçim bitince açılır. */
  president: string | null;
  /** Başkanın dağıtacağı jeton sayısı (aldığı oy sayısı); seçim bitince açılır. */
  budget: number | null;
  /** RD-U7: dağıtımda "Başkan seçildi" anının başlangıcı ve bitişi; diğer aşamalarda null. */
  crown: { startedAt: number; endsAt: number } | null;
  /**
   * RD-M3: asılı vaatler (herkese açık). Seçim, ikinci oylama ve düelloda herkesinki; başkan belli olunca yalnız
   * başkanınki.
   */
  pledges: Record<string, Pledge>;
  /**
   * Hazır olanlar (yalnız kimler; seçimleri gizli): oylamada "Tamam" diyenler, düelloda işaretini verenler,
   * dağıtımda "Bitti" diyen başkan, darbede oy verenler. Diğer aşamalarda boş.
   */
  ready: string[];
  runoff: RusvetRunoff | null;
  duel: RusvetDuel | null;
  /** Yalnız darbe aşamasında. */
  coup: RusvetCoupPublic | null;
  reveal: RusvetReveal | null;
}

/** RD-M1: başkanın defteri — yalnız başkanın kendi görünümünde (ilk tur oyları). */
export interface RusvetLedger {
  /** Başkana kendi eliyle oy verenler. */
  voters: string[];
  /** Oy vermediği için oyu başkana rastgele düşenler. */
  random: string[];
}

/** Kişiye özel görünüm. İzleyicide hepsi boş. */
export interface RusvetView {
  /** Başkanlık oyun (ilk tur; seçim bitince oy vermediysen rastgele atanan). İkinci oylamada o turdaki oyun. */
  myVote: string | null;
  /** RD-U4: oyun seçim bitince rastgele atandı (oy vermedin). */
  myVoteRandom: boolean;
  /** Düelloda şu anki elin işaretin (yalnız aday için). */
  mySign: Sign | null;
  /** Yalnız başkan: o ana kadar verdiği jetonlar. */
  myTokens: Allocation[] | null;
  /** RD-M1: yalnız başkan, dağıtım ve darbe aşamasında: kendisine kim oy verdi. */
  ledger: RusvetLedger | null;
  /** Yalnız darbe aşamasında, oy hakkı olan sana: verdiğin darbe oyu (yoksa null). Başkasının oyu hiçbir yerde yok. */
  myCoup: boolean | null;
  /** Darbe aşamasında oy hakkın var mı. */
  canCoup: boolean;
  /** Bulunulan aşamada hazırsın: oy kilitli / işaretin verildi / dağıtım bitti. */
  locked: boolean;
}
