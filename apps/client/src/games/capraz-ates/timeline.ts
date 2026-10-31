import { CAPRAZ_ATES_INTERVAL_MS, CAPRAZ_ATES_REVEAL_MS } from "@glix/engine";

/**
 * Final açılışının zaman çizelgesi (tek yer; açılış başından, yani tur 2'nin hedeflerinin açıldığı andan ms).
 * Açılışın tamamı `CAPRAZ_ATES_REVEAL_MS` (8 sn) içine sığar; oyun o sürenin sonunda sonuç ekranına geçer.
 */
export const FINAL_TIMELINE = {
  /** Halkanın tam ekrana büyümesi. */
  growMs: 500,
  /** Sessizlikten sonra bütün namluların aynı anda ateş aldığı an. */
  muzzleAt: 1_000,
  /** Mermilerin ağır çekim uçuşu. */
  flightMs: 2_000,
  /** Mermilerin hedefe (ya da ortaya, kalkana) vardığı an. */
  impactAt: 3_000,
  /** Oyuncuların yanında tur puanı rozetleri. */
  chipsAt: 3_300,
  /** Kendi sonucun (başlıkta). */
  verdictAt: 3_600,
  /** "Seni vuranlar: …" satırı. */
  shootersAt: 4_300,
  /** "En çok hedeflenen: …" özeti. */
  summaryAt: 4_900,
  /** Rozetler iki turun toplamına döner; kendi toplamın görünür. */
  totalAt: 5_600,
  /** Açılışın bittiği an (oyun bu anda biter). */
  endMs: CAPRAZ_ATES_REVEAL_MS,
} as const;

/** Tur 1'in kısa açılışı (açılış başından ms); `CAPRAZ_ATES_INTERVAL_MS` (5 sn) içine sığar. */
export const INTERVAL_TIMELINE = {
  growMs: 300,
  muzzleAt: 150,
  flightMs: 650,
  impactAt: 800,
  chipsAt: 950,
  verdictAt: 1_100,
  /** "Tur 2 başlıyor" geri sayımı. */
  nextAt: 2_400,
  endMs: CAPRAZ_ATES_INTERVAL_MS,
} as const;

export type RevealTimeline = {
  growMs: number;
  muzzleAt: number;
  flightMs: number;
  impactAt: number;
  chipsAt: number;
  verdictAt: number;
  endMs: number;
};

/** Her turun son 5 saniyesi: düello anı (karartma, ıslık); son 3 saniyede büyük sayılar. */
export const DUEL = {
  /** Düello anının başladığı kalan süre. */
  startMs: 5_000,
  /** "3 · 2 · 1" sayılarının başladığı kalan süre. */
  countFromMs: 3_000,
  /** "ATEŞ!" yazısı ve flaşın ekranda kalma süresi (açılışın başında). */
  fireMs: 750,
} as const;

/** Düello anında ekranda yazacak olan: null (düello yok), "3" | "2" | "1" ya da "" (yalnız karartma). */
export function duelLabel(remainingMs: number): string | null {
  if (remainingMs <= 0 || remainingMs > DUEL.startMs) return null;
  if (remainingMs > DUEL.countFromMs) return "";
  return String(Math.ceil(remainingMs / 1_000));
}
