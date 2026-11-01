/**
 * Kör Kronometre — istemci ile sunucu arasındaki sözleşme. Kurallar: docs/KURALLAR.md §9 (O6 ve KR öneri paketi).
 *
 * Akış (KR-M2, KR-M3): 3 el. Her el "Hazır ol" (1. elde 3 sn, sonrakilerde 2 sn; hedef görünür, basılmaz) → "BAŞLA!"
 * → sayma ve tek basış (hedef + 8 sn; herkes basarsa son basıştan 1 sn sonra kapanır) → el arası kısa açılış (3 sn).
 * Son elin kapanışı oyunun son açılışıdır (6 sn, ardından ortak "Devam et").
 */

/** Hedef süre aralığı (tam saniye, uçlar dahil); her el için setup'ta tohumlu RNG ile, eller arasında tekrarsız (O6). */
export const KOR_KRONOMETRE_TARGET_MIN_S = 7;
export const KOR_KRONOMETRE_TARGET_MAX_S = 13;
/** KR-M3: el sayısı. */
export const KOR_KRONOMETRE_HANDS = 3;
/** KR-M2: elin başındaki "Hazır ol" süresi (ms): 1. elde 3 sn, 2. ve 3. elde 2 sn. */
export const KOR_KRONOMETRE_READY_MS: readonly number[] = [3_000, 2_000, 2_000];
/** KR-M3 / KR-U7: eller arasındaki kısa açılış (ms). */
export const KOR_KRONOMETRE_GAP_MS = 3_000;
/** Basış süresi = hedef + bu pay (ms); "BAŞLA!" anından ölçülür. */
export const KOR_KRONOMETRE_EXTRA_MS = 8_000;
/** Son el kapandıktan sonra son açılışın ekranda kaldığı süre (ms). */
export const KOR_KRONOMETRE_REVEAL_MS = 6_000;
/** Bir elde herkes bastıysa elin kapanmasına kalan süre (ms). */
export const KOR_KRONOMETRE_LOCK_GRACE_MS = 1_000;
/** KR-M1: istemcinin bildirdiği dokunma anı, sunucunun aldığı andan en çok bu kadar eskiyse kabul edilir (ms). */
export const KOR_KRONOMETRE_AT_MAX_AGE_MS = 400;
/** KR-M5 / KR-U6: hedefe bu kadar ya da daha yakın basış "TAM İSABET" sayılır (ms, uç dahil). */
export const KOR_KRONOMETRE_BULLSEYE_MS = 50;
/** KR-M5: tam isabetin derecesinden bağımsız ek el puanı. */
export const KOR_KRONOMETRE_BULLSEYE_BONUS = 1;

/** Elin basış süresi (ms): hedef + 8 sn ("BAŞLA!"dan). */
export const korKronometreDurationMs = (targetMs: number): number => targetMs + KOR_KRONOMETRE_EXTRA_MS;

/** El `index`in (0 tabanlı) "Hazır ol" süresi (ms). */
export const korKronometreReadyMs = (index: number): number =>
  KOR_KRONOMETRE_READY_MS[Math.min(KOR_KRONOMETRE_READY_MS.length - 1, Math.max(0, index))] ?? 2_000;

/**
 * En uzun olası toplam süre (her el en uzun hedefle ve kimse erken bitirmezse): 3 el (hazır ol + hedef + 8 sn),
 * 2 el arası ve son açılış. Bot/simülasyon penceresi.
 */
export const KOR_KRONOMETRE_TOTAL_MS =
  KOR_KRONOMETRE_READY_MS.reduce((a, b) => a + b, 0) +
  KOR_KRONOMETRE_HANDS * korKronometreDurationMs(KOR_KRONOMETRE_TARGET_MAX_S * 1_000) +
  (KOR_KRONOMETRE_HANDS - 1) * KOR_KRONOMETRE_GAP_MS +
  KOR_KRONOMETRE_REVEAL_MS;

/**
 * `at` (KR-M1): dokunma anı, sunucu saatiyle (ms; istemci ping ortancasıyla düzeltir). Verilmezse sunucunun aldığı an.
 */
export type KorKronometreAction = { kind: "press"; at?: number };

/** Bir elin süresi dolunca açılan bir oyuncunun satırı. */
export interface KorKronometreEntry {
  playerId: string;
  /** Basış anı ("BAŞLA!"dan, ms); basmayan için null. */
  ms: number | null;
  pressed: boolean;
  /** |ms − hedef|; basmayan için null. */
  distance: number | null;
  /** Eşit mesafede aynı derece; sonraki derece atlanır (1, 1, 3 …). Basmayan sıralamaya girmez: null. */
  rank: number | null;
  /** KR-M5 / KR-U6: hedefe 50 ms ya da daha yakın. */
  bullseye: boolean;
  /** El puanı: derece 1 → 2, derece 2 → 1, diğerleri 0; tam isabette +1. */
  points: number;
}

/** Bir elin açılışı; yakından uzağa sıralıdır (basmayanlar sonda, katılım sırasıyla). */
export interface KorKronometreReveal {
  entries: KorKronometreEntry[];
}

/** Herkese açık el bilgisi. Basışlar yalnız el kapandıktan sonra (`reveal`) açılır. */
export interface KorKronometreHand {
  /** 0 tabanlı el numarası. */
  index: number;
  /** Elin hedefi (ms; tam saniye, 7–13 sn). */
  targetMs: number;
  /** "Hazır ol"un başladığı an (sunucu saati, ms). */
  startAt: number;
  /** "BAŞLA!" anı: sayma ve basış bu andan başlar. */
  goAt: number;
  /** Basışın kapandığı an; herkes basınca öne çekilir. */
  endsAt: number;
  /** El kapanmadan null. */
  reveal: KorKronometreReveal | null;
}

/** `ready`: "Hazır ol" · `count`: sayma ve basış · `gap`: el arası açılış · `over`: son açılış. */
export type KorKronometrePhase = "ready" | "count" | "gap" | "over";

/** Oyun sonu sıralamasında bir oyuncu (KR-M3). */
export interface KorKronometreStanding {
  playerId: string;
  /** El puanları toplamı (mini oyun puanı). */
  total: number;
  /** El el puan; basmadığı elde null. */
  handPoints: (number | null)[];
  /** Bastığı el sayısı (eşitlik bozucu 1). */
  pressedHands: number;
  /** Bastığı ellerdeki ortalama uzaklık (ms, eşitlik bozucu 2); hiç basmadıysa null. */
  avgDistance: number | null;
  /** Toplam → bastığı el → ortalama uzaklık sırasıyla derece (eşitler aynı derece, sonraki atlanır). */
  rank: number;
  /** Genel skora eklenen puan (+2 / +1 / 0). */
  award: number;
}

export interface KorKronometreFinal {
  standings: KorKronometreStanding[];
}

/** Herkese açık görünüm. Bir el kapanmadan o elin hiçbir basışı (kim bastığı da) burada yoktur. */
export interface KorKronometrePublicView {
  startedAt: number;
  /** Toplam el sayısı (3). */
  hands: number;
  /** Gösterilen el (0 tabanlı): oynanan, el arasında az önce biten, sonda son el. */
  hand: number;
  phase: KorKronometrePhase;
  /** Başlamış eller (el arasında sıradaki el de; hedefi o an açıklanır). Gelecek ellerin hedefi yoktur. */
  played: KorKronometreHand[];
  /** Kapanmış ellerin toplam el puanı (oyuncu → puan). */
  totals: Record<string, number>;
  /** Son elin kapanışı (son açılışın başı); son el başlamadan null (gelecek hedefleri ele vermesin). */
  endsAt: number | null;
  /** Son açılışın bitişi (oyunun bitişi); son el başlamadan null. */
  revealEndsAt: number | null;
  /** Oyun sonu sıralaması; son el kapanmadan null. */
  final: KorKronometreFinal | null;
}

/** Kişiye özel görünüm: yalnız gösterilen elde bastın mı; basış anı el kapanana kadar sahibine de gizlidir. */
export interface KorKronometreView {
  pressed: boolean;
}
