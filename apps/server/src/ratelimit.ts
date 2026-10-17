import type { Clock } from "./clock.js";

/** Belirteç kovası: `capacity` kadar ani, saniyede `refillPerSecond` kadar sürekli mesaj. */
export class TokenBucket {
  private tokens: number;
  private last: number;

  constructor(
    private readonly clock: Clock,
    private readonly capacity = 30,
    private readonly refillPerSecond = 20,
  ) {
    this.tokens = capacity;
    this.last = clock.now();
  }

  take(): boolean {
    const now = this.clock.now();
    const elapsed = Math.max(0, now - this.last);
    this.last = now;
    this.tokens = Math.min(this.capacity, this.tokens + (elapsed / 1000) * this.refillPerSecond);
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}
