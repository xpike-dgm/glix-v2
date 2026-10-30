/**
 * Oyuncunun KENDİ dokunma hızı: vınlama sesi, titreşim gücü ve "ritim" efekti buna bakar. Barın doluluğunu hiçbir
 * biçimde yansıtmaz (bar zaten istemcide bilinmez). Saf; zaman dışarıdan verilir.
 */

/** Seri: art arda iki dokunuş arası en çok bu kadar (ms) olursa seri sürer. */
export const STREAK_GAP_MS = 230;
/** Hız penceresi (ms): son bu kadar sürede kaç dokunuş. */
export const RATE_WINDOW_MS = 1_000;
/** Seride her bu kadar dokunuşta bir küçük "ritim" efekti. */
export const RHYTHM_EVERY = 8;

export interface TapPulse {
  /** Son 1 sn'deki dokunuş sayısı (bu dokunuş dahil). */
  rate: number;
  /** Seri uzunluğu (bu dokunuş dahil; seri yoksa 1). */
  streak: number;
  /** Bu dokunuş bir ritim vuruşu mu. */
  rhythm: boolean;
}

export interface TapRhythm {
  push(now: number): TapPulse;
  reset(): void;
}

export function createTapRhythm(): TapRhythm {
  let times: number[] = [];
  let last = Number.NEGATIVE_INFINITY;
  let streak = 0;
  return {
    push(now) {
      streak = now - last <= STREAK_GAP_MS ? streak + 1 : 1;
      last = now;
      times.push(now);
      const from = now - RATE_WINDOW_MS;
      if ((times[0] ?? now) <= from) times = times.filter((t) => t > from);
      return { rate: times.length, streak, rhythm: streak >= RHYTHM_EVERY && streak % RHYTHM_EVERY === 0 };
    },
    reset() {
      times = [];
      last = Number.NEGATIVE_INFINITY;
      streak = 0;
    },
  };
}

/** Vınlamanın perdesi (Hz): hızlandıkça incelir (yükselir); saniyede 14 dokunuşta tavan. */
export function humPitch(rate: number): number {
  const r = Math.max(0, Math.min(14, rate));
  return Math.round(70 + r * 22);
}

/** Vınlamanın gücü (0..0.05): tek dokunuşta fısıltı, hızlandıkça belirgin. */
export function humLevel(rate: number): number {
  const r = Math.max(0, Math.min(14, rate));
  return r <= 0 ? 0 : Math.min(0.05, 0.01 + r * 0.003);
}

/** Titreşim süresi (ms): yavaş basışta yumuşak, seride daha sert; ritim vuruşunda en serti. */
export function hapticMs(pulse: TapPulse): number {
  if (pulse.rhythm) return 28;
  if (pulse.streak >= 3) return 16;
  return 7;
}
