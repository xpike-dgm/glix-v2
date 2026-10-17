export const CLOCK_SAMPLES = 5;

/** Sunucu saati − istemci saati; gidiş-dönüşün ortasında örneklenmiş sayılır. */
export function offsetFromPong(sentAt: number, receivedAt: number, serverTime: number): number {
  return serverTime - (sentAt + receivedAt) / 2;
}

export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  const hi = s[mid] ?? 0;
  return s.length % 2 === 1 ? hi : ((s[mid - 1] ?? hi) + hi) / 2;
}

/** Son `max` örneği tutar. */
export function pushSample(samples: readonly number[], sample: number, max = CLOCK_SAMPLES): number[] {
  return [...samples, sample].slice(-max);
}
