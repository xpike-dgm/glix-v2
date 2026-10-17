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

  private refill(): void {
    const now = this.clock.now();
    const elapsed = Math.max(0, now - this.last);
    this.last = now;
    this.tokens = Math.min(this.capacity, this.tokens + (elapsed / 1000) * this.refillPerSecond);
  }

  /** Belirteç harcamadan en az biri var mı. */
  available(): boolean {
    this.refill();
    return this.tokens >= 1;
  }

  /** Dolu kova: hiç harcanmamış gibi; kayıt silinebilir. */
  isFull(): boolean {
    this.refill();
    return this.tokens >= this.capacity;
  }

  take(): boolean {
    this.refill();
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}

/** IP başına kovalar: oda kurma ve başarısız katılma. Bağlantı kopsa da sınır korunur. */
export class IpLimiter {
  private readonly entries = new Map<string, { create: TokenBucket; joinFail: TokenBucket }>();
  private readonly reports = new Map<string, TokenBucket>();

  constructor(
    private readonly clock: Clock,
    private readonly createBurst = 10,
  ) {}

  private entry(ip: string): { create: TokenBucket; joinFail: TokenBucket } {
    let e = this.entries.get(ip);
    if (!e) {
      // Oda kurma: `createBurst` ani (varsayılan 10), 6 sn'de 1. Başarısız katılma: 20 ani, 3 sn'de 1.
      e = {
        create: new TokenBucket(this.clock, this.createBurst, 1 / 6),
        joinFail: new TokenBucket(this.clock, 20, 1 / 3),
      };
      this.entries.set(ip, e);
    }
    return e;
  }

  takeCreate(ip: string): boolean {
    return this.entry(ip).create.take();
  }

  /** Katılma denemesine izin var mı (belirteç harcamaz). */
  canTryJoin(ip: string): boolean {
    return this.entry(ip).joinFail.available();
  }

  recordFailedJoin(ip: string): void {
    this.entry(ip).joinFail.take();
  }

  /** İstemci hata bildirimi: IP başına dakikada `perMinute`. */
  takeReport(ip: string, perMinute = 10): boolean {
    let b = this.reports.get(ip);
    if (!b) {
      b = new TokenBucket(this.clock, perMinute, perMinute / 60);
      this.reports.set(ip, b);
    }
    return b.take();
  }

  /** Tamamen dolmuş (boşta) kayıtları siler; bellek sınırlı kalır. */
  prune(): void {
    for (const [ip, e] of this.entries) if (e.create.isFull() && e.joinFail.isFull()) this.entries.delete(ip);
    for (const [ip, b] of this.reports) if (b.isFull()) this.reports.delete(ip);
  }

  size(): number {
    return this.entries.size;
  }
}
