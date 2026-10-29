/** Sunucu sağlık ölçümleri: son 600 tick süresi ve son 10 sn'lik giden bayt. */
export const TICK_SAMPLES = 600;
export const BYTES_WINDOW_S = 10;

/** Birikimli tick süresi kovalarının üst sınırları (ms); sonuncusu "sonsuz". Yük testi adım başına yüzdelik hesaplar. */
export const TICK_BUCKETS_MS: readonly number[] = [
  0.25, 0.5, 1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64, 100, 150, 250, 500, 1000,
];

export interface TickHistogram {
  /** `TICK_BUCKETS_MS` ile aynı sırada, sondaki "sonsuz" kovası dahil sayaçlar (sunucu açılışından beri). */
  counts: number[];
  /** Açılıştan beri görülen en uzun tick (ms). */
  maxMs: number;
}

export interface Metrics {
  recordTick(ms: number): void;
  /** Açılıştan beri tüm tick'lerin kova sayaçları (sağlık ucunda `?detail=1`). */
  tickHistogram(): TickHistogram;
  /** Son TICK_SAMPLES tick'in %95'lik süresi (ms); örnek yoksa 0. */
  tickMsP95(): number;
  recordBytes(bytes: number, nowMs: number): void;
  /** Son 10 sn'nin ortalama giden bayt/sn değeri. */
  bytesOutPerSec(nowMs: number): number;
}

export function createMetrics(): Metrics {
  const ticks = new Float64Array(TICK_SAMPLES);
  const hist = new Array<number>(TICK_BUCKETS_MS.length + 1).fill(0);
  let maxMs = 0;
  let tickCount = 0;
  let tickPos = 0;
  // Saniye kovaları: kova numarası ile toplam bayt.
  const bucketSec = new Array<number>(BYTES_WINDOW_S).fill(-1);
  const bucketBytes = new Array<number>(BYTES_WINDOW_S).fill(0);

  return {
    recordTick(ms) {
      let b = 0;
      while (b < TICK_BUCKETS_MS.length && ms > (TICK_BUCKETS_MS[b] ?? 0)) b++;
      hist[b] = (hist[b] ?? 0) + 1;
      if (ms > maxMs) maxMs = ms;
      ticks[tickPos] = ms;
      tickPos = (tickPos + 1) % TICK_SAMPLES;
      tickCount = Math.min(tickCount + 1, TICK_SAMPLES);
    },
    tickHistogram() {
      return { counts: [...hist], maxMs };
    },
    tickMsP95() {
      if (tickCount === 0) return 0;
      const sorted = Array.from(ticks.subarray(0, tickCount)).sort((a, b) => a - b);
      const idx = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);
      return sorted[idx] ?? 0;
    },
    recordBytes(bytes, nowMs) {
      const sec = Math.floor(nowMs / 1000);
      const slot = sec % BYTES_WINDOW_S;
      if (bucketSec[slot] !== sec) {
        bucketSec[slot] = sec;
        bucketBytes[slot] = 0;
      }
      bucketBytes[slot] = (bucketBytes[slot] ?? 0) + bytes;
    },
    bytesOutPerSec(nowMs) {
      const sec = Math.floor(nowMs / 1000);
      let total = 0;
      for (let i = 0; i < BYTES_WINDOW_S; i++) {
        const s = bucketSec[i] ?? -1;
        if (s > sec - BYTES_WINDOW_S && s <= sec) total += bucketBytes[i] ?? 0;
      }
      return total / BYTES_WINDOW_S;
    },
  };
}
