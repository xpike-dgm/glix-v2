/** Sessiz Sıra (TASLAK) — istemci ile sunucu arasındaki sözleşme. Kurallar: docs/TASLAK-OYUNLAR.md §3. */

export const SESSIZ_ROUNDS = 3;
/** Tur başına oyuncu başına dağıtılan kart sayısı. */
export const SESSIZ_CARDS: readonly number[] = [1, 2, 2];
export const SESSIZ_LIVES = 3;
export const SESSIZ_MAX_CARD = 99;
/** Kartlara bakma, oynama (üst sınır) ve sonuç süreleri (ms). */
export const SESSIZ_LOOK_MS = 3_000;
export const SESSIZ_PLAY_MS: readonly number[] = [18_000, 22_000, 22_000];
export const SESSIZ_REVEAL_MS = 3_000;
export const SESSIZ_LAST_REVEAL_MS = 5_000;
/** Son kart oynanınca (ya da canlar bitince) turun kapanmasına kalan süre (ms). */
export const SESSIZ_END_GRACE_MS = 1_000;
export const SESSIZ_DURATION_MS = SESSIZ_PLAY_MS.reduce(
  (sum, play, r) =>
    sum + SESSIZ_LOOK_MS + play + (r === SESSIZ_ROUNDS - 1 ? SESSIZ_LAST_REVEAL_MS : SESSIZ_REVEAL_MS),
  0,
);

export type SessizAction = { kind: "play" };

/** Oynanan bir kart: doğruysa (kendisinden küçük kart kalmamışsa) `ok`. */
export interface SessizPlay {
  playerId: string;
  card: number;
  ok: boolean;
}

/** Hatalı hamle ya da süre dolması yüzünden açılıp atılan kart. */
export interface SessizMissed {
  playerId: string;
  card: number;
}

export interface SessizPublicView {
  startedAt: number;
  round: number;
  rounds: number;
  phase: "look" | "play" | "reveal";
  phaseStartedAt: number;
  phaseEndsAt: number;
  lives: number;
  maxLives: number;
  /** Oyuncu başına elinde kalan kart sayısı (değerleri değil). */
  counts: Record<string, number>;
  /** Bu turda oynananlar (sırayla) ve açılıp atılan kartlar. */
  plays: SessizPlay[];
  missed: SessizMissed[];
  /** Mini puan: doğru hamle +1, hatalı hamle −1. */
  totals: Record<string, number>;
  /** Canlar bitti: oyun erken kapandı, genel skora puan yok. */
  dead: boolean;
  /** Yalnız oyunun son sonuç aşamasında: genel skora eklenecek puanlar. */
  final: Record<string, number> | null;
}

export interface SessizView {
  /** Elinde kalan kartlar (küçükten büyüğe). Yalnız sahibine gider. */
  hand: number[];
}
