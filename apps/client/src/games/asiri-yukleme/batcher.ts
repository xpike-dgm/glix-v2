import { ASIRI_YUKLEME_MAX_BATCH } from "@glix/engine";

/**
 * Hızlı tıklamaları toplu göndermek için sınırlayıcı. Sunucu soket başına 30 ani + saniyede 20 mesaja izin verir
 * (apps/server/src/ratelimit.ts); parmak saniyede 10+ kez dokunabildiği için her dokunuş ayrı mesaj olamaz.
 *
 * - İlk tıklama (boşta iken) hemen gider: gecikme yok.
 * - Sonraki tıklamalar en az `intervalMs` aralıkla, biriken sayı kadar tek mesajla gider (en çok `maxBatch`;
 *   fazlası bir sonraki pencerede). Böylece mesaj hızı ≤ 1000 / intervalMs (varsayılan 12,5/sn < 20/sn).
 */
export interface BatcherDeps {
  send: (count: number) => void;
  now: () => number;
  setTimer: (fn: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
  intervalMs?: number;
  maxBatch?: number;
}

export interface TapBatcher {
  tap(): void;
  /** Bekleyen tıklamaları atar (tur bitti). */
  drop(): void;
  pending(): number;
  dispose(): void;
}

export const TAP_INTERVAL_MS = 80;

export function createTapBatcher(deps: BatcherDeps): TapBatcher {
  const interval = deps.intervalMs ?? TAP_INTERVAL_MS;
  const maxBatch = deps.maxBatch ?? ASIRI_YUKLEME_MAX_BATCH;
  let pending = 0;
  let lastSent = Number.NEGATIVE_INFINITY;
  let timer: unknown = null;

  const flush = (): void => {
    timer = null;
    if (pending <= 0) return;
    const count = Math.min(pending, maxBatch);
    pending -= count;
    lastSent = deps.now();
    deps.send(count);
    if (pending > 0) timer = deps.setTimer(flush, interval);
  };

  return {
    tap(): void {
      pending += 1;
      if (timer !== null) return;
      const wait = lastSent + interval - deps.now();
      if (wait <= 0) flush();
      else timer = deps.setTimer(flush, wait);
    },
    drop(): void {
      pending = 0;
      if (timer !== null) deps.clearTimer(timer);
      timer = null;
    },
    pending: () => pending,
    dispose(): void {
      this.drop();
    },
  };
}
