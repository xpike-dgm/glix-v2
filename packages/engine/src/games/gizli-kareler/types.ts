/** Gizli Kareler — istemci ile sunucu arasındaki sözleşme. Kurallar: docs/KURALLAR.md §14, docs/A6-OYUNLAR.md. */

/** Her aşamanın seçim süresi (ms). */
export const KARELER_STAGE_MS = 20_000;
/** 1. aşama açıldıktan sonra 2. aşama başlayana kadar sonucun ekranda kaldığı süre (ms). */
export const KARELER_BETWEEN_MS = 4_000;
/** Son sonucun ekranda kaldığı süre (ms); oyun bunun sonunda biter. */
export const KARELER_FINAL_MS = 5_000;
/** En uzun oyun: iki aşama + ara pencere + son sonuç. */
export const KARELER_DURATION_MS =
  KARELER_STAGE_MS + KARELER_BETWEEN_MS + KARELER_STAGE_MS + KARELER_FINAL_MS;

/** 2–4 oyuncuda 3×3, 5–8 oyuncuda 4×4. */
export function kareSize(playerCount: number): 3 | 4 {
  return playerCount <= 4 ? 3 : 4;
}

/** Izgaradaki hücre sayısı. */
export function kareCells(size: number): number {
  return size * size;
}

/** Seçim: hücre numarası, soldan sağa satır satır 0..size²-1. */
export type KarelerAction = { kind: "pick"; cell: number } | { kind: "lock" };

/** Kilitlenen aşamanın bitişine kalan süre (son dokunuşun animasyonu için, ms). */
export const KARELER_LOCK_GRACE_MS = 1_000;

/**
 * Bir oyuncunun aşamadaki durumu:
 * - `solo`: hücrede tek başına (+1, ilk aşamadaysa devam eder)
 * - `clash`: hücreyi başkasıyla paylaştı (elendi, puan yok)
 * - `passive`: seçim yapmadı (puan yok, çakışmaya girmez)
 */
export type KareStatus = "solo" | "clash" | "passive";

/** Bir aşamanın açılmış sonucu (yalnız o aşamaya katılanlar). */
export interface KareReveal {
  /** Katılımcının son seçimi; seçmeyen null. */
  choices: Record<string, number | null>;
  status: Record<string, KareStatus>;
}

export interface KareStage2 {
  startsAt: number;
  endsAt: number;
  /** 2. aşamada seçecek (1. aşamada tek kalan) oyuncular. */
  players: string[];
}

/** Herkese açık görünüm (oda başına bir kez). Seçimler aşama bitene kadar burada yoktur. */
export interface KarelerPublicView {
  size: number;
  startedAt: number;
  /** 1. aşama seçim süresinin bitişi (herkes kilitlediyse erken); seçimler bu anda açılır. */
  endsAt: number;
  /** 1. aşama açılmadan veya oyun 1. aşamada bitiyorsa null. */
  stage2: KareStage2 | null;
  stage1: KareReveal | null;
  stage2Reveal: KareReveal | null;
  /** Oyunun bitişi; 1. aşama açılmadan null. */
  finishesAt: number | null;
  /** 1. aşamadan sonra tek başına kalıp 2. aşamayı rakipsiz sayılan oyuncu (otomatik +1). */
  walkover: string | null;
  /** Şimdiye kadar açılan sonuçlardan kazanılan puanlar (genel skora direkt). 1. aşama açılmadan null. */
  points: Record<string, number> | null;
  /** Şu an seçim yapılan aşamada "Tamam" diyenler (seçimleri gizli kalır); seçim aşaması dışında boş. */
  ready: string[];
}

/** Kişiye özel görünüm: yalnız kendi seçimin (şu an seçim yapılan aşamada). */
export interface KarelerView {
  myChoice: number | null;
  /** Bu aşamada seçimini kilitledin mi. */
  locked: boolean;
}
