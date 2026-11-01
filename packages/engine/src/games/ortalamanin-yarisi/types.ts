/**
 * Ortalamaya En Yakın — istemci ile sunucu arasındaki sözleşme. Kurallar: docs/KURALLAR.md §13 (O5 ve Kasım 2026
 * öneri paketi dahil: OY-M1 kalabalık yanar, OY-M2 rastgele sayı puan almaz, OY-U3 tur kartı).
 */

/** Tur sayısı. */
export const ORTALAMA_ROUNDS = 3;
/**
 * Turlara göre hedef çarpanı (pay/payda): 1. tur ½, 2. tur ⅔, 3. tur ¾. Hedef = o turun ortalaması × çarpan.
 * Kesirler tam sayı olarak tutulur; böylece uzaklık karşılaştırması ondalık hatasız yapılır.
 */
export const ORTALAMA_MULTIPLIERS: readonly { num: number; den: number }[] = [
  { num: 1, den: 2 },
  { num: 2, den: 3 },
  { num: 3, den: 4 },
];

/** Seçim süresi (ms), her tur: eski 20 sn'nin yarısı, alt sınır 10 sn. Tur kartından sonra başlar. */
export const ORTALAMA_CHOOSE_MS = 10_000;
/**
 * Tur kartı (OY-U3): her turun başında 0,9 sn'lik tam ekran kart. Seçim süresinden yemez; seçim süresi kart
 * yerleşince başlar. Kart sırasında seçim alınmaz.
 */
export const ORTALAMA_INTRO_MS = 900;
/** Kalabalık eşiği (OY-M1): aynı sayıyı bu kadar ya da daha çok oyuncu seçerse o sayı yanar. */
export const ORTALAMA_CROWD = 3;
/** Turlar arasında bir tur sonucunun ekranda kaldığı süre (ms). */
export const ORTALAMA_ROUND_REVEAL_MS = 5_000;
/** Son turun sonucunun (ve genel puanların) ekranda kaldığı süre (ms); hedef ışını animasyonu için. */
export const ORTALAMA_REVEAL_MS = 7_000;
/** Oyunun tam süresi (ms); erken bitişte kısalır. */
export const ORTALAMA_DURATION_MS =
  ORTALAMA_ROUNDS * (ORTALAMA_INTRO_MS + ORTALAMA_CHOOSE_MS) +
  (ORTALAMA_ROUNDS - 1) * ORTALAMA_ROUND_REVEAL_MS +
  ORTALAMA_REVEAL_MS;

/** Tur `round` (0 tabanlı) için çarpan. */
export function ortalamaMultiplier(round: number): { num: number; den: number } {
  const i = Math.min(ORTALAMA_ROUNDS - 1, Math.max(0, Math.floor(round)));
  return ORTALAMA_MULTIPLIERS[i] ?? { num: 1, den: 2 };
}

/** Seçilebilecek en küçük ve en büyük sayı (tam sayı). */
export const ORTALAMA_MIN = 0;
export const ORTALAMA_MAX = 100;

/** Kilit ("Tamam"): seçim kesinleşir; bağlı herkes kilitlerse o turun seçimi 1 sn sonra biter. */
export type OrtalamaAction = { kind: "choose"; value: number } | { kind: "lock" };

/** Son kilitten sonra seçimlerin açılmasına kalan süre (ms). */
export const ORTALAMA_LOCK_GRACE_MS = 1_000;

/** Bir turun süresi dolunca herkese açılan sonuç. */
export interface OrtalamaReveal {
  /** Her katılımcının seçimi (göndermeyene sunucunun atadığı sayı da burada; `random` listesinde işaretli). */
  choices: Record<string, number>;
  /** OY-M2: sayıyı sunucunun rastgele atadığı oyuncular (o tur hiç seçim göndermediler). Puan almazlar. */
  random: string[];
  /**
   * OY-M1: sayısı yananlar (aynı sayıyı seçen 3+ oyuncu; rastgele atanan sayılar sayıma girmez). Puan almazlar;
   * sayıları ortalamaya yine girer.
   */
  burned: string[];
  /** Seçimlerin ortalaması. */
  mean: number;
  /** Hedef = ortalama × çarpan. */
  target: number;
  /** Hedefe uzaklık (|seçim − hedef|). */
  distances: Record<string, number>;
  /** Hedefe yakınlık sırası: en yakından en uzağa; eşit uzaklıklar katılım sırasıyla. */
  order: string[];
  /**
   * Puan derecesi (1 = puana uygun en yakın); eşit uzaklıktakiler aynı dereceyi paylaşır. Yananlar ve rastgele
   * sayılar derece almaz (0); derece sırası yalnız uygun oyuncularla kurulur.
   */
  ranks: Record<string, number>;
  /** Bu turdan kazanılan mini oyun puanı (genel skora yalnız oyun sonunda toplamdan çevrilir). */
  points: Record<string, number>;
}

/**
 * Biten bir turun herkese açık özeti (sonraki turlarda "önceki tur" olarak gösterilir). Seçimler o tur açıldıktan
 * sonra zaten herkese açıktır (OY-U1 kendi geçen sayın, OY-U2 kapsüllerde geçen tur, OY-U8 üç turun tablosu).
 */
export interface OrtalamaRoundSummary {
  mean: number;
  target: number;
  multiplier: { num: number; den: number };
  choices: Record<string, number>;
  points: Record<string, number>;
  random: string[];
  burned: string[];
}

/** Herkese açık görünüm (oda başına bir kez). Seçimler tur süresi dolana kadar burada yoktur. */
export interface OrtalamaPublicView {
  /** Oyunun başlangıcı. */
  startedAt: number;
  /** Gösterilen turun başlangıcı: tur kartı (OY-U3) bu anda açılır. */
  introAt: number;
  /** Gösterilen turun seçim başlangıcı (tur kartından sonra; PhaseClock için). */
  roundStartedAt: number;
  /** Gösterilen turun seçim süresinin bitişi; seçimler bu anda açılır. */
  endsAt: number;
  /** Gösterilen turun sonuç ekranının bitişi (son turda oyunun bitişi). */
  revealEndsAt: number;
  /** Gösterilen tur (1 tabanlı) ve toplam tur sayısı. */
  round: number;
  rounds: number;
  /** Gösterilen turun çarpanı. */
  multiplier: { num: number; den: number };
  /** Önceki turlar (açılmış olanlar), eskiden yeniye; 2. turdan itibaren seçim ekranında son eleman gösterilir. */
  previous: OrtalamaRoundSummary[];
  /** Mini puan toplamları (açılmış turlar dahil; gösterilen tur açıldıysa o da dahil). */
  totals: Record<string, number>;
  /** Gösterilen turun süresi dolmadan null. */
  reveal: OrtalamaReveal | null;
  /** Yalnız son turun sonucu açıldığında: genel skora eklenecek puanlar (toplama göre, bir kez). */
  final: Record<string, number> | null;
  /** Seçimini kilitleyenler (yalnız kimler; seçimin kendisi değil). */
  lockedIds: string[];
}

/** Kişiye özel görünüm: yalnız bu turdaki kendi seçimin. */
export interface OrtalamaView {
  /** Henüz seçmediysen ya da izleyiciysen null. */
  myChoice: number | null;
  /** Seçimini kilitledin mi. */
  locked: boolean;
}
