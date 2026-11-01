/**
 * Açgözlülük Limiti — istemci ile sunucu arasındaki sözleşme. Kurallar: docs/KURALLAR.md §12 (AL öneri paketi
 * değişikliği dahil: 3 tur, Gözcü, sisli limit, genel skor +2/+1/0).
 */

/** Tur sayısı (AL-M2). */
export const ACGOZLULUK_ROUNDS = 3;
/** Her turun seçim süresi (ms). */
export const ACGOZLULUK_CHOOSE_MS = 12_000;
/** Turlar arasında bir turun açılışının ekranda kaldığı süre (ms). */
export const ACGOZLULUK_ROUND_REVEAL_MS = 5_000;
/** Son turun açılışının (ve genel puanların) ekranda kaldığı süre (ms); ardından ortak "Devam et". */
export const ACGOZLULUK_REVEAL_MS = 7_000;
/** Oyunun tam süresi (ms): 3 × 12 + 2 × 5 + 7 = 53 sn; erken bitişte kısalır. */
export const ACGOZLULUK_DURATION_MS =
  ACGOZLULUK_ROUNDS * ACGOZLULUK_CHOOSE_MS +
  (ACGOZLULUK_ROUNDS - 1) * ACGOZLULUK_ROUND_REVEAL_MS +
  ACGOZLULUK_REVEAL_MS;
/** Gözcü'nün hazneye baktığı an: turun başından bu kadar sonra (AL-M3). */
export const ACGOZLULUK_PEEK_MS = 7_000;

/** Oyuncu sayısına göre ortak limit tablosu (KURALLAR §12, madde 3); sisli limitin (AL-M4) orta değeri. */
export const ACGOZLULUK_LIMITS: Readonly<Record<number, number>> = {
  3: 6,
  4: 11,
  5: 17,
  6: 24,
  7: 33,
  8: 43,
};

/** Ağdan gelen sayıya konan teknik üst sınır (gerçek üst sınır oyuncu sayısıdır). */
export const ACGOZLULUK_WIRE_MAX = 64;

const clampPlayers = (playerCount: number): number => Math.min(8, Math.max(3, Math.trunc(playerCount)));

/** Tablo değeri (bandın ortası). Tablo dışı oyuncu sayısı için en yakın tablo satırı kullanılır. */
export function acgozlulukLimit(playerCount: number): number {
  return ACGOZLULUK_LIMITS[clampPlayers(playerCount)] ?? 6;
}

/** Sisli limitin genişliği (AL-M4): 3–4 oyuncuda ±1, 5–6 oyuncuda ±2, 7–8 oyuncuda ±3. */
export function acgozlulukSpread(playerCount: number): number {
  const n = clampPlayers(playerCount);
  return n <= 4 ? 1 : n <= 6 ? 2 : 3;
}

/** Herkese açık sisli bant: gerçek limit her tur bu aralıktan (uçlar dahil) çekilir. */
export interface AcgozlulukBand {
  low: number;
  high: number;
}

/** Oyuncu sayısının bandı (ör. 5 kişide 15–19, 3 kişide 5–7). Hiçbir zaman 1…N² dışına çıkmaz. */
export function acgozlulukBand(playerCount: number): AcgozlulukBand {
  const n = clampPlayers(playerCount);
  const mid = acgozlulukLimit(n);
  const s = acgozlulukSpread(n);
  return { low: Math.max(1, mid - s), high: Math.min(n * n, mid + s) };
}

/** Adil pay (AL-U2): ⌊bandın orta değeri ÷ N⌋ (3→2, 4→2, 5→3, 6→4, 7→4, 8→5). */
export function acgozlulukFairShare(playerCount: number): number {
  const n = clampPlayers(playerCount);
  return Math.floor(acgozlulukLimit(n) / n);
}

/** Gözcü'nün tek kelimesi (AL-M3). */
export type AcgozlulukScoutWord = "rahat" | "sinirda" | "tasiyor";

/**
 * Gözcü kelimesi: toplam ≤ limitin %70'i → RAHAT; %70'ten büyük ve ≤ limit → SINIRDA; limitten büyük → TAŞIYOR.
 * Tam sayı aritmetiğiyle (10 × toplam ≤ 7 × limit).
 */
export function acgozlulukScoutWord(total: number, limit: number): AcgozlulukScoutWord {
  if (total > limit) return "tasiyor";
  return total * 10 <= limit * 7 ? "rahat" : "sinirda";
}

/** Kilit ("Tamam"): seçim kesinleşir; bağlı herkes kilitlerse o turun seçimi 1 sn sonra biter. */
export type AcgozlulukAction = { kind: "choose"; value: number } | { kind: "lock" };

/** Son kilitten sonra seçimlerin açılmasına kalan süre (ms). */
export const ACGOZLULUK_LOCK_GRACE_MS = 1_000;

/** Bir turun süresi dolunca herkese açılan sonuç. */
export interface AcgozlulukReveal {
  /** Her katılımcının seçimi (seçmeyen 0). */
  choices: Record<string, number>;
  /** Bu turda hiç seçim göndermeyenler (0 sayıldılar; AL-U13 "seçmedi"). */
  missing: string[];
  total: number;
  /** Bu turun gerçek limiti (sisin içinden çıkan; AL-M4). */
  limit: number;
  over: boolean;
  /** Bu turdan kazanılan mini puan: taşmadıysa seçilen sayı, taştıysa herkese 0. */
  points: Record<string, number>;
  /** Dolum sırası (AL-U6): 0'dan büyük seçenler küçükten büyüğe; eşit sayılarda katılım sırası. */
  order: string[];
  /**
   * "Taşıran"lar (AL-U6; yalnız gösteri, ceza yok): dolum sırasında toplamı limitin üstüne çıkaran ilk şerit ve ondan
   * sonrakiler; o şeritle aynı sayıyı seçen herkes de dahil. Taşmadıysa boş.
   */
  spillers: string[];
}

/** Açılmış bir turun kaydı (kasa defteri, AL-U3). */
export interface AcgozlulukRoundRecord {
  /** O turun Gözcü'sü (kim olduğu herkese açıktır; gördüğü kelime değil). */
  scoutId: string | null;
  reveal: AcgozlulukReveal;
}

/** Herkese açık görünüm (oda başına bir kez). Seçimler, toplam ve gerçek limit tur açılana kadar burada yoktur. */
export interface AcgozlulukPublicView {
  /** Oyunun başlangıcı. */
  startedAt: number;
  /** Gösterilen turun seçim başlangıcı. */
  roundStartedAt: number;
  /** Gösterilen turun seçim süresinin bitişi; seçimler bu anda açılır. */
  endsAt: number;
  /** Gösterilen turun açılışının bitişi (son turda oyunun bitişi). */
  revealEndsAt: number;
  /** Gösterilen tur (1 tabanlı) ve toplam tur. */
  round: number;
  rounds: number;
  /** Sisli limit bandı (herkese aynı; AL-M4). */
  band: AcgozlulukBand;
  /** Seçilebilecek en büyük sayı (= oyuncu sayısı). */
  maxChoice: number;
  /** Bu turun Gözcü'sü (herkese açık); yoksa null. */
  scoutId: string | null;
  /** Gözcü'nün baktığı an (yalnız an; gördüğü kelime yalnız onun `view`'ındadır). */
  scoutPeekedAt: number | null;
  /** Açılmış önceki turlar, eskiden yeniye. */
  history: AcgozlulukRoundRecord[];
  /** Mini puan toplamları (açılmış turlar; gösterilen tur açıldıysa o da dahil). */
  totals: Record<string, number>;
  /** Gösterilen turun süresi dolmadan null. */
  reveal: AcgozlulukReveal | null;
  /** Yalnız son turun sonucu açıldığında: genel skora eklenecek puanlar (+2 / +1 / 0). */
  final: Record<string, number> | null;
  /** Bu turda seçimini kilitleyenler (yalnız kimler; seçimin kendisi değil). */
  lockedIds: string[];
}

/** Gözcü'nün gördüğü (yalnız Gözcü'nün kendi görünümünde). */
export interface AcgozlulukScoutPeek {
  word: AcgozlulukScoutWord;
  /** Baktığı an. */
  at: number;
}

/** Kişiye özel görünüm: bu turdaki kendi seçimin ve Gözcü'ysen gördüğün. */
export interface AcgozlulukView {
  /** Henüz seçmediysen ya da izleyiciysen null (seçilmemiş 0 sayılır). */
  myChoice: number | null;
  /** Seçimini kilitledin mi. */
  locked: boolean;
  /** Bu tur Gözcü sensen ve baktıysan kelimen; değilse null. */
  scout: AcgozlulukScoutPeek | null;
}
