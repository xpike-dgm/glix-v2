/** Sunucunun zaman kaynağı. Üretimde sistem saati; testlerde elle ilerletilen sahte saat. */
export type Cancel = () => void;

export interface Clock {
  now(): number;
  /** `ms` sonra bir kez çalıştırır; dönen işlev zamanlayıcıyı iptal eder. */
  setTimeout(fn: () => void, ms: number): Cancel;
}

export const systemClock: Clock = {
  now: () => Date.now(),
  setTimeout(fn, ms) {
    const handle = setTimeout(fn, ms);
    return () => clearTimeout(handle);
  },
};

export interface ManualClock extends Clock {
  /** Saati `ms` ilerletir; vadesi gelen zamanlayıcıları sırayla (kendi vade anlarında) çalıştırır. */
  advance(ms: number): void;
  pending(): number;
}

export function createManualClock(start = 1_000_000): ManualClock {
  let current = start;
  let seq = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();

  function nextDue(limit: number): [number, { at: number; fn: () => void }] | null {
    let best: [number, { at: number; fn: () => void }] | null = null;
    for (const entry of timers) {
      if (entry[1].at > limit) continue;
      if (!best || entry[1].at < best[1].at || (entry[1].at === best[1].at && entry[0] < best[0]))
        best = entry;
    }
    return best;
  }

  return {
    now: () => current,
    setTimeout(fn, ms) {
      const id = ++seq;
      timers.set(id, { at: current + Math.max(0, ms), fn });
      return () => {
        timers.delete(id);
      };
    },
    advance(ms) {
      const target = current + ms;
      for (let due = nextDue(target); due; due = nextDue(target)) {
        timers.delete(due[0]);
        current = Math.max(current, due[1].at);
        due[1].fn();
      }
      current = target;
    },
    pending: () => timers.size,
  };
}
