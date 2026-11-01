/**
 * Çizgiyi Geçme — istemci ile sunucu arasındaki sözleşme. Kurallar: docs/KURALLAR.md §18 (O12 ve CZ öneri paketi
 * değişikliği dahil: iki tur, kalabalık radarı, 100 her zaman tek başına "Zirve").
 */

/** Tur sayısı (CZ-M1): keşif ve final. */
export const CIZGI_ROUNDS = 2;
/** Her turun seçim süresi (ms). CZ-M2 (15 sn) onaylanmadı: süre 30 sn kalır. */
export const CIZGI_CHOOSE_MS = 30_000;
/** 1. turun açılışının ekranda kaldığı süre (ms); ardından 2. tur başlar. */
export const CIZGI_ROUND_REVEAL_MS = 5_000;
/** Son turun açılışının (ve genel puanların) ekranda kaldığı süre (ms); ardından ortak "Devam et". */
export const CIZGI_REVEAL_MS = 7_000;
/** Oyunun tam süresi (ms): 30 + 5 + 30 + 7 = 72 sn; erken bitişte kısalır. */
export const CIZGI_DURATION_MS =
  CIZGI_ROUNDS * CIZGI_CHOOSE_MS + (CIZGI_ROUNDS - 1) * CIZGI_ROUND_REVEAL_MS + CIZGI_REVEAL_MS;
/** Kalabalık radarının anı (CZ-M3): turun başından bu kadar sonra, turun ortası. */
export const CIZGI_RADAR_MS = 15_000;
/** Radar bu oyuncu sayısından itibaren vardır (2 kişide radar yok; CZ-M3). */
export const CIZGI_RADAR_MIN_PLAYERS = 3;

/** Seçilebilecek en küçük ve en büyük sayı (tam sayı). */
export const CIZGI_MIN = 0;
export const CIZGI_MAX = 100;

/**
 * Bölge genişliği (O12, docs/KURALLAR.md §18 değişikliği): oyuncu sayısına göre.
 *
 * Gerekçe: seçimler 0–100 üzerinde dağılırken bir oyuncunun başkasıyla aynı bölgeye düşme olasılığı oyuncu
 * sayısından bağımsız olarak kabaca %25'te kalsın (çarpışma anlamlı ama kesin değil). Oyuncu arttıkça çarpışma
 * ihtimali büyüyeceğinden bölge daralır; az oyuncuda çarpışma neredeyse hiç olmayacağından genişler. 4 oyuncuda
 * eski değer (10) korunur. 100 her zaman ayrı Zirve olduğu için (CZ-M4) düzgün dağılımda olasılık tablodaki her sayı
 * için %24,5–%26,7 aralığındadır (cizgiyi-gecme.test.ts bunu denetler).
 */
export const CIZGI_ZONE_WIDTH: Readonly<Record<number, number>> = {
  2: 25,
  3: 14,
  4: 10,
  5: 7,
  6: 6,
  7: 5,
  8: 4,
};

/** Oyuncu sayısına göre bölge genişliği; tablo dışı sayılar en yakın uca bağlanır (2–8). */
export function cizgiZoneWidth(playerCount: number): number {
  const n = Math.min(8, Math.max(2, Math.floor(playerCount)));
  return CIZGI_ZONE_WIDTH[n] ?? 10;
}

/** Zirve platformunun numarası (CZ-M4): 0–99'un son platformunun bir üstü. */
export function cizgiPeakZone(width = 10): number {
  return Math.floor((CIZGI_MAX - 1) / width) + 1;
}

/**
 * Bölge numarası (CZ-M4): 100 her oyuncu sayısında tek başına "Zirve" platformudur; diğer sayılar `⌊değer ÷ genişlik⌋`.
 * 0–99'un son platformu kısa kalabilir (6 kişide 96–99, 3 ve 5 kişide 98–99).
 */
export function cizgiZone(value: number, width = 10): number {
  return value >= CIZGI_MAX ? cizgiPeakZone(width) : Math.floor(value / width);
}

/** Bölgenin ilk ve son sayısı: Zirve 100–100, diğerleri 99 ile sınırlı. */
export function cizgiZoneRange(zone: number, width: number): { from: number; to: number } {
  if (zone >= cizgiPeakZone(width)) return { from: CIZGI_MAX, to: CIZGI_MAX };
  return { from: zone * width, to: Math.min(CIZGI_MAX - 1, zone * width + width - 1) };
}

/** Kilit ("Tamam"): o turun seçimi kesinleşir; bağlı herkes kilitlerse o turun seçimi 1 sn sonra biter. */
export type CizgiAction = { kind: "choose"; value: number } | { kind: "lock" };

/** Son kilitten sonra seçimlerin açılmasına kalan süre (ms). */
export const CIZGI_LOCK_GRACE_MS = 1_000;

/**
 * Bir oyuncunun tur sonucundaki durumu:
 * - `first`: tek kalanların en yükseği (+2 tur puanı)
 * - `second`: tek kalanların ikincisi (+1 tur puanı)
 * - `safe`: tek kaldı ama ilk ikide değil (0)
 * - `crashed`: aynı bölgede başkası var, pasif (0)
 * - `none`: bu turda seçim yapmadı, pasif (0)
 */
export type CizgiStatus = "first" | "second" | "safe" | "crashed" | "none";

/** Bir turun süresi dolunca herkese açılan sonuç. */
export interface CizgiReveal {
  /** Bölge genişliği (sonuçta görünürlük için tekrar). */
  zoneWidth: number;
  /** Her katılımcının bu turdaki son seçimi; seçmeyen null. */
  choices: Record<string, number | null>;
  status: Record<string, CizgiStatus>;
  /** Bu turun tur puanı (+2 / +1 / 0); genel skor oyun sonunda toplamdan hesaplanır. */
  points: Record<string, number>;
}

/** Kalabalık radarı (CZ-M3): o an gönderilmiş seçimlere göre 2+ pin bulunan platformlar; sonra güncellenmez. */
export interface CizgiRadar {
  /** Radarın çekildiği an. */
  at: number;
  /** Yanan platform numaraları (küçükten büyüğe). Kimin orada olduğu ve kaç kişi olduğu yoktur. */
  zones: number[];
}

/** Herkese açık görünüm (oda başına bir kez). Seçimler tur açılana kadar burada yoktur. */
export interface CizgiPublicView {
  /** Oyunun başlangıcı. */
  startedAt: number;
  /** Gösterilen turun seçim başlangıcı. */
  roundStartedAt: number;
  /** Bölge genişliği (oyuncu sayısına göre; herkese açık kural bilgisi). */
  zoneWidth: number;
  /** Gösterilen turun seçim süresinin bitişi; seçimler bu anda açılır. */
  endsAt: number;
  /** Gösterilen turun açılışının bitişi (son turda oyunun bitişi). */
  revealEndsAt: number;
  /** Gösterilen tur (1 tabanlı) ve toplam tur. */
  round: number;
  rounds: number;
  /** Bu turun radar anı (kural bilgisi); 2 kişide radar olmadığı için null. */
  radarAt: number | null;
  /** Radar çekildiyse fotoğrafı; henüz çekilmediyse ya da bu tur çıkmayacaksa null. */
  radar: CizgiRadar | null;
  /** Açılmış önceki turlar, eskiden yeniye. */
  history: CizgiReveal[];
  /** Tur puanı toplamları (açılmış turlar; gösterilen tur açıldıysa o da dahil). */
  totals: Record<string, number>;
  /** Gösterilen turun süresi dolmadan null. */
  reveal: CizgiReveal | null;
  /** Yalnız son turun sonucu açıldığında: genel skora eklenecek puanlar (+2 / +1 / 0). */
  final: Record<string, number> | null;
  /** Bu turda seçimini kilitleyenler (yalnız kimler; seçimin kendisi değil). */
  lockedIds: string[];
}

/** Kişiye özel görünüm: yalnız bu turdaki kendi seçimin. */
export interface CizgiView {
  /** Henüz seçmediysen ya da izleyiciysen null. */
  myChoice: number | null;
  /** Bu turda seçimini kilitledin mi. */
  locked: boolean;
}
