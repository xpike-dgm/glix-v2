import { createEffect, createSignal, on, onCleanup } from "solid-js";

/** Konum oranından (0..1) en yakın tam sayı. */
export function valueFromRatio(ratio: number, min: number, max: number): number {
  const r = Number.isFinite(ratio) ? Math.min(1, Math.max(0, ratio)) : 0;
  return Math.round(min + r * (max - min));
}

/** Değerin sayı doğrusundaki konumu (0..1). */
export function ratioOfValue(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

/** `delta` kadar adım; sınırda durur. Henüz değer yoksa `startAt`'tan başlar. */
export function stepValue(
  value: number | null,
  delta: number,
  min: number,
  max: number,
  startAt: number,
): number {
  const base = value ?? startAt;
  return Math.min(max, Math.max(min, Math.round(base + delta)));
}

/** Sunucuya art arda gidecek seçimler arasındaki en kısa süre (ms); genel mesaj sınırının çok altında. */
export const SEND_GAP_MS = 140;

/**
 * Seçimleri sunucuya sıklığı sınırlı gönderir: sürüklerken en çok ~7/sn (sondaki değer her zaman gider),
 * parmak kalkınca hemen. Aynı değer iki kez gitmez.
 */
export class ChoiceSender {
  private lastSent: number | null = null;
  private lastSentAt = Number.NEGATIVE_INFINITY;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private pending: number | null = null;
  /** Parmak hâlâ değer değiştiriyor: sunucudan dönen eski değer yerel değeri ezmemeli. */
  busy = false;

  constructor(
    private readonly send: (value: number) => void,
    private readonly now: () => number = Date.now,
  ) {}

  set(value: number, final: boolean): void {
    this.pending = value;
    this.busy = !final;
    if (final) {
      this.flush();
      return;
    }
    if (this.timer !== undefined) return;
    const wait = Math.max(0, SEND_GAP_MS - (this.now() - this.lastSentAt));
    this.timer = setTimeout(() => this.flush(), wait);
  }

  /** Sunucu bu değeri onayladı/bildirdi. */
  acknowledge(value: number): void {
    this.lastSent = value;
  }

  /** Sunucudan gelen değer yerel değeri güncelleyebilir mi (bekleyen yerel değişiklik yok)? */
  get idle(): boolean {
    return !this.busy && this.timer === undefined;
  }

  flush(): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    const v = this.pending;
    this.pending = null;
    if (v === null || v === this.lastSent) return;
    this.lastSent = v;
    this.lastSentAt = this.now();
    this.send(v);
  }

  dispose(): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
  }
}

interface SyncOptions {
  /** Sunucunun bildiği seçim (kendi `view`'ından). */
  serverValue: () => number | null | undefined;
  send: (value: number) => void;
  /** Süre doldu ya da izleyici: değişiklik gönderilmez. */
  closed: () => boolean;
}

/** Sayı seçicinin yerel değeri: dokunuşa anında yanıt verir, sunucuya `ChoiceSender` ile gönderir. */
export function createChoiceSync(opts: SyncOptions) {
  const [local, setLocal] = createSignal<number | null>(null);
  const sender = new ChoiceSender((v) => {
    if (!opts.closed()) opts.send(v);
  });
  const set = (value: number, final: boolean): void => {
    if (opts.closed()) return;
    setLocal(value);
    sender.set(value, final);
  };
  createEffect(
    on(
      () => opts.serverValue(),
      (server) => {
        if (server === undefined || server === null) return;
        sender.acknowledge(server);
        if (sender.idle) setLocal(server);
      },
    ),
  );
  onCleanup(() => sender.dispose());
  return { value: local, set };
}
