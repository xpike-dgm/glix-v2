import { type Accessor, createEffect, createSignal, onCleanup } from "solid-js";
import { hapticError } from "../fx/haptics.js";
import { fail } from "../fx/sound.js";
import type { ActionAck } from "../net/client.js";

/** Yerel değer sunucu görünümüyle eşleşmezse bile en geç bu kadar sonra sunucudaki değere dönülür. */
export const OPTIMISTIC_TIMEOUT_MS = 3500;
/** Sunucu "tamam" dedikten sonra görünüm hâlâ eşleşmediyse (ör. değer düzeltildi) yerel değer bu kadar sonra bırakılır. */
export const OPTIMISTIC_GRACE_MS = 1200;

/** Eylem çağrısının sonucunu yanıta çevirir: `sendActionAck` olduğu gibi, `false` red, diğerleri tamam. */
export type AckLike = Promise<ActionAck> | boolean | undefined;

export function toAck(r: AckLike): Promise<ActionAck> {
  if (r instanceof Promise) return r;
  return Promise.resolve(r === false ? { ok: false, reason: "local" } : { ok: true });
}

export interface OptimisticCoreOptions<T> {
  equals?: (a: T, b: T) => boolean;
  timeoutMs?: number;
  graceMs?: number;
  /** Görünen değer değişti (arayüzü yenile). */
  onChange: () => void;
  /** Sunucu eylemi açıkça reddetti ya da gönderilemedi: yerel değer geri alındı. */
  onReject: (reason: string | undefined) => void;
}

/**
 * Çatıdan bağımsız çekirdek (test edilebilir): yerel değeri tutar; sunucu görünümü eşleşince,
 * eylem reddedilince ya da süre dolunca bırakır. Yalnızca oyuncunun kendi seçimini yansıtır.
 */
export class OptimisticCore<T> {
  private local: { v: T } | null = null;
  private token = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private server: T;
  private readonly equals: (a: T, b: T) => boolean;
  private readonly timeoutMs: number;
  private readonly graceMs: number;

  constructor(
    initial: T,
    private readonly opts: OptimisticCoreOptions<T>,
  ) {
    this.server = initial;
    this.equals = opts.equals ?? Object.is;
    this.timeoutMs = opts.timeoutMs ?? OPTIMISTIC_TIMEOUT_MS;
    this.graceMs = opts.graceMs ?? OPTIMISTIC_GRACE_MS;
  }

  /** Şu an gösterilecek değer. */
  get(): T {
    return this.local ? this.local.v : this.server;
  }

  /** Bekleyen yerel değer var mı. */
  get pending(): boolean {
    return this.local !== null;
  }

  /** Sunucu görünümü değişti. */
  sync(server: T): void {
    this.server = server;
    if (this.local && this.equals(this.local.v, server)) this.drop();
    else this.opts.onChange();
  }

  /** Yerel değeri hemen göster ve eylemi gönder. */
  set(v: T, send: () => Promise<ActionAck>): void {
    const mine = ++this.token;
    this.local = { v };
    this.arm(this.timeoutMs, mine);
    this.opts.onChange();
    send().then(
      (ack) => this.settle(mine, ack),
      () => this.settle(mine, { ok: false, reason: "offline" }),
    );
  }

  /** Bekleyen yerel değeri bırak (ör. tur değişti). */
  reset(): void {
    this.token++;
    this.drop();
  }

  dispose(): void {
    this.token++;
    clearTimeout(this.timer);
    this.timer = undefined;
    this.local = null;
  }

  private settle(mine: number, ack: ActionAck): void {
    if (mine !== this.token || !this.local) return;
    if (ack.ok) {
      if (this.equals(this.local.v, this.server)) this.drop();
      else this.arm(this.graceMs, mine);
      return;
    }
    this.drop();
    // Yanıt hiç gelmediyse eylem yine de işlenmiş olabilir: sessizce sunucudaki değere dönülür.
    if (ack.reason !== "timeout") this.opts.onReject(ack.reason);
  }

  private arm(ms: number, mine: number): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      if (mine === this.token) this.drop();
    }, ms);
  }

  private drop(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.local = null;
    this.opts.onChange();
  }
}

export interface OptimisticOptions<T> {
  equals?: (a: T, b: T) => boolean;
  timeoutMs?: number;
  graceMs?: number;
  /** Reddedilince çalışır (varsayılan: hata sesi + hafif titreşim). */
  onReject?: (reason: string | undefined) => void;
}

/**
 * `[değer, ayarla]`: `ayarla(v, gönder)` değeri anında gösterir ve `gönder()` ile (genelde `sendActionAck`)
 * sunucuya iletir. Sunucu görünümü eşleşene, eylem reddedilene ya da süre dolana dek yerel değer görünür;
 * reddedilirse eski değere döner ve hafif hata titreşimi verir.
 */
export function createOptimistic<T>(
  server: Accessor<T>,
  options: OptimisticOptions<T> = {},
): [Accessor<T>, (v: T, send: () => Promise<ActionAck>) => void, () => void] {
  const [version, setVersion] = createSignal(0);
  const core = new OptimisticCore<T>(server(), {
    ...(options.equals ? { equals: options.equals } : {}),
    ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
    ...(options.graceMs !== undefined ? { graceMs: options.graceMs } : {}),
    onChange: () => setVersion((n) => n + 1),
    onReject:
      options.onReject ??
      (() => {
        fail();
        hapticError();
      }),
  });
  createEffect(() => core.sync(server()));
  onCleanup(() => core.dispose());
  const value: Accessor<T> = () => {
    version();
    return core.get();
  };
  return [value, (v, send) => core.set(v, send), () => core.reset()];
}
