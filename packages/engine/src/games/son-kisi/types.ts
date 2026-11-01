/**
 * Son Kişi — istemci ile sunucu arasındaki sözleşme. Kurallar: docs/KURALLAR.md §17 (SK öneri paketi), docs/A6-OYUNLAR.md.
 *
 * Akış (SK-M2): 3 alarm (tur). Her turun gizli alarmı turun başından 8–16 sn sonradır; herkes kaçarsa tur son kaçıştan
 * 1 sn sonra kapanır. Turlar arasında 4 sn kısa açılış; son turun kapanışı oyunun son açılışıdır (ardından "Devam et").
 *
 * Gizlilik: alarm anı ve gerilim eşikleri tur bitene kadar hiçbir görünümde yoktur. Görünümlerde mutlak zaman olarak
 * yalnız oyunun başlangıcı (`startedAt`) bulunur; diğer her süre turun başından ölçülür. Sahip kararı: oyun sırasında
 * **kimin kaçtığı görünmez**, yalnız kaç kişinin kaçtığı görünür; kimin ne zaman kaçtığı turun açılışında açılır.
 */

/** SK-M2: tur (alarm) sayısı. */
export const SON_KISI_ROUNDS = 3;
/** Gizli alarm, turun başından en az / en çok bu kadar sonra (ms çözünürlükte rastgele, uçlar dahil). */
export const SON_KISI_MIN_MS = 8_000;
export const SON_KISI_MAX_MS = 16_000;
/** Bir turda herkes kaçtıysa turun kapanmasına kalan süre (ms). */
export const SON_KISI_LOCK_GRACE_MS = 1_000;
/** SK-M2 / SK-U8: turlar arasındaki kısa açılış (ms). */
export const SON_KISI_GAP_MS = 4_000;
/** SK-U6: son turun kapanışından sonra oyun içi son açılışın süresi (ms; ardından ortak "Devam et"). */
export const SON_KISI_REVEAL_MS = 6_000;
/** SK-M3 / SK-M4: alarmdan önceki bu pencerede (ms, uç dahil) kaçan "KIL PAYI" sayılır ve +1 ek tur puanı alır. */
export const SON_KISI_CLOSE_MS = 1_000;
/** SK-M1: son kaçan / sondan ikinci (yalnız 3+ oyuncuda) / kıl payı tur puanları. */
export const SON_KISI_LAST_POINTS = 2;
export const SON_KISI_SECOND_POINTS = 1;
export const SON_KISI_CLOSE_BONUS = 1;

/**
 * En uzun olası toplam süre (her tur en geç alarmla ve kimse erken bitirmezse): 3 tur, 2 tur arası ve son açılış.
 * Bot/simülasyon penceresi.
 */
export const SON_KISI_TOTAL_MS =
  SON_KISI_ROUNDS * SON_KISI_MAX_MS + (SON_KISI_ROUNDS - 1) * SON_KISI_GAP_MS + SON_KISI_REVEAL_MS;

export type SonKisiAction = { kind: "escape" };

/** Gerilim düzeyi: o turda geçilen gizli eşik sayısı (0–3). Alarm anı hiçbir görünümde yoktur. */
export type SonKisiTension = 0 | 1 | 2 | 3;

/** `play`: tur sürüyor · `gap`: turlar arası kısa açılış · `over`: son açılış. */
export type SonKisiPhase = "play" | "gap" | "over";

/** Bir turun açılışında bir kaçış. */
export interface SonKisiEscape {
  id: string;
  /** Turun başından kaçışa geçen süre (ms). */
  ms: number;
  /** Tur puanı (son kaçan 2, sondan ikinci 1, kıl payı +1; diğerleri 0). */
  points: number;
  /** SK-M4: alarmdan önceki son 1 sn içinde kaçtı (KIL PAYI +1). */
  close: boolean;
}

/** Bir tur kapanınca açılan sonuç (SK-M3, SK-U6). */
export interface SonKisiRoundResult {
  /** 0 tabanlı tur numarası. */
  index: number;
  /** Gizli alarm anı (turun başından ms). Herkes erken kaçtıysa da özgün an ("çalacaktı"). */
  alarmMs: number;
  /** Alarm çaldı mı (false: herkes kaçtığı için tur alarmdan önce kapandı). */
  rang: boolean;
  /** Kaçanlar, kaçış sırasıyla (eşit zamanda katılım sırasıyla). */
  escapes: SonKisiEscape[];
  /** Alarma yakalananlar (kaçmayanlar; 0 puan), katılım sırasıyla. */
  caught: string[];
  /** En son kaçan(lar) (+2); kimse kaçmadıysa boş. */
  last: string[];
  /** Sondan ikinci kaçan(lar) (+1; 2 oyuncuda hep boş). */
  second: string[];
  /** Oyuncu → bu turun puanı (eksi yok). */
  points: Record<string, number>;
}

/** Oyun sonu sıralamasında bir oyuncu (SK-M2). */
export interface SonKisiStanding {
  playerId: string;
  /** Üç turun puanları toplamı (mini oyun puanı). */
  total: number;
  /** Tur tur puan. */
  roundPoints: number[];
  /** Toplama göre derece (eşitler aynı derece, sonraki atlanır). */
  rank: number;
  /** Genel skora eklenen puan (+2 / +1 / 0). */
  award: number;
}

/** Herkese açık görünüm. Bir tur kapanmadan o turun alarmı, eşikleri ve kimin kaçtığı burada yoktur. */
export interface SonKisiPublicView {
  /** Oyunun başlangıcı (sunucu saati). Görünümdeki tek mutlak zamandır. */
  startedAt: number;
  /** Toplam tur sayısı (3). */
  rounds: number;
  /** Gösterilen tur (0 tabanlı): oynanan, tur arasında az önce biten, sonda son tur. */
  round: number;
  phase: SonKisiPhase;
  /** Oynanan turun gerilim düzeyi; tur kapanınca 3. */
  tension: SonKisiTension;
  /** Oynanan turda kaç kişi kaçtı (kim olduğu yok; sahip kararı). Tur kapanınca o turun kaçan sayısı. */
  escapedCount: number;
  /** Kapanmış turların sonuçları (tur sırasıyla). */
  results: SonKisiRoundResult[];
  /** Kapanmış turların toplam puanı (oyuncu → puan). */
  totals: Record<string, number>;
  /** Oyun sonu sıralaması; son tur kapanmadan null. */
  final: SonKisiStanding[] | null;
  /** Son tur kapandı mı (oyun içi son açılış başladı). */
  finished: boolean;
}

/** Kişiye özel görünüm: oynanan turda kaçtın mı ve kaçtıysan ne zaman (yalnız sende). İzleyicide hep boş. */
export interface SonKisiView {
  escaped: boolean;
  /** Kendi kaçış anın (turun başından ms); kaçmadıysan null. */
  myMs: number | null;
}
